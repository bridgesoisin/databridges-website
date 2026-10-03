import { describe, expect, it } from "vitest";
import { buildEvalContext } from "@/lib/visibility/context";
import { evaluateS4 } from "@/lib/visibility/evaluate/seo-content";
import { GENERIC_ANCHORS } from "@/lib/visibility/lists";
import { CANDIDATE_EXCLUSIONS, PAGE_TYPES } from "@/lib/visibility/types";
import type {
  CandidateExclusion,
  FetchErrorCode,
  FetchRecord,
  MetricResult,
  PageType,
  SampledPage,
  ScanSnapshot,
} from "@/lib/visibility/types";

const SCANNED_AT = "2026-10-02T09:15:00.000Z";
const NOW = new Date(SCANNED_AT);
const HOME = "https://example.ie/";

const S4_IDS = ["S4.01", "S4.02", "S4.03", "S4.04", "S4.05", "S4.06"];
const S4_MAX = [30, 20, 20, 10, 10, 10];

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

function failure(code: FetchErrorCode): { code: FetchErrorCode; message: string } {
  return { code, message: code };
}

const words = (n: number, prefix = "word"): string =>
  Array.from({ length: n }, (_, i) => `${prefix}${i}`).join(" ");

function html(opts: { body?: string; lang?: string; head?: string } = {}): string {
  const body = opts.body ?? `<main><p>${words(80)}</p></main>`;
  const lang = opts.lang === undefined ? ' lang="en"' : opts.lang === "" ? "" : ` lang="${opts.lang}"`;
  return `<!doctype html><html${lang}><head><title>A page title</title>${opts.head ?? ""}</head><body>${body}</body></html>`;
}

const SPA_BODY = '<div id="root"></div><noscript>You need to enable JavaScript to run this app.</noscript>';

function depthOf(url: string): number {
  return new URL(url).pathname.split("/").filter((s) => s !== "").length;
}

function sampled(
  url: string,
  type: PageType,
  body: string | null,
  over: Partial<FetchRecord> = {},
): SampledPage {
  return {
    url,
    type,
    reason: `test ${type}`,
    depth: depthOf(url),
    record: record(url, { body, ...over }),
  };
}

const at = (path: string): string => `https://example.ie${path}`;
const page = (path: string, type: PageType, body: string | null, over: Partial<FetchRecord> = {}): SampledPage =>
  sampled(at(path), type, body, over);
const homePage = (body: string = html(), over: Partial<FetchRecord> = {}): SampledPage =>
  sampled(HOME, "home", body, over);

function zeroed<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
}

function snapshot(over: Partial<ScanSnapshot> = {}): ScanSnapshot {
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
    pages: [],
    candidates: {
      fromSitemap: 0,
      fromHomepageLinks: 0,
      considered: 0,
      excluded: zeroed<CandidateExclusion>(CANDIDATE_EXCLUSIONS),
      byType: zeroed<PageType>(PAGE_TYPES),
      capped: false,
    },
    stats: { requestCount: 0, requestCapReached: false, jobTimedOut: false, jobDurationMs: 0 },
    ...over,
  };
}

function assertPlainEvidence(value: unknown, where: string): void {
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "number") {
    expect(Number.isFinite(value), `${where} number`).toBe(true);
    return;
  }
  if (typeof value === "string") {
    expect(value.length, `${where} string length`).toBeLessThanOrEqual(200);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertPlainEvidence(item, `${where}[${i}]`));
    return;
  }
  expect(typeof value, `${where} type`).toBe("object");
  expect(Object.getPrototypeOf(value), `${where} prototype`).toBe(Object.prototype);
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    assertPlainEvidence(item, `${where}.${key}`);
  }
}

function checkShape(results: MetricResult[]): void {
  expect(results.map((r) => r.metricId)).toEqual(S4_IDS);
  results.forEach((result, i) => {
    const where = result.metricId;
    expect(result.reviewedBy).toBeNull();
    if (result.result === "NOT_APPLICABLE") {
      expect(result.points, where).toBeNull();
      expect(result.maxPoints, where).toBeNull();
    } else {
      expect(result.maxPoints, where).toBe(S4_MAX[i]);
      if (result.result === "PASS" || result.result === "PARTIAL" || result.result === "FAIL") {
        expect(result.points, where).not.toBeNull();
      } else {
        expect(result.points, where).toBeNull();
      }
    }
    expect(result.explanation.length, `${where} explanation`).toBeGreaterThan(0);
    expect(result.explanation, `${where} explanation newline`).not.toContain("\n");
    expect(/[.!?]\s+[A-Z]/.test(result.explanation), `${where} one sentence: ${result.explanation}`).toBe(false);
    expect(result.explanation.endsWith("."), `${where} ends with a full stop`).toBe(true);
    assertPlainEvidence(JSON.parse(JSON.stringify(result.evidence)), `${where}.evidence`);
    expect(JSON.parse(JSON.stringify(result.evidence))).toEqual(result.evidence);
  });
}

