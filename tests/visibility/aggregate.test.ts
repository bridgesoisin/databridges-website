import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildConsensus,
  indexRow,
  scoreSubmission,
  submissionToResults,
  toCsv,
  validateSubmission,
  type Submission,
  type SubmissionMetric,
} from "@/lib/visibility/aggregate";
import {
  aggregateTarget,
  assertId,
  initRoot,
  loadSubmissions,
  rebuildIndex,
  writeSkeleton,
} from "@/lib/visibility/aggregate-fs";
import { METHODOLOGY, METHODOLOGY_VERSION } from "@/lib/visibility/methodology";

const HOME = "https://fixture.example/";
const PER_PAGE = new Set(["P", "CP", "KO", "AP"]);

function perfectMetric(id: string): SubmissionMetric {
  const def = METHODOLOGY.metrics.find((m) => m.id === id)!;
  const base = { metricId: id, evidence: ["observed value"], explanation: "Meets the rule." };
  if (PER_PAGE.has(def.scope)) {
    return { ...base, pageScores: [{ url: HOME, status: "observed", score: 1 }] };
  }
  return { ...base, outcome: "SCORED", score: 1 };
}

function makeSubmission(overrides: Partial<Submission> = {}): Submission {
  return {
    schemaVersion: 1,
    methodologyVersion: METHODOLOGY_VERSION,
    targetId: "fixture-site",
    homeUrl: HOME,
    runId: "run-1",
    agentId: "agent-a",
    scannedAt: "2026-10-03T12:00:00.000Z",
    mode: "manual-agent",
    outcome: "COMPLETED",
    sampledPages: [{ url: HOME, type: "home", reason: "Homepage" }],
    metrics: METHODOLOGY.metrics.map((m) => perfectMetric(m.id)),
    criticalFindings: [],
    ...overrides,
  };
}

function withMetric(sub: Submission, metric: SubmissionMetric): Submission {
  return { ...sub, metrics: sub.metrics.map((m) => (m.metricId === metric.metricId ? metric : m)) };
}

function errorsOf(input: unknown): string[] {
  const result = validateSubmission(input);
  return result.ok ? [] : result.errors;
}

describe("validateSubmission", () => {
  it("accepts a complete, well-formed submission", () => {
    expect(validateSubmission(makeSubmission()).ok).toBe(true);
  });

  it("rejects input that is not an object", () => {
    expect(errorsOf(null)).toHaveLength(1);
    expect(errorsOf([])).toHaveLength(1);
    expect(errorsOf("x")).toHaveLength(1);
  });

  it("requires every metric exactly once", () => {
    const sub = makeSubmission();
    const missing = { ...sub, metrics: sub.metrics.filter((m) => m.metricId !== "S1.01") };
    expect(errorsOf(missing).join("\n")).toMatch(/metric S1\.01 is missing/);
    const duplicated = { ...sub, metrics: [...sub.metrics, sub.metrics[0]] };
    expect(errorsOf(duplicated).join("\n")).toMatch(/appears more than once/);
  });

  it("rejects unknown metric ids", () => {
    const sub = makeSubmission();
    const bad = { ...sub, metrics: [...sub.metrics, { ...sub.metrics[0], metricId: "Z9.99" }] };
    expect(errorsOf(bad).join("\n")).toMatch(/not a known metric/);
  });

  it("rejects the wrong methodology version", () => {
    expect(errorsOf(makeSubmission({ methodologyVersion: "9.9.9" })).join("\n")).toMatch(/methodologyVersion/);
  });

  it("rejects identifiers that are unsafe in a file path", () => {
    for (const bad of ["../escape", "a/b", "a\\b", "", "x", ".hidden", "-lead", "has space"]) {
      expect(errorsOf(makeSubmission({ targetId: bad })).join("\n"), bad).toMatch(/targetId/);
    }
    expect(errorsOf(makeSubmission({ agentId: "agent/../x" })).join("\n")).toMatch(/agentId/);
  });

  it("keeps per-page metrics on pageScores and site metrics on score", () => {
    const sub = makeSubmission();
    const perPageWithScore = withMetric(sub, {
      metricId: "S1.01",
      evidence: [],
      explanation: "x",
      outcome: "SCORED",
      score: 1,
    });
    expect(errorsOf(perPageWithScore).join("\n")).toMatch(/S1\.01.*pageScores only/);
    const siteWithPages = withMetric(sub, {
      metricId: "S1.03",
      evidence: [],
      explanation: "x",
      outcome: "SCORED",
      score: 1,
      pageScores: [{ url: HOME, status: "observed", score: 1 }],
    });
    expect(errorsOf(siteWithPages).join("\n")).toMatch(/S1\.03.*not pageScores/);
  });

  it("checks scores, statuses and evidence limits", () => {
    const sub = makeSubmission();
    expect(
      errorsOf(withMetric(sub, { metricId: "S1.03", evidence: [], explanation: "x", outcome: "SCORED", score: 1.5 })).join("\n")
    ).toMatch(/from 0 to 1/);
    expect(
      errorsOf(withMetric(sub, { metricId: "S1.03", evidence: [], explanation: "x", outcome: "NOT_OBSERVED", score: 0.5 })).join("\n")
    ).toMatch(/omitted unless/);
    expect(
      errorsOf(withMetric(sub, { metricId: "S1.03", evidence: ["a".repeat(201)], explanation: "x", outcome: "FAIL" as never })).join("\n")
    ).toMatch(/at most 200/);
    expect(
      errorsOf(
        withMetric(sub, {
          metricId: "S1.01",
          evidence: [],
          explanation: "x",
          pageScores: [{ url: HOME, status: "not_observed", score: 1 }],
        })
      ).join("\n")
    ).toMatch(/null unless status is observed/);
    expect(
      errorsOf(withMetric(sub, { metricId: "S1.03", evidence: [], explanation: " ", outcome: "SCORED", score: 1 })).join("\n")
    ).toMatch(/explanation/);
  });

  it("only allows an empty metrics list for runs that did not complete", () => {
    expect(validateSubmission(makeSubmission({ outcome: "BLOCKED_BY_ROBOTS", metrics: [], sampledPages: [] })).ok).toBe(true);
    expect(errorsOf(makeSubmission({ outcome: "UNREACHABLE" })).join("\n")).toMatch(/must be empty/);
  });

  it("rejects unknown critical findings and oversized sampled lists", () => {
    expect(errorsOf(makeSubmission({ criticalFindings: ["CF-99"] })).join("\n")).toMatch(/unknown id/);
    const many = Array.from({ length: 6 }, (_, i) => ({ url: `https://fixture.example/p${i}`, type: "other", reason: "x" }));
    expect(errorsOf(makeSubmission({ sampledPages: many })).join("\n")).toMatch(/at most 5/);
  });
});

