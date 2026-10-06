import { describe, expect, it } from "vitest";
import { METHODOLOGY, metricsForCategory } from "@/lib/visibility/methodology";
import {
  aggregatePageScores,
  computeScoreSummary,
  deriveResultCode,
  displayScore,
  noScoreSummary,
  notApplicable,
  notObserved,
  notObservedForAll,
  pointsFor,
  resultFromPageScores,
  resultFromScore,
  roundHalfUp,
  scanError,
  scoreBand,
  scoreCategory,
  summariseScores,
} from "@/lib/visibility/scoring";
import {
  CATEGORY_IDS,
  type CategoryId,
  type CategoryScore,
  type MetricResult,
  type PerPageScore,
  type Pillar,
} from "@/lib/visibility/types";

const EMPTY = {};

function uniform(categoryId: CategoryId, s: number): MetricResult[] {
  return metricsForCategory(categoryId).map((m) => resultFromScore(m.id, s, EMPTY, "uniform"));
}

function unobserved(categoryId: CategoryId): MetricResult[] {
  return metricsForCategory(categoryId).map((m) => notObserved(m.id, "not observed"));
}

function build(scores: Partial<Record<CategoryId, number | "none">>): MetricResult[] {
  const results: MetricResult[] = [];
  for (const id of CATEGORY_IDS) {
    const s = scores[id];
    if (s === undefined || s === "none") continue;
    results.push(...uniform(id, s));
  }
  return results;
}

function pages(
  spec: (number | "not_observed" | "scan_error" | "not_applicable")[]
): PerPageScore[] {
  return spec.map((entry, i) => {
    const url = `https://example.ie/p${i}`;
    if (typeof entry === "number") {
      return { url, score: entry, status: "observed", evidence: { n: i } };
    }
    return { url, score: null, status: entry, evidence: { n: i } };
  });
}

function categoryOf(id: CategoryId) {
  return METHODOLOGY.categories.find((c) => c.id === id)!;
}

function syntheticCategory(
  id: CategoryId,
  pillar: Pillar,
  weight: number,
  score: number | null,
  shown = true
): CategoryScore {
  return {
    id,
    pillar,
    weight,
    points: score === null ? 0 : score * 100,
    appliedMax: score === null ? 0 : 100,
    possibleMax: 100,
    coverage: score === null ? 0 : 1,
    score,
    shown,
  };
}

function syntheticSummary(
  scores: Record<CategoryId, number | null>,
  shown: Partial<Record<CategoryId, boolean>> = {}
) {
  const categories = {} as Record<CategoryId, CategoryScore>;
  for (const def of METHODOLOGY.categories) {
    categories[def.id] = syntheticCategory(
      def.id,
      def.pillar,
      def.weight,
      scores[def.id],
      shown[def.id] ?? true
    );
  }
  return summariseScores(categories);
}

describe("rounding", () => {
  it("rounds half up, not to even", () => {
    expect(roundHalfUp(0.5, 0)).toBe(1);
    expect(roundHalfUp(1.5, 0)).toBe(2);
    expect(roundHalfUp(2.5, 0)).toBe(3);
    expect(roundHalfUp(3.5, 0)).toBe(4);
    expect(roundHalfUp(0.005, 2)).toBe(0.01);
    expect(roundHalfUp(0.015, 2)).toBe(0.02);
    expect(roundHalfUp(0.00005, 4)).toBe(0.0001);
  });

  it("absorbs binary representation error at the half boundary", () => {
    expect(roundHalfUp(1.005, 2)).toBe(1.01);
    expect(roundHalfUp(2.675, 2)).toBe(2.68);
    expect(roundHalfUp(1.0049999, 2)).toBe(1);
    expect(roundHalfUp(14.000000000000002, 2)).toBe(14);
    expect(roundHalfUp(57.49999999999999, 0)).toBe(58);
    expect(roundHalfUp(0.49999999, 0)).toBe(0);
    expect(roundHalfUp(0.4999999995, 0)).toBe(1);
  });

  it("keeps values below the half boundary down", () => {
    expect(roundHalfUp(0.4999, 0)).toBe(0);
    expect(roundHalfUp(66.2499, 0)).toBe(66);
    expect(roundHalfUp(0.00004, 4)).toBe(0);
  });

  it("never returns negative zero", () => {
    expect(Object.is(roundHalfUp(0, 2), 0)).toBe(true);
    expect(Object.is(roundHalfUp(-0, 2), 0)).toBe(true);
  });

  it("displays the stored two-decimal score rounded half up", () => {
    expect(displayScore(57.5)).toBe(58);
    expect(displayScore(66.25)).toBe(66);
    expect(displayScore(74.5)).toBe(75);
    expect(displayScore(99.5)).toBe(100);
    expect(displayScore(0)).toBe(0);
    expect(displayScore(49.49)).toBe(49);
    expect(displayScore(null)).toBeNull();
  });
});