function evaluate(pages: SampledPage[], over: Partial<ScanSnapshot> = {}): Record<string, MetricResult> {
  const results = evaluateS4(buildEvalContext(snapshot({ pages, ...over }), NOW));
  checkShape(results);
  return Object.fromEntries(results.map((r) => [r.metricId, r]));
}

function ev(result: MetricResult): Record<string, unknown> {
  return result.evidence as Record<string, unknown>;
}

function evList(result: MetricResult): Record<string, unknown>[] {
  return result.evidence as Record<string, unknown>[];
}

const mainOf = (n: number): string => html({ body: `<main><p>${words(n)}</p></main>` });

// ---------------------------------------------------------------------------
// S4.01
// ---------------------------------------------------------------------------

describe("S4.01 Content depth", () => {
  it("is PASS (30) at 300 words and PARTIAL (15) at 299", () => {
    const pass = evaluate([homePage(mainOf(300))])["S4.01"];
    expect(pass.result).toBe("PASS");
    expect(pass.points).toBe(30);
    expect(evList(pass)[0].words).toBe(300);
    expect(evList(pass)[0].branch).toBe("words_300_or_more");
    const partial = evaluate([homePage(mainOf(299))])["S4.01"];
    expect(partial.result).toBe("PARTIAL");
    expect(partial.points).toBe(15);
    expect(evList(partial)[0].branch).toBe("words_150_to_299");
  });

  it("is PARTIAL (15) at 150 words and FAIL (0) at 149", () => {
    expect(evaluate([homePage(mainOf(150))])["S4.01"].points).toBe(15);
    const fail = evaluate([homePage(mainOf(149))])["S4.01"];
    expect(fail.result).toBe("FAIL");
    expect(fail.points).toBe(0);
    expect(evList(fail)[0].branch).toBe("words_under_150");
  });

  it("records the main-content method and flags it as a heuristic", () => {
    const r = evaluate([homePage(mainOf(300))])["S4.01"];
    expect(evList(r)[0].mainContentMethod).toBe("main");
    expect(evList(r)[0].mainContentIsHeuristic).toBe(true);
  });

  it("is the mean over content pages (300, 200, 100 words = 0.5 = 15 points)", () => {
    const r = evaluate([
      homePage(mainOf(300)),
      page("/services", "services", mainOf(200)),
      page("/about", "about", mainOf(100)),
    ])["S4.01"];
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(15);
    expect(r.explanation).toContain("1 of 3");
  });

  it.each<PageType>(["home", "about", "services", "faq", "article", "other"])("applies to %s pages", (type) => {
    const p = type === "home" ? homePage(mainOf(10)) : page(`/${type}/x`, type, mainOf(10));
    const r = evaluate([homePage(mainOf(300)), p].filter((v, i, all) => all.indexOf(v) === i))["S4.01"];
    expect(evList(r).some((e) => e.url === p.url)).toBe(true);
  });

  it("excludes contact and legal pages", () => {
    const r = evaluate([
      homePage(mainOf(300)),
      page("/contact", "contact", mainOf(10)),
      page("/privacy", "legal", mainOf(10)),
    ])["S4.01"];
    expect(r.result).toBe("PASS");
    expect(evList(r)).toHaveLength(1);
  });

  it("is NOT_APPLICABLE when only contact and legal pages were sampled", () => {
    const r = evaluate([page("/contact", "contact", mainOf(10)), page("/privacy", "legal", mainOf(10))])["S4.01"];
    expect(r.result).toBe("NOT_APPLICABLE");
    expect(r.points).toBeNull();
    expect(r.maxPoints).toBeNull();
  });

  it.each(["zh", "ja", "ko", "th", "zh-Hant"])("is NOT_APPLICABLE for html lang %s", (lang) => {
    const r = evaluate([homePage(html({ lang, body: "<main><p>内容</p></main>" }))])["S4.01"];
    expect(r.result).toBe("NOT_APPLICABLE");
  });

  it("scores only the pages in space-delimited languages when the sample is mixed", () => {
    const r = evaluate([
      homePage(mainOf(300)),
      page("/about", "about", html({ lang: "ja", body: "<main><p>内容</p></main>" })),
    ])["S4.01"];
    expect(r.result).toBe("PASS");
    expect(evList(r)[1].status).toBe("not_applicable");
    expect(evList(r)[1].branch).toBe("not_applicable_language");
  });

  it("is NOT_OBSERVED for a render-dependent page", () => {
    const spa = html({ body: SPA_BODY });
    const r = evaluate([homePage(spa), page("/a", "other", spa), page("/b", "other", spa)])["S4.01"];
    expect(r.result).toBe("NOT_OBSERVED");
    expect(r.points).toBeNull();
    expect(r.maxPoints).toBe(30);
    expect(evList(r)[0].branch).toBe("not_observed_render_dependent");
  });

  it("scores the readable pages when only a minority is render-dependent", () => {
    const r = evaluate([homePage(mainOf(300)), page("/app", "other", html({ body: SPA_BODY }))])["S4.01"];
    expect(r.result).toBe("PASS");
    expect(r.explanation).toContain("1 page could not be observed");
  });

  it("does not treat a short server-rendered page as render-dependent", () => {
    const r = evaluate([homePage(mainOf(20))])["S4.01"];
    expect(r.result).toBe("FAIL");
  });

  it("is SCAN_ERROR when most content pages failed to fetch", () => {
    const failed = (path: string): SampledPage => page(path, "other", null, { status: null, error: failure("TIMEOUT") });
    const r = evaluate([homePage(mainOf(300)), failed("/a"), failed("/b")])["S4.01"];
    expect(r.result).toBe("SCAN_ERROR");
    expect(r.maxPoints).toBe(30);
  });

  it("treats a 404 sampled page as unobserved", () => {
    const r = evaluate([homePage(mainOf(300)), page("/gone", "other", "Not found", { status: 404 })])["S4.01"];
    expect(evList(r)[1].status).toBe("scan_error");
    expect(r.result).toBe("PASS");
  });
});