describe("scoreSubmission", () => {
  it("scores a perfect submission 100 with full coverage", () => {
    const scored = scoreSubmission(makeSubmission());
    expect(scored.summary.overall).toBe(100);
    expect(scored.summary.seo).toBe(100);
    expect(scored.summary.aeo).toBe(100);
    expect(scored.summary.coverage).toBe(1);
    expect(scored.band).toBe("Strong signals detected");
  });

  it("derives points and result codes from page scores (plan 4.3.6 example)", () => {
    const urls = ["a", "b", "c", "d", "e"].map((p) => `https://fixture.example/${p}`);
    const scores = [1, 1, 0.5, 1, 0];
    const sub = withMetric(makeSubmission(), {
      metricId: "S2.01",
      evidence: ["titles checked"],
      explanation: "Mixed.",
      pageScores: urls.map((url, i) => ({ url, status: "observed", score: scores[i] })),
    });
    const result = submissionToResults(sub).find((r) => r.metricId === "S2.01")!;
    expect(result.points).toBe(14);
    expect(result.result).toBe("PARTIAL");
  });

  it("treats not-observed and not-applicable inputs without penalty", () => {
    let sub = withMetric(makeSubmission(), {
      metricId: "S1.03",
      evidence: [],
      explanation: "Could not tell.",
      outcome: "NOT_OBSERVED",
    });
    sub = withMetric(sub, { metricId: "S3.04", evidence: [], explanation: "Tiny HTML.", outcome: "NOT_APPLICABLE" });
    const scored = scoreSubmission(sub);
    expect(scored.summary.overall).toBe(100);
    expect(scored.summary.coverage).toBeLessThan(1);
  });

  it("returns no score when the run did not complete", () => {
    const sub = makeSubmission({ outcome: "BLOCKED_BY_ROBOTS", metrics: [], sampledPages: [] });
    const scored = scoreSubmission(sub);
    expect(scored.summary.overall).toBeNull();
    expect(scored.band).toBeNull();
  });
});