describe("score bands (4.7)", () => {
  it("maps the displayed whole number to the four plan labels", () => {
    expect(scoreBand(100)).toBe("Strong signals detected");
    expect(scoreBand(85)).toBe("Strong signals detected");
    expect(scoreBand(84)).toBe("Good foundations");
    expect(scoreBand(70)).toBe("Good foundations");
    expect(scoreBand(69)).toBe("Some gaps");
    expect(scoreBand(50)).toBe("Some gaps");
    expect(scoreBand(49)).toBe("Many gaps");
    expect(scoreBand(0)).toBe("Many gaps");
  });

  it("bands the rounded figure so the label agrees with the number shown beside it", () => {
    expect(displayScore(84.5)).toBe(85);
    expect(scoreBand(84.5)).toBe("Strong signals detected");
    expect(scoreBand(84.49)).toBe("Good foundations");
    expect(scoreBand(69.5)).toBe("Good foundations");
    expect(scoreBand(49.5)).toBe("Some gaps");
    expect(scoreBand(66.25)).toBe("Some gaps");
    expect(scoreBand(57.5)).toBe("Some gaps");
  });

  it("gives no band to a withheld score", () => {
    expect(scoreBand(null)).toBeNull();
    expect(scoreBand(Number.NaN)).toBeNull();
  });
});

describe("result code and points (4.3.2)", () => {
  it("maps s = 1 to PASS, s = 0 to FAIL and anything else to PARTIAL", () => {
    expect(deriveResultCode(1)).toBe("PASS");
    expect(deriveResultCode(0)).toBe("FAIL");
    expect(deriveResultCode(0.5)).toBe("PARTIAL");
    expect(deriveResultCode(0.7)).toBe("PARTIAL");
  });

  it("applies the 1e-9 comparison tolerance", () => {
    expect(deriveResultCode(1 - 1e-10)).toBe("PASS");
    expect(deriveResultCode(1e-10)).toBe("FAIL");
    expect(deriveResultCode(1 - 1e-8)).toBe("PARTIAL");
    expect(deriveResultCode(1e-8)).toBe("PARTIAL");
    expect(deriveResultCode(1 + 1e-10)).toBe("PASS");
    expect(deriveResultCode(-1e-10)).toBe("FAIL");
  });

  it("rejects scores that are not numbers in [0, 1]", () => {
    expect(() => deriveResultCode(NaN)).toThrow(RangeError);
    expect(() => deriveResultCode(Infinity)).toThrow(RangeError);
    expect(() => deriveResultCode(1.01)).toThrow(RangeError);
    expect(() => deriveResultCode(-0.01)).toThrow(RangeError);
  });

  it("computes points as round2(maxPoints x s)", () => {
    expect(pointsFor(20, 0.7)).toBe(14);
    expect(pointsFor(20, 1)).toBe(20);
    expect(pointsFor(20, 0)).toBe(0);
    expect(pointsFor(10, 0.12345)).toBe(1.23);
    expect(pointsFor(10, 0.0005)).toBe(0.01);
    expect(pointsFor(15, 1 / 3)).toBe(5);
    expect(pointsFor(25, 2 / 3)).toBe(16.67);
    expect(pointsFor(20, 1 - 1e-12)).toBe(20);
  });
});

describe("resultFromScore", () => {
  it("builds a PARTIAL result for S2.01 at 0.7", () => {
    const r = resultFromScore("S2.01", 0.7, { note: "x" }, "3 of 5 pages are in range");
    expect(r).toEqual({
      metricId: "S2.01",
      metricVersion: 1,
      result: "PARTIAL",
      points: 14,
      maxPoints: 20,
      evidence: { note: "x" },
      explanation: "3 of 5 pages are in range",
      reviewedBy: null,
    });
  });

  it("builds PASS at full points and FAIL at zero", () => {
    const pass = resultFromScore("S1.03", 1, EMPTY, "ok");
    expect(pass.result).toBe("PASS");
    expect(pass.points).toBe(20);
    expect(pass.maxPoints).toBe(20);
    const fail = resultFromScore("S1.03", 0, EMPTY, "none");
    expect(fail.result).toBe("FAIL");
    expect(fail.points).toBe(0);
    expect(fail.maxPoints).toBe(20);
  });

  it("rounds points half up to two decimals", () => {
    expect(resultFromScore("S2.09", 0.0005, EMPTY, "x").points).toBe(0.01);
    expect(resultFromScore("S1.05", 0.12345, EMPTY, "x").points).toBe(1.23);
    expect(resultFromScore("S2.05", 0.335, EMPTY, "x").points).toBe(5.03);
  });

  it("throws for an unknown metric and for an invalid score", () => {
    expect(() => resultFromScore("S9.99", 1, EMPTY, "x")).toThrow(/Unknown metric/);
    expect(() => resultFromScore("S1.01", 2, EMPTY, "x")).toThrow(RangeError);
  });
});

describe("notApplicable, notObserved and scanError", () => {
  it("NOT_APPLICABLE has null points and null maxPoints", () => {
    const r = notApplicable("S2.02", "Fewer than 2 titled pages.");
    expect(r.result).toBe("NOT_APPLICABLE");
    expect(r.points).toBeNull();
    expect(r.maxPoints).toBeNull();
    expect(r.explanation).toBe("Fewer than 2 titled pages.");
    expect(r.evidence).toEqual({ branch: "NOT_APPLICABLE", reason: "Fewer than 2 titled pages." });
    expect(r.metricVersion).toBe(1);
    expect(r.reviewedBy).toBeNull();
  });

  it("NOT_OBSERVED and SCAN_ERROR keep the metric's maxPoints with null points", () => {
    const observed = notObserved("S3.01", "Port 80 refused the connection.");
    expect(observed.result).toBe("NOT_OBSERVED");
    expect(observed.points).toBeNull();
    expect(observed.maxPoints).toBe(20);
    const error = scanError("S1.02", "robots.txt returned 503.");
    expect(error.result).toBe("SCAN_ERROR");
    expect(error.points).toBeNull();
    expect(error.maxPoints).toBe(25);
    expect(error.explanation).toBe("robots.txt returned 503.");
  });

  it("accepts caller evidence in place of the default", () => {
    const r = notObserved("S3.05", "One sample.", { samples: 1 });
    expect(r.evidence).toEqual({ samples: 1 });
  });

  it("throws for an unknown metric", () => {
    expect(() => notApplicable("X1.01", "x")).toThrow();
    expect(() => notObserved("X1.01", "x")).toThrow();
    expect(() => scanError("X1.01", "x")).toThrow();
  });
});

