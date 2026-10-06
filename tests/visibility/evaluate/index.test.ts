import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateSnapshot as evaluateReport } from "@/lib/visibility/evaluate";
import { evaluateA1 } from "@/lib/visibility/evaluate/aeo-access";
import { evaluateA2 } from "@/lib/visibility/evaluate/aeo-structured";
import { evaluateA3 } from "@/lib/visibility/evaluate/aeo-answers";
import { evaluateA4 } from "@/lib/visibility/evaluate/aeo-trust";
import { evaluateS1 } from "@/lib/visibility/evaluate/seo-crawl";
import { evaluateS2 } from "@/lib/visibility/evaluate/seo-onpage";
import { evaluateS3 } from "@/lib/visibility/evaluate/seo-technical";
import { evaluateS4 } from "@/lib/visibility/evaluate/seo-content";
import { AI_SEARCH_AGENTS } from "@/lib/visibility/lists";
import { METHODOLOGY } from "@/lib/visibility/methodology";
import { runScan } from "@/lib/visibility/scan";
import { computeScoreSummary, noScoreSummary } from "@/lib/visibility/scoring";
import {
  METRIC_IDS,
  type MetricResult,
  type ScanOutcome,
  type ScanSnapshot,
  type TlsInfo,
} from "@/lib/visibility/types";
import {
  createFixtureFetcher,
  createSiteFetcher,
  expectedSample,
  fixtureNames,
  loadFixture,
  type FixtureResource,
  type FixtureSite,
} from "../helpers/fixture-fetcher";

vi.mock("@/lib/visibility/evaluate/seo-crawl", { spy: true });
vi.mock("@/lib/visibility/evaluate/seo-onpage", { spy: true });
vi.mock("@/lib/visibility/evaluate/seo-technical", { spy: true });
vi.mock("@/lib/visibility/evaluate/seo-content", { spy: true });
vi.mock("@/lib/visibility/evaluate/aeo-access", { spy: true });
vi.mock("@/lib/visibility/evaluate/aeo-structured", { spy: true });
vi.mock("@/lib/visibility/evaluate/aeo-answers", { spy: true });
vi.mock("@/lib/visibility/evaluate/aeo-trust", { spy: true });

const EVALUATORS = [evaluateS1, evaluateS2, evaluateS3, evaluateS4, evaluateA1, evaluateA2, evaluateA3, evaluateA4];
const SCANNED_AT = "2026-10-02T09:15:00.000Z";
const HOME = "https://example.ie/";
const SPA_SHELL = '<div id="root"></div><noscript>Enable JavaScript</noscript>';

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// Keep the full report for determinism checks while adapting the integration-test vocabulary.
function evaluateSnapshot(snapshot: ScanSnapshot) {
  const report = evaluateReport(snapshot);
  return {
    report,
    results: report.metrics,
    summary: report.scores,
    criticalFindings: report.criticalFindings.map((finding) => finding.id),
  };
}

async function scanFixture(name: string) {
  const fixture = loadFixture(name);
  const fetcher = createFixtureFetcher(fixture);
  const snapshot = await runScan(fixture.site.inputUrl, fetcher, {
    now: new Date(fixture.site.scannedAt),
    scannerVersion: "integration-test",
  });
  return { fixture, fetcher, snapshot };
}

function html(head = "", body = `<main><h1>Example</h1><p>${"Visible content. ".repeat(80)}</p></main>`): string {
  return `<!doctype html><html lang="en"><head><title>Example consultancy homepage</title>${head}</head><body>${body}</body></html>`;
}

async function scanSite(over: Record<string, FixtureResource> = {}, inputUrl = HOME): Promise<ScanSnapshot> {
  const site: FixtureSite = {
    inputUrl,
    scannedAt: SCANNED_AT,
    resources: {
      [HOME]: {
        status: 200,
        headers: { "content-type": "text/html" },
        inlineBody: html(),
        tls: { authorized: true, daysToExpiry: 90 },
        ttfbMs: 120,
      },
      [`${HOME}robots.txt`]: {
        status: 200,
        headers: { "content-type": "text/plain" },
        inlineBody: "User-agent: *\nAllow: /\n",
      },
      "http://example.ie/": { status: 301, headers: { location: HOME } },
      ...over,
    },
  };
  return runScan(inputUrl, createSiteFetcher(site), {
    now: new Date(SCANNED_AT),
    scannerVersion: "integration-test",
  });
}