// ---------------------------------------------------------------------------
// S4.02
// ---------------------------------------------------------------------------

const anchors = (count: number, prefix = "/p", start = 0): string =>
  Array.from({ length: count }, (_, i) => `<a href="${prefix}${start + i}">Topic ${start + i}</a>`).join(" ");

const homeWithLinks = (inner: string): SampledPage =>
  homePage(html({ body: `<main><p>${words(60)}</p>${inner}</main>` }));

describe("S4.02 Internal link breadth", () => {
  it("is PASS (20) with 8 distinct targets and PARTIAL (10) with 7", () => {
    const pass = evaluate([homeWithLinks(anchors(8))])["S4.02"];
    expect(pass.result).toBe("PASS");
    expect(pass.points).toBe(20);
    expect(ev(pass).distinctTargets).toBe(8);
    expect(ev(pass).branch).toBe("targets_8_or_more");
    const partial = evaluate([homeWithLinks(anchors(7))])["S4.02"];
    expect(partial.result).toBe("PARTIAL");
    expect(partial.points).toBe(10);
    expect(ev(partial).branch).toBe("targets_3_to_7");
  });

  it("is PARTIAL with 3 targets and FAIL with 2", () => {
    expect(evaluate([homeWithLinks(anchors(3))])["S4.02"].points).toBe(10);
    const fail = evaluate([homeWithLinks(anchors(2))])["S4.02"];
    expect(fail.result).toBe("FAIL");
    expect(fail.points).toBe(0);
    expect(ev(fail).branch).toBe("targets_2_or_fewer");
    expect(evaluate([homeWithLinks("")])["S4.02"].result).toBe("FAIL");
  });

  it("counts links from nav, main, footer and elsewhere", () => {
    const body = html({
      body: `<header><a href="/h1">Header link</a></header>
        <nav>${anchors(2, "/n")}</nav>
        <main><p>${words(60)}</p>${anchors(2, "/m")}</main>
        <footer>${anchors(2, "/f")}</footer>`,
    });
    const r = evaluate([homePage(body)])["S4.02"];
    expect(ev(r).distinctTargets).toBe(7);
    expect(ev(r).byFirstLocation).toEqual({ nav: 2, main: 2, footer: 2, other: 1 });
  });

  it("counts a target once however often it is linked", () => {
    const r = evaluate([homeWithLinks(`${anchors(3)} ${anchors(3)} <a href="/p0">Again</a>`)])["S4.02"];
    expect(ev(r).distinctTargets).toBe(3);
  });

  it("excludes the homepage itself, fragments, mailto, tel, javascript and other sites", () => {
    const noise = `
      <a href="/">Home</a>
      <a href="https://example.ie/">Home again</a>
      <a href="/#services">Services on home</a>
      <a href="#top">Top</a>
      <a href="mailto:hello@example.ie">Email</a>
      <a href="tel:+353123456789">Call</a>
      <a href="javascript:void(0)">Script</a>
      <a href="https://other.example/page">Elsewhere</a>
      <a href="ftp://example.ie/file">FTP</a>`;
    const r = evaluate([homeWithLinks(`${anchors(2)}${noise}`)])["S4.02"];
    expect(ev(r).distinctTargets).toBe(2);
    expect(r.result).toBe("FAIL");
  });

  it("does not count a fragment-only link even when a base element moves it off the homepage", () => {
    const body = html({
      head: '<base href="https://example.ie/other/">',
      body: `<main><p>${words(60)}</p><a href="https://example.ie/a">A</a><a href="https://example.ie/b">B</a><a href="#top">Top</a></main>`,
    });
    const r = evaluate([homePage(body)])["S4.02"];
    expect(ev(r).distinctTargets).toBe(2);
  });

  it("treats the www host as the same site", () => {
    const r = evaluate([homeWithLinks(`${anchors(2)}<a href="https://www.example.ie/team">Team</a>`)])["S4.02"];
    expect(ev(r).distinctTargets).toBe(3);
  });

  it("distinguishes targets that differ only by query string", () => {
    const r = evaluate([homeWithLinks('<a href="/a?x=1">A1</a><a href="/a?x=2">A2</a><a href="/a">A</a>')])["S4.02"];
    expect(ev(r).distinctTargets).toBe(3);
  });

  it("limits the sample in evidence to five targets", () => {
    const r = evaluate([homeWithLinks(anchors(9))])["S4.02"];
    expect((ev(r).sample as unknown[]).length).toBe(5);
  });

  it("is NOT_OBSERVED when the homepage is render-dependent", () => {
    const spa = html({ body: `${SPA_BODY}${anchors(10)}` });
    const r = evaluate([homePage(spa)])["S4.02"];
    expect(r.result).toBe("NOT_OBSERVED");
    expect(r.maxPoints).toBe(20);
  });

  it("is SCAN_ERROR when the homepage could not be parsed or fetched", () => {
    const r = evaluate([homePage("", { status: 500 })])["S4.02"];
    expect(r.result).toBe("SCAN_ERROR");
  });

  it("is NOT_OBSERVED when there is no homepage record", () => {
    expect(evaluate([])["S4.02"].result).toBe("NOT_OBSERVED");
  });
});

