import { describe, expect, it } from "vitest";
import { buildEvalContext } from "@/lib/visibility/context";
import { evaluateS2 } from "@/lib/visibility/evaluate/seo-onpage";
import { METHODOLOGY } from "@/lib/visibility/methodology";
import { CANDIDATE_EXCLUSIONS, PAGE_TYPES } from "@/lib/visibility/types";
import type {
  CandidateExclusion,
  EvalContext,
  FetchRecord,
  MetricResult,
  PageType,
  SampledPage,
  ScanSnapshot,
} from "@/lib/visibility/types";

const SCANNED_AT = "2026-10-02T09:15:00.000Z";
const NOW = new Date(SCANNED_AT);
const HOME = "https://example.ie/";

function record(url: string, over: Partial<FetchRecord> = {}): FetchRecord {
  return {
    url,
    finalUrl: url,
    kind: "page",
    method: "GET",
    status: 200,
    redirectChain: [],
    headers: {},
    contentType: "text/html; charset=utf-8",
    wireBytes: 0,
    decodedBytes: 0,
    bodyHash: null,
    body: null,
    truncated: false,
    error: null,
    requestAcceptEncoding: "gzip, br",
    fetchedAt: SCANNED_AT,
    durationMs: 10,
    ttfbMs: 5,
    tls: null,
    ...over,
  };
}

const words = (n: number): string => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

type DocOpts = {
  title?: string | null;
  titleTags?: string;
  description?: string | null;
  descriptionTags?: string;
  lang?: string | null;
  head?: string;
  body?: string;
};

const GOOD_TITLE = "A good page title for testing";
const MAIN_BODY = `<main><h1>Heading</h1><p>${words(80)}</p></main>`;
const SPA_BODY = `<div id="root"></div><noscript>You need to enable JavaScript to run this app.</noscript>`;

function doc(opts: DocOpts = {}): string {
  const lang = opts.lang === undefined ? ' lang="en"' : opts.lang === null ? "" : ` lang="${opts.lang}"`;
  const title =
    opts.titleTags ??
    (opts.title === null ? "" : `<title>${opts.title === undefined ? GOOD_TITLE : opts.title}</title>`);
  const description =
    opts.descriptionTags ??
    (opts.description === undefined || opts.description === null
      ? ""
      : `<meta name="description" content="${opts.description}">`);
  return `<!doctype html><html${lang}><head>${title}${description}${opts.head ?? ""}</head><body>${opts.body ?? MAIN_BODY}</body></html>`;
}

type Spec = {
  path?: string;
  type?: PageType;
  html: string | null;
  record?: Partial<FetchRecord>;
};

function sampled(spec: Spec, index: number): SampledPage {
  const path = spec.path ?? (index === 0 ? "/" : `/page-${index}`);
  const url = `https://example.ie${path}`;
  return {
    url,
    type: spec.type ?? (index === 0 ? "home" : "other"),
    reason: "test",
    depth: path.split("/").filter((s) => s !== "").length,
    record: record(url, { body: spec.html, ...spec.record }),
  };
}

function zeroed<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
}

function snapshot(pages: SampledPage[]): ScanSnapshot {
  return {
    snapshotVersion: 1,
    scannerVersion: "test",
    inputUrl: HOME,
    homeUrl: HOME,
    scannedAt: SCANNED_AT,
    outcome: "COMPLETED",
    outcomeDetail: null,
    scannerRegion: null,
    httpsAttempt: null,
    robots: [],
    sitemaps: [],
    llms: null,
    httpVariant: null,
    timing: [],
    linkChecks: [],
    pages,
    candidates: {
      fromSitemap: 0,
      fromHomepageLinks: 0,
      considered: 0,
      excluded: zeroed<CandidateExclusion>(CANDIDATE_EXCLUSIONS),
      byType: zeroed<PageType>(PAGE_TYPES),
      capped: false,
    },
    stats: { requestCount: 0, requestCapReached: false, jobTimedOut: false, jobDurationMs: 0 },
  };
}

function ctxOf(specs: Spec[]): EvalContext {
  return buildEvalContext(snapshot(specs.map(sampled)), NOW);
}

function runOn(specs: Spec[]): MetricResult[] {
  return evaluateS2(ctxOf(specs));
}

function metricOf(results: MetricResult[], id: string): MetricResult {
  const found = results.find((r) => r.metricId === id);
  if (found === undefined) throw new Error(`no result for ${id}`);
  return found;
}

function run(id: string, htmls: (string | Spec)[]): MetricResult {
  const specs = htmls.map((h): Spec => (typeof h === "string" ? { html: h } : h));
  return metricOf(runOn(specs), id);
}

function pageEvidence(result: MetricResult): Record<string, unknown>[] {
  return result.evidence as Record<string, unknown>[];
}

const fetchFailure: Spec = {
  html: null,
  record: { status: null, error: { code: "TIMEOUT", message: "timed out" } },
};
const notFoundPage: Spec = { html: doc(), record: { status: 404 } };
const robotsBlockedPage: Spec = {
  html: null,
  record: { status: null, error: { code: "ROBOTS_DISALLOWED", message: "blocked" } },
};