describe("aggregatePageScores and resultFromPageScores (4.3.2)", () => {
  it("reproduces the S2.01 worked example: pages [1, 1, 0.5, 1, 0] give 14.00 PARTIAL", () => {
    const perPage = pages([1, 1, 0.5, 1, 0]);
    const aggregate = aggregatePageScores(perPage);
    expect(aggregate.outcome).toBe("scored");
    expect(aggregate.mean).toBeCloseTo(0.7, 12);
    const r = resultFromPageScores("S2.01", perPage, null, "3 of 5 pages have a title in range");
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(14);
    expect(r.maxPoints).toBe(20);
    expect(r.explanation).toBe("3 of 5 pages have a title in range");
  });

  it("defaults the evidence to one record per page with its score", () => {
    const r = resultFromPageScores("S2.01", pages([1, 0.5]), undefined, "x");
    expect(r.evidence).toEqual([
      { n: 0, url: "https://example.ie/p0", status: "observed", s_p: 1 },
      { n: 1, url: "https://example.ie/p1", status: "observed", s_p: 0.5 },
    ]);
  });

  it("keeps caller evidence when given", () => {
    const r = resultFromPageScores("S2.01", pages([1]), [{ url: "u", chars: 42 }], "x");
    expect(r.evidence).toEqual([{ url: "u", chars: 42 }]);
  });

  it("gives PASS when every page scores 1 and FAIL when every page scores 0", () => {
    expect(resultFromPageScores("S2.08", pages([1, 1, 1]), null, "x").result).toBe("PASS");
    const fail = resultFromPageScores("S2.08", pages([0, 0]), null, "x");
    expect(fail.result).toBe("FAIL");
    expect(fail.points).toBe(0);
  });

  it("is NOT_APPLICABLE when there are no pages or none is applicable", () => {
    for (const perPage of [[], pages(["not_applicable", "not_applicable"])]) {
      const r = resultFromPageScores("S2.07", perPage, null, "x");
      expect(r.result).toBe("NOT_APPLICABLE");
      expect(r.points).toBeNull();
      expect(r.maxPoints).toBeNull();
    }
  });

  it("excludes not_applicable pages from the half rule and the mean", () => {
    const r = resultFromPageScores(
      "S2.07",
      pages([1, "not_applicable", 0, "not_applicable", "not_observed"]),
      null,
      "x"
    );
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(5);
  });

  it("is NOT_OBSERVED when fewer than half of the applicable pages were observed", () => {
    const r = resultFromPageScores(
      "S2.05",
      pages([1, 1, "not_observed", "not_observed", "not_observed"]),
      null,
      "x"
    );
    expect(r.result).toBe("NOT_OBSERVED");
    expect(r.points).toBeNull();
    expect(r.maxPoints).toBe(15);
    expect(r.explanation).toMatch(/2 of 5/);
  });

  it("is SCAN_ERROR when fewer than half were observed and any gap is a scan error", () => {
    const r = resultFromPageScores(
      "S2.05",
      pages([1, "not_observed", "scan_error", "not_observed", "not_observed"]),
      null,
      "x"
    );
    expect(r.result).toBe("SCAN_ERROR");
    expect(r.points).toBeNull();
    expect(r.maxPoints).toBe(15);
    expect(
      resultFromPageScores("S1.01", pages(["scan_error", "scan_error", 1]), null, "x").result
    ).toBe("SCAN_ERROR");
  });

  it("scores when exactly half of the applicable pages were observed", () => {
    const r = resultFromPageScores("S2.05", pages([1, 0, "not_observed", "scan_error"]), null, "x");
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(7.5);
  });

  it("scores when only one page is applicable and it was observed", () => {
    const r = resultFromPageScores("S4.02", pages([0.5]), null, "x");
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(10);
  });

  it("treats a single applicable page that was not observed as NOT_OBSERVED", () => {
    expect(resultFromPageScores("S4.02", pages(["not_observed"]), null, "x").result).toBe(
      "NOT_OBSERVED"
    );
    expect(resultFromPageScores("S4.02", pages(["scan_error"]), null, "x").result).toBe(
      "SCAN_ERROR"
    );
  });

  it("averages only the observed pages", () => {
    const r = resultFromPageScores("S2.05", pages([1, 0, "not_observed"]), null, "x");
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(7.5);
  });

  it("falls back to a generated explanation when none is given", () => {
    const r = resultFromPageScores("S2.05", pages([1, 0]), null, "  ");
    expect(r.explanation).toBe("Mean page score 0.5 over 2 observed pages.");
  });

  it("throws when an observed page has no usable score", () => {
    const bad: PerPageScore[] = [
      { url: "https://example.ie/", score: null, status: "observed", evidence: {} },
    ];
    expect(() => resultFromPageScores("S2.05", bad, null, "x")).toThrow(TypeError);
    expect(() => resultFromPageScores("S2.05", pages([1.5]), null, "x")).toThrow(RangeError);
  });

  it("does not mutate its inputs", () => {
    const perPage = Object.freeze(pages([1, 0.5]).map((p) => Object.freeze(p)));
    expect(() => resultFromPageScores("S2.05", perPage, null, "x")).not.toThrow();
  });
});