// ---------------------------------------------------------------------------
// S4.03
// ---------------------------------------------------------------------------

const bodyWithAnchors = (inner: string): string => html({ body: `<main><p>${words(60)}</p>${inner}</main>` });

function s403(...pages: SampledPage[]): MetricResult {
  return evaluate(pages)["S4.03"];
}

describe("S4.03 Descriptive anchor text", () => {
  it("is PASS (20) when every same-site link has descriptive text", () => {
    const r = s403(homePage(bodyWithAnchors('<a href="/a">AI training courses</a><a href="/b">Contact the team</a>')));
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(20);
    expect(evList(r)[0].branch).toBe("descriptive_share");
    expect(evList(r)[0].descriptive).toBe(2);
  });

  it("scores descriptive / all same-site links (3 of 4 = 0.75 = 15 points)", () => {
    const r = s403(
      homePage(
        bodyWithAnchors('<a href="/a">AI training</a><a href="/b">Our services</a><a href="/c">Pricing</a><a href="/d">Read more</a>'),
      ),
    );
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(15);
    expect(evList(r)[0].generic).toBe(1);
    expect(evList(r)[0].genericExamples).toEqual(["read more"]);
  });

  it("is FAIL (0) when every link is generic", () => {
    const r = s403(homePage(bodyWithAnchors('<a href="/a">Click here</a><a href="/b">Learn more</a>')));
    expect(r.result).toBe("FAIL");
    expect(r.points).toBe(0);
  });

  it.each([...GENERIC_ANCHORS])("treats %j as generic", (phrase) => {
    const r = s403(homePage(bodyWithAnchors(`<a href="/a">${phrase}</a><a href="/b">Pricing</a>`)));
    expect(evList(r)[0].generic).toBe(1);
    expect(r.points).toBe(10);
  });

  it("matches generic phrases ignoring case and surrounding whitespace", () => {
    const r = s403(homePage(bodyWithAnchors('<a href="/a">  READ   More </a><a href="/b">Pricing</a>')));
    expect(evList(r)[0].generic).toBe(1);
  });

  it("does not flag a descriptive link that merely contains a generic phrase", () => {
    const r = s403(homePage(bodyWithAnchors('<a href="/a">Read more about our AI training</a>')));
    expect(r.result).toBe("PASS");
  });

  it("counts icon-only links with no accessible name as non-descriptive", () => {
    const r = s403(
      homePage(bodyWithAnchors('<a href="/a"><svg width="16" height="16"></svg></a><a href="/b">Pricing</a>')),
    );
    expect(evList(r)[0].unnamed).toBe(1);
    expect(r.points).toBe(10);
  });

  it("accepts aria-label and image alt text as accessible names", () => {
    const r = s403(
      homePage(
        bodyWithAnchors(
          '<a href="/a" aria-label="Contact us"><svg></svg></a><a href="/b"><img src="/l.png" alt="Pricing"></a>',
        ),
      ),
    );
    expect(r.result).toBe("PASS");
  });

  it("treats a generic image alt as generic", () => {
    const r = s403(homePage(bodyWithAnchors('<a href="/a"><img src="/l.png" alt="here"></a><a href="/b">Pricing</a>')));
    expect(evList(r)[0].generic).toBe(1);
  });

  it("treats an image link with an empty alt as unnamed", () => {
    const r = s403(homePage(bodyWithAnchors('<a href="/a"><img src="/l.png" alt=""></a><a href="/b">Pricing</a>')));
    expect(evList(r)[0].unnamed).toBe(1);
  });

  it("ignores links to other sites, fragment-only links and non-web links", () => {
    const r = s403(
      homePage(
        bodyWithAnchors(
          '<a href="/a">Pricing</a><a href="https://other.example/">click here</a><a href="#top">here</a><a href="mailto:a@example.ie">here</a><a href="tel:123">here</a>',
        ),
      ),
    );
    expect(evList(r)[0].sameSiteLinks).toBe(1);
    expect(r.result).toBe("PASS");
  });

  it("counts every anchor, including repeated targets", () => {
    const r = s403(homePage(bodyWithAnchors('<a href="/a">Pricing</a><a href="/a">here</a>')));
    expect(evList(r)[0].sameSiteLinks).toBe(2);
    expect(r.points).toBe(10);
  });

  it("counts links in nav and footer as well as main", () => {
    const body = html({
      body: `<nav><a href="/a">Services</a></nav><main><p>${words(60)}</p><a href="/b">more</a></main><footer><a href="/c">Privacy policy</a></footer>`,
    });
    const r = s403(homePage(body));
    expect(evList(r)[0].sameSiteLinks).toBe(3);
    expect(r.points).toBeCloseTo(13.33, 2);
  });

  it("is the mean of page scores (1 and 0.5 = 0.75 = 15 points)", () => {
    const r = s403(
      homePage(bodyWithAnchors('<a href="/a">Pricing</a><a href="/b">Team</a>')),
      page("/about", "about", bodyWithAnchors('<a href="/a">Pricing</a><a href="/b">here</a>')),
    );
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(15);
  });

  it("leaves out a page with no same-site links rather than scoring it", () => {
    const r = s403(
      homePage(bodyWithAnchors('<a href="/a">Pricing</a>')),
      page("/about", "about", bodyWithAnchors("")),
    );
    expect(r.result).toBe("PASS");
    expect(evList(r)[1].status).toBe("not_applicable");
    expect(evList(r)[1].branch).toBe("not_applicable_no_internal_links");
  });

  it("is NOT_APPLICABLE when no sampled page has a same-site link", () => {
    const r = s403(homePage(bodyWithAnchors("")), page("/about", "about", bodyWithAnchors('<a href="https://other.example/">x</a>')));
    expect(r.result).toBe("NOT_APPLICABLE");
    expect(r.points).toBeNull();
  });

  it("applies to contact and legal pages", () => {
    const r = s403(
      homePage(bodyWithAnchors('<a href="/a">Pricing</a>')),
      page("/contact", "contact", bodyWithAnchors('<a href="/a">here</a>')),
    );
    expect(evList(r)).toHaveLength(2);
    expect(r.points).toBe(10);
  });

  it("is NOT_OBSERVED for render-dependent pages", () => {
    const spa = html({ body: `${SPA_BODY}<a href="/a">here</a>` });
    const r = s403(homePage(spa), page("/a", "other", spa), page("/b", "other", spa));
    expect(r.result).toBe("NOT_OBSERVED");
    expect(r.maxPoints).toBe(20);
  });

  it("is SCAN_ERROR when most pages failed to fetch", () => {
    const failed = (path: string): SampledPage => page(path, "other", null, { status: null, error: failure("TIMEOUT") });
    const r = s403(homePage(bodyWithAnchors('<a href="/a">Pricing</a>')), failed("/a"), failed("/b"));
    expect(r.result).toBe("SCAN_ERROR");
  });
});