function setHomeHtml(snapshot: ScanSnapshot, head: string, body?: string): void {
  snapshot.pages[0].record.body = html(head, body);
}

function setRobots(snapshot: ScanSnapshot, body: string): void {
  snapshot.robots[0].record.body = body;
}

function resultFor(snapshot: ScanSnapshot, id: string): MetricResult {
  return evaluateSnapshot(snapshot).results.find((result) => result.metricId === id)!;
}

describe("evaluateSnapshot offline integration", () => {
  it.each(fixtureNames())("evaluates the real runScan snapshot for %s without fetching live", async (name) => {
    const liveFetch = vi.fn(() => { throw new Error("Live fetch is forbidden in fixture tests"); });
    vi.stubGlobal("fetch", liveFetch);
    const { fixture, fetcher, snapshot } = await scanFixture(name);
    const before = JSON.stringify(snapshot);
    const requestsBefore = fetcher.requests.length;
    const evaluated = evaluateSnapshot(snapshot);

    expect(snapshot.outcome).toBe(fixture.expected.outcome === "SCORED" ? "COMPLETED" : fixture.expected.outcome);
    expect(snapshot.pages.map((page) => page.url)).toEqual(expectedSample(fixture.site));
    expect(evaluated.results.map((result) => result.metricId)).toEqual([...METRIC_IDS]);
    expect(new Set(evaluated.results.map((result) => result.metricId)).size).toBe(52);
    expect(evaluated.criticalFindings).toEqual(fixture.expected.criticalFindings);
    expect(evaluated.report).toMatchObject({
      reportVersion: 1,
      methodologyVersion: METHODOLOGY.version,
      scannerVersion: snapshot.scannerVersion,
      scannedAt: snapshot.scannedAt,
      outcome: snapshot.outcome,
      metrics: evaluated.results,
      scores: evaluated.summary,
    });
    for (const finding of evaluated.report.criticalFindings) {
      expect(finding.summary).toMatch(/^Detected: /);
    }
    expect(evaluated.summary).toEqual(snapshot.outcome === "COMPLETED"
      ? computeScoreSummary(evaluated.results)
      : noScoreSummary());
    expect(evaluateSnapshot(snapshot)).toEqual(evaluated);
    expect(JSON.stringify(snapshot)).toBe(before);
    expect(fetcher.requests).toHaveLength(requestsBefore);
    expect(liveFetch).not.toHaveBeenCalled();
  });

  it("calls all eight real evaluators once, in methodology order, with the scan timestamp", async () => {
    const { snapshot } = await scanFixture("fx-strong");
    const evaluated = evaluateSnapshot(snapshot);
    const orders = EVALUATORS.map((evaluate) => {
      expect(evaluate).toHaveBeenCalledTimes(1);
      return vi.mocked(evaluate).mock.invocationCallOrder[0];
    });
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    const ctx = vi.mocked(evaluateS1).mock.calls[0][0];
    for (const evaluate of EVALUATORS) expect(vi.mocked(evaluate).mock.calls[0][0]).toBe(ctx);
    expect(ctx.now.toISOString()).toBe(snapshot.scannedAt);
    expect(evaluated.results).toEqual(EVALUATORS.flatMap((evaluate) => vi.mocked(evaluate).mock.results[0].value));
    expect(resultFor(snapshot, "S3.05")).toMatchObject({ result: "PARTIAL", points: 5 });
  });

  it("does not let the wall clock change freshness or the summary of a stored snapshot", async () => {
    const { snapshot } = await scanFixture("fx-stale");
    const before = evaluateSnapshot(snapshot);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2040-01-01T00:00:00Z"));
    expect(evaluateSnapshot(snapshot)).toEqual(before);
  });

  it("rejects an invalid scan timestamp on a completed snapshot", async () => {
    const snapshot = await scanSite();
    snapshot.scannedAt = "invalid";
    expect(() => evaluateSnapshot(snapshot)).toThrow("now must be a valid Date");
  });
});