describe("evaluateS2: contract", () => {
  it("returns one result per S2 metric, in id order, with methodology points", () => {
    const results = runOn([{ html: doc() }, { html: doc() }]);
    expect(results.map((r) => r.metricId)).toEqual([
      "S2.01", "S2.02", "S2.03", "S2.04", "S2.05", "S2.06", "S2.07", "S2.08", "S2.09",
    ]);
    for (const r of results) {
      const def = METHODOLOGY.metrics.find((m) => m.id === r.metricId);
      expect(def).toBeDefined();
      expect(r.metricVersion).toBe(def?.version);
      expect(r.reviewedBy).toBeNull();
      if (r.result === "NOT_APPLICABLE") expect(r.maxPoints).toBeNull();
      else expect(r.maxPoints).toBe(def?.maxPoints);
      if (r.result === "PASS" || r.result === "PARTIAL" || r.result === "FAIL") {
        expect(r.points).not.toBeNull();
      } else {
        expect(r.points).toBeNull();
      }
      expect(typeof r.explanation).toBe("string");
      expect(r.explanation.length).toBeGreaterThan(0);
    }
  });

  it("is deterministic and its evidence is plain JSON", () => {
    const specs: Spec[] = [{ html: doc({ description: "d".repeat(80) }) }, { html: doc({ title: "T".repeat(70) }) }];
    const first = runOn(specs);
    const second = runOn(specs);
    expect(second).toEqual(first);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
  });

  it("caps every evidence string at 200 characters, even for hostile input", () => {
    const huge = "z".repeat(6000);
    const results = runOn([
      {
        html: doc({
          title: huge,
          description: huge,
          lang: huge,
          head: `<meta property="og:image" content="${huge}">`,
          body: `<main><h1>${huge}</h1><p>${words(60)}</p><img src="/${huge}.jpg"></main>`,
        }),
      },
      { html: doc({ title: huge, description: huge }) },
    ]);
    const walk = (value: unknown): void => {
      if (typeof value === "string") expect(value.length).toBeLessThanOrEqual(200);
      else if (Array.isArray(value)) value.forEach(walk);
      else if (value !== null && typeof value === "object") Object.values(value).forEach(walk);
    };
    for (const r of results) {
      walk(r.evidence);
      expect(r.explanation.length).toBeLessThanOrEqual(200);
    }
  });

  it("returns NOT_OBSERVED for every page metric, and NOT_OBSERVED for the uniqueness metrics, when no page was sampled", () => {
    const results = evaluateS2(buildEvalContext(snapshot([]), NOW));
    for (const r of results) {
      expect(r.result).toBe("NOT_OBSERVED");
      expect(r.points).toBeNull();
      expect(r.maxPoints).toBe(METHODOLOGY.metrics.find((m) => m.id === r.metricId)?.maxPoints);
    }
  });

  it("turns an unexpected internal error into SCAN_ERROR for that metric only", () => {
    const ctx = ctxOf([{ html: doc() }]);
    const broken: EvalContext = {
      ...ctx,
      helpers: {
        ...ctx.helpers,
        normaliseText: () => {
          throw new Error("boom");
        },
      },
    };
    const twoPages = ctxOf([{ html: doc() }, { html: doc() }]);
    const results = evaluateS2({ ...twoPages, helpers: broken.helpers });
    expect(metricOf(results, "S2.02").result).toBe("SCAN_ERROR");
    expect(metricOf(results, "S2.04").result).toBe("NOT_APPLICABLE");
    expect(metricOf(results, "S2.01").result).toBe("PASS");
    expect(JSON.stringify(metricOf(results, "S2.02").evidence)).toContain("internal_error");
  });
});