// ---------------------------------------------------------------------------
// S4.04
// ---------------------------------------------------------------------------

const textPage = (path: string, type: PageType, text: string, outside = ""): SampledPage =>
  path === "/"
    ? homePage(html({ body: `${outside}<main><h1>${text}</h1><p>${text} ${words(30, text.replace(/\W/g, ""))}</p></main>` }))
    : page(path, type, html({ body: `${outside}<main><h1>${text}</h1><p>${text} ${words(30, text.replace(/\W/g, ""))}</p></main>` }));

function s404(...pages: SampledPage[]): MetricResult {
  return evaluate(pages)["S4.04"];
}

describe("S4.04 Distinct content", () => {
  it("is PASS (10) when all content pages have different main text", () => {
    const r = s404(textPage("/", "home", "Alpha"), textPage("/services", "services", "Beta"), textPage("/about", "about", "Gamma"));
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(10);
    expect(ev(r).branch).toBe("all_distinct");
    expect(ev(r).duplicatePages).toBe(0);
  });

  it("is 1 - duplicates/pages (2 identical of 3 = 0.3333 = 3.33 points)", () => {
    const r = s404(textPage("/", "home", "Alpha"), textPage("/services", "services", "Same"), textPage("/about", "about", "Same"));
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(3.33);
    expect(ev(r).duplicatePages).toBe(2);
    expect(ev(r).compared).toBe(3);
    expect(ev(r).branch).toBe("identical_text_found");
    expect(ev(r).duplicateSets).toEqual([["https://example.ie/services", "https://example.ie/about"]]);
  });

  it("is FAIL (0) when every page repeats the same text", () => {
    const r = s404(textPage("/", "home", "Same"), textPage("/services", "services", "Same"), textPage("/about", "about", "Same"));
    expect(r.result).toBe("FAIL");
    expect(r.points).toBe(0);
  });

  it("counts several identical sets (2 + 2 of 5 = 0.2 = 2 points)", () => {
    const r = s404(
      textPage("/", "home", "One"),
      textPage("/a", "other", "Two"),
      textPage("/b", "other", "Two"),
      textPage("/c", "other", "Three"),
      textPage("/d", "other", "Three"),
    );
    expect(r.points).toBe(2);
    expect((ev(r).duplicateSets as unknown[]).length).toBe(2);
  });

  it("compares main text only, so a different header or footer does not hide a duplicate", () => {
    const r = s404(
      textPage("/", "home", "Same", "<header>Header one</header>"),
      textPage("/services", "services", "Same", "<header>Header two</header>"),
    );
    expect(r.result).toBe("FAIL");
  });

  it("ignores whitespace differences through text normalisation", () => {
    const a = homePage(html({ body: "<main><p>Hello   world,\n this is   the page text of one page.</p></main>" }));
    const b = page("/services", "services", html({ body: "<main><p>Hello world, this is the page text of one page.</p></main>" }));
    expect(s404(a, b).result).toBe("FAIL");
  });

  it("is NOT_APPLICABLE below two content pages", () => {
    const one = s404(textPage("/", "home", "Alpha"));
    expect(one.result).toBe("NOT_APPLICABLE");
    expect(one.points).toBeNull();
    expect(one.maxPoints).toBeNull();
    expect(ev(one).branch).toBe("not_applicable_under_two_content_pages");
    expect(s404().result).toBe("NOT_APPLICABLE");
  });

  it("does not count contact and legal pages as content pages", () => {
    const two = s404(textPage("/", "home", "Same"), textPage("/contact", "contact", "Same"), textPage("/privacy", "legal", "Same"));
    expect(two.result).toBe("NOT_APPLICABLE");
    const three = s404(
      textPage("/", "home", "Alpha"),
      textPage("/services", "services", "Beta"),
      textPage("/contact", "contact", "Alpha"),
    );
    expect(three.result).toBe("PASS");
  });

  it("leaves a render-dependent page out of the comparison", () => {
    const r = s404(
      textPage("/", "home", "Same"),
      textPage("/services", "services", "Same"),
      page("/app", "other", html({ body: SPA_BODY })),
    );
    expect(r.result).toBe("FAIL");
    expect(ev(r).compared).toBe(2);
    expect(ev(r).notCompared).toBe(1);
  });

  it("is NOT_OBSERVED when fewer than two content pages are readable (render-dependent)", () => {
    const spa = html({ body: SPA_BODY });
    const r = s404(homePage(spa), page("/a", "other", spa), textPage("/b", "other", "Beta"));
    expect(r.result).toBe("NOT_OBSERVED");
    expect(r.points).toBeNull();
    expect(r.maxPoints).toBe(10);
    expect(evList(r)[0].branch).toBe("too_few_readable_pages");
  });

  it("is SCAN_ERROR when fewer than two content pages are readable because of fetch errors", () => {
    const r = s404(
      textPage("/", "home", "Alpha"),
      page("/a", "other", null, { status: null, error: failure("TIMEOUT") }),
    );
    expect(r.result).toBe("SCAN_ERROR");
  });

  it("leaves pages with no main text out of the comparison (empty text is not duplication)", () => {
    const empty = (path: string): SampledPage => page(path, "other", html({ body: "<main></main>" }));
    const r = s404(textPage("/", "home", "Alpha"), empty("/a"), empty("/b"));
    expect(r.result).toBe("NOT_OBSERVED");
    const withTwo = s404(textPage("/", "home", "Alpha"), textPage("/s", "services", "Beta"), empty("/a"), empty("/b"));
    expect(withTwo.result).toBe("PASS");
    expect(ev(withTwo).compared).toBe(2);
  });

  it("does not treat pages in CJK languages as inapplicable", () => {
    const a = homePage(html({ lang: "ja", body: "<main><p>最初のページ</p></main>" }));
    const b = page("/b", "other", html({ lang: "ja", body: "<main><p>二番目のページ</p></main>" }));
    expect(s404(a, b).result).toBe("PASS");
  });
});

