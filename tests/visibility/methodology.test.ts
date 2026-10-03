import { describe, expect, it } from "vitest";
import { LISTS_VERSION } from "@/lib/visibility/lists";
import {
  CATEGORIES,
  METHODOLOGY,
  METHODOLOGY_VERSION,
  METRICS,
  THRESHOLDS,
  getCategory,
  getMetricDefinition,
  metricsForCategory,
} from "@/lib/visibility/methodology";
import {
  CATEGORY_IDS,
  METRIC_BASES,
  METRIC_IDS,
  METRIC_READS,
  METRIC_SCOPES,
  type CategoryId,
} from "@/lib/visibility/types";

// Written from plan 4.5 independently of the implementation: [id, name, points, scope, reads, basis].
const PLAN_CATALOGUE = [
  ["S1.01", "Pages are indexable", 25, "P", "meta", "VENDOR"],
  ["S1.02", "Crawlable by Googlebot and bingbot", 25, "P", "meta", "STD"],
  ["S1.03", "Valid XML sitemap discoverable", 20, "S", "site", "STD"],
  ["S1.04", "Canonical URL is consistent", 20, "P", "meta", "VENDOR"],
  ["S1.05", "Page returns success directly", 10, "P", "meta", "HEUR"],
  ["S2.01", "Title tag", 20, "P", "meta", "HEUR"],
  ["S2.02", "Titles are unique", 10, "S", "site", "VENDOR"],
  ["S2.03", "Meta description", 15, "P", "meta", "HEUR"],
  ["S2.04", "Descriptions are unique", 5, "S", "site", "VENDOR"],
  ["S2.05", "Single H1", 15, "P", "body", "HEUR"],
  ["S2.06", "Heading hierarchy", 10, "P", "body", "STD"],
  ["S2.07", "Image alt attributes", 10, "P", "body", "STD"],
  ["S2.08", "Language declared", 5, "P", "meta", "STD"],
  ["S2.09", "Share-preview tags", 10, "P", "meta", "STD"],
  ["S3.01", "HTTPS enforced", 20, "S", "site", "VENDOR"],
  ["S3.02", "Valid TLS certificate", 10, "S", "site", "STD"],
  ["S3.03", "Mobile viewport", 15, "P", "meta", "VENDOR"],
  ["S3.04", "Response compression", 10, "S", "site", "VENDOR"],
  ["S3.05", "Server response time", 10, "S", "site", "HEUR"],
  ["S3.06", "Broken internal links", 25, "S", "site", "HEUR"],
  ["S3.07", "No mixed content", 10, "P", "body", "STD"],
  ["S4.01", "Content depth", 30, "CP", "body", "HEUR"],
  ["S4.02", "Internal link breadth", 20, "H", "body", "HEUR"],
  ["S4.03", "Descriptive anchor text", 20, "P", "body", "HEUR"],
  ["S4.04", "Distinct content", 10, "S", "body", "HEUR"],
  ["S4.05", "Clean URLs", 10, "P", "meta", "HEUR"],
  ["S4.06", "Site navigation", 10, "P", "body", "HEUR"],
  ["A1.01", "AI search and answer crawlers allowed", 40, "P", "meta", "VENDOR"],
  ["A1.02", "Snippet and preview eligibility", 15, "P", "meta", "VENDOR"],
  ["A1.03", "llms.txt present", 5, "S", "site", "HEUR"],
  ["A1.04", "Primary content in the initial HTML", 40, "CP", "meta", "VENDOR"],
  ["A2.01", "Valid JSON-LD", 15, "P", "meta", "VENDOR"],
  ["A2.02", "Organisation identity", 20, "H", "meta", "STD"],
  ["A2.03", "Profile links (sameAs)", 10, "H", "meta", "HEUR"],
  ["A2.04", "Identity graph coherence", 10, "S", "site", "STD"],
  ["A2.05", "Page-type schema", 15, "P", "meta", "STD"],
  ["A2.06", "Breadcrumbs", 5, "P", "meta", "VENDOR"],
  ["A2.07", "Schema matches visible content", 15, "P", "body", "HEUR"],
  ["A2.08", "Name consistency", 10, "H", "meta", "HEUR"],
  ["A3.01", "Question-style headings", 10, "KO", "body", "HEUR"],
  ["A3.02", "Answer-first sections", 30, "KO", "body", "HEUR"],
  ["A3.03", "FAQ block present", 20, "S", "body", "HEUR"],
  ["A3.04", "Scannable structure", 15, "KO", "body", "HEUR"],
  ["A3.05", "Sentence and paragraph length", 10, "KO", "body", "HEUR"],
  ["A3.06", "Entity statement near the top", 15, "H", "body", "HEUR"],
  ["A4.01", "About page discoverable", 15, "H", "body", "HEUR"],
  ["A4.02", "Contact information visible", 15, "H", "body", "HEUR"],
  ["A4.03", "Author attribution", 15, "AP", "body", "HEUR"],
  ["A4.04", "Dates on articles", 10, "AP", "body", "HEUR"],
  ["A4.05", "Freshness", 20, "S", "site", "HEUR"],
  ["A4.06", "Privacy policy linked", 10, "H", "body", "HEUR"],
  ["A4.07", "External references", 15, "KO", "body", "HEUR"],
] as const;