describe("S2.01 Title tag", () => {
  const cases: [number, "PASS" | "PARTIAL" | "FAIL", number][] = [
    [1, "FAIL", 0],
    [9, "FAIL", 0],
    [10, "PARTIAL", 10],
    [19, "PARTIAL", 10],
    [20, "PASS", 20],
    [65, "PASS", 20],
    [66, "PARTIAL", 10],
    [90, "PARTIAL", 10],
    [91, "FAIL", 0],
    [500, "FAIL", 0],
  ];
  it.each(cases)("a title of %i characters gives %s with %f points", (chars, code, points) => {
    const r = run("S2.01", [doc({ title: "x".repeat(chars) })]);
    expect(r.result).toBe(code);
    expect(r.points).toBe(points);
    expect(r.maxPoints).toBe(20);
    expect(pageEvidence(r)[0].chars).toBe(chars);
  });

  it("scores a page with no title element as 0 (missing)", () => {
    const r = run("S2.01", [doc({ title: null })]);
    expect(r.result).toBe("FAIL");
    expect(pageEvidence(r)[0].branch).toBe("missing");
    expect(pageEvidence(r)[0].tagCount).toBe(0);
  });

  it("scores empty and whitespace-only titles as 0 (empty)", () => {
    for (const title of ["", "   ", "&nbsp;&nbsp;"]) {
      const r = run("S2.01", [doc({ title })]);
      expect(r.result).toBe("FAIL");
      expect(pageEvidence(r)[0].branch).toBe("empty");
    }
  });

  it("scores two non-empty titles as 0 (multiple), however good each is", () => {
    const r = run("S2.01", [doc({ titleTags: `<title>${GOOD_TITLE}</title><title>${GOOD_TITLE} two</title>` })]);
    expect(r.result).toBe("FAIL");
    expect(pageEvidence(r)[0].branch).toBe("multiple");
  });

  it("ignores an additional empty title element (conservative reading) and grades the non-empty one", () => {
    const r = run("S2.01", [doc({ titleTags: `<title>${GOOD_TITLE}</title><title></title>` })]);
    expect(r.result).toBe("PASS");
    expect(pageEvidence(r)[0].tagCount).toBe(2);
    expect(pageEvidence(r)[0].nonEmptyCount).toBe(1);
  });

  it("counts normalised code points: non-breaking spaces collapse and astral characters count once", () => {
    const collapsed = run("S2.01", [doc({ title: `${"a".repeat(10)}\u{a0}\u{a0} ${"b".repeat(9)}` })]);
    expect(collapsed.result).toBe("PASS");
    expect(pageEvidence(collapsed)[0].chars).toBe(20);

    const astral = run("S2.01", [doc({ title: "\u{1F600}".repeat(10) })]);
    expect(astral.result).toBe("PARTIAL");
    expect(pageEvidence(astral)[0].chars).toBe(10);
  });

  it("reproduces the plan 4.3.6 worked example: [1, 1, 0.5, 1, 0] gives 14 points, PARTIAL", () => {
    const r = run("S2.01", [
      doc({ title: "x".repeat(30) }),
      doc({ title: "x".repeat(30) }),
      doc({ title: "x".repeat(18) }),
      doc({ title: "x".repeat(30) }),
      doc({ title: null }),
    ]);
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(14);
    expect(pageEvidence(r).map((e) => e.s_p)).toEqual([1, 1, 0.5, 1, 0]);
    expect(r.explanation).toBe(
      "Of 5 pages, 3 have a title of 20 to 65 characters, 1 has a title of 10 to 19 characters and 1 has no title.",
    );
  });

  it("explains the all-pages and single-page cases, and names pages that could not be read", () => {
    const good = doc({ title: "x".repeat(30) });
    expect(run("S2.01", [good, good, good]).explanation).toBe("All 3 pages have a title of 20 to 65 characters.");
    expect(run("S2.01", [good]).explanation).toBe("The page has a title of 20 to 65 characters.");
    expect(run("S2.01", [good, good, fetchFailure]).explanation).toBe(
      "Of 3 pages, 2 have a title of 20 to 65 characters and 1 could not be read.",
    );
  });

  it("still scores a render-dependent page from its raw head and notes the caveat", () => {
    const r = run("S2.01", [doc({ title: "Loading app now", body: SPA_BODY })]);
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(10);
    expect(String(pageEvidence(r)[0].note)).toMatch(/JavaScript/);
  });

  it("leaves pages that could not be read out of the mean, and reports SCAN_ERROR when fewer than half were read", () => {
    const withErrors = run("S2.01", [doc({ title: "x".repeat(30) }), notFoundPage, doc({ title: "x".repeat(30) })]);
    expect(withErrors.result).toBe("PASS");
    expect(pageEvidence(withErrors)[1].status).toBe("scan_error");

    const mostlyUnread = run("S2.01", [doc({ title: "x".repeat(30) }), fetchFailure, fetchFailure]);
    expect(mostlyUnread.result).toBe("SCAN_ERROR");
    expect(mostlyUnread.points).toBeNull();
    expect(mostlyUnread.maxPoints).toBe(20);

    const blocked = run("S2.01", [doc({ title: "x".repeat(30) }), robotsBlockedPage, robotsBlockedPage]);
    expect(blocked.result).toBe("NOT_OBSERVED");
  });
});

describe("S2.02 Titles are unique", () => {
  it("is PASS when every titled page has a different title", () => {
    const r = run("S2.02", ["Alpha", "Beta", "Gamma"].map((title) => doc({ title })));
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(10);
    expect((r.evidence as Record<string, unknown>).branch).toBe("all_unique");
  });

  it("scores distinct titles over titled pages: 3 distinct over 5 gives 6 points", () => {
    const r = run("S2.02", ["Alpha", "Beta", "Beta", "Gamma", "Gamma"].map((title) => doc({ title })));
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(6);
    const evidence = r.evidence as { distinct: number; pagesWithValue: number; duplicateGroups: { text: string; pages: string[] }[] };
    expect(evidence.distinct).toBe(3);
    expect(evidence.pagesWithValue).toBe(5);
    expect(evidence.duplicateGroups.map((g) => g.text)).toEqual(["Beta", "Gamma"]);
    expect(evidence.duplicateGroups[0].pages).toEqual(["https://example.ie/page-2", "https://example.ie/page-1"].sort());
  });

  it("scores one distinct title over n pages as 1/n (all identical is not zero)", () => {
    const r = run("S2.02", Array.from({ length: 5 }, () => doc({ title: "Same" })));
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(2);
  });

  it("compares after normalisation and case folding", () => {
    const r = run("S2.02", [doc({ title: "Kitchens  and Wardrobes" }), doc({ title: "KITCHENS AND\u{a0}wardrobes" })]);
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(5);
  });

  it("leaves pages without a title out of the denominator", () => {
    const r = run("S2.02", [doc({ title: "Same" }), doc({ title: "Same" }), doc({ title: null })]);
    expect(r.points).toBe(5);
    expect((r.evidence as Record<string, unknown>).pagesWithValue).toBe(2);
  });

  it("uses the first non-empty title when a page has several", () => {
    const r = run("S2.02", [
      doc({ titleTags: "<title></title><title>Alpha</title><title>Zed</title>" }),
      doc({ title: "Alpha" }),
    ]);
    expect(r.points).toBe(5);
  });

  it("is NOT_APPLICABLE with fewer than 2 titled pages", () => {
    const one = run("S2.02", [doc({ title: "Only" }), doc({ title: null })]);
    expect(one.result).toBe("NOT_APPLICABLE");
    expect(one.points).toBeNull();
    expect(one.maxPoints).toBeNull();
    expect(run("S2.02", [doc({ title: "Only" })]).result).toBe("NOT_APPLICABLE");
    expect(run("S2.02", [doc({ title: null }), doc({ title: "" })]).result).toBe("NOT_APPLICABLE");
  });

  it("is NOT_OBSERVED, not NOT_APPLICABLE, when an unreadable page might have supplied the second title", () => {
    const r = run("S2.02", [doc({ title: "Only" }), fetchFailure]);
    expect(r.result).toBe("NOT_OBSERVED");
    expect(r.maxPoints).toBe(10);
  });

  it("reports SCAN_ERROR or NOT_OBSERVED when fewer than half the sampled pages could be read", () => {
    const errors = run("S2.02", [doc({ title: "A" }), fetchFailure, fetchFailure, notFoundPage]);
    expect(errors.result).toBe("SCAN_ERROR");
    const blocked = run("S2.02", [doc({ title: "A" }), robotsBlockedPage, robotsBlockedPage]);
    expect(blocked.result).toBe("NOT_OBSERVED");
  });

  it("includes render-dependent pages, because titles live in the head (identical shells score 1/n)", () => {
    const shell = doc({ title: "App", body: SPA_BODY });
    const r = run("S2.02", Array.from({ length: 5 }, () => shell));
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(2);
  });
});

