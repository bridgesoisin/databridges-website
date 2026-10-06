import { describe, it } from "vitest";
import { evaluateSnapshot } from "@/lib/visibility/evaluate";
import { runScan } from "@/lib/visibility/scan";
import { createFixtureFetcher, fixtureNames, loadFixture } from "../helpers/fixture-fetcher";

describe("explore", () => {
  it.each(fixtureNames())("%s", async (name) => {
    const fixture = loadFixture(name);
    const snap = await runScan(fixture.site.inputUrl, createFixtureFetcher(fixture), { now: new Date(fixture.site.scannedAt), scannerVersion: "t" });
    const t0 = Date.now();
    const report = evaluateSnapshot(snap, new Date(snap.scannedAt));
    const ms = Date.now() - t0;
    const exp = fixture.expected;
    const line = {
      name, outcome: report.outcome, exp: exp.outcome,
      scores: [report.scores.overall, report.scores.seo, report.scores.aeo, report.coverage],
      expScores: exp.scores ? [exp.scores.overall, exp.scores.seo, exp.scores.aeo, exp.scores.coverage] : null,
      cf: report.criticalFindings.map((c) => c.id), expCf: exp.criticalFindings,
      metrics: report.metrics.length, ms,
    };
    console.log(JSON.stringify(line));
  });
});