const PLAN_CATEGORIES: [CategoryId, "SEO" | "AEO", string, number, number][] = [
  ["S1", "SEO", "Crawlability and indexation", 15, 5],
  ["S2", "SEO", "On-page fundamentals", 15, 9],
  ["S3", "SEO", "Technical health and speed basics", 10, 7],
  ["S4", "SEO", "Content and internal linking", 10, 6],
  ["A1", "AEO", "AI crawler access and content availability", 15, 4],
  ["A2", "AEO", "Structured data and entity clarity", 15, 8],
  ["A3", "AEO", "Answer-ready content", 10, 6],
  ["A4", "AEO", "Trust, authorship and freshness", 10, 7],
];

describe("methodology version and thresholds", () => {
  it("is the draft version and carries the 4.3 thresholds", () => {
    expect(METHODOLOGY_VERSION).toBe("0.1.0-draft");
    expect(METHODOLOGY.version).toBe("0.1.0-draft");
    expect(THRESHOLDS).toEqual({
      categoryMinCoverage: 0.5,
      pillarMinShownWeight: 30,
      overallMinShownWeight: 70,
    });
    expect(METHODOLOGY.thresholds).toEqual(THRESHOLDS);
    expect(METHODOLOGY.listVersions).toEqual({ aiAgents: LISTS_VERSION, patterns: LISTS_VERSION });
  });

  it("exposes the same metrics and categories through METHODOLOGY", () => {
    expect(METHODOLOGY.metrics).toEqual([...METRICS]);
    expect(METHODOLOGY.categories).toEqual([...CATEGORIES]);
  });

  it("is deeply frozen so evaluators cannot mutate the definition", () => {
    expect(Object.isFrozen(METHODOLOGY)).toBe(true);
    expect(Object.isFrozen(METRICS)).toBe(true);
    expect(Object.isFrozen(METRICS[0])).toBe(true);
    expect(Object.isFrozen(METRICS[0].limitations)).toBe(true);
    expect(Object.isFrozen(CATEGORIES[0].metricIds)).toBe(true);
  });
});

describe("categories", () => {
  it("has the 8 categories in order with the plan weights, pillars and names", () => {
    expect(CATEGORIES.map((c) => c.id)).toEqual([...CATEGORY_IDS]);
    expect(
      CATEGORIES.map((c) => [c.id, c.pillar, c.name, c.weight, c.metricIds.length])
    ).toEqual(PLAN_CATEGORIES);
  });

  it("weights sum to 100 and the pillars split 50/50", () => {
    const sum = (items: readonly { weight: number }[]) =>
      items.reduce((total, item) => total + item.weight, 0);
    expect(sum(CATEGORIES)).toBe(100);
    expect(sum(CATEGORIES.filter((c) => c.pillar === "SEO"))).toBe(50);
    expect(sum(CATEGORIES.filter((c) => c.pillar === "AEO"))).toBe(50);
    expect(CATEGORIES.filter((c) => c.pillar === "SEO").map((c) => c.id)).toEqual([
      "S1",
      "S2",
      "S3",
      "S4",
    ]);
    expect(CATEGORIES.filter((c) => c.pillar === "AEO").map((c) => c.id)).toEqual([
      "A1",
      "A2",
      "A3",
      "A4",
    ]);
  });

  it("gives every category metrics that sum to exactly 100 points", () => {
    for (const category of CATEGORIES) {
      const total = metricsForCategory(category.id).reduce((sum, m) => sum + m.maxPoints, 0);
      expect(total, `${category.id} points`).toBe(100);
    }
  });

  it("lists every metric in exactly one category, in catalogue order", () => {
    const listed = CATEGORIES.flatMap((c) => c.metricIds);
    expect(listed).toEqual([...METRIC_IDS]);
    for (const category of CATEGORIES) {
      for (const id of category.metricIds) {
        expect(getMetricDefinition(id).categoryId).toBe(category.id);
        expect(id.startsWith(category.id)).toBe(true);
      }
    }
  });
});