describe("S2.03 Meta description", () => {
  const cases: [number, "PASS" | "PARTIAL" | "FAIL", number][] = [
    [1, "FAIL", 0],
    [29, "FAIL", 0],
    [30, "PARTIAL", 7.5],
    [69, "PARTIAL", 7.5],
    [70, "PASS", 15],
    [160, "PASS", 15],
    [161, "PARTIAL", 7.5],
    [220, "PARTIAL", 7.5],
    [221, "FAIL", 0],
    [900, "FAIL", 0],
  ];
  it.each(cases)("a description of %i characters gives %s with %f points", (chars, code, points) => {
    const r = run("S2.03", [doc({ description: "d".repeat(chars) })]);
    expect(r.result).toBe(code);
    expect(r.points).toBe(points);
    expect(r.maxPoints).toBe(15);
    expect(pageEvidence(r)[0].chars).toBe(chars);
  });

  it("scores a page with no description as 0 (missing)", () => {
    const r = run("S2.03", [doc()]);
    expect(r.result).toBe("FAIL");
    expect(pageEvidence(r)[0].branch).toBe("missing");
  });

  it("scores an empty description as 0 (empty)", () => {
    const r = run("S2.03", [doc({ description: "" })]);
    expect(pageEvidence(r)[0].branch).toBe("empty");
    expect(r.result).toBe("FAIL");
  });

  it("scores two non-empty descriptions as 0 (multiple)", () => {
    const tag = `<meta name="description" content="${"d".repeat(100)}">`;
    const r = run("S2.03", [doc({ descriptionTags: tag + tag })]);
    expect(r.result).toBe("FAIL");
    expect(pageEvidence(r)[0].branch).toBe("multiple");
  });

  it("ignores an additional empty description tag (conservative reading)", () => {
    const r = run("S2.03", [
      doc({ descriptionTags: `<meta name="description" content="${"d".repeat(100)}"><meta name="description" content="">` }),
    ]);
    expect(r.result).toBe("PASS");
  });

  it("does not accept og:description or twitter:description as the meta description", () => {
    const r = run("S2.03", [
      doc({ head: `<meta property="og:description" content="${"d".repeat(100)}"><meta name="twitter:description" content="${"d".repeat(100)}">` }),
    ]);
    expect(r.result).toBe("FAIL");
  });

  it("accepts the tag name in any letter case", () => {
    const r = run("S2.03", [doc({ descriptionTags: `<meta name="Description" content="${"d".repeat(100)}">` })]);
    expect(r.result).toBe("PASS");
  });

  it("averages page scores: [1, 0.5, 0] gives 7.5 of 15", () => {
    const r = run("S2.03", [
      doc({ description: "d".repeat(100) }),
      doc({ description: "d".repeat(40) }),
      doc({ description: "d".repeat(10) }),
    ]);
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(7.5);
  });

  it("still scores a render-dependent page from its raw head", () => {
    const r = run("S2.03", [doc({ description: "d".repeat(100), body: SPA_BODY })]);
    expect(r.result).toBe("PASS");
  });

  it("excludes unreadable pages and flags a majority of unreadable pages", () => {
    expect(run("S2.03", [doc({ description: "d".repeat(100) }), fetchFailure, doc({ description: "d".repeat(100) })]).result).toBe("PASS");
    expect(run("S2.03", [doc({ description: "d".repeat(100) }), fetchFailure, fetchFailure]).result).toBe("SCAN_ERROR");
  });
});

describe("S2.04 Descriptions are unique", () => {
  const d = (n: string): string => `${n} description that is long enough to look real for the test`;

  it("is PASS when every described page has a different description", () => {
    const r = run("S2.04", ["a", "b", "c"].map((n) => doc({ description: d(n) })));
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(5);
  });

  it("scores distinct descriptions over described pages: 2 distinct over 5 gives 2 points", () => {
    const r = run("S2.04", ["a", "a", "a", "b", "b"].map((n) => doc({ description: d(n) })));
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(2);
  });

  it("compares after normalisation and case folding", () => {
    const r = run("S2.04", [doc({ description: "Same  text here" }), doc({ description: "same text HERE" })]);
    expect(r.points).toBe(2.5);
  });

  it("leaves pages without a description out of the denominator", () => {
    const r = run("S2.04", [doc({ description: d("a") }), doc({ description: d("b") }), doc()]);
    expect(r.result).toBe("PASS");
    expect((r.evidence as Record<string, unknown>).pagesWithValue).toBe(2);
  });

  it("is NOT_APPLICABLE with fewer than 2 pages that have a description", () => {
    const r = run("S2.04", [doc({ description: d("a") }), doc(), doc()]);
    expect(r.result).toBe("NOT_APPLICABLE");
    expect(r.maxPoints).toBeNull();
    expect(run("S2.04", [doc(), doc()]).result).toBe("NOT_APPLICABLE");
  });

  it("is NOT_OBSERVED when an unreadable page could have supplied the second description", () => {
    expect(run("S2.04", [doc({ description: d("a") }), fetchFailure]).result).toBe("NOT_OBSERVED");
  });

  it("is SCAN_ERROR when fewer than half the pages could be read", () => {
    expect(run("S2.04", [doc({ description: d("a") }), fetchFailure, fetchFailure]).result).toBe("SCAN_ERROR");
  });
});

