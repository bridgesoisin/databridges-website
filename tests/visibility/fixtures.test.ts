import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { evaluateSnapshot } from "@/lib/visibility/evaluate";
import { METHODOLOGY } from "@/lib/visibility/methodology";
import { createOwnAgentGate, runScan } from "@/lib/visibility/scan";
import {
  CATEGORY_IDS,
  CRITICAL_FINDING_IDS,
  EVIDENCE_STRING_MAX,
  METRIC_IDS,
  METRIC_RESULT_CODES,
  type MetricResult,
  type ScanReport,
  type ScanSnapshot,
} from "@/lib/visibility/types";
import {
  FIXTURES_DIR,
  createFixtureFetcher,
  expectedSample,
  fixtureNames,
  loadFixture,
  type FixtureExpected,
  type FixtureFetcher,
  type LoadedFixture,
} from "./helpers/fixture-fetcher";
import { armTripwire, type Tripwire } from "./helpers/net-observe";

// Golden fixtures (plan 7.2). Each fixture is a synthetic site plus a hand-derived expected.json. This file runs
// the real scan orchestration against the offline fixture fetcher, evaluates the stored snapshot, and compares.
// Mismatches are reported per fixture and metric; they are adjudicated against the plan text, never "fixed" here.

// Stored scores have two decimals and category figures four, so half of the last stored digit is the tolerance.
const TOLERANCE_SCORE = 0.005 + 1e-9;
const TOLERANCE_UNIT = 0.00005 + 1e-9;
const TOLERANCE_POINTS = 0.005 + 1e-9;

const PLAN_FIXTURES = [
  "fx-strong",
  "fx-minimal",
  "fx-spa-shell",
  "fx-noindex-home",
  "fx-robots-block-all",
  "fx-robots-block-ai-only",
  "fx-robots-rfc-matching",
  "fx-canonical-variants",
  "fx-duplicate-titles",
  "fx-jsonld-broken",
  "fx-faq-mismatch",
  "fx-stale",
  "fx-non-english",
  "fx-cjk",
  "fx-hostile",
];
// Table-driven, no site to scan: covered by fixtures-rfc.test.ts.
const NOT_SCANNED = new Set(["fx-robots-rfc-matching"]);

type Robustness = { maxEvaluationMs?: number; maxEvidenceStringChars?: number };

type Run = {
  fixture: LoadedFixture;
  fetcher: FixtureFetcher;
  snapshot: ScanSnapshot;
  report: ScanReport;
  evaluationMs: number;
};

function hasExpected(name: string): boolean {
  return existsSync(path.join(FIXTURES_DIR, name, "expected.json"));
}

const names = fixtureNames().filter(hasExpected);

async function execute(name: string): Promise<Run> {
  const fixture = loadFixture(name);
  const now = new Date(fixture.site.scannedAt);
  const gate = createOwnAgentGate();
  const fetcher = createFixtureFetcher(fixture, { robotsGate: gate.gate });
  const snapshot = await runScan(fixture.site.inputUrl, fetcher, {
    now,
    scannerVersion: "fixtures-test",
    ownAgentGate: gate,
  });
  const started = performance.now();
  const report = evaluateSnapshot(snapshot, now);
  return { fixture, fetcher, snapshot, report, evaluationMs: performance.now() - started };
}

function show(value: number | string | null | undefined): string {
  return value === null || value === undefined ? "null" : String(value);
}

function near(actual: number | null, expected: number | null, tolerance: number): boolean {
  if (actual === null || expected === null) return actual === expected;
  return Math.abs(actual - expected) <= tolerance;
}

function failIfAny(fixture: string, section: string, diffs: readonly string[]): void {
  if (diffs.length === 0) return;
  const lines = diffs.map((line) => `  ${line}`).join("\n");
  throw new Error(`${fixture}: ${diffs.length} ${section} mismatch${diffs.length === 1 ? "" : "es"}\n${lines}`);
}

function wantedOutcome(expected: FixtureExpected): string {
  return expected.outcome === "SCORED" ? "COMPLETED" : expected.outcome;
}