describe("metric catalogue", () => {
  it("has 52 metrics with unique ids that match METRIC_IDS in order", () => {
    expect(METRICS).toHaveLength(52);
    expect(new Set(METRICS.map((m) => m.id)).size).toBe(52);
    expect(METRICS.map((m) => m.id)).toEqual([...METRIC_IDS]);
  });

  it("matches the plan 4.5 ids, names, points, scopes, reads and bases exactly", () => {
    expect(METRICS.map((m) => [m.id, m.name, m.maxPoints, m.scope, m.reads, m.basis])).toEqual(
      PLAN_CATALOGUE.map((row) => [...row])
    );
  });

  it("uses only valid scopes, bases and reads", () => {
    for (const m of METRICS) {
      expect(METRIC_SCOPES, m.id).toContain(m.scope);
      expect(METRIC_BASES, m.id).toContain(m.basis);
      expect(METRIC_READS, m.id).toContain(m.reads);
    }
  });

  it("makes site-level scope S metrics read site or body, never meta pages", () => {
    for (const m of METRICS.filter((x) => x.scope === "S")) {
      expect(["site", "body"], m.id).toContain(m.reads);
    }
    expect(getMetricDefinition("A1.04").reads).toBe("meta");
    expect(getMetricDefinition("S4.04").reads).toBe("body");
    expect(getMetricDefinition("A3.03").reads).toBe("body");
  });

  it("uses only OBSERVED or DERIVED evidence and version 1", () => {
    for (const m of METRICS) {
      expect(["OBSERVED", "DERIVED"], m.id).toContain(m.evidenceType);
      expect(m.version, m.id).toBe(1);
    }
  });

  it("fills every text field", () => {
    for (const m of METRICS) {
      expect(m.description.trim().length, `${m.id} description`).toBeGreaterThan(10);
      expect(m.evaluationRule.trim().length, `${m.id} evaluationRule`).toBeGreaterThan(10);
      expect(m.applicabilityRule.trim().length, `${m.id} applicabilityRule`).toBeGreaterThan(5);
      expect(m.limitations.length, `${m.id} limitations`).toBeGreaterThan(0);
      for (const text of [...m.limitations, ...m.humanReviewWhen]) {
        expect(text.trim().length, m.id).toBeGreaterThan(5);
      }
    }
  });

  it("writes fix guidance as 'Consider ...' with no outcome promises", () => {
    const banned =
      /\b(will|guarantee[sd]?|ensure[sd]?|boost|ranks?|ranking|rankings|grade|worst|cited|citation)\b|AI visibility score/i;
    for (const m of METRICS) {
      expect(m.fixGuidance.startsWith("Consider "), m.id).toBe(true);
      expect(m.fixGuidance.endsWith("."), m.id).toBe(true);
      expect(m.fixGuidance, m.id).not.toMatch(banned);
    }
  });

  it("avoids the wording that 4.7 rules out and US spellings in user-facing text", () => {
    const banned = /\b(ranks|grade|worst)\b|you will be cited|AI visibility score/i;
    const us = /\b(optimi[z]e|normali[z]e|summari[z]e|behavior|color)/i;
    for (const m of METRICS) {
      const text = [
        m.name,
        m.description,
        m.applicabilityRule,
        m.evaluationRule,
        m.fixGuidance,
        ...m.limitations,
        ...m.humanReviewWhen,
      ].join(" ");
      expect(text, m.id).not.toMatch(banned);
      expect(text, m.id).not.toMatch(us);
      expect(text, m.id).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it("keeps the plan's thresholds in the condensed rules", () => {
    const rule = (id: string) => getMetricDefinition(id).evaluationRule;
    expect(rule("S2.01")).toMatch(/20 to 65/);
    expect(rule("S2.01")).toMatch(/10 to 19 or 66 to 90/);
    expect(rule("S2.03")).toMatch(/70 to 160/);
    expect(rule("S2.03")).toMatch(/30 to 69 or 161 to 220/);
    expect(rule("S3.02")).toMatch(/14 days/);
    expect(rule("S3.05")).toMatch(/800 ms/);
    expect(rule("S3.05")).toMatch(/1,800 ms/);
    expect(rule("S4.01")).toMatch(/300/);
    expect(rule("S4.01")).toMatch(/150 to 299/);
    expect(rule("S4.02")).toMatch(/8 or more/);
    expect(rule("S4.02")).toMatch(/3 to 7/);
    expect(rule("A1.04")).toMatch(/50 or more words/);
    expect(rule("A3.02")).toMatch(/15 to 70 words/);
    expect(rule("A3.02")).toMatch(/60%/);
    expect(rule("A3.02")).toMatch(/30% to 59%/);
    expect(rule("A3.05")).toMatch(/24 words/);
    expect(rule("A3.05")).toMatch(/100 words/);
    expect(rule("A4.05")).toMatch(/180 days/);
    expect(rule("A4.05")).toMatch(/181 to 365/);
    expect(rule("A4.05")).toMatch(/5 or more URLs/);
    expect(rule("A2.02")).toMatch(/\(8\)/);
    expect(getMetricDefinition("A3.01").applicabilityRule).toMatch(/lang starts with en/);
    expect(getMetricDefinition("A3.05").applicabilityRule).toMatch(/lang starts with en/);
    expect(getMetricDefinition("S3.06").applicabilityRule).toMatch(/fewer than 5/);
    expect(getMetricDefinition("S2.02").applicabilityRule).toMatch(/fewer than 2/);
  });

  it("applies metrics that read only the URL or the fetch record to unparsed pages as well", () => {
    for (const id of ["S1.02", "S1.05", "S4.05", "A1.01"]) {
      expect(getMetricDefinition(id).applicabilityRule, id).toMatch(/^Every sampled page/);
      expect(getMetricDefinition(id).applicabilityRule, id).not.toMatch(/fetched and parsed/);
    }
    for (const id of ["S1.01", "S1.04", "S2.01", "S3.03", "A2.01"]) {
      expect(getMetricDefinition(id).applicabilityRule, id).toMatch(/fetched and parsed/);
    }
  });

  it("says in every body metric's applicability rule that render-dependent pages are NOT_OBSERVED (4.2.6)", () => {
    for (const m of METRICS.filter((x) => x.reads === "body")) {
      expect(m.applicabilityRule, m.id).toMatch(/render-dependent/);
      expect(m.applicabilityRule, m.id).toMatch(/NOT_OBSERVED/);
    }
    for (const m of METRICS.filter((x) => x.reads !== "body")) {
      expect(m.applicabilityRule, m.id).not.toMatch(/render-dependent page is NOT_OBSERVED/);
    }
  });

  it("carries the plan's review triggers", () => {
    expect(getMetricDefinition("S1.01").humanReviewWhen.join(" ")).toMatch(/homepage scores FAIL/);
    expect(getMetricDefinition("S1.02").humanReviewWhen.join(" ")).toMatch(/homepage scores FAIL/);
    expect(getMetricDefinition("A3.02").humanReviewWhen.join(" ")).toMatch(/answer-first/);
    expect(getMetricDefinition("A4.05").humanReviewWhen.join(" ")).toMatch(/auto-generated/);
    expect(getMetricDefinition("A1.01").humanReviewWhen.join(" ")).toMatch(/crawler list/);
  });
});

describe("lookups", () => {
  it("getMetricDefinition returns the definition for a known id", () => {
    const def = getMetricDefinition("S2.01");
    expect(def.name).toBe("Title tag");
    expect(def.maxPoints).toBe(20);
    expect(def.categoryId).toBe("S2");
  });

  it("getMetricDefinition throws for an unknown id", () => {
    expect(() => getMetricDefinition("S9.99")).toThrow(/Unknown metric id/);
    expect(() => getMetricDefinition("")).toThrow();
  });

  it("getCategory returns the category and throws for an unknown id", () => {
    expect(getCategory("A3").name).toBe("Answer-ready content");
    expect(getCategory("A3").weight).toBe(10);
    expect(() => getCategory("Z1")).toThrow(/Unknown category id/);
  });

  it("metricsForCategory returns that category's metrics in order", () => {
    expect(metricsForCategory("A1").map((m) => m.id)).toEqual(["A1.01", "A1.02", "A1.03", "A1.04"]);
    expect(metricsForCategory("S2")).toHaveLength(9);
    expect(() => metricsForCategory("Z1")).toThrow();
  });
});