describe("buildConsensus", () => {
  it("reports a single rater honestly", () => {
    const report = buildConsensus([makeSubmission()]);
    expect(report.confidence).toBe("single-rater");
    expect(report.agreementRate).toBeNull();
    expect(report.summary.overall).toBe(100);
  });

  it("agrees when independent submissions match", () => {
    const report = buildConsensus([makeSubmission(), makeSubmission({ agentId: "agent-b" })]);
    expect(report.confidence).toBe("agreed");
    expect(report.agreementRate).toBe(1);
    expect(report.disputes).toHaveLength(0);
    expect(report.summary.overall).toBe(100);
    expect(report.agentIds).toEqual(["agent-a", "agent-b"]);
  });

  it("averages scores that differ by 0.1 or less", () => {
    const a = withMetric(makeSubmission(), { metricId: "S1.03", evidence: [], explanation: "x", outcome: "SCORED", score: 1 });
    const b = withMetric(makeSubmission({ agentId: "agent-b" }), {
      metricId: "S1.03",
      evidence: [],
      explanation: "x",
      outcome: "SCORED",
      score: 0.9,
    });
    const report = buildConsensus([a, b]);
    const metric = report.results.find((r) => r.metricId === "S1.03")!;
    expect(report.disputes).toHaveLength(0);
    expect(metric.points).toBe(19);
  });

  it("flags a dispute and leaves the metric unscored", () => {
    const b = withMetric(makeSubmission({ agentId: "agent-b" }), {
      metricId: "S1.03",
      evidence: [],
      explanation: "No sitemap found.",
      outcome: "SCORED",
      score: 0,
    });
    const report = buildConsensus([makeSubmission(), b]);
    expect(report.disputes.map((d) => d.metricId)).toEqual(["S1.03"]);
    expect(report.results.find((r) => r.metricId === "S1.03")!.result).toBe("NOT_OBSERVED");
    expect(report.confidence).toBe("needs-review");
    expect(report.agreementRate).toBeCloseTo(51 / 52, 4);
  });

  it("treats scored versus not-scored as a disagreement", () => {
    const b = withMetric(makeSubmission({ agentId: "agent-b" }), {
      metricId: "S1.03",
      evidence: [],
      explanation: "x",
      outcome: "NOT_APPLICABLE",
    });
    expect(buildConsensus([makeSubmission(), b]).disputes).toHaveLength(1);
  });

  it("includes a critical finding only when a majority of raters report it", () => {
    const one = makeSubmission({ criticalFindings: ["CF-02"] });
    const two = makeSubmission({ agentId: "agent-b" });
    let report = buildConsensus([one, two]);
    expect(report.criticalFindings).toEqual([]);
    expect(report.contestedFindings).toEqual(["CF-02"]);
    expect(report.confidence).toBe("needs-review");

    report = buildConsensus([one, makeSubmission({ agentId: "agent-b", criticalFindings: ["CF-02"] })]);
    expect(report.criticalFindings).toEqual(["CF-02"]);

    report = buildConsensus([
      one,
      makeSubmission({ agentId: "agent-b", criticalFindings: ["CF-02"] }),
      makeSubmission({ agentId: "agent-c" }),
    ]);
    expect(report.criticalFindings).toEqual(["CF-02"]);
  });

  it("returns no score when no submission completed", () => {
    const blocked = makeSubmission({ outcome: "BLOCKED_BY_ROBOTS", metrics: [], sampledPages: [] });
    const report = buildConsensus([blocked]);
    expect(report.confidence).toBe("no-score");
    expect(report.summary.overall).toBeNull();
    expect(report.outcome).toBe("BLOCKED_BY_ROBOTS");
  });

  it("throws when given nothing", () => {
    expect(() => buildConsensus([])).toThrow(RangeError);
  });
});

describe("index CSV", () => {
  it("writes a header and one row per report", () => {
    const csv = toCsv([buildConsensus([makeSubmission()])]);
    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0].startsWith("targetId,homeUrl,runId")).toBe(true);
    expect(lines[1].startsWith("fixture-site,https://fixture.example/,run-1")).toBe(true);
    expect(lines[1]).toContain(",100,100,100,1,Strong signals detected,1,");
  });

  it("neutralises spreadsheet formulas and quotes awkward cells", () => {
    const report = { ...buildConsensus([makeSubmission()]), homeUrl: '=HYPERLINK("x","y")' };
    const row = indexRow(report);
    expect(row[1].startsWith('"\'=HYPERLINK')).toBe(true);
  });
});

