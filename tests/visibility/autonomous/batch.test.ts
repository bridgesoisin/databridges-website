import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runBatch } from "../../../scripts/visibility/batch";
import { AgentFailure } from "../../../scripts/visibility/agents";
import { freshDatabase, loadDatabase } from "@/lib/visibility/autonomous/store";
import { tipChoices, assess } from "@/lib/visibility/autonomous/assessment";
import { LIMITS } from "@/lib/visibility/autonomous/policy";
import { runScan } from "@/lib/visibility/scan";
import { createSiteFetcher, loadFixture, type FixtureResource, type FixtureSite } from "../helpers/fixture-fetcher";

const owned: string[] = [];
async function directory() { const root = await fs.mkdtemp(path.join(os.tmpdir(), "visibility-batch-test-")); owned.push(root); return root; }
afterEach(async () => { for (const root of owned.splice(0)) await fs.rm(root, { recursive: true, force: true }); });
async function companySnapshot() {
  const f = loadFixture("fx-strong");
  const resources: Record<string, FixtureResource> = {};
  for (const [url, original] of Object.entries(f.site.resources)) {
    const row: FixtureResource = structuredClone(original);
    if (row.bodyFile) {
      row.inlineBody = (await fs.readFile(path.join(f.dir, row.bodyFile), "utf8")).replaceAll("fixture.example", "example.ie");
      delete row.bodyFile;
    }
    if (row.headers?.location) row.headers.location = row.headers.location.replaceAll("fixture.example", "example.ie");
    resources[url.replaceAll("fixture.example", "example.ie")] = row;
  }
  const site: FixtureSite = { ...f.site, inputUrl: "https://example.ie/", resources };
  const snapshot = await runScan(site.inputUrl, createSiteFetcher(site), { now: new Date(site.scannedAt), scannerVersion: "test" });
  snapshot.pages[0].record.body += "<footer>Example Limited. PRIVATE_PERSON private@example.ie 0851234567</footer>";
  return snapshot;
}

describe("unattended resumable batch (offline agents and scanner)", () => {
  it("discovers, scans and reviews with both providers; persists no personal values", async () => {
    const root = await directory(); const snapshot = await companySnapshot(); const db = freshDatabase(1);
    const a = assess(snapshot); const choices = tipChoices(a);
    const invoke = vi.fn(async (_provider, role) => role === "discover" ? { candidates: [
      { homeUrl: snapshot.homeUrl, sourceUrl: "https://trade.example/person/PRIVATE_PERSON", country: "IE", sector: "professional-services", companyOnly: true } ] } :
      { verdict: "CONFIRMED", strengthMetricId: choices.strengths[0] ?? null, improvementMetricId: choices.improvements[0] ?? null });
    await runBatch(db, root, { invoke, scan: async () => snapshot });
    expect(db.state).toBe("COMPLETE");
    expect(invoke.mock.calls.map(c => c[0])).toEqual(["codex", "codex", "claude"]);
    expect(db.agentCalls).toBe(3);
    const saved = await fs.readFile(path.join(root, "database.json"), "utf8");
    for (const secret of ["PRIVATE_PERSON", "private@example.ie", "0851234567", "<footer>"]) expect(saved).not.toContain(secret);
    const resumed = await loadDatabase(root); const noScan = vi.fn();
    await runBatch(resumed, root, { invoke, scan: noScan });
    expect(noScan).not.toHaveBeenCalled();
  });
  it("saves a rate-limit pause and retries without asking for input", async () => {
    const root = await directory(); const snapshot = await companySnapshot(); const db = freshDatabase(1);
    const choices = tipChoices(assess(snapshot)); let clock = 0; let rateLimited = true;
    const invoke = vi.fn(async (_provider, role) => {
      if (rateLimited) { rateLimited = false; throw new AgentFailure("RATE_LIMIT"); }
      return role === "discover" ? { candidates: [{ homeUrl: snapshot.homeUrl, sourceUrl: "https://trade.example/", country: "IE", sector: "professional-services", companyOnly: true }] } :
        { verdict: "CONFIRMED", strengthMetricId: choices.strengths[0] ?? null, improvementMetricId: choices.improvements[0] ?? null };
    });
    await runBatch(db, root, { invoke, scan: async () => snapshot, now: () => clock, sleep: async ms => { clock += ms; } });
    expect(clock).toBe(LIMITS.rateLimitBackoffMs);
    expect(db.state).toBe("COMPLETE"); expect(db.agentCalls).toBe(4);
  });
  it("stops on authentication failure rather than using a paid fallback", async () => {
    const root = await directory(); const db = freshDatabase();
    await runBatch(db, root, { invoke: async () => { throw new AgentFailure("AUTH"); } });
    expect(db.state).toBe("AUTH_REQUIRED"); expect(db.agentCalls).toBe(1);
  });
  it("honours a stop request before a call and persists progress", async () => {
    const root = await directory(); const db = freshDatabase(); const invoke = vi.fn();
    await runBatch(db, root, { invoke, stopped: async () => true });
    expect(db.state).toBe("PAUSED"); expect(invoke).not.toHaveBeenCalled();
  });
  it("does not loop forever when discovery finds no eligible sites", async () => {
    const root = await directory(); const db = freshDatabase();
    await runBatch(db, root, { invoke: async () => ({ candidates: [] }) });
    expect(db.state).toBe("EXHAUSTED"); expect(db.discoveryRounds).toBe(LIMITS.maxDiscoveryRounds);
  });
  it("never retries a robots-blocked site or tries to work around it", async () => {
    const root = await directory(); const db = freshDatabase(1); const snapshot = await companySnapshot();
    snapshot.outcome = "BLOCKED_BY_ROBOTS";
    const scan = vi.fn(async () => snapshot);
    await runBatch(db, root, { scan, invoke: async () => ({ candidates: [{ homeUrl: snapshot.homeUrl,
      sourceUrl: "https://trade.example/", country: "IE", sector: "professional-services", companyOnly: true }] }) });
    expect(scan).toHaveBeenCalledTimes(1);
    expect(db.entries[0].status).toBe("SKIPPED");
    expect(db.entries[0].reason).toBe("ROBOTS_BLOCKED");
    expect(db.entries[0].assessment).toBeUndefined();
  });
  it("stops at the persisted call budget after a restart", async () => {
    const root = await directory(); const db = freshDatabase(); const invoke = vi.fn();
    db.agentCalls = LIMITS.maxAgentCalls;
    await runBatch(db, root, { invoke });
    expect(db.state).toBe("LIMIT_REACHED"); expect(invoke).not.toHaveBeenCalled();
  });
});