describe("no-score outcomes", () => {
  it.each<ScanOutcome>(["BLOCKED_BY_ROBOTS", "UNREACHABLE", "JOB_ERROR"])(
    "synthesizes 52 NOT_OBSERVED results for %s without invoking evaluators", async (outcome) => {
      const snapshot = await scanSite();
      snapshot.outcome = outcome;
      // Leftover facts must never produce critical findings or run category evaluators.
      setHomeHtml(snapshot, '<meta name="robots" content="noindex">', SPA_SHELL);
      vi.clearAllMocks();
      const evaluated = evaluateSnapshot(snapshot);
      expect(evaluated.results.map((result) => result.metricId)).toEqual([...METRIC_IDS]);
      for (const [i, result] of evaluated.results.entries()) {
        expect(result).toMatchObject({
          metricVersion: METHODOLOGY.metrics[i].version,
          result: "NOT_OBSERVED", points: null, maxPoints: METHODOLOGY.metrics[i].maxPoints,
          reviewedBy: null,
        });
      }
      expect(evaluated.summary).toEqual(noScoreSummary());
      expect(evaluated.summary).toMatchObject({
        overall: null, seo: null, aeo: null, coverage: 0,
        withheld: { overall: "NO_SCORE_OUTCOME", seo: "NO_SCORE_OUTCOME", aeo: "NO_SCORE_OUTCOME" },
      });
      for (const category of Object.values(evaluated.summary.categories)) {
        expect(category).toMatchObject({ score: null, coverage: 0, shown: false });
      }
      expect(evaluated.criticalFindings).toEqual([]);
      for (const evaluate of EVALUATORS) expect(evaluate).not.toHaveBeenCalled();
    },
  );

  it.each<ScanOutcome>(["BLOCKED_BY_ROBOTS", "UNREACHABLE", "JOB_ERROR"])(
    "validates the scan timestamp before assembling a %s report", async (outcome) => {
      const snapshot = await scanSite();
      snapshot.outcome = outcome;
      snapshot.scannedAt = "invalid";
      vi.clearAllMocks();
      expect(() => evaluateSnapshot(snapshot)).toThrow("now must be a valid Date");
      for (const evaluate of EVALUATORS) expect(evaluate).not.toHaveBeenCalled();
    },
  );

  it("handles a real unreachable scan and a rejected-input job error", async () => {
    const unreachable = await scanSite({
      [HOME]: { error: { code: "CONNECT_REFUSED", message: "offline" } },
      "http://example.ie/": { error: { code: "CONNECT_REFUSED", message: "offline" } },
    });
    const rejected = await scanSite({}, "https://localhost/");
    expect(unreachable.outcome).toBe("UNREACHABLE");
    expect(rejected.outcome).toBe("JOB_ERROR");
    for (const snapshot of [unreachable, rejected]) {
      expect(evaluateSnapshot(snapshot)).toMatchObject({ summary: noScoreSummary(), criticalFindings: [] });
    }
  });
});