// ---------------------------------------------------------------------------
// S4.05
// ---------------------------------------------------------------------------

function s405(...paths: string[]): MetricResult {
  const pages = paths.map((p) => sampled(at(p), p === "/" ? "home" : "other", html()));
  return evaluate(pages)["S4.05"];
}

function violationsOf(path: string): unknown {
  return evList(s405(path))[0].violations;
}

describe("S4.05 Clean URLs", () => {
  it("is PASS (10) for a lowercase hyphenated path", () => {
    const r = s405("/", "/about-us", "/services/ai-training");
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(10);
    expect(evList(r)[0].branch).toBe("no_violations");
  });

  it("is PARTIAL (5) for one violation and FAIL (0) for two", () => {
    const one = s405("/About");
    expect(one.result).toBe("PARTIAL");
    expect(one.points).toBe(5);
    expect(evList(one)[0].branch).toBe("one_violation");
    const two = s405("/My_Page");
    expect(two.result).toBe("FAIL");
    expect(two.points).toBe(0);
    expect(evList(two)[0].branch).toBe("two_or_more_violations");
  });

  it("flags uppercase in the path", () => {
    expect(violationsOf("/Services")).toEqual(["uppercase_in_path"]);
    expect(violationsOf("/services/AI")).toEqual(["uppercase_in_path"]);
  });

  it("does not flag the upper-case hex digits of percent-encoding", () => {
    expect(violationsOf("/caf%C3%A9")).toEqual([]);
  });

  it("flags a space, however it is written", () => {
    expect(violationsOf("/my%20page")).toEqual(["space_in_path"]);
    expect(violationsOf("/my page")).toEqual(["space_in_path"]);
  });

  it("flags an underscore in the path", () => {
    expect(violationsOf("/summer_hours")).toEqual(["underscore_in_path"]);
  });

  it("flags a path longer than 100 characters (100 is fine, 101 is not)", () => {
    expect(violationsOf(`/${"a".repeat(99)}`)).toEqual([]);
    expect(violationsOf(`/${"a".repeat(100)}`)).toEqual(["path_over_100_characters"]);
    expect(evList(s405(`/${"a".repeat(100)}`))[0].pathLength).toBe(101);
  });

  it("measures the path length on the decoded text", () => {
    expect(violationsOf(`/${"é".repeat(99)}`)).toEqual([]);
    expect(violationsOf(`/${"é".repeat(100)}`)).toEqual(["path_over_100_characters"]);
  });

  it("flags a query string once, however many parameters it has", () => {
    expect(violationsOf("/page?a=1&b=2&c=3")).toEqual(["query_string"]);
    expect(s405("/page?a=1&b=2").points).toBe(5);
  });

  it.each(["sid", "PHPSESSID", "jsessionid", "sessionId"])("flags the session parameter %s as a second violation", (name) => {
    const r = s405(`/page?${name}=abc123`);
    expect(evList(r)[0].violations).toEqual(["query_string", "session_parameter"]);
    expect(r.result).toBe("FAIL");
  });

  it("does not flag similar parameter names", () => {
    expect(violationsOf("/page?session=1")).toEqual(["query_string"]);
    expect(violationsOf("/page?sidebar=1")).toEqual(["query_string"]);
  });

  it("ignores an empty query string", () => {
    expect(violationsOf("/page?")).toEqual([]);
  });

  it("counts each kind of violation once", () => {
    expect(violationsOf("/a_b_c/d_e")).toEqual(["underscore_in_path"]);
    expect(violationsOf("/A/B")).toEqual(["uppercase_in_path"]);
  });

  it("lists every kind present", () => {
    expect(violationsOf("/My_Page%20x?sid=1")).toEqual([
      "uppercase_in_path",
      "space_in_path",
      "underscore_in_path",
      "query_string",
      "session_parameter",
    ]);
  });

  it("is the mean of page scores (clean, one, two violations = 0.5 = 5 points)", () => {
    const r = s405("/", "/About", "/A_b");
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(5);
    expect(r.explanation).toContain("1 of 3");
  });

  it("judges the final address after redirects and records the sampled one", () => {
    const moved = page("/Old_Page", "other", html(), { finalUrl: at("/new-page") });
    const r = evaluate([homePage(), moved])["S4.05"];
    expect(r.result).toBe("PASS");
    expect(evList(r)[1].checkedUrl).toBe(at("/new-page"));
    expect(evList(r)[1].finalUrl).toBe(at("/new-page"));
  });

  it("judges pages whose HTML could not be fetched or parsed, from the address alone", () => {
    const failed = page("/A_b", "other", null, { status: null, error: failure("TIMEOUT") });
    const blocked = page("/c_d", "other", null, { status: null, error: failure("ROBOTS_DISALLOWED") });
    const pdf = page("/E", "other", "%PDF", { contentType: "application/pdf" });
    const r = evaluate([homePage(), failed, blocked, pdf])["S4.05"];
    expect(evList(r).map((e) => e.status)).toEqual(["observed", "observed", "observed", "observed"]);
    expect(evList(r).map((e) => e.s_p)).toEqual([1, 0, 0.5, 0.5]);
  });

  it("is evaluated on a render-dependent page (it reads only the address)", () => {
    const r = evaluate([homePage(html({ body: SPA_BODY }))])["S4.05"];
    expect(r.result).toBe("PASS");
  });

  it("is NOT_APPLICABLE when no page was sampled", () => {
    expect(evaluate([])["S4.05"].result).toBe("NOT_APPLICABLE");
  });
});