describe("file layer", () => {
  let root: string;

  const approvedTargets = (status = "APPROVED", basis = "OWNED") =>
    JSON.stringify({
      policy: {},
      targets: [
        {
          targetId: "fixture-site",
          homeUrl: HOME,
          status,
          approvalBasis: basis,
          approvalRef: "test approval",
        },
      ],
    });

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "vi-agg-"));
    await writeFile(path.join(root, "targets.json"), approvedTargets(), "utf8");
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function drop(sub: Submission, fileName = `${sub.agentId}.json`) {
    const dir = path.join(root, "runs", sub.targetId, sub.runId);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, fileName), JSON.stringify(sub), "utf8");
  }

  it("creates the starter folder once and never overwrites it", async () => {
    const fresh = await mkdtemp(path.join(os.tmpdir(), "vi-init-"));
    try {
      expect(await initRoot(fresh)).toEqual(["targets.json", "candidates.json"]);
      const targets = JSON.parse(await readFile(path.join(fresh, "targets.json"), "utf8"));
      expect(targets.policy.scanOnlyApproved).toBe(true);
      expect(targets.targets[0].targetId).toBe("databridges-ie");
      await writeFile(path.join(fresh, "targets.json"), '{"policy":{},"targets":[]}', "utf8");
      expect(await initRoot(fresh)).toEqual([]);
      expect(await readFile(path.join(fresh, "targets.json"), "utf8")).toBe('{"policy":{},"targets":[]}');
    } finally {
      await rm(fresh, { recursive: true, force: true });
    }
  });

  it("refuses to aggregate or create a skeleton for a target that is not approved", async () => {
    await drop(makeSubmission());
    for (const [status, basis] of [["PAUSED", "OWNED"], ["APPROVED", "GUESSED"], ["REMOVED", "OWNED"]]) {
      await writeFile(path.join(root, "targets.json"), approvedTargets(status, basis), "utf8");
      await expect(aggregateTarget(root, "fixture-site", "run-1"), `${status}/${basis}`).rejects.toThrow(RangeError);
      await expect(writeSkeleton(root, "fixture-site", "run-2", "agent-a")).rejects.toThrow(RangeError);
    }
    await writeFile(path.join(root, "targets.json"), '{"targets":[]}', "utf8");
    await expect(aggregateTarget(root, "fixture-site", "run-1")).rejects.toThrow(/not in targets\.json/);
    await rm(path.join(root, "targets.json"));
    await expect(aggregateTarget(root, "fixture-site", "run-1")).rejects.toThrow(/missing or unreadable/);
  });

  it("creates a blank submission that cannot pass validation until it is filled in", async () => {
    const file = await writeSkeleton(root, "fixture-site", "run-3", "agent-a");
    const skeleton = JSON.parse(await readFile(file, "utf8"));
    expect(skeleton.metrics).toHaveLength(52);
    expect(skeleton.homeUrl).toBe(HOME);
    const result = validateSubmission(skeleton);
    expect(result.ok).toBe(false);
    const text = result.ok ? "" : result.errors.join("\n");
    expect(text).toMatch(/scannedAt/);
    expect(text).toMatch(/pageScores must list one entry/);
    expect(text).toMatch(/TODO placeholder/);
    await expect(writeSkeleton(root, "fixture-site", "run-3", "agent-a")).rejects.toThrow(/already exists/);
  });

  it("aggregates two agents, writes scores, history and the index", async () => {
    await drop(makeSubmission());
    await drop(makeSubmission({ agentId: "agent-b" }));
    const { report, invalid } = await aggregateTarget(root, "fixture-site", "run-1");
    expect(invalid).toEqual([]);
    expect(report?.raters).toBe(2);
    const scores = JSON.parse(await readFile(path.join(root, "scores", "fixture-site.json"), "utf8"));
    expect(scores.summary.overall).toBe(100);
    await readFile(path.join(root, "history", "fixture-site", "run-1.json"), "utf8");
    const csv = await readFile(path.join(root, "index.csv"), "utf8");
    expect(csv).toContain("fixture-site");
    expect(await rebuildIndex(root)).toBe(1);
  });

  it("reports invalid files and keeps scoring the valid ones", async () => {
    await drop(makeSubmission());
    await drop(makeSubmission({ agentId: "agent-b" }), "wrong-name.json");
    await drop(makeSubmission({ agentId: "agent-c", methodologyVersion: "0.0.1" }));
    const { report, invalid } = await aggregateTarget(root, "fixture-site", "run-1");
    expect(report?.raters).toBe(1);
    expect(invalid.map((i) => i.file).sort()).toEqual(["agent-c.json", "wrong-name.json"]);
  });

  it("flags a submission placed in the wrong target or run folder", async () => {
    const dir = path.join(root, "runs", "other-site", "run-1");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "agent-a.json"), JSON.stringify(makeSubmission()), "utf8");
    const loaded = await loadSubmissions(root, "other-site", "run-1");
    expect(loaded.valid).toHaveLength(0);
    expect(loaded.invalid[0].errors.join(" ")).toMatch(/targetId/);
  });

  it("returns nothing for an empty run and refuses unsafe ids", async () => {
    expect((await aggregateTarget(root, "fixture-site", "run-9")).report).toBeNull();
    expect(() => assertId("../x", "targetId")).toThrow(RangeError);
    await expect(loadSubmissions(root, "..", "run-1")).rejects.toThrow(RangeError);
  });
});