function isHostileCode(code: number): boolean {
  return (
    code <= 0x1f ||
    (code >= 0x7f && code <= 0x9f) ||
    code === 0x00ad ||
    code === 0x061c ||
    code === 0x180e ||
    (code >= 0x200b && code <= 0x200f) ||
    (code >= 0x2028 && code <= 0x202e) ||
    (code >= 0x2060 && code <= 0x2064) ||
    (code >= 0x2066 && code <= 0x2069) ||
    code === 0xfeff
  );
}

function stringProblem(text: string, limit: number): string | null {
  if (text.length > limit) return `${text.length} characters, over the limit of ${limit}`;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (isHostileCode(code)) return `contains U+${code.toString(16).toUpperCase().padStart(4, "0")}, a control, invisible or bidirectional character`;
  }
  return null;
}

function collectStrings(value: unknown, where: string, out: Array<{ where: string; text: string }>, depth = 0): void {
  if (typeof value === "string") {
    out.push({ where, text: value });
    return;
  }
  if (depth > 12 || typeof value !== "object" || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectStrings(item, `${where}[${index}]`, out, depth + 1));
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    out.push({ where: `${where}.${key}`, text: key });
    collectStrings(item, `${where}.${key}`, out, depth + 1);
  }
}

function metricLine(name: string, id: string, expected: FixtureExpected["metrics"][string], actual: MetricResult | undefined): string | null {
  if (actual === undefined) return `${id}: expected ${expected.result}, but the report has no result for it`;
  const parts: string[] = [];
  if (actual.result !== expected.result) parts.push(`result expected ${expected.result}, got ${actual.result}`);
  if (!near(actual.points, expected.points, TOLERANCE_POINTS)) {
    parts.push(`points expected ${show(expected.points)}, got ${show(actual.points)}`);
  }
  if (parts.length === 0) return null;
  const explanation = actual.explanation.length > 200 ? `${actual.explanation.slice(0, 199)}...` : actual.explanation;
  return `${name} ${id}: ${parts.join("; ")}\n      report says: ${explanation}`;
}

describe("golden fixture inventory", () => {
  const directories = readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  it("holds every fixture named in plan 7.2", () => {
    expect(directories).toEqual(expect.arrayContaining(PLAN_FIXTURES));
  });

  it("gives every fixture that has a site.json an expected.json", () => {
    const orphans = fixtureNames().filter((name) => !hasExpected(name));
    expect(orphans).toEqual([]);
  });

  it("runs every scannable plan fixture", () => {
    const missing = PLAN_FIXTURES.filter((name) => !NOT_SCANNED.has(name) && !names.includes(name));
    expect(missing).toEqual([]);
    expect(names.length).toBeGreaterThanOrEqual(PLAN_FIXTURES.length - NOT_SCANNED.size);
  });
});