describe("S2.05 Single H1", () => {
  const page = (body: string): string => doc({ body });

  it("is PASS with exactly one non-empty h1", () => {
    const r = run("S2.05", [page(`<main><h1>Only one</h1><p>${words(60)}</p></main>`)]);
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(15);
    expect(pageEvidence(r)[0].h1Count).toBe(1);
  });

  it("is PARTIAL (0.5) with two or more non-empty h1 elements", () => {
    for (const count of [2, 3]) {
      const h1s = Array.from({ length: count }, (_, i) => `<h1>Heading ${i}</h1>`).join("");
      const r = run("S2.05", [page(`<main>${h1s}<p>${words(60)}</p></main>`)]);
      expect(r.result).toBe("PARTIAL");
      expect(r.points).toBe(7.5);
      expect(pageEvidence(r)[0].branch).toBe("multiple_h1");
    }
  });

  it("is FAIL with no h1, and when the only h1 is empty", () => {
    const none = run("S2.05", [page(`<main><h2>Sub</h2><p>${words(60)}</p></main>`)]);
    expect(none.result).toBe("FAIL");
    expect(pageEvidence(none)[0].branch).toBe("no_h1");
    const empty = run("S2.05", [page(`<main><h1> </h1><p>${words(60)}</p></main>`)]);
    expect(empty.result).toBe("FAIL");
    expect(pageEvidence(empty)[0].emptyH1Count).toBe(1);
  });

  it("ignores empty h1 elements when counting, so one filled plus one empty is a single h1", () => {
    const r = run("S2.05", [page(`<main><h1></h1><h1>Filled</h1><p>${words(60)}</p></main>`)]);
    expect(r.result).toBe("PASS");
  });

  it("counts h1 elements anywhere in the visible document, not only inside main (conservative reading)", () => {
    const hero = run("S2.05", [page(`<header><h1>Hero</h1></header><main><p>${words(60)}</p></main>`)]);
    expect(hero.result).toBe("PASS");
    const both = run("S2.05", [page(`<header><h1>Logo</h1></header><main><h1>Topic</h1><p>${words(60)}</p></main>`)]);
    expect(both.result).toBe("PARTIAL");
  });

  it("does not count a hidden h1", () => {
    const r = run("S2.05", [page(`<main><h1 hidden>Hidden</h1><h1>Shown</h1><p>${words(60)}</p></main>`)]);
    expect(r.result).toBe("PASS");
  });

  it("averages page scores: [1, 0.5, 0] gives 7.5 of 15", () => {
    const r = run("S2.05", [
      page(`<main><h1>A</h1><p>${words(60)}</p></main>`),
      page(`<main><h1>A</h1><h1>B</h1><p>${words(60)}</p></main>`),
      page(`<main><p>${words(60)}</p></main>`),
    ]);
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(7.5);
  });

  it("is NOT_OBSERVED when every page is render-dependent, and ignores render-dependent pages when others are readable", () => {
    const allShell = run("S2.05", [doc({ body: SPA_BODY }), doc({ body: SPA_BODY })]);
    expect(allShell.result).toBe("NOT_OBSERVED");
    expect(allShell.points).toBeNull();
    expect(allShell.maxPoints).toBe(15);
    expect(pageEvidence(allShell)[0].status).toBe("not_observed");

    const mixed = run("S2.05", [
      page(`<main><h1>A</h1><p>${words(60)}</p></main>`),
      page(`<main><h1>B</h1><p>${words(60)}</p></main>`),
      doc({ body: SPA_BODY }),
    ]);
    expect(mixed.result).toBe("PASS");
  });

  it("reports unreadable pages as unobserved", () => {
    expect(run("S2.05", [page(MAIN_BODY), notFoundPage, page(MAIN_BODY)]).result).toBe("PASS");
    expect(run("S2.05", [page(MAIN_BODY), fetchFailure, fetchFailure]).result).toBe("SCAN_ERROR");
    expect(run("S2.05", [page(MAIN_BODY), robotsBlockedPage, robotsBlockedPage]).result).toBe("NOT_OBSERVED");
  });
});