// ---------------------------------------------------------------------------
// S4.06
// ---------------------------------------------------------------------------

const navPage = (nav: string, extra = ""): string => html({ body: `${nav}<main><p>${words(60)}</p>${extra}</main>` });
const navLinks = (count: number): string => anchors(count, "/n");

function s406(...pages: SampledPage[]): MetricResult {
  return evaluate(pages)["S4.06"];
}

describe("S4.06 Site navigation", () => {
  it("is PASS (10) for a nav with 3 internal links", () => {
    const r = s406(homePage(navPage(`<nav>${navLinks(3)}</nav>`)));
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(10);
    expect(evList(r)[0].branch).toBe("nav_with_3_or_more_links");
    expect(evList(r)[0].mostSameSiteLinks).toBe(3);
  });

  it.each([1, 2])("is PARTIAL (5) for a nav with %i internal links", (count) => {
    const r = s406(homePage(navPage(`<nav>${navLinks(count)}</nav>`)));
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(5);
    expect(evList(r)[0].branch).toBe("nav_with_1_or_2_links");
  });

  it("is FAIL (0) when there is no navigation block", () => {
    const r = s406(homePage(navPage("", navLinks(5))));
    expect(r.result).toBe("FAIL");
    expect(r.points).toBe(0);
    expect(evList(r)[0].branch).toBe("no_nav");
    expect(evList(r)[0].navBlocks).toBe(0);
  });

  it("is FAIL when the nav holds no internal links", () => {
    const r = s406(homePage(navPage('<nav><a href="https://other.example/">Elsewhere</a><a href="#top">Top</a></nav>')));
    expect(r.result).toBe("FAIL");
    expect(evList(r)[0].branch).toBe("nav_without_internal_links");
  });

  it("accepts role=navigation", () => {
    const r = s406(homePage(navPage(`<div role="navigation">${navLinks(4)}</div>`)));
    expect(r.result).toBe("PASS");
  });

  it("does not count external, fragment, mailto or javascript links in the nav", () => {
    const nav = `<nav>${navLinks(2)}<a href="https://other.example/">x</a><a href="#a">y</a><a href="mailto:a@example.ie">m</a><a href="javascript:void(0)">j</a></nav>`;
    const r = s406(homePage(navPage(nav)));
    expect(r.result).toBe("PARTIAL");
    expect(evList(r)[0].mostSameSiteLinks).toBe(2);
  });

  it("uses the best of several nav blocks", () => {
    const r = s406(homePage(navPage(`<nav>${navLinks(1)}</nav><nav>${navLinks(3)}</nav>`)));
    expect(r.result).toBe("PASS");
    expect(evList(r)[0].navBlocks).toBe(2);
  });

  it("does not add the links of separate nav blocks together", () => {
    const r = s406(homePage(navPage(`<nav>${navLinks(2)}</nav><nav>${anchors(2, "/o")}</nav>`)));
    expect(r.result).toBe("PARTIAL");
  });

  it("is the mean of page scores (1, 0.5, 0 = 0.5 = 5 points)", () => {
    const r = s406(
      homePage(navPage(`<nav>${navLinks(3)}</nav>`)),
      page("/services", "services", navPage(`<nav>${navLinks(1)}</nav>`)),
      page("/about", "about", navPage("")),
    );
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(5);
    expect(r.explanation).toContain("1 of 3");
  });

  it("applies to every page type including contact and legal", () => {
    const r = s406(
      homePage(navPage(`<nav>${navLinks(3)}</nav>`)),
      page("/contact", "contact", navPage("")),
      page("/privacy", "legal", navPage("")),
    );
    expect(evList(r)).toHaveLength(3);
    expect(r.points).toBeCloseTo(3.33, 2);
  });

  it("is NOT_OBSERVED for render-dependent pages", () => {
    const spa = html({ body: `<nav>${navLinks(3)}</nav>${SPA_BODY}` });
    const r = s406(homePage(spa), page("/a", "other", spa), page("/b", "other", spa));
    expect(r.result).toBe("NOT_OBSERVED");
    expect(r.maxPoints).toBe(10);
  });

  it("scores the readable pages when only a minority is render-dependent", () => {
    const spa = html({ body: `<nav>${navLinks(3)}</nav>${SPA_BODY}` });
    const r = s406(homePage(navPage(`<nav>${navLinks(3)}</nav>`)), page("/app", "other", spa));
    expect(r.result).toBe("PASS");
  });

  it("is SCAN_ERROR when most pages failed to fetch", () => {
    const failed = (path: string): SampledPage => page(path, "other", null, { status: null, error: failure("TIMEOUT") });
    const r = s406(homePage(navPage(`<nav>${navLinks(3)}</nav>`)), failed("/a"), failed("/b"));
    expect(r.result).toBe("SCAN_ERROR");
  });
});