describe("critical findings (plan 4.6)", () => {
  it.each(["*", "Googlebot"])("CF-01 detects a root block for %s on a completed scan", async (agent) => {
    const snapshot = await scanSite({
      [`${HOME}robots.txt`]: {
        status: 200, headers: { "content-type": "text/plain" },
        inlineBody: `User-agent: DataBridgesBot\nAllow: /\n\nUser-agent: ${agent}\nDisallow: /\n`,
      },
    });
    expect(snapshot.outcome).toBe("COMPLETED");
    expect(evaluateSnapshot(snapshot).criticalFindings).toContain("CF-01");
  });

  it("CF-01 currently requires both / and a homepage subpath blocked for the same supported agent", async () => {
    const snapshot = await scanSite();
    snapshot.homeUrl = `${HOME}landing`;
    snapshot.pages[0].record.finalUrl = snapshot.homeUrl;
    setRobots(snapshot, "User-agent: Googlebot\nDisallow: /$\nAllow: /landing\n");
    // Current implementation requires both URLs; plan 4.6 names the root alone.
    expect(evaluateSnapshot(snapshot).criticalFindings).not.toContain("CF-01");
    setRobots(snapshot, "User-agent: Googlebot\nDisallow: /landing\n\nUser-agent: bingbot\nDisallow: /\n");
    expect(evaluateSnapshot(snapshot).criticalFindings).not.toContain("CF-01");
    setRobots(snapshot, "User-agent: Googlebot\nDisallow: /\n");
    expect(evaluateSnapshot(snapshot).criticalFindings).toContain("CF-01");
    setRobots(snapshot, "User-agent: bingbot\nDisallow: /\n");
    expect(evaluateSnapshot(snapshot).criticalFindings).not.toContain("CF-01");
  });

  it.each([
    ['<meta name="robots" content="none">', {}],
    ['<meta name="googlebot" content="noindex">', {}],
    ["", { "x-robots-tag": "bingbot: noindex" }],
  ])("CF-02 detects supported noindex directives in meta or headers", async (head, headers) => {
    const snapshot = await scanSite();
    setHomeHtml(snapshot, head);
    Object.assign(snapshot.pages[0].record.headers, headers);
    const evaluated = evaluateSnapshot(snapshot);
    const indexable = evaluated.results.find((result) => result.metricId === "S1.01")!;
    expect(indexable).toMatchObject({ result: "FAIL", points: 0 });
    expect(indexable.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: snapshot.pages[0].url, branch: "noindex_directive" }),
    ]));
    expect(evaluated.criticalFindings).toEqual(["CF-02"]);
  });

  it("CF-02 ignores unrelated agents and noindex on another sampled page", async () => {
    const { snapshot } = await scanFixture("fx-strong");
    snapshot.pages[1].record.body = html('<meta name="robots" content="noindex">');
    snapshot.pages[0].record.headers["x-robots-tag"] = "GPTBot: noindex";
    expect(evaluateSnapshot(snapshot).criticalFindings).not.toContain("CF-02");
    expect(resultFor(snapshot, "S1.01")).toMatchObject({ result: "PARTIAL", points: 20 });
  });

  it("CF-03 requires all three search crawlers to be explicitly disallowed", async () => {
    const snapshot = await scanSite();
    const rules = AI_SEARCH_AGENTS.map((agent) => `User-agent: ${agent}\nDisallow: /\n`).join("\n");
    setRobots(snapshot, rules);
    expect(evaluateSnapshot(snapshot).criticalFindings).toEqual(["CF-03"]);
    setRobots(snapshot, rules.replace("User-agent: Claude-SearchBot\nDisallow: /", "User-agent: Claude-SearchBot\nAllow: /"));
    expect(evaluateSnapshot(snapshot).criticalFindings).toEqual([]);
    snapshot.robots[0].record.status = 503;
    expect(evaluateSnapshot(snapshot).criticalFindings).toEqual([]);
  });

  it("CF-04 applies to the homepage, while body metrics retain the existing observation rules", async () => {
    const { snapshot } = await scanFixture("fx-strong");
    snapshot.pages[1].record.body = html("", SPA_SHELL);
    expect(evaluateSnapshot(snapshot).criticalFindings).not.toContain("CF-04");
    setHomeHtml(snapshot, "", SPA_SHELL);
    expect(evaluateSnapshot(snapshot).criticalFindings).toEqual(["CF-04"]);
    const { snapshot: shell } = await scanFixture("fx-spa-shell");
    expect(resultFor(shell, "S2.05")).toMatchObject({ result: "NOT_OBSERVED", points: null });
    expect(resultFor(shell, "A1.04")).toMatchObject({ result: "FAIL", points: 0 });
  });

  it.each<[TlsInfo | null, boolean]>([
    [{ authorized: false, error: "HOSTNAME_MISMATCH" }, true],
    [{ authorized: true, daysToExpiry: -1 }, true],
    [{ authorized: true, daysToExpiry: 0 }, false],
    [{ authorized: true, daysToExpiry: 13 }, false],
    [null, false],
  ])("CF-05 distinguishes invalid or expired TLS from short expiry or missing evidence", async (tls, detected) => {
    const snapshot = await scanSite();
    snapshot.pages[0].record.tls = tls;
    expect(evaluateSnapshot(snapshot).criticalFindings.includes("CF-05")).toBe(detected);
  });

  it("CF-05 detects a real HTTPS failure followed by successful HTTP fallback", async () => {
    const snapshot = await scanSite({
      [HOME]: { error: { code: "TLS_ERROR", message: "invalid certificate" } },
      "http://example.ie/": { status: 200, headers: { "content-type": "text/html" }, inlineBody: html() },
    });
    expect(snapshot.outcome).toBe("COMPLETED");
    expect(snapshot.httpsAttempt).not.toBeNull();
    expect(evaluateSnapshot(snapshot).criticalFindings).toEqual(["CF-05"]);
    expect(resultFor(snapshot, "S3.01")).toMatchObject({ result: "FAIL", points: 0 });
    expect(resultFor(snapshot, "S3.02")).toMatchObject({ result: "FAIL", points: 0 });
    snapshot.httpsAttempt = null;
    expect(evaluateSnapshot(snapshot).criticalFindings).toEqual(["CF-05"]);
  });

  it.each([
    ['<link rel="canonical" href="https://elsewhere.ie/">', {}, true],
    ["", { link: '<https://elsewhere.ie/>; rel="canonical"' }, true],
    ['<link rel="canonical" href="https://www.example.ie/other">', {}, false],
    ['<link rel="canonical" href="mailto:hello@elsewhere.ie">', {}, false],
  ])("CF-06 detects usable cross-site canonicals in the head or Link header", async (head, headers, detected) => {
    const snapshot = await scanSite();
    setHomeHtml(snapshot, head);
    Object.assign(snapshot.pages[0].record.headers, headers);
    expect(evaluateSnapshot(snapshot).criticalFindings.includes("CF-06")).toBe(detected);
  });

  it.each([403, 429, 503, 200, 404, 500])("CF-07 uses the context challenge detector at status %s", async (status) => {
    const snapshot = await scanSite();
    snapshot.llms = {
      ...snapshot.pages[0].record, url: `${HOME}llms.txt`, finalUrl: `${HOME}llms.txt`, kind: "llms",
      status, body: "Verify you are human", headers: { "content-type": "text/plain" },
    };
    expect(evaluateSnapshot(snapshot).criticalFindings.includes("CF-07")).toBe([403, 429, 503].includes(status));
    snapshot.llms.body = null;
    expect(evaluateSnapshot(snapshot).criticalFindings).not.toContain("CF-07");
    snapshot.llms.headers["cf-mitigated"] = "challenge";
    expect(evaluateSnapshot(snapshot).criticalFindings.includes("CF-07")).toBe([403, 429, 503].includes(status));
  });

  it("returns each finding once in CF order and leaves scoring to computeScoreSummary", async () => {
    const snapshot = await scanSite();
    setRobots(snapshot, "User-agent: DataBridgesBot\nAllow: /\n\nUser-agent: *\nDisallow: /\n");
    setHomeHtml(snapshot, '<meta name="robots" content="noindex"><link rel="canonical" href="https://elsewhere.ie/">', SPA_SHELL);
    snapshot.pages[0].record.tls = { authorized: false };
    snapshot.llms = { ...snapshot.pages[0].record, kind: "llms", status: 403, body: "captcha", headers: {} };
    const evaluated = evaluateSnapshot(snapshot);
    expect(evaluated.criticalFindings).toEqual(["CF-01", "CF-02", "CF-03", "CF-04", "CF-05", "CF-06", "CF-07"]);
    expect(evaluated.summary).toEqual(computeScoreSummary(evaluated.results));
  });
});