describe("S2.06 Heading hierarchy", () => {
  const level = (n: number, text = `Heading ${n}`): string => `<h${n}>${text}</h${n}>`;
  // Each heading holds two words, so the paragraph is sized to make main.wordCount exactly totalWords.
  const withHeadings = (headings: string, totalWords = 80): string => {
    const headingWords = (headings.match(/<h[1-6]>/g) ?? []).length * 2;
    return doc({ body: `<main>${headings}<p>${words(Math.max(0, totalWords - headingWords))}</p></main>` });
  };

  it("is PASS with zero skips on a short page, including headings that step back up", () => {
    const r = run("S2.06", [withHeadings(level(1) + level(2) + level(3) + level(2) + level(3) + level(4) + level(2))]);
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(10);
    expect(pageEvidence(r)[0].skipCount).toBe(0);
  });

  it("does not count a jump back up (h4 then h2) or a first heading deeper than h1 as a skip", () => {
    const up = run("S2.06", [withHeadings(level(1) + level(2) + level(3) + level(4) + level(2))]);
    expect(up.result).toBe("PASS");
    const start = run("S2.06", [withHeadings(level(3) + level(3) + level(4))]);
    expect(start.result).toBe("PASS");
    const h2start = run("S2.06", [withHeadings(level(2) + level(3))]);
    expect(h2start.result).toBe("PASS");
  });

  it("scores 0.5 for one or two skips", () => {
    const one = run("S2.06", [withHeadings(level(1) + level(2) + level(4))]);
    expect(one.result).toBe("PARTIAL");
    expect(one.points).toBe(5);
    expect(pageEvidence(one)[0].skips).toEqual(["h2>h4"]);
    const two = run("S2.06", [withHeadings(level(1) + level(3) + level(5))]);
    expect(two.points).toBe(5);
    expect(pageEvidence(two)[0].skipCount).toBe(2);
    expect(pageEvidence(two)[0].branch).toBe("skips_1_2");
  });

  it("scores 0 for three or more skips", () => {
    const three = run("S2.06", [withHeadings(level(2) + level(4) + level(2) + level(4) + level(2) + level(4))]);
    expect(three.result).toBe("FAIL");
    expect(three.points).toBe(0);
    expect(pageEvidence(three)[0].skipCount).toBe(3);
    expect(pageEvidence(three)[0].branch).toBe("skips_3_plus");
    const more = run("S2.06", [withHeadings(level(1) + level(3) + level(5) + level(6) + level(2) + level(4) + level(2) + level(6))]);
    expect(more.result).toBe("FAIL");
  });

  it("requires an h2 on pages of 300 or more words", () => {
    const longNoH2 = run("S2.06", [withHeadings(level(1), 300)]);
    expect(longNoH2.result).toBe("FAIL");
    expect(pageEvidence(longNoH2)[0].branch).toBe("no_h2_long_page");
    expect(pageEvidence(longNoH2)[0].mainWordCount).toBe(300);

    const shortNoH2 = run("S2.06", [withHeadings(level(1), 299)]);
    expect(shortNoH2.result).toBe("PASS");

    const longWithH2 = run("S2.06", [withHeadings(level(1) + level(2), 300)]);
    expect(longWithH2.result).toBe("PASS");
  });

  it("scores a long page with skips and no h2 as 0.5, the lenient reading of the overlapping branches", () => {
    const r = run("S2.06", [withHeadings(level(1) + level(3), 320)]);
    expect(r.result).toBe("PARTIAL");
    expect(pageEvidence(r)[0].branch).toBe("skips_1_2");
  });

  it("reads skips from main-content headings, so a footer heading cannot cause a false skip", () => {
    const r = run("S2.06", [
      doc({ body: `<main><h1>Topic</h1><h2>Part</h2><p>${words(80)}</p></main><footer><h4>Contact</h4></footer>` }),
    ]);
    expect(r.result).toBe("PASS");
    expect(pageEvidence(r)[0].headingCount).toBe(2);
  });

  it("accepts an h2 outside main for the long-page clause (conservative reading)", () => {
    const r = run("S2.06", [
      doc({ body: `<main><h1>Topic</h1><p>${words(320)}</p></main><aside><h2>Related</h2></aside>` }),
    ]);
    expect(r.result).toBe("PASS");
  });

  it("scores a page without any headings by the 300-word rule alone", () => {
    expect(run("S2.06", [withHeadings("", 100)]).result).toBe("PASS");
    expect(run("S2.06", [withHeadings("", 300)]).result).toBe("FAIL");
  });

  it("is NOT_APPLICABLE per page for languages without word counts, and for the metric when all pages are such", () => {
    const cjk = doc({ lang: "ja", body: `<main>${level(1)}${level(4)}<p>${words(80)}</p></main>` });
    const all = run("S2.06", [cjk, cjk]);
    expect(all.result).toBe("NOT_APPLICABLE");
    expect(all.points).toBeNull();
    expect(all.maxPoints).toBeNull();

    const mixed = run("S2.06", [withHeadings(level(1) + level(2)), cjk]);
    expect(mixed.result).toBe("PASS");
    expect(pageEvidence(mixed)[1].status).toBe("not_applicable");
  });

  it("averages page scores: [1, 0.5, 0] gives 5 of 10", () => {
    const r = run("S2.06", [
      withHeadings(level(1) + level(2)),
      withHeadings(level(1) + level(3)),
      withHeadings(level(2) + level(4) + level(2) + level(4) + level(2) + level(4)),
    ]);
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(5);
  });

  it("is NOT_OBSERVED for render-dependent pages and for pages that could not be read", () => {
    expect(run("S2.06", [doc({ body: SPA_BODY }), doc({ body: SPA_BODY })]).result).toBe("NOT_OBSERVED");
    expect(run("S2.06", [withHeadings(level(1)), fetchFailure, fetchFailure]).result).toBe("SCAN_ERROR");
  });
});