// ---------------------------------------------------------------------------
// Whole category
// ---------------------------------------------------------------------------

describe("evaluateS4", () => {
  it("returns one result per S4 metric in id order, deterministically", () => {
    const nav = `<nav>${navLinks(3)}</nav>`;
    const pages = [
      homePage(html({ body: `${nav}<main><p>${words(320)}</p>${anchors(8, "/h")}</main>` })),
      page("/services", "services", html({ body: `${nav}<main><p>${words(310, "svc")}</p></main>` })),
    ];
    const snap = snapshot({ pages });
    const first = evaluateS4(buildEvalContext(snap, NOW));
    const second = evaluateS4(buildEvalContext(snap, NOW));
    checkShape(first);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.map((r) => r.result)).toEqual(["PASS", "PASS", "PASS", "PASS", "PASS", "PASS"]);
    expect(first.reduce((sum, r) => sum + (r.points ?? 0), 0)).toBe(100);
  });

  it("returns a result for every metric when there are no pages", () => {
    const results = evaluateS4(buildEvalContext(snapshot(), NOW));
    checkShape(results);
    expect(results.map((r) => r.result)).toEqual([
      "NOT_APPLICABLE",
      "NOT_OBSERVED",
      "NOT_APPLICABLE",
      "NOT_APPLICABLE",
      "NOT_APPLICABLE",
      "NOT_APPLICABLE",
    ]);
  });
});