describe("evaluator output contract", () => {
  async function s1Results() {
    const snapshot = await scanSite();
    const baseline = evaluateSnapshot(snapshot);
    const results = baseline.results.filter((result) => result.metricId.startsWith("S1."));
    vi.clearAllMocks();
    return { snapshot, results, baseline };
  }

  function expectContainedFault(snapshot: ScanSnapshot, baseline: ReturnType<typeof evaluateSnapshot>) {
    // Calling directly also asserts that the evaluator fault does not escape report assembly.
    const evaluated = evaluateSnapshot(snapshot);
    expect(evaluated.results.map((result) => result.metricId)).toEqual([...METRIC_IDS]);
    expect(new Set(evaluated.results.map((result) => result.metricId)).size).toBe(52);
    const definitions = METHODOLOGY.metrics.filter((metric) => metric.categoryId === "S1");
    const failed = evaluated.results.filter((result) => result.metricId.startsWith("S1."));
    expect(failed).toHaveLength(definitions.length);
    for (const [index, result] of failed.entries()) {
      expect(result).toMatchObject({
        metricId: definitions[index].id,
        metricVersion: definitions[index].version,
        result: "SCAN_ERROR",
        points: null,
        maxPoints: definitions[index].maxPoints,
        reviewedBy: null,
        evidence: { branch: "SCAN_ERROR", reason: "evaluator_failed" },
      });
      expect(result.explanation).toMatch(/internal error/);
    }
    expect(evaluated.summary.categories.S1).toMatchObject({
      score: null, points: 0, coverage: 0, shown: false, appliedMax: 0, possibleMax: 100,
    });
    expect(evaluated.summary).toEqual(computeScoreSummary(evaluated.results));
    expect(evaluated.results.filter((result) => !result.metricId.startsWith("S1."))).toEqual(
      baseline.results.filter((result) => !result.metricId.startsWith("S1.")),
    );
    expect(evaluated.criticalFindings).toEqual(baseline.criticalFindings);
    expect(evaluated.report.limitations.join("\n")).toMatch(/internal error stopped S1/);
    for (const evaluate of EVALUATORS) expect(evaluate).toHaveBeenCalledTimes(1);
    return evaluated;
  }

  it("contains results returned out of order and retains all IDs in methodology order", async () => {
    const { snapshot, results, baseline } = await s1Results();
    vi.mocked(evaluateS1).mockReturnValueOnce([...results].reverse());
    expectContainedFault(snapshot, baseline);
  });

  it("contains duplicate IDs with a full category of SCAN_ERROR results", async () => {
    const { snapshot, results, baseline } = await s1Results();
    vi.mocked(evaluateS1).mockReturnValueOnce([...results, results[0]]);
    expectContainedFault(snapshot, baseline);
  });

  it("contains missing IDs with a full category of SCAN_ERROR results", async () => {
    const { snapshot, results, baseline } = await s1Results();
    vi.mocked(evaluateS1).mockReturnValueOnce(results.slice(1));
    expectContainedFault(snapshot, baseline);
  });

  it.each([
    ["unknown", "X1.01"],
    ["wrong category", "S2.01"],
  ])("contains %s IDs without leaking them into the report", async (_name, metricId) => {
    const { snapshot, results, baseline } = await s1Results();
    vi.mocked(evaluateS1).mockReturnValueOnce([{ ...results[0], metricId }, ...results.slice(1)]);
    expectContainedFault(snapshot, baseline);
  });

  it.each([
    { result: "UNKNOWN" },
    { points: Number.NaN },
    { points: -1 },
    { points: 26 },
    { points: null },
  ])("contains invalid scored values %j", async (over) => {
    const { snapshot, results, baseline } = await s1Results();
    vi.mocked(evaluateS1).mockReturnValueOnce([{ ...results[0], ...over } as MetricResult, ...results.slice(1)]);
    expectContainedFault(snapshot, baseline);
  });

  // These malformed fields currently pass validResult; keep that validation gap visible.
  it.each([
    { metricVersion: 999 },
    { maxPoints: null },
    { explanation: null },
    { reviewedBy: undefined },
    { result: "NOT_OBSERVED", points: 0 },
    { result: "NOT_APPLICABLE", points: null, maxPoints: 25 },
  ])("currently passes through unvalidated result metadata %j while using standard scoring", async (over) => {
    const { snapshot, results, baseline } = await s1Results();
    const supplied = [{ ...results[0], ...over } as MetricResult, ...results.slice(1)];
    vi.mocked(evaluateS1).mockReturnValueOnce(supplied);
    const evaluated = evaluateSnapshot(snapshot);
    expect(evaluated.results).toEqual([...supplied, ...baseline.results.slice(results.length)]);
    expect(evaluated.summary).toEqual(computeScoreSummary(evaluated.results));
    expect(evaluated.report.limitations.join("\n")).not.toMatch(/internal error stopped S1/);
    const code = supplied[0].result;
    if (code === "NOT_APPLICABLE" || code === "NOT_OBSERVED") {
      const max = METHODOLOGY.metrics[0].maxPoints;
      expect(evaluated.summary.categories.S1.appliedMax).toBe(baseline.summary.categories.S1.appliedMax - max);
      expect(evaluated.summary.categories.S1.possibleMax).toBe(
        baseline.summary.categories.S1.possibleMax - (code === "NOT_APPLICABLE" ? max : 0),
      );
    }
  });

  it.each([null, {}, [null], [{}]])("contains a malformed evaluator return %j", async (value) => {
    const { snapshot, baseline } = await s1Results();
    vi.mocked(evaluateS1).mockReturnValueOnce(value as MetricResult[]);
    expectContainedFault(snapshot, baseline);
  });

  it.each([new Error("evaluator failed"), "non-Error evaluator failure"])(
    "contains an evaluator exception %s and still evaluates the other seven categories", async (error) => {
      const { snapshot, baseline } = await s1Results();
      vi.mocked(evaluateS1).mockImplementationOnce(() => { throw error; });
      expectContainedFault(snapshot, baseline);
    },
  );

  it("preserves a valid category's results, including the defined non-scored conventions", async () => {
    const { snapshot, results, baseline } = await s1Results();
    vi.mocked(evaluateS1).mockReturnValueOnce(results);
    expect(evaluateSnapshot(snapshot)).toEqual(baseline);
  });
});