describe("S2.07 Image alt attributes", () => {
  const img = (attrs: string): string => `<img src="/i.jpg" ${attrs}>`;
  const withImages = (...images: string[]): string =>
    doc({ body: `<main><h1>H</h1><p>${words(60)}</p>${images.join("")}</main>` });

  it("is PASS when every content image has an alt attribute, and an empty alt counts as decorative", () => {
    const r = run("S2.07", [withImages(img('alt="A chair"'), img('alt=""'))]);
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(10);
    expect(pageEvidence(r)[0].decorativeEmptyAlt).toBe(1);
  });

  it("scores the share of content images with alt: 3 of 4 gives 0.75", () => {
    const r = run("S2.07", [withImages(img('alt="a"'), img('alt="b"'), img('alt="c"'), img(""))]);
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(7.5);
    expect(pageEvidence(r)[0].contentImages).toBe(4);
    expect(pageEvidence(r)[0].withAlt).toBe(3);
  });

  it("scores 0 for a page whose content images all lack alt", () => {
    const r = run("S2.07", [withImages(img(""), img(""))]);
    expect(r.result).toBe("FAIL");
    expect(pageEvidence(r)[0].branch).toBe("none_have_alt");
  });

  it("excludes role=presentation, aria-hidden=true and images 2 pixels or smaller", () => {
    const r = run("S2.07", [
      withImages(
        img('role="presentation"'),
        img('aria-hidden="true"'),
        img('width="2"'),
        img('height="1"'),
        img('width="0" height="0"'),
        img('alt="kept"'),
      ),
    ]);
    expect(r.result).toBe("PASS");
    expect(pageEvidence(r)[0].contentImages).toBe(1);
  });

  it("includes images larger than 2 pixels and aria-hidden=false", () => {
    const r = run("S2.07", [withImages(img('width="3"'), img('height="3"'), img('aria-hidden="false"'))]);
    expect(r.result).toBe("FAIL");
    expect(pageEvidence(r)[0].contentImages).toBe(3);
  });

  it("averages per-page shares rather than pooling images: [0.25, 1] gives 0.625", () => {
    const r = run("S2.07", [
      withImages(img('alt="a"'), img(""), img(""), img("")),
      withImages(img('alt="a"')),
    ]);
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(6.25);
  });

  it("is NOT_APPLICABLE when the sample has no content images, and leaves imageless pages out of the mean", () => {
    const none = run("S2.07", [withImages(), withImages(img('role="presentation"'))]);
    expect(none.result).toBe("NOT_APPLICABLE");
    expect(none.points).toBeNull();
    expect(none.maxPoints).toBeNull();

    const some = run("S2.07", [withImages(img('alt="a"'), img("")), withImages()]);
    expect(some.points).toBe(5);
    expect(pageEvidence(some)[1].status).toBe("not_applicable");
  });

  it("is NOT_OBSERVED, not NOT_APPLICABLE, when the only pages are render-dependent", () => {
    const r = run("S2.07", [doc({ body: SPA_BODY }), doc({ body: SPA_BODY })]);
    expect(r.result).toBe("NOT_OBSERVED");
    expect(r.maxPoints).toBe(10);
  });

  it("is SCAN_ERROR when most pages could not be read", () => {
    expect(run("S2.07", [withImages(img('alt="a"')), fetchFailure, fetchFailure]).result).toBe("SCAN_ERROR");
  });
});

describe("S2.08 Language declared", () => {
  const valid = ["en", "en-IE", "en-ie", "EN-ie", "eng", "fr-FR", "zh-Hans-CN", "ga", "en-abcdefgh", "de-DE-1996", "en-US-x1"];
  it.each(valid)("accepts %s", (lang) => {
    const r = run("S2.08", [doc({ lang })]);
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(5);
  });

  const invalid = ["english", "e", "en_IE", "en-", "-en", "12", "en IE", "abcd", "en-abcdefghi", "ab-c", "en--IE"];
  it.each(invalid)("rejects %s", (lang) => {
    const r = run("S2.08", [doc({ lang })]);
    expect(r.result).toBe("FAIL");
    expect(pageEvidence(r)[0].branch).toBe("invalid_lang");
  });

  it("scores a missing or empty lang attribute as 0", () => {
    const missing = run("S2.08", [doc({ lang: null })]);
    expect(missing.result).toBe("FAIL");
    expect(pageEvidence(missing)[0].branch).toBe("missing_lang");
    const empty = run("S2.08", [doc({ lang: "" })]);
    expect(empty.result).toBe("FAIL");
    expect(pageEvidence(empty)[0].branch).toBe("missing_lang");
  });

  it("averages page scores: 4 of 5 pages valid gives 4 of 5 points", () => {
    const r = run("S2.08", [doc(), doc(), doc(), doc(), doc({ lang: null })]);
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(4);
  });

  it("still scores a render-dependent page", () => {
    expect(run("S2.08", [doc({ body: SPA_BODY })]).result).toBe("PASS");
  });

  it("excludes unreadable pages and flags a majority of unreadable pages", () => {
    expect(run("S2.08", [doc(), notFoundPage, doc()]).result).toBe("PASS");
    expect(run("S2.08", [doc(), fetchFailure, fetchFailure]).result).toBe("SCAN_ERROR");
  });
});