describe("evidence hygiene", () => {
  it("caps strings at 200 characters, ending in an ellipsis", () => {
    const r = resultFromScore("S1.03", 1, { text: "a".repeat(500) }, "b".repeat(300));
    const text = (r.evidence as { text: string }).text;
    expect(text).toHaveLength(200);
    expect(text).toBe(`${"a".repeat(199)}…`);
    expect(r.explanation).toBe(`${"b".repeat(199)}…`);
  });

  it("caps object keys and strings inside arrays at 200 characters too", () => {
    const r = resultFromScore(
      "S1.03",
      1,
      [{ ["k".repeat(300)]: ["v".repeat(300)] }],
      "x"
    );
    const record = (r.evidence as Record<string, string[]>[])[0];
    const [key] = Object.keys(record);
    expect(key).toHaveLength(200);
    expect(record[key][0]).toHaveLength(200);
  });

  it("cuts a string of 201 characters to 199 plus an ellipsis", () => {
    const r = resultFromScore("S1.03", 1, { text: "d".repeat(201) }, "x");
    expect((r.evidence as { text: string }).text).toBe(`${"d".repeat(199)}…`);
  });

  it("leaves a string of exactly 200 characters untouched", () => {
    const exact = "c".repeat(200);
    const r = resultFromScore("S1.03", 1, { text: exact }, exact);
    expect((r.evidence as { text: string }).text).toBe(exact);
    expect(r.explanation).toBe(exact);
  });

  it("caps by UTF-16 length and never splits a surrogate pair", () => {
    const r = resultFromScore("S1.03", 1, { text: "\u{1F600}".repeat(250) }, "x");
    const text = (r.evidence as { text: string }).text;
    expect(text.length).toBeLessThanOrEqual(200);
    expect(Array.from(text)).toHaveLength(100);
    expect(text.endsWith("…")).toBe(true);
    expect(text).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
    expect(text).not.toMatch(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
  });

  it("keeps a string of 100 astral characters that is exactly 200 code units", () => {
    const exact = "\u{1F600}".repeat(100);
    const r = resultFromScore("S1.03", 1, { text: exact }, "x");
    expect((r.evidence as { text: string }).text).toBe(exact);
  });

  it("drops lone surrogates and tag characters used to hide text", () => {
    const tag = String.fromCodePoint(0xe0041, 0xe0042);
    const r = resultFromScore(
      "S1.03",
      1,
      { text: `a\uD800b${tag}c\u{AD}d\u{2060}e\u{61C}f` },
      "x"
    );
    expect((r.evidence as { text: string }).text).toBe("abcdef");
  });

  it("replaces control characters with spaces and drops invisible and bidi characters", () => {
    const r = resultFromScore(
      "S1.03",
      1,
      { text: "a\nb\tc\u0000d\u{200B}e\u{202E}f\u{2066}g\u{FEFF}h" },
      "line1\nline2"
    );
    expect((r.evidence as { text: string }).text).toBe("a b c defgh");
    expect(r.explanation).toBe("line1 line2");
  });

  it("turns non-finite numbers into null and drops __proto__ keys", () => {
    const hostile = JSON.parse('{"__proto__": {"polluted": true}, "ok": 1}') as Record<
      string,
      unknown
    >;
    const r = resultFromScore(
      "S1.03",
      1,
      { n: Number.NaN, inf: Infinity, ...hostile } as never,
      "x"
    );
    expect(r.evidence).toEqual({ n: null, inf: null, ok: 1 });
    expect(Object.getPrototypeOf(r.evidence)).toBe(Object.prototype);
    expect((r.evidence as { polluted?: boolean }).polluted).toBeUndefined();
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it("cuts evidence nested deeper than the cap", () => {
    let nested: Record<string, unknown> = { leaf: "x" };
    for (let i = 0; i < 20; i += 1) nested = { next: nested };
    const r = resultFromScore("S1.03", 1, nested as never, "x");
    let cursor = r.evidence as Record<string, unknown> | null;
    let depth = 0;
    while (cursor && typeof cursor === "object") {
      cursor = cursor.next as Record<string, unknown> | null;
      depth += 1;
    }
    expect(depth).toBeLessThan(12);
  });
});

describe("scoreCategory (4.3.3)", () => {
  it("scores a fully passing category at 1 with full coverage", () => {
    const c = scoreCategory(categoryOf("S1"), uniform("S1", 1));
    expect(c).toEqual({
      id: "S1",
      pillar: "SEO",
      weight: 15,
      points: 100,
      appliedMax: 100,
      possibleMax: 100,
      coverage: 1,
      score: 1,
      shown: true,
    });
  });

  it("shows a category whose coverage is exactly 0.5", () => {
    const results = [
      resultFromScore("S1.01", 1, EMPTY, "x"),
      resultFromScore("S1.02", 1, EMPTY, "x"),
      notObserved("S1.03", "x"),
      notObserved("S1.04", "x"),
      scanError("S1.05", "x"),
    ];
    const c = scoreCategory(categoryOf("S1"), results);
    expect(c.appliedMax).toBe(50);
    expect(c.possibleMax).toBe(100);
    expect(c.coverage).toBe(0.5);
    expect(c.shown).toBe(true);
    expect(c.score).toBe(1);
  });

  it("hides a category whose coverage is just below 0.5", () => {
    const results = [
      resultFromScore("S1.01", 1, EMPTY, "x"),
      resultFromScore("S1.03", 1, EMPTY, "x"),
      notObserved("S1.02", "x"),
      notObserved("S1.04", "x"),
      notObserved("S1.05", "x"),
    ];
    const c = scoreCategory(categoryOf("S1"), results);
    expect(c.appliedMax).toBe(45);
    expect(c.coverage).toBe(0.45);
    expect(c.shown).toBe(false);
    expect(c.score).toBe(1);
  });

  it("counts a FAIL as observed: it adds to appliedMax and coverage", () => {
    const c = scoreCategory(categoryOf("S1"), [
      resultFromScore("S1.01", 0, EMPTY, "x"),
      resultFromScore("S1.02", 0, EMPTY, "x"),
    ]);
    expect(c.appliedMax).toBe(50);
    expect(c.coverage).toBe(0.5);
    expect(c.shown).toBe(true);
    expect(c.score).toBe(0);
    expect(c.points).toBe(0);
  });

  it("honours a thresholds argument, with a coverage equal to the threshold counting as shown", () => {
    const half = [
      resultFromScore("S1.01", 1, EMPTY, "x"),
      resultFromScore("S1.02", 1, EMPTY, "x"),
    ];
    expect(
      scoreCategory(categoryOf("S1"), half, {
        categoryMinCoverage: 0.6,
        pillarMinShownWeight: 30,
        overallMinShownWeight: 70,
      }).shown
    ).toBe(false);
    expect(
      scoreCategory(categoryOf("S1"), half, {
        categoryMinCoverage: 0.5,
        pillarMinShownWeight: 30,
        overallMinShownWeight: 70,
      }).shown
    ).toBe(true);
  });

  it("excludes NOT_APPLICABLE metrics from both appliedMax and possibleMax", () => {
    const results = metricsForCategory("S2").map((m) =>
      m.id === "S2.02" || m.id === "S2.04"
        ? notApplicable(m.id, "n/a")
        : resultFromScore(m.id, 1, EMPTY, "x")
    );
    const c = scoreCategory(categoryOf("S2"), results);
    expect(c.appliedMax).toBe(85);
    expect(c.possibleMax).toBe(85);
    expect(c.coverage).toBe(1);
    expect(c.points).toBe(85);
    expect(c.score).toBe(1);
    expect(c.shown).toBe(true);
  });

  it("treats a category of only NOT_APPLICABLE metrics as not shown with null coverage and score", () => {
    const results = metricsForCategory("A3").map((m) => notApplicable(m.id, "n/a"));
    const c = scoreCategory(categoryOf("A3"), results);
    expect(c.appliedMax).toBe(0);
    expect(c.possibleMax).toBe(0);
    expect(c.coverage).toBeNull();
    expect(c.score).toBeNull();
    expect(c.shown).toBe(false);
    expect(c.points).toBe(0);
  });

  it("treats an empty results list as every metric NOT_OBSERVED", () => {
    const c = scoreCategory(categoryOf("A2"), []);
    expect(c.appliedMax).toBe(0);
    expect(c.possibleMax).toBe(100);
    expect(c.coverage).toBe(0);
    expect(c.score).toBeNull();
    expect(c.shown).toBe(false);
  });

  it("counts NOT_OBSERVED and SCAN_ERROR in possibleMax but not appliedMax", () => {
    const results = [
      resultFromScore("A1.01", 1, EMPTY, "x"),
      notObserved("A1.02", "x"),
      scanError("A1.03", "x"),
      resultFromScore("A1.04", 0.5, EMPTY, "x"),
    ];
    const c = scoreCategory(categoryOf("A1"), results);
    expect(c.appliedMax).toBe(80);
    expect(c.possibleMax).toBe(100);
    expect(c.coverage).toBe(0.8);
    expect(c.points).toBe(60);
    expect(c.score).toBe(0.75);
  });

  it("rounds the category score to four decimals half up", () => {
    const results = [
      resultFromScore("A1.03", 1, EMPTY, "x"),
      resultFromScore("A1.04", 0, EMPTY, "x"),
    ];
    const c = scoreCategory(categoryOf("A1"), results);
    expect(c.points).toBe(5);
    expect(c.appliedMax).toBe(45);
    expect(c.score).toBe(0.1111);
    expect(c.coverage).toBe(0.45);
    const second = scoreCategory(categoryOf("A1"), [
      resultFromScore("A1.01", 2 / 3, EMPTY, "x"),
      resultFromScore("A1.02", 1, EMPTY, "x"),
    ]);
    expect(second.points).toBe(41.67);
    expect(second.score).toBe(0.7576);
  });

  it("sums the two-decimal metric points, as a reader would from the report table", () => {
    const results = metricsForCategory("S2").map((m) => resultFromScore(m.id, 1 / 3, EMPTY, "x"));
    const c = scoreCategory(categoryOf("S2"), results);
    const sumOfRoundedPoints = results.reduce((sum, r) => sum + (r.points ?? 0), 0);
    expect(c.points).toBeCloseTo(sumOfRoundedPoints, 9);
    expect(c.score).toBe(Math.round((c.points / 100) * 10000) / 10000);
  });

  it("ignores results that belong to other categories", () => {
    const c = scoreCategory(categoryOf("S1"), [...uniform("S1", 1), ...uniform("S2", 0)]);
    expect(c.score).toBe(1);
    expect(c.possibleMax).toBe(100);
  });

  it("throws on a duplicate result for a metric", () => {
    const results = [...uniform("S1", 1), resultFromScore("S1.01", 0, EMPTY, "x")];
    expect(() => scoreCategory(categoryOf("S1"), results)).toThrow(/Duplicate/);
  });

  it("throws when a scored result has missing or out-of-range points", () => {
    const missing: MetricResult = { ...resultFromScore("S1.01", 1, EMPTY, "x"), points: null };
    expect(() => scoreCategory(categoryOf("S1"), [missing])).toThrow(RangeError);
    const over: MetricResult = { ...resultFromScore("S1.01", 1, EMPTY, "x"), points: 26 };
    expect(() => scoreCategory(categoryOf("S1"), [over])).toThrow(RangeError);
  });
});

describe("worked example 4.3.6: aggregation", () => {
  const scores = { S1: 0.8, S2: 0.7, S3: 0.9, S4: 0.6, A1: 0.75, A2: 0.4, A3: 0.5, A4: 0.65 };

  it("reproduces SEO 75, AEO 57.5 (displayed 58) and overall 66.25 (displayed 66) from metric results", () => {
    const summary = computeScoreSummary(build(scores));
    for (const id of CATEGORY_IDS) {
      expect(summary.categories[id].score, id).toBe(scores[id]);
      expect(summary.categories[id].coverage, id).toBe(1);
      expect(summary.categories[id].shown, id).toBe(true);
    }
    expect(summary.seo).toBe(75);
    expect(summary.aeo).toBe(57.5);
    expect(summary.overall).toBe(66.25);
    expect(displayScore(summary.seo)).toBe(75);
    expect(displayScore(summary.aeo)).toBe(58);
    expect(displayScore(summary.overall)).toBe(66);
    expect(summary.coverage).toBe(1);
    expect(summary.shownWeight).toEqual({ seo: 50, aeo: 50, overall: 100 });
    expect(summary.withheld).toEqual({ seo: null, aeo: null, overall: null });
  });

  it("reproduces the same result from category scores alone", () => {
    const summary = syntheticSummary(scores);
    expect(summary.seo).toBe(75);
    expect(summary.aeo).toBe(57.5);
    expect(summary.overall).toBe(66.25);
  });

  it("matches the plan's weight x score table", () => {
    const seoSum = 15 * 0.8 + 15 * 0.7 + 10 * 0.9 + 10 * 0.6;
    const aeoSum = 15 * 0.75 + 15 * 0.4 + 10 * 0.5 + 10 * 0.65;
    expect(seoSum).toBeCloseTo(37.5, 9);
    expect(aeoSum).toBeCloseTo(28.75, 9);
    expect(seoSum / 50).toBeCloseTo(0.75, 9);
    expect(aeoSum / 50).toBeCloseTo(0.575, 9);
    expect((seoSum + aeoSum) / 100).toBeCloseTo(0.6625, 9);
  });

  it("is deterministic and leaves its input untouched", () => {
    const results = build(scores);
    const frozen = Object.freeze(results.map((r) => Object.freeze(r)));
    const first = computeScoreSummary(frozen);
    const second = computeScoreSummary(frozen);
    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });
});

describe("worked example 4.3.6: coverage", () => {
  it("hides A3 when its six metrics are all NOT_OBSERVED and computes the overall over 90 weight", () => {
    const results = [
      ...build({ S1: 0.8, S2: 0.7, S3: 0.9, S4: 0.6, A1: 0.75, A2: 0.4, A4: 0.65 }),
      ...unobserved("A3"),
    ];
    expect(results.filter((r) => r.metricId.startsWith("A3"))).toHaveLength(6);
    const summary = computeScoreSummary(results);
    const a3 = summary.categories.A3;
    expect(a3.coverage).toBe(0);
    expect(a3.score).toBeNull();
    expect(a3.shown).toBe(false);
    expect(a3.possibleMax).toBe(100);
    expect(a3.appliedMax).toBe(0);
    expect(summary.shownWeight).toEqual({ seo: 50, aeo: 40, overall: 90 });
    expect(summary.withheld).toEqual({ seo: null, aeo: null, overall: null });
    expect(summary.seo).toBe(75);
    expect(summary.aeo).toBe(59.38);
    expect(summary.overall).toBe(68.06);
    expect(summary.coverage).toBe(0.9);
  });
});

describe("withholding rules (4.3.5)", () => {
  const all = { S1: 1, S2: 1, S3: 1, S4: 1, A1: 1, A2: 1, A3: 1, A4: 1 } as const;

  it("publishes a pillar whose shown weight is exactly 30", () => {
    const summary = computeScoreSummary(build({ ...all, S3: "none", S4: "none" }));
    expect(summary.shownWeight.seo).toBe(30);
    expect(summary.seo).toBe(100);
    expect(summary.withheld.seo).toBeNull();
    expect(summary.overall).toBe(100);
    expect(summary.shownWeight.overall).toBe(80);
  });

  it("withholds a pillar below 30 shown weight and forces the overall to be withheld", () => {
    const summary = computeScoreSummary(build({ ...all, S2: "none", S4: "none" }));
    expect(summary.shownWeight.seo).toBe(25);
    expect(summary.seo).toBeNull();
    expect(summary.withheld.seo).toBe("PILLAR_WEIGHT_BELOW_MINIMUM");
    expect(summary.aeo).toBe(100);
    expect(summary.withheld.aeo).toBeNull();
    expect(summary.shownWeight.overall).toBe(75);
    expect(summary.overall).toBeNull();
    expect(summary.withheld.overall).toBe("PILLAR_NOT_PUBLISHED");
  });

  it("forces the overall to be withheld when the AEO pillar is withheld, even above 70 shown weight", () => {
    const summary = computeScoreSummary(build({ ...all, A2: "none", A3: "none" }));
    expect(summary.shownWeight).toEqual({ seo: 50, aeo: 25, overall: 75 });
    expect(summary.aeo).toBeNull();
    expect(summary.seo).toBe(100);
    expect(summary.overall).toBeNull();
    expect(summary.withheld.overall).toBe("PILLAR_NOT_PUBLISHED");
  });

  it("publishes the overall when the shown weight is exactly 70", () => {
    const summary = computeScoreSummary(
      build({ S1: 1, S2: 1, S3: 1, A1: 1, A2: 1, S4: "none", A3: "none", A4: "none" })
    );
    expect(summary.shownWeight).toEqual({ seo: 40, aeo: 30, overall: 70 });
    expect(summary.seo).toBe(100);
    expect(summary.aeo).toBe(100);
    expect(summary.overall).toBe(100);
    expect(summary.withheld.overall).toBeNull();
  });

  it("withholds the overall at 65 shown weight although both pillars are published", () => {
    const summary = computeScoreSummary(
      build({ S1: 1, S3: 1, S4: 1, A1: 1, A2: 1, S2: "none", A3: "none", A4: "none" })
    );
    expect(summary.shownWeight).toEqual({ seo: 35, aeo: 30, overall: 65 });
    expect(summary.seo).toBe(100);
    expect(summary.aeo).toBe(100);
    expect(summary.overall).toBeNull();
    expect(summary.withheld.overall).toBe("OVERALL_WEIGHT_BELOW_MINIMUM");
  });

  it("withholds the overall when both pillars sit at the 30 minimum (60 shown weight)", () => {
    const summary = computeScoreSummary(
      build({ S1: 1, S2: 1, A1: 1, A2: 1, S3: "none", S4: "none", A3: "none", A4: "none" })
    );
    expect(summary.shownWeight).toEqual({ seo: 30, aeo: 30, overall: 60 });
    expect(summary.seo).toBe(100);
    expect(summary.aeo).toBe(100);
    expect(summary.overall).toBeNull();
    expect(summary.withheld.overall).toBe("OVERALL_WEIGHT_BELOW_MINIMUM");
  });

  it("withholds everything when there are no results", () => {
    const summary = computeScoreSummary([]);
    expect(summary.seo).toBeNull();
    expect(summary.aeo).toBeNull();
    expect(summary.overall).toBeNull();
    expect(summary.coverage).toBe(0);
    expect(summary.shownWeight).toEqual({ seo: 0, aeo: 0, overall: 0 });
    expect(summary.withheld).toEqual({
      seo: "PILLAR_WEIGHT_BELOW_MINIMUM",
      aeo: "PILLAR_WEIGHT_BELOW_MINIMUM",
      overall: "PILLAR_NOT_PUBLISHED",
    });
  });

  it("treats a fractionally short pillar weight as below the minimum", () => {
    const summary = syntheticSummary(
      { S1: 1, S2: 1, S3: 1, S4: 1, A1: 1, A2: 1, A3: 1, A4: 1 },
      { S2: false }
    );
    expect(summary.shownWeight.seo).toBe(35);
    const tight = summariseScores({
      ...summary.categories,
      S1: syntheticCategory("S1", "SEO", 15, 1),
      S2: syntheticCategory("S2", "SEO", 14.9999, 1),
      S3: syntheticCategory("S3", "SEO", 0, 1, false),
      S4: syntheticCategory("S4", "SEO", 0, 1, false),
    });
    expect(tight.seo).toBeNull();
    expect(tight.withheld.seo).toBe("PILLAR_WEIGHT_BELOW_MINIMUM");
  });

  it("does not count a category with no applicable metrics towards shown weight", () => {
    const results = [
      ...build({ S1: 1, S2: 1, S3: 1, A1: 1, A2: 1, A4: 1 }),
      ...metricsForCategory("S4").map((m) => notApplicable(m.id, "n/a")),
      ...metricsForCategory("A3").map((m) => notApplicable(m.id, "n/a")),
    ];
    const summary = computeScoreSummary(results);
    expect(summary.categories.S4.coverage).toBeNull();
    expect(summary.categories.S4.shown).toBe(false);
    expect(summary.shownWeight).toEqual({ seo: 40, aeo: 40, overall: 80 });
    expect(summary.overall).toBe(100);
    expect(summary.coverage).toBe(1);
  });
});

describe("pillar and overall rounding", () => {
  it("rounds an exact x.xx5 pillar score half up", () => {
    // SEO = (15 x 1000 + 15 x 1001 + 10 x 1000 + 10 x 1001) / 50 / 100 = 50025 / 5000 = 10.005 exactly.
    const full = syntheticSummary({
      S1: 0.1,
      S2: 0.1001,
      S3: 0.1,
      S4: 0.1001,
      A1: 1,
      A2: 1,
      A3: 1,
      A4: 1,
    });
    expect(full.categories.S2.score).toBe(0.1001);
    expect(full.seo).toBe(10.01);

    const half = syntheticSummary(
      { S1: 0.1234, S2: 0.1235, S3: 0, S4: 0, A1: 1, A2: 1, A3: 1, A4: 1 },
      { S3: false, S4: false }
    );
    expect(half.shownWeight.seo).toBe(30);
    expect(half.seo).toBe(12.35);
  });

  it("aggregates from the four-decimal category scores", () => {
    const results = [
      resultFromScore("A1.03", 1, EMPTY, "x"),
      resultFromScore("A1.04", 0, EMPTY, "x"),
      ...build({ S1: 1, S2: 1, S3: 1, S4: 1, A2: 1, A3: 1, A4: 1 }),
    ];
    const summary = computeScoreSummary(results);
    expect(summary.categories.A1.score).toBe(0.1111);
    expect(summary.categories.A1.shown).toBe(false);
    expect(summary.aeo).toBe(100);
  });

  it("reports overall coverage as the weight-averaged applied / possible ratio", () => {
    const results = [
      ...build({ S1: 1, S2: 1, S3: 1, S4: 1, A2: 1, A3: 1, A4: 1 }),
      resultFromScore("A1.03", 1, EMPTY, "x"),
      resultFromScore("A1.04", 0, EMPTY, "x"),
      notObserved("A1.01", "x"),
      notObserved("A1.02", "x"),
    ];
    const summary = computeScoreSummary(results);
    expect(summary.categories.A1.coverage).toBe(0.45);
    // (85 x 1 + 15 x 0.45) / 100 = 0.9175
    expect(summary.coverage).toBe(0.9175);
  });

  it("builds overall coverage from unrounded ratios and leaves out categories with no applicable metric", () => {
    const results = [
      ...build({ S1: 1, S3: 1, S4: 1, A1: 1, A2: 1, A4: 1 }),
      ...metricsForCategory("A3").map((m) => notApplicable(m.id, "n/a")),
      ...metricsForCategory("S2").map((m) =>
        m.id === "S2.02" || m.id === "S2.04"
          ? notApplicable(m.id, "n/a")
          : m.id === "S2.01"
            ? resultFromScore(m.id, 1, EMPTY, "x")
            : notObserved(m.id, "x")
      ),
    ];
    const summary = computeScoreSummary(results);
    expect(summary.categories.S2.possibleMax).toBe(85);
    expect(summary.categories.S2.appliedMax).toBe(20);
    expect(summary.categories.S2.coverage).toBe(0.2353);
    expect(summary.categories.S2.shown).toBe(false);
    expect(summary.categories.A3.coverage).toBeNull();
    // A3 (weight 10) is left out of numerator and denominator: (75 + 15 x 20/85) / 90 = 0.8725490...
    expect(summary.coverage).toBe(0.8725);
    expect(summary.shownWeight).toEqual({ seo: 35, aeo: 40, overall: 75 });
    expect(summary.overall).toBe(100);
  });

  it("honours a thresholds argument in summariseScores", () => {
    const base = syntheticSummary({ S1: 1, S2: 1, S3: 1, S4: 1, A1: 1, A2: 1, A3: 1, A4: 1 });
    const strict = summariseScores(base.categories, {
      categoryMinCoverage: 0.5,
      pillarMinShownWeight: 51,
      overallMinShownWeight: 70,
    });
    expect(strict.seo).toBeNull();
    expect(strict.aeo).toBeNull();
    expect(strict.withheld.seo).toBe("PILLAR_WEIGHT_BELOW_MINIMUM");
    expect(strict.withheld.overall).toBe("PILLAR_NOT_PUBLISHED");
  });
});

describe("outcomes that produce no score", () => {
  it("notObservedForAll returns one NOT_OBSERVED result per metric with maxPoints set", () => {
    const results = notObservedForAll("No scan.");
    expect(results).toHaveLength(52);
    expect(results.map((r) => r.metricId)).toEqual(METHODOLOGY.metrics.map((m) => m.id));
    for (const r of results) {
      expect(r.result).toBe("NOT_OBSERVED");
      expect(r.points).toBeNull();
      expect(r.maxPoints).toBe(METHODOLOGY.metrics.find((m) => m.id === r.metricId)!.maxPoints);
    }
  });

  it("noScoreSummary has no scores, no shown categories and NO_SCORE_OUTCOME everywhere", () => {
    const summary = noScoreSummary();
    expect(summary.overall).toBeNull();
    expect(summary.seo).toBeNull();
    expect(summary.aeo).toBeNull();
    expect(summary.coverage).toBe(0);
    expect(summary.shownWeight).toEqual({ seo: 0, aeo: 0, overall: 0 });
    expect(summary.withheld).toEqual({
      seo: "NO_SCORE_OUTCOME",
      aeo: "NO_SCORE_OUTCOME",
      overall: "NO_SCORE_OUTCOME",
    });
    for (const id of CATEGORY_IDS) {
      expect(summary.categories[id].score, id).toBeNull();
      expect(summary.categories[id].coverage, id).toBe(0);
      expect(summary.categories[id].shown, id).toBe(false);
    }
  });
});

describe("input validation", () => {
  it("throws for a result that names an unknown metric", () => {
    const stray: MetricResult = {
      metricId: "S9.99",
      metricVersion: 1,
      result: "PASS",
      points: 10,
      maxPoints: 10,
      evidence: {},
      explanation: "x",
      reviewedBy: null,
    };
    expect(() => computeScoreSummary([stray])).toThrow(/unknown metric/);
  });
});
