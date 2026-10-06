import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateSnapshot } from "@/lib/visibility/evaluate";
import { renderJson, renderMarkdown } from "@/lib/visibility/report";
import { createOwnAgentGate, runScan } from "@/lib/visibility/scan";
import type { ScanReport, ScanSnapshot } from "@/lib/visibility/types";
import {
  createFixtureFetcher,
  fixtureNames,
  loadFixture,
  type LoadedFixture,
} from "./helpers/fixture-fetcher";

// Plan 4.1 (1) and 7.1: the report is a pure function of (snapshot, methodology version, scan time).
// Ten runs of the whole pipeline, and ten evaluations of one stored snapshot, must agree byte for byte.

const RUNS = 10;
// The richest golden site: every category observed, sitemap, llms.txt, JSON-LD graph, link checks, timing samples.
const RICH_FIXTURE = "fx-strong";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function scan(fixture: LoadedFixture): Promise<ScanSnapshot> {
  const gate = createOwnAgentGate();
  return runScan(fixture.site.inputUrl, createFixtureFetcher(fixture, { robotsGate: gate.gate }), {
    now: new Date(fixture.site.scannedAt),
    scannerVersion: "determinism-test",
    ownAgentGate: gate,
  });
}

function reverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (typeof value !== "object" || value === null) return value;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value).reverse()) out[key] = reverseKeys((value as Record<string, unknown>)[key]);
  return out;
}

async function pipeline(fixture: LoadedFixture): Promise<{ snapshot: string; json: string; markdown: string; report: ScanReport }> {
  const snapshot = await scan(fixture);
  const report = evaluateSnapshot(snapshot, new Date(fixture.site.scannedAt));
  return { snapshot: JSON.stringify(snapshot), json: renderJson(report), markdown: renderMarkdown(report), report };
}

describe(`determinism on ${RICH_FIXTURE}`, () => {
  const fixture = loadFixture(RICH_FIXTURE);

  it(`scans and evaluates ${RUNS} times to byte-identical snapshots and JSON reports`, async () => {
    const first = await pipeline(fixture);
    expect(first.report.outcome).toBe("COMPLETED");
    expect(first.report.metrics).toHaveLength(52);
    expect(first.json.length).toBeGreaterThan(10_000);
    for (let run = 2; run <= RUNS; run += 1) {
      const next = await pipeline(fixture);
      expect(next.snapshot === first.snapshot, `snapshot of run ${run} differs from run 1`).toBe(true);
      expect(next.json === first.json, `JSON report of run ${run} differs from run 1`).toBe(true);
      expect(next.markdown === first.markdown, `Markdown report of run ${run} differs from run 1`).toBe(true);
    }
  });

  it(`evaluates one stored snapshot ${RUNS} times to byte-identical JSON reports`, async () => {
    const snapshot = await scan(fixture);
    const now = new Date(fixture.site.scannedAt);
    const first = renderJson(evaluateSnapshot(snapshot, now));
    for (let run = 2; run <= RUNS; run += 1) {
      expect(renderJson(evaluateSnapshot(snapshot, now)) === first, `report of run ${run} differs from run 1`).toBe(true);
    }
  });

  it("does not change the stored snapshot while evaluating it", async () => {
    const snapshot = await scan(fixture);
    const before = JSON.stringify(snapshot);
    evaluateSnapshot(snapshot, new Date(fixture.site.scannedAt));
    expect(JSON.stringify(snapshot) === before).toBe(true);
  });

  it("scores a snapshot read back from JSON exactly as the in-memory one", async () => {
    const snapshot = await scan(fixture);
    const now = new Date(fixture.site.scannedAt);
    const stored = JSON.parse(JSON.stringify(snapshot)) as ScanSnapshot;
    const live = evaluateSnapshot(snapshot, now);
    const replay = evaluateSnapshot(stored, now);
    expect(replay.snapshotHash).toBe(live.snapshotHash);
    expect(renderJson(replay) === renderJson(live)).toBe(true);
  });

  it("takes the scan time from the snapshot when no time is passed", async () => {
    const snapshot = await scan(fixture);
    const explicit = evaluateSnapshot(snapshot, new Date(snapshot.scannedAt));
    expect(renderJson(evaluateSnapshot(snapshot)) === renderJson(explicit)).toBe(true);
    expect(explicit.scannedAt).toBe(new Date(fixture.site.scannedAt).toISOString());
  });

  it("never reads the clock or Math.random while evaluating", async () => {
    const snapshot = await scan(fixture);
    const now = new Date(fixture.site.scannedAt);
    const baseline = renderJson(evaluateSnapshot(snapshot, now));

    vi.useFakeTimers({ toFake: ["Date"] });
    for (const hidden of ["1999-01-01T00:00:00Z", "2041-06-30T12:00:00Z"]) {
      vi.setSystemTime(new Date(hidden));
      expect(renderJson(evaluateSnapshot(snapshot, now)) === baseline, `report changed when the system clock read ${hidden}`).toBe(true);
    }
    vi.useRealTimers();

    const random = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random was called during evaluation");
    });
    expect(renderJson(evaluateSnapshot(snapshot, now)) === baseline).toBe(true);
    expect(random).not.toHaveBeenCalled();
  });

  it("changes the report only when the snapshot content changes", async () => {
    const snapshot = await scan(fixture);
    const now = new Date(fixture.site.scannedAt);
    const base = evaluateSnapshot(snapshot, now);

    const altered = JSON.parse(JSON.stringify(snapshot)) as ScanSnapshot;
    const home = altered.pages[0].record;
    home.body = (home.body ?? "").replace("</title>", " extra</title>");
    expect(evaluateSnapshot(altered, now).snapshotHash).not.toBe(base.snapshotHash);

    const reordered = reverseKeys(snapshot) as ScanSnapshot;
    expect(Object.keys(reordered)[0]).not.toBe(Object.keys(snapshot)[0]);
    expect(evaluateSnapshot(reordered, now).snapshotHash).toBe(base.snapshotHash);
  });
});

describe("determinism across every golden site", () => {
  it.each(fixtureNames())("gives identical reports on two independent scans of %s", async (name) => {
    const fixture = loadFixture(name);
    const first = await pipeline(fixture);
    const second = await pipeline(fixture);
    expect(second.snapshot === first.snapshot, `${name}: snapshots differ`).toBe(true);
    expect(second.json === first.json, `${name}: JSON reports differ`).toBe(true);
    expect(second.markdown === first.markdown, `${name}: Markdown reports differ`).toBe(true);
  }, 60_000);
});