describe("S2.09 Share-preview tags", () => {
  const og = (...tags: [string, string][]): string =>
    tags.map(([key, content]) => `<meta property="${key}" content="${content}">`).join("");
  const TITLE: [string, string] = ["og:title", "T"];
  const DESC: [string, string] = ["og:description", "D"];
  const IMAGE: [string, string] = ["og:image", "https://example.ie/i.jpg"];

  it("is PASS with og:title, og:description and an absolute https og:image", () => {
    const r = run("S2.09", [doc({ head: og(TITLE, DESC, IMAGE) })]);
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(10);
    expect(pageEvidence(r)[0].branch).toBe("all_three");
  });

  it("scores present tags over three: 2 of 3, 1 of 3 and none", () => {
    const two = run("S2.09", [doc({ head: og(TITLE, DESC) })]);
    expect(two.result).toBe("PARTIAL");
    expect(two.points).toBe(6.67);
    expect(pageEvidence(two)[0].missing).toEqual(["og:image"]);
    const one = run("S2.09", [doc({ head: og(IMAGE) })]);
    expect(one.points).toBe(3.33);
    expect(pageEvidence(one)[0].branch).toBe("one_of_three");
    const none = run("S2.09", [doc()]);
    expect(none.result).toBe("FAIL");
    expect(none.points).toBe(0);
    expect(pageEvidence(none)[0].branch).toBe("none");
  });

  it("requires og:image to be an absolute https URL", () => {
    const bad = ["/img/og.png", "img/og.png", "//cdn.example.ie/og.png", "http://example.ie/og.png", "data:image/png;base64,AAAA", "ftp://example.ie/og.png", "https://", "https:example.ie/og.png", "https:/example.ie/og.png"];
    for (const value of bad) {
      const r = run("S2.09", [doc({ head: og(TITLE, DESC, ["og:image", value]) })]);
      expect(r.points, value).toBe(6.67);
      expect(pageEvidence(r)[0].imageIssue, value).toBe("og:image is present but is not an absolute https address");
    }
  });

  it("accepts an absolute https og:image whatever the letter case of the scheme", () => {
    const r = run("S2.09", [doc({ head: og(TITLE, DESC, ["og:image", "HTTPS://example.ie/og.png"]) })]);
    expect(r.result).toBe("PASS");
  });

  it("accepts any og:image among several when one is an absolute https URL", () => {
    const r = run("S2.09", [doc({ head: og(TITLE, DESC, ["og:image", "/relative.png"], IMAGE) })]);
    expect(r.result).toBe("PASS");
  });

  it("does not count tags with empty content", () => {
    const r = run("S2.09", [doc({ head: og(["og:title", ""], DESC, IMAGE) })]);
    expect(r.points).toBe(6.67);
    expect(pageEvidence(r)[0].missing).toEqual(["og:title"]);
  });

  it("accepts the name attribute form but not Twitter card tags", () => {
    const nameForm = run("S2.09", [
      doc({ head: `<meta name="og:title" content="T"><meta name="og:description" content="D"><meta name="og:image" content="https://example.ie/i.jpg">` }),
    ]);
    expect(nameForm.result).toBe("PASS");
    const twitter = run("S2.09", [
      doc({ head: `<meta name="twitter:title" content="T"><meta name="twitter:description" content="D"><meta name="twitter:image" content="https://example.ie/i.jpg">` }),
    ]);
    expect(twitter.result).toBe("FAIL");
  });

  it("averages page scores: [1, 2/3, 0] gives 5.56 of 10", () => {
    const r = run("S2.09", [doc({ head: og(TITLE, DESC, IMAGE) }), doc({ head: og(TITLE, DESC) }), doc()]);
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(5.56);
  });

  it("still scores a render-dependent page from its raw head", () => {
    expect(run("S2.09", [doc({ head: og(TITLE, DESC, IMAGE), body: SPA_BODY })]).result).toBe("PASS");
  });

  it("excludes unreadable pages and flags a majority of unreadable pages", () => {
    const head = og(TITLE, DESC, IMAGE);
    expect(run("S2.09", [doc({ head }), notFoundPage, doc({ head })]).result).toBe("PASS");
    expect(run("S2.09", [doc({ head }), fetchFailure, fetchFailure]).result).toBe("SCAN_ERROR");
  });
});

describe("bounded evidence on large pages", () => {
  it("keeps S2.06 and S2.07 evidence small for pages with thousands of headings and images", () => {
    const headings = Array.from({ length: 4000 }, (_, i) => (i % 2 === 0 ? "<h2>a</h2>" : "<h4>b</h4>")).join("");
    const images = Array.from({ length: 4000 }, () => '<img src="/i.jpg">').join("");
    const html = doc({ body: `<main><h1>Topic</h1>${headings}<p>${words(60)}</p>${images}</main>` });

    const headingResult = run("S2.06", [html]);
    expect(headingResult.result).toBe("FAIL");
    const headingEvidence = pageEvidence(headingResult)[0];
    expect(headingEvidence.skipCount).toBe(2000);
    expect((headingEvidence.skips as string[]).length).toBeLessThanOrEqual(6);
    expect(String(headingEvidence.levels).length).toBeLessThanOrEqual(200);

    const imageResult = run("S2.07", [html]);
    expect(imageResult.result).toBe("FAIL");
    const imageEvidence = pageEvidence(imageResult)[0];
    expect(imageEvidence.contentImages).toBe(4000);
    expect((imageEvidence.missingAlt as string[]).length).toBeLessThanOrEqual(3);
  });
});

describe("page fetch classes across S2", () => {
  it("treats a non-HTML 200 response as not observed, not as a failure", () => {
    const pdf: Spec = { html: null, record: { contentType: "application/pdf" } };
    const results = runOn([{ html: doc() }, pdf, pdf]);
    expect(metricOf(results, "S2.01").result).toBe("NOT_OBSERVED");
    expect(pageEvidence(metricOf(results, "S2.01"))[1].status).toBe("not_observed");
  });

  it("treats an HTTP error page as a scan error that never lowers the score", () => {
    const results = runOn([{ html: doc({ title: "x".repeat(30) }) }, notFoundPage, { html: doc({ title: "x".repeat(30) }) }]);
    expect(metricOf(results, "S2.01").result).toBe("PASS");
    expect(pageEvidence(metricOf(results, "S2.01"))[1].branch).toBe("SCAN_ERROR");
  });
});
