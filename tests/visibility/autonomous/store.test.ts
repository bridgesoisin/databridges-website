import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { acquireLock, atomicJson, freshDatabase, loadDatabase, ranking, saveDatabase, unlockStale } from "@/lib/visibility/autonomous/store";
import { admitCandidates } from "@/lib/visibility/autonomous/policy";
import { tipChoices } from "@/lib/visibility/autonomous/assessment";
import { idealAssessment } from "../helpers/ideal-assessment";

const owned: string[] = [];
async function directory() { const root = await fs.mkdtemp(path.join(os.tmpdir(), "visibility-store-test-")); owned.push(root); return root; }
afterEach(async () => { vi.restoreAllMocks(); for (const root of owned.splice(0)) await fs.rm(root, { recursive: true, force: true }); });

describe("private checkpoint and draft ranking", () => {
  it("retries a transient Windows lock without deleting the previous checkpoint", async () => {
    const root = await directory(); const filename = path.join(root, "checkpoint.json");
    await atomicJson(filename, { generation: 1 });
    const original = fs.rename;
    let attempts = 0;
    const spy = vi.spyOn(fs, "rename").mockImplementation(async (from, to) => {
      attempts += 1;
      if (attempts === 1) {
        expect(JSON.parse(await fs.readFile(filename, "utf8"))).toEqual({ generation: 1 });
        throw Object.assign(new Error("temporary lock"), { code: "EPERM" });
      }
      await original(from, to);
    });
    await atomicJson(filename, { generation: 2 });
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(JSON.parse(await fs.readFile(filename, "utf8"))).toEqual({ generation: 2 });
  });
  it("round-trips a checkpoint and does not overwrite its target", async () => {
    const root = await directory(); const db = freshDatabase(3);
    await saveDatabase(root, db);
    expect(await loadDatabase(root, 3)).toEqual(db);
    await expect(loadDatabase(root, 4)).rejects.toThrow("TARGET_DIFFERS");
  });
  it("rejects a poisoned queued URL before it could be fetched", async () => {
    const root = await directory(); const db = freshDatabase();
    const c = admitCandidates({ candidates: [{ homeUrl: "https://example.ie/", sourceUrl: "https://trade.example/", country: "IE", sector: "professional-services", companyOnly: true }] }, "codex")[0];
    db.entries.push({ ...c, homeUrl: "http://127.0.0.1/", status: "PENDING", scanAttempts: 0, reviewAttempts: {}, reviews: {} });
    await atomicJson(path.join(root, "database.json"), db);
    await expect(loadDatabase(root)).rejects.toThrow("INVALID_ENTRY");
  });
  it("refuses a second writer and refuses unlocking a live process", async () => {
    const root = await directory(); const release = await acquireLock(root);
    await expect(acquireLock(root)).rejects.toThrow("BATCH_LOCKED");
    await expect(unlockStale(root)).rejects.toThrow("RUNNER_STILL_ACTIVE");
    await release(); const second = await acquireLock(root); await second();
  });
  it("uses shared ties and contains only fixed tips/root URLs", () => {
    const db = freshDatabase(); const a = idealAssessment();
    const review = { verdict: "CONFIRMED" as const, strengthMetricId: tipChoices(a).strengths[0], improvementMetricId: null };
    for (const homeUrl of ["https://one.ie/", "https://two.ie/"]) {
      const c = admitCandidates({ candidates: [{ homeUrl, sourceUrl: "https://trade.example/", country: "IE", sector: "professional-services", companyOnly: true }] }, "claude")[0];
      db.entries.push({ ...c, status: "ASSESSED", scanAttempts: 1, reviewAttempts: { codex: 1, claude: 1 }, reviews: { codex: review, claude: review }, assessment: a });
    }
    const output = ranking(db);
    expect(output.publicationStatus).toBe("REQUIRES_APPROVAL");
    expect(output.rows.map(r => r.rank)).toEqual([1, 1]);
    expect(output.rows.every(r => r.improvement === null)).toBe(true);
  });
});