describe("golden fixtures", () => {
  let tripwire: Tripwire;

  beforeAll(() => {
    tripwire = armTripwire();
  });

  afterAll(() => {
    tripwire.stop();
    expect(tripwire.attempts).toBe(0);
  });

  describe.each(names)("%s", (name) => {
    let run: Run;

    beforeAll(async () => {
      run = await execute(name);
    }, 120_000);

    it("has a well-formed expected.json", () => {
      const { expected, site } = run.fixture;
      const diffs: string[] = [];
      if (!["SCORED", "BLOCKED_BY_ROBOTS", "UNREACHABLE"].includes(expected.outcome)) {
        diffs.push(`outcome ${show(expected.outcome)} is not SCORED, BLOCKED_BY_ROBOTS or UNREACHABLE`);
      }
      if (typeof expected.partial !== "boolean") diffs.push("partial must be true or false");
      for (const id of expected.criticalFindings ?? []) {
        if (!(CRITICAL_FINDING_IDS as readonly string[]).includes(id)) diffs.push(`criticalFindings lists unknown id ${id}`);
      }
      const listed = Object.keys(expected.metrics ?? {});
      for (const id of listed) {
        if (!(METRIC_IDS as readonly string[]).includes(id)) diffs.push(`metrics lists unknown id ${id}`);
      }
      for (const id of listed) {
        const entry = expected.metrics[id];
        const definition = METHODOLOGY.metrics.find((metric) => metric.id === id);
        if (definition === undefined) continue;
        if (!(METRIC_RESULT_CODES as readonly string[]).includes(entry.result)) {
          diffs.push(`${id}: ${entry.result} is not a result code`);
          continue;
        }
        const scored = entry.result === "PASS" || entry.result === "PARTIAL" || entry.result === "FAIL";
        if (!scored && entry.points !== null) diffs.push(`${id}: ${entry.result} must have points null, not ${show(entry.points)}`);
        if (scored && entry.points === null) diffs.push(`${id}: ${entry.result} must have points`);
        if (scored && entry.points !== null) {
          if (entry.result === "PASS" && !near(entry.points, definition.maxPoints, TOLERANCE_POINTS)) {
            diffs.push(`${id}: PASS must carry all ${definition.maxPoints} points, not ${entry.points}`);
          }
          if (entry.result === "FAIL" && entry.points !== 0) diffs.push(`${id}: FAIL must carry 0 points, not ${entry.points}`);
          if (entry.result === "PARTIAL" && !(entry.points > 0 && entry.points < definition.maxPoints)) {
            diffs.push(`${id}: PARTIAL points must lie between 0 and ${definition.maxPoints}, not ${entry.points}`);
          }
        }
      }
      if (expected.partial === false) {
        for (const id of METRIC_IDS) if (!listed.includes(id)) diffs.push(`metrics must list all ${METRIC_IDS.length} ids, but ${id} is missing`);
        if (expected.scores === null || expected.scores === undefined) diffs.push("scores must be given when partial is false");
        if (expected.categories === null || expected.categories === undefined) {
          diffs.push("categories must be given when partial is false");
        } else {
          for (const id of CATEGORY_IDS) if (expected.categories[id] === undefined) diffs.push(`categories is missing ${id}`);
        }
      }
      if (Number.isNaN(new Date(site.scannedAt).getTime())) diffs.push(`site.json scannedAt is not a date: ${site.scannedAt}`);
      failIfAny(name, "fixture-file", diffs);
    });

    it("scans to the expected outcome and the expected page sample", () => {
      const { fixture, fetcher, snapshot, report } = run;
      const { expected, site } = fixture;
      const diffs: string[] = [];
      if (snapshot.outcome !== wantedOutcome(expected)) {
        diffs.push(`snapshot outcome expected ${wantedOutcome(expected)}, got ${snapshot.outcome} (${snapshot.outcomeDetail ?? "no detail"})`);
      }
      if (report.outcome !== wantedOutcome(expected)) diffs.push(`report outcome expected ${wantedOutcome(expected)}, got ${report.outcome}`);
      if (site.samplingExpectation !== undefined) {
        const want = expectedSample(site);
        const got = snapshot.pages.map((page) => page.url);
        if (JSON.stringify(got) !== JSON.stringify(want)) {
          diffs.push(`sampled pages differ\n      expected: ${want.join(" ") || "(none)"}\n      got:      ${got.join(" ") || "(none)"}`);
        }
      }
      if (expected.outcome === "BLOCKED_BY_ROBOTS") {
        const robots = `${new URL(site.inputUrl).origin}/robots.txt`;
        if (JSON.stringify(fetcher.hops) !== JSON.stringify([robots])) {
          diffs.push(`a blocked scan may request only ${robots}, but it requested: ${fetcher.hops.join(" ") || "(nothing)"}`);
        }
      }
      for (const url of fetcher.hops) {
        if (new URL(url).hostname !== new URL(site.inputUrl).hostname) diffs.push(`requested a host outside the fixture: ${url}`);
      }
      failIfAny(name, "scan", diffs);
    });

    it("reports the expected scores", ({ skip }) => {
      const { expected } = run.fixture;
      if (expected.partial) skip();
      const want = expected.scores;
      if (want === null) throw new Error(`${name}: expected.json has no scores`);
      const got = run.report.scores;
      const diffs: string[] = [];
      for (const key of ["overall", "seo", "aeo"] as const) {
        if (!near(got[key], want[key], TOLERANCE_SCORE)) diffs.push(`${key}: expected ${show(want[key])}, got ${show(got[key])}`);
      }
      if (!near(got.coverage, want.coverage, TOLERANCE_UNIT)) diffs.push(`coverage: expected ${show(want.coverage)}, got ${show(got.coverage)}`);
      if (!near(run.report.coverage, got.coverage, 1e-12)) diffs.push(`report.coverage ${run.report.coverage} differs from scores.coverage ${got.coverage}`);
      failIfAny(name, "score", diffs);
    });

    it("reports the expected category scores, coverage and visibility", ({ skip }) => {
      const { expected } = run.fixture;
      if (expected.partial) skip();
      const diffs: string[] = [];
      for (const id of CATEGORY_IDS) {
        const want = expected.categories?.[id];
        const got = run.report.scores.categories[id];
        if (want === undefined) {
          diffs.push(`${id}: expected.json has no entry`);
          continue;
        }
        if (!near(got.score, want.score, TOLERANCE_UNIT)) diffs.push(`${id} score: expected ${show(want.score)}, got ${show(got.score)}`);
        // A category with nothing applicable has no coverage figure; expected.json can only write that as 0.
        if (!near(got.coverage ?? 0, want.coverage, TOLERANCE_UNIT)) {
          diffs.push(`${id} coverage: expected ${show(want.coverage)}, got ${show(got.coverage)}`);
        }
        if (got.shown !== want.shown) diffs.push(`${id} shown: expected ${want.shown}, got ${got.shown}`);
      }
      failIfAny(name, "category", diffs);
    });

    it("raises the expected critical findings", () => {
      const want: string[] = [...new Set(run.fixture.expected.criticalFindings)].sort();
      const got: string[] = [...new Set(run.report.criticalFindings.map((finding) => finding.id))].sort();
      const diffs: string[] = [];
      for (const id of want) if (!got.includes(id)) diffs.push(`${id}: expected but not raised`);
      for (const id of got) {
        if (!want.includes(id)) {
          const summary = run.report.criticalFindings.find((finding) => finding.id === id)?.summary ?? "";
          diffs.push(`${id}: raised but not expected (${summary})`);
        }
      }
      failIfAny(name, "critical finding", diffs);
    });

    it("returns the expected result and points for every listed metric", () => {
      const { expected } = run.fixture;
      const byId = new Map(run.report.metrics.map((metric) => [metric.metricId, metric]));
      const diffs: string[] = [];
      for (const [id, want] of Object.entries(expected.metrics)) {
        const line = metricLine(name, id, want, byId.get(id));
        if (line !== null) diffs.push(line);
      }
      failIfAny(name, "metric", diffs);
    });

    it("lists all 52 metrics once, in methodology order", () => {
      expect(run.report.metrics.map((metric) => metric.metricId)).toEqual([...METRIC_IDS]);
    });

    it("keeps evidence and explanations bounded and free of control or bidirectional characters", () => {
      const { expected } = run.fixture;
      const robustness = (expected as FixtureExpected & { robustness?: Robustness }).robustness;
      const limit = Math.min(EVIDENCE_STRING_MAX, robustness?.maxEvidenceStringChars ?? EVIDENCE_STRING_MAX);
      const strings: Array<{ where: string; text: string }> = [];
      for (const metric of run.report.metrics) {
        collectStrings(metric.evidence, `${metric.metricId}.evidence`, strings);
        strings.push({ where: `${metric.metricId}.explanation`, text: metric.explanation });
      }
      const diffs: string[] = [];
      for (const { where, text } of strings) {
        const problem = stringProblem(text, limit);
        if (problem !== null) diffs.push(`${where}: ${problem}`);
        if (diffs.length >= 25) break;
      }
      failIfAny(name, "evidence string", diffs);
    });

    it("evaluates within the fixture's time bound", ({ skip }) => {
      const { expected } = run.fixture;
      const limit = (expected as FixtureExpected & { robustness?: Robustness }).robustness?.maxEvaluationMs;
      if (limit === undefined) skip();
      expect(run.evaluationMs, `${name}: evaluation took ${Math.round(run.evaluationMs)} ms`).toBeLessThan(limit as number);
    });
  });
});
