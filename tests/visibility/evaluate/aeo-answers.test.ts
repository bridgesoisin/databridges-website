import { describe, expect, it, vi } from "vitest";
import { buildEvalContext } from "@/lib/visibility/context";
import { evaluateA3 } from "@/lib/visibility/evaluate/aeo-answers";
import { METHODOLOGY } from "@/lib/visibility/methodology";
import { CANDIDATE_EXCLUSIONS, PAGE_TYPES } from "@/lib/visibility/types";
import type {
  EvalContext,
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

// ---------------------------------------------------------------------------
// Builders: small HTML pages run through the real extractor and buildEvalContext
// ---------------------------------------------------------------------------

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

function zeroed<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
}

function snapshot(pages: SampledPage[], over: Partial<ScanSnapshot> = {}): ScanSnapshot {
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
      excluded: zeroed(CANDIDATE_EXCLUSIONS),
      byType: zeroed(PAGE_TYPES),
      capped: false,
    },
    stats: { requestCount: 0, requestCapReached: false, jobTimedOut: false, jobDurationMs: 0 },
    ...over,
  };
}

function ctxOf(pages: SampledPage[], over: Partial<ScanSnapshot> = {}): EvalContext {
  return buildEvalContext(snapshot(pages, over), NOW);
}

function depthOf(url: string): number {
  return new URL(url).pathname.split("/").filter((s) => s !== "").length;
}

function sampled(url: string, type: PageType, body: string | null, over: Partial<FetchRecord> = {}): SampledPage {
  return {
    url,
    type,
    reason: `test ${type}`,
    depth: depthOf(url),
    record: record(url, { body, ...over }),
  };
}

function failure(code: FetchErrorCode): { code: FetchErrorCode; message: string } {
  return { code, message: code };
}

function doc(opts: { lang?: string | null; head?: string; body: string }): string {
  const lang = opts.lang === undefined ? "en" : opts.lang;
  const attr = lang === null ? "" : ` lang="${lang}"`;
  return `<!doctype html><html${attr}><head><title>A page title</title>${opts.head ?? ""}</head><body>${opts.body}</body></html>`;
}

const SPA_SHELL = doc({
  body: `<div id="root"></div><noscript>You need to enable JavaScript to run this app.</noscript>`,
});

function ld(value: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
}

// n counted words, one sentence ending in a full stop.
function sentence(n: number, prefix = "word"): string {
  const tokens = Array.from({ length: n }, (_, i) => `${prefix}${i}`);
  return `${tokens.join(" ")}.`;
}

function para(n: number): string {
  return `<p>${sentence(n)}</p>`;
}

// k sentences of `each` words, so k sentences and k*each words.
function paraOfSentences(k: number, each: number): string {
  return `<p>${Array.from({ length: k }, (_, i) => sentence(each, `s${i}w`)).join(" ")}</p>`;
}

function section(heading: string, answerWords = 20, level = 2): string {
  return `<h${level}>${heading}</h${level}>${para(answerWords)}`;
}

function mainPage(url: string, type: PageType, inner: string, opts: { lang?: string | null; head?: string } = {}): SampledPage {
  return sampled(url, type, doc({ lang: opts.lang, head: opts.head, body: `<main>${inner}</main>` }));
}

function home(inner = para(60), opts: { lang?: string | null; head?: string } = {}): SampledPage {
  return mainPage(HOME, "home", inner, opts);
}

function run(pages: SampledPage[], over: Partial<ScanSnapshot> = {}): Record<string, MetricResult> {
  const results = evaluateA3(ctxOf(pages, over));
  return Object.fromEntries(results.map((r) => [r.metricId, r]));
}

function one(id: string, pages: SampledPage[], over: Partial<ScanSnapshot> = {}): MetricResult {
  return run(pages, over)[id];
}

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, out);
  else if (typeof value === "object" && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      out.push(key);
      collectStrings(item, out);
    }
  }
  return out;
}

function expectCleanEvidence(result: MetricResult): void {
  expect(JSON.parse(JSON.stringify(result.evidence))).toEqual(result.evidence);
  for (const text of [...collectStrings(result.evidence), result.explanation]) {
    expect(text.length).toBeLessThanOrEqual(200);
    expect(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/.test(text)).toBe(false);
  }
}

function pageRecords(result: MetricResult): Record<string, unknown>[] {
  return result.evidence as Record<string, unknown>[];
}

const KO_URL = "https://example.ie/services";
const KO_URL_2 = "https://example.ie/faq";
const KO_URL_3 = "https://example.ie/blog/post";

function ko(inner: string, opts: { lang?: string | null; url?: string; type?: PageType } = {}): SampledPage {
  return mainPage(opts.url ?? KO_URL, opts.type ?? "services", inner, { lang: opts.lang });
}

// ---------------------------------------------------------------------------
// Category contract
// ---------------------------------------------------------------------------

describe("evaluateA3: result contract", () => {
  it("returns one result per A3 metric, in id order, with the methodology's points", () => {
    const results = evaluateA3(ctxOf([home(), ko(section("Our services"))]));
    const category = METHODOLOGY.categories.find((c) => c.id === "A3");
    expect(results.map((r) => r.metricId)).toEqual(category?.metricIds);
    expect(results.map((r) => r.metricId)).toEqual(["A3.01", "A3.02", "A3.03", "A3.04", "A3.05", "A3.06"]);
    for (const result of results) {
      expect(result.metricVersion).toBe(1);
      expect(result.reviewedBy).toBeNull();
      expect(result.explanation).not.toBe("");
    }
    expect(results.map((r) => r.maxPoints)).toEqual([10, 30, 20, 15, 10, 15].map((n, i) => (results[i].result === "NOT_APPLICABLE" ? null : n)));
  });

  it("returns six results even when nothing was sampled", () => {
    const results = evaluateA3(ctxOf([]));
    expect(results).toHaveLength(6);
    expect(results.map((r) => r.result)).toEqual([
      "NOT_APPLICABLE",
      "NOT_APPLICABLE",
      "NOT_OBSERVED",
      "NOT_APPLICABLE",
      "NOT_APPLICABLE",
      "NOT_OBSERVED",
    ]);
  });

  it("does not read the wall clock and is deterministic", () => {
    const pages = [home(), ko(section("What is this?") + section("Why us?") + section("How?"))];
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2020-01-01T00:00:00Z"));
      const first = evaluateA3(ctxOf(pages));
      vi.setSystemTime(new Date("2035-06-01T00:00:00Z"));
      const second = evaluateA3(ctxOf(pages));
      expect(second).toEqual(first);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not mutate the snapshot it reads", () => {
    const snap = snapshot([home(), ko(section("A") + section("B") + section("C"))]);
    const before = JSON.stringify(snap);
    evaluateA3(buildEvalContext(snap, NOW));
    expect(JSON.stringify(snap)).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// A3.01 Question-style headings
// ---------------------------------------------------------------------------

function headingsPage(texts: string[], opts: { level?: number; lang?: string | null } = {}): SampledPage {
  return ko(texts.map((t) => section(t, 20, opts.level ?? 2)).join(""), { lang: opts.lang });
}

describe("A3.01 question-style headings", () => {
  const plain = (n: number) => Array.from({ length: n }, (_, i) => `Topic number ${i}`);

  it("PASS at exactly 25% questions (1 of 4)", () => {
    const r = one("A3.01", [home(), headingsPage(["Is it any good?", ...plain(3)])]);
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(10);
    expect(pageRecords(r)[0]).toMatchObject({ branch: "questions_25_percent_or_more", subheadings: 4, questions: 1, questionShare: 25 });
  });

  it("PARTIAL just under 25% (4 of 17 is 23.5%)", () => {
    const r = one("A3.01", [headingsPage(["A?", "B?", "C?", "D?", ...plain(13)])]);
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(5);
    expect(pageRecords(r)[0].branch).toBe("questions_10_to_24_percent");
  });

  it("PASS at 25% with a larger page (4 of 16)", () => {
    const r = one("A3.01", [headingsPage(["A?", "B?", "C?", "D?", ...plain(12)])]);
    expect(r.result).toBe("PASS");
  });

  it("PARTIAL at exactly 10% (1 of 10) and for 14% (1 of 7)", () => {
    expect(one("A3.01", [headingsPage(["Why?", ...plain(9)])])).toMatchObject({ result: "PARTIAL", points: 5 });
    const seven = one("A3.01", [headingsPage(["Why?", ...plain(6)])]);
    expect(seven).toMatchObject({ result: "PARTIAL", points: 5 });
    expect(pageRecords(seven)[0].questionShare).toBe(14.3);
  });

  it("FAIL just under 10% (1 of 11 is 9.1%) and at 0%", () => {
    const eleven = one("A3.01", [headingsPage(["Why?", ...plain(10)])]);
    expect(eleven).toMatchObject({ result: "FAIL", points: 0 });
    expect(pageRecords(eleven)[0].branch).toBe("questions_under_10_percent");
    expect(one("A3.01", [headingsPage(plain(4))])).toMatchObject({ result: "FAIL", points: 0 });
  });

  it("treats a heading that starts with a question word as a question", () => {
    for (const text of ["How we work", "What we do", "Who we are", "Can you help with tax", "Should I register", "Is it safe"]) {
      const r = one("A3.01", [headingsPage([text, ...plain(5)])]);
      expect(r.result).toBe("PARTIAL");
      expect(pageRecords(r)[0].questions).toBe(1);
    }
  });

  it("does not treat a heading as a question just because it contains a question word", () => {
    const r = one("A3.01", [headingsPage(["Our approach to what matters", "Topic one", "Topic two"])]);
    expect(r.result).toBe("FAIL");
  });

  it("recognises a trailing question mark followed by a closing quote or bracket", () => {
    const r = one("A3.01", [headingsPage(["Our price (really?)", "Topic one", "Topic two"])]);
    expect(pageRecords(r)[0].questions).toBe(1);
  });

  it("counts h3 as well as h2, and ignores h1, h4 and headings outside main", () => {
    const inner =
      "<h1>Is this the title?</h1>" +
      section("Topic one", 20, 2) +
      section("Is it h3?", 20, 3) +
      section("Another topic", 20, 3) +
      section("Is it h4?", 20, 4);
    const page = sampled(
      KO_URL,
      "services",
      doc({ body: `<aside><h2>Is this aside?</h2></aside><main>${inner}</main><footer><h2>Is this footer?</h2></footer>` }),
    );
    const r = one("A3.01", [page]);
    expect(pageRecords(r)[0]).toMatchObject({ subheadings: 3, questions: 1 });
  });

  it("ignores an empty subheading", () => {
    const r = one("A3.01", [ko(section("") + section("Topic one") + section("Topic two") + section("Why?"))]);
    expect(pageRecords(r)[0]).toMatchObject({ subheadings: 3, questions: 1 });
  });

  it("NOT_APPLICABLE when no page has 3 subheadings (2 is not enough)", () => {
    const r = one("A3.01", [headingsPage(["Why?", "How?"])]);
    expect(r.result).toBe("NOT_APPLICABLE");
    expect(r.points).toBeNull();
    expect(r.maxPoints).toBeNull();
    expect(pageRecords(r)[0]).toMatchObject({ branch: "fewer_than_3_subheadings", subheadings: 2, status: "not_applicable" });
  });

  it("applies from exactly 3 subheadings", () => {
    expect(one("A3.01", [headingsPage(["Why?", "How?", "What?"])]).result).toBe("PASS");
  });

  it("a page with fewer than 3 subheadings is left out of the mean", () => {
    const good = headingsPage(["Why?", "How?", "What?"]);
    const thin = ko(section("Only one"), { url: KO_URL_2, type: "faq" });
    const r = one("A3.01", [good, thin]);
    expect(r.result).toBe("PASS");
    expect(pageRecords(r)[1]).toMatchObject({ status: "not_applicable", s_p: null });
  });

  it("NOT_APPLICABLE for a page whose language is not English, or undeclared", () => {
    for (const lang of ["fr", "fr-FR", "ja", "de", null, ""]) {
      const r = one("A3.01", [headingsPage(["Why?", "How?", "What?"], { lang })]);
      expect(r.result).toBe("NOT_APPLICABLE");
      expect(pageRecords(r)[0].branch).toBe("not_applicable_language");
    }
  });

  it("applies to en, en-IE and EN (language is read as the primary subtag, case-insensitively)", () => {
    for (const lang of ["en", "en-IE", "EN-gb"]) {
      expect(one("A3.01", [headingsPage(["Why?", "How?", "What?"], { lang })]).result).toBe("PASS");
    }
  });

  it("does not treat a three-letter language such as eng as English (conservative reading)", () => {
    expect(one("A3.01", [headingsPage(["Why?", "How?", "What?"], { lang: "eng" })]).result).toBe("NOT_APPLICABLE");
  });

  it("only knowledge pages count: home, about, contact and legal are out of scope", () => {
    const heads = ["Why?", "How?", "What?"];
    const inner = heads.map((t) => section(t)).join("");
    expect(one("A3.01", [mainPage(HOME, "home", inner)]).result).toBe("NOT_APPLICABLE");
    expect(one("A3.01", [home(), mainPage("https://example.ie/about", "about", inner)]).result).toBe("NOT_APPLICABLE");
    expect(one("A3.01", [home(), mainPage("https://example.ie/contact", "contact", inner)]).result).toBe("NOT_APPLICABLE");
    expect(one("A3.01", [home(), mainPage("https://example.ie/privacy", "legal", inner)]).result).toBe("NOT_APPLICABLE");
    for (const [type, url] of [["services", KO_URL], ["faq", KO_URL_2], ["article", KO_URL_3], ["other", "https://example.ie/pricing"]] as const) {
      expect(one("A3.01", [mainPage(url, type, inner)]).result).toBe("PASS");
    }
  });

  it("the metric score is the mean of page scores (PASS page and FAIL page give 0.5)", () => {
    const good = headingsPage(["Why?", "How?", "What?"]);
    const bad = ko(["One", "Two", "Three"].map((t) => section(t)).join(""), { url: KO_URL_2, type: "faq" });
    const r = one("A3.01", [home(), good, bad]);
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(5);
    expect(pageRecords(r)).toHaveLength(2);
    expect(r.explanation).toContain("1 scored full marks");
  });

  it("is NOT_OBSERVED for a render-dependent page, and the metric when fewer than half were observed", () => {
    const spa = sampled(KO_URL, "services", SPA_SHELL);
    const r = one("A3.01", [spa]);
    expect(r.result).toBe("NOT_OBSERVED");
    expect(r.points).toBeNull();
    expect(r.maxPoints).toBe(10);
    expect(pageRecords(r)[0]).toMatchObject({ branch: "render_dependent", status: "not_observed" });
    const readable = ko(["Why?", "How?", "What?"].map((t) => section(t)).join(""), { url: KO_URL_3, type: "article" });
    const mixed = one("A3.01", [spa, sampled(KO_URL_2, "faq", SPA_SHELL), readable]);
    expect(mixed.result).toBe("NOT_OBSERVED");
  });

  it("scores from the observed pages when at least half could be read", () => {
    const spa = sampled(KO_URL_2, "faq", SPA_SHELL);
    const good = headingsPage(["Why?", "How?", "What?"]);
    const r = one("A3.01", [spa, good]);
    expect(r.result).toBe("PASS");
  });

  it("is SCAN_ERROR when fewer than half could be read because of fetch failures", () => {
    const broken = sampled(KO_URL, "services", null, { status: 500, body: null });
    expect(one("A3.01", [broken]).result).toBe("SCAN_ERROR");
    const failed = sampled(KO_URL, "services", null, { status: null, error: failure("TIMEOUT") });
    expect(one("A3.01", [failed]).result).toBe("SCAN_ERROR");
  });

  it("is NOT_OBSERVED for robots-blocked and non-HTML pages", () => {
    const blocked = sampled(KO_URL, "services", null, { status: null, error: failure("ROBOTS_DISALLOWED") });
    expect(one("A3.01", [blocked]).result).toBe("NOT_OBSERVED");
    const pdf = sampled(KO_URL, "services", null, { contentType: "application/pdf" });
    expect(one("A3.01", [pdf]).result).toBe("NOT_OBSERVED");
  });

  it("keeps evidence short and clean for hostile headings", () => {
    const bidi = String.fromCodePoint(0x202e);
    const long = `Why ${"x".repeat(500)}${bidi}?`;
    const r = one("A3.01", [headingsPage([long, ...plain(5)])]);
    expectCleanEvidence(r);
    expect(r.result).toBe("PARTIAL");
  });
});

// ---------------------------------------------------------------------------
// A3.02 Answer-first sections
// ---------------------------------------------------------------------------

describe("A3.02 answer-first sections", () => {
  const goodSections = (n: number) => Array.from({ length: n }, (_, i) => section(`Topic ${i}`, 20)).join("");
  const badSections = (n: number) => Array.from({ length: n }, (_, i) => section(`Bad ${i}`, 5)).join("");

  it("PASS when every subheading opens with a 20-word single-sentence paragraph", () => {
    const r = one("A3.02", [ko(goodSections(4))]);
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(30);
    expect(pageRecords(r)[0]).toMatchObject({ branch: "answer_first_60_percent_or_more", subheadings: 4, answerFirst: 4 });
  });

  it("answer block word boundaries: 14 fails, 15 passes, 70 passes, 71 fails", () => {
    const check = (words: number) =>
      pageRecords(one("A3.02", [ko(section("One", words) + section("Two", 20) + section("Three", 20))]))[0].answerFirst;
    expect(check(14)).toBe(2);
    expect(check(15)).toBe(3);
    expect(check(70)).toBe(3);
    expect(check(71)).toBe(2);
  });

  it("answer block sentence boundary: 3 sentences pass, 4 fail", () => {
    const three = ko(`<h2>One</h2>${paraOfSentences(3, 8)}` + section("Two") + section("Three"));
    const four = ko(`<h2>One</h2>${paraOfSentences(4, 8)}` + section("Two") + section("Three"));
    expect(pageRecords(one("A3.02", [three]))[0].answerFirst).toBe(3);
    expect(pageRecords(one("A3.02", [four]))[0].answerFirst).toBe(2);
  });

  it("page score thresholds: 60% is 1, 59% is 0.5, 30% is 0.5, under 30% is 0", () => {
    // 3 of 5 = 60%
    const sixty = ko(goodSections(3) + badSections(2));
    expect(one("A3.02", [sixty]).result).toBe("PASS");
    // 10 of 17 = 58.8%
    const fiftyNine = ko(goodSections(10) + badSections(7));
    const r59 = one("A3.02", [fiftyNine]);
    expect(r59).toMatchObject({ result: "PARTIAL", points: 15 });
    expect(pageRecords(r59)[0].branch).toBe("answer_first_30_to_59_percent");
    // 3 of 10 = 30%
    const thirty = ko(goodSections(3) + badSections(7));
    expect(one("A3.02", [thirty])).toMatchObject({ result: "PARTIAL", points: 15 });
    // 5 of 17 = 29.4%
    const twentyNine = ko(goodSections(5) + badSections(12));
    const r29 = one("A3.02", [twentyNine]);
    expect(r29).toMatchObject({ result: "FAIL", points: 0 });
    expect(pageRecords(r29)[0].branch).toBe("answer_first_under_30_percent");
  });

  it("lists the first few misses in the evidence with the reason", () => {
    const r = one("A3.02", [ko(badSections(4))]);
    const misses = pageRecords(r)[0].misses as string[];
    expect(misses).toHaveLength(3);
    expect(misses[0]).toContain("5 words (under 15)");
  });

  it("uses the first paragraph under a heading and ignores later ones", () => {
    const inner = `<h2>One</h2>${para(5)}${para(30)}` + section("Two") + section("Three");
    expect(pageRecords(one("A3.02", [ko(inner)]))[0].answerFirst).toBe(2);
  });

  it("ignores a paragraph that comes before the first subheading", () => {
    const inner = para(30) + `<h2>One</h2>` + `<h2>Two</h2>` + `<h2>Three</h2>`;
    const r = one("A3.02", [ko(inner)]);
    expect(pageRecords(r)[0]).toMatchObject({ subheadings: 3, answerFirst: 0 });
  });

  it("a subheading with no paragraph before the next heading of the same level does not qualify", () => {
    const inner = `<h2>One</h2><h2>Two</h2>${para(20)}<h2>Three</h2>${para(20)}`;
    expect(pageRecords(one("A3.02", [ko(inner)]))[0].answerFirst).toBe(2);
  });

  it("an h2 takes the first paragraph under its own h3 (next heading of the same or higher level ends the section)", () => {
    const inner = `<h2>Parent</h2><h3>Child</h3>${para(20)}<h2>Next</h2>${para(20)}<h2>Last</h2>${para(20)}`;
    const r = one("A3.02", [ko(inner)]);
    expect(pageRecords(r)[0]).toMatchObject({ subheadings: 4, answerFirst: 4 });
  });

  it("an h3 stops at the next h3 or h2, so it does not borrow a later paragraph", () => {
    const inner = `<h2>Parent</h2>${para(20)}<h3>One</h3><h3>Two</h3>${para(20)}<h3>Three</h3><h2>Four</h2>${para(20)}`;
    const r = one("A3.02", [ko(inner)]);
    // Parent ok, One no paragraph, Two ok, Three no paragraph, Four ok
    expect(pageRecords(r)[0]).toMatchObject({ subheadings: 5, answerFirst: 3 });
  });

  it("text outside a p element does not count as an answer block", () => {
    const inner = ["One", "Two", "Three"].map((h) => `<h2>${h}</h2><div>${sentence(20)}</div>`).join("");
    expect(pageRecords(one("A3.02", [ko(inner)]))[0].answerFirst).toBe(0);
  });

  it("NOT_APPLICABLE for a page with fewer than 3 subheadings", () => {
    const r = one("A3.02", [ko(goodSections(2))]);
    expect(r.result).toBe("NOT_APPLICABLE");
    expect(pageRecords(r)[0].branch).toBe("fewer_than_3_subheadings");
  });

  it("applies to any language that uses spaces (French), unlike A3.01", () => {
    expect(one("A3.02", [ko(goodSections(3), { lang: "fr" })]).result).toBe("PASS");
  });

  it("NOT_APPLICABLE for Chinese, Japanese, Korean and Thai pages (word-count metric)", () => {
    for (const lang of ["zh", "ja-JP", "ko", "th"]) {
      const r = one("A3.02", [ko(goodSections(3), { lang })]);
      expect(r.result).toBe("NOT_APPLICABLE");
    }
  });

  it("NOT_OBSERVED for a render-dependent page", () => {
    const r = one("A3.02", [sampled(KO_URL, "services", SPA_SHELL)]);
    expect(r.result).toBe("NOT_OBSERVED");
    expect(r.maxPoints).toBe(30);
  });

  it("mean across pages (PASS page and FAIL page give 15 points)", () => {
    const r = one("A3.02", [home(), ko(goodSections(4)), ko(badSections(4), { url: KO_URL_2, type: "faq" })]);
    expect(r).toMatchObject({ result: "PARTIAL", points: 15 });
  });

  it("keeps evidence short and clean for hostile headings", () => {
    const bidi = String.fromCodePoint(0x202e);
    const r = one("A3.02", [ko(section(`${"y".repeat(400)}${bidi}`, 3) + badSections(3))]);
    expectCleanEvidence(r);
  });
});

// ---------------------------------------------------------------------------
// A3.03 FAQ block present
// ---------------------------------------------------------------------------

describe("A3.03 FAQ block present", () => {
  const detailsPairs = (n: number) =>
    Array.from({ length: n }, (_, i) => `<details><summary>Question ${i}?</summary><p>Answer ${i} is here.</p></details>`).join("");
  const dlPairs = (n: number) =>
    `<dl>${Array.from({ length: n }, (_, i) => `<dt>Question ${i}?</dt><dd>Answer ${i} is here.</dd>`).join("")}</dl>`;
  const headingPairs = (n: number, question = true) =>
    Array.from({ length: n }, (_, i) => `<h2>${question ? `Is item ${i} available?` : `Plain heading ${i}`}</h2><p>Answer ${i} is here.</p>`).join("");

  it("PASS with 3 details/summary pairs on one page", () => {
    const r = one("A3.03", [home(), ko(detailsPairs(3))]);
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(20);
    expect(r.explanation).toContain("3 question and answer pairs");
  });

  it("PASS with 3 dt/dd pairs, and with 3 question-form headings each followed by a paragraph", () => {
    expect(one("A3.03", [ko(dlPairs(3))]).result).toBe("PASS");
    expect(one("A3.03", [ko(headingPairs(3))]).result).toBe("PASS");
  });

  it("PARTIAL (0.5) with 1 or 2 pairs on the best page", () => {
    for (const n of [1, 2]) {
      const r = one("A3.03", [ko(detailsPairs(n))]);
      expect(r).toMatchObject({ result: "PARTIAL", points: 10 });
      expect(pageRecords(r)[0].branch).toBe("pairs_1_or_2");
    }
  });

  it("FAIL with no pairs", () => {
    const r = one("A3.03", [home(), ko(para(40))]);
    expect(r).toMatchObject({ result: "FAIL", points: 0 });
    expect(r.explanation).toBe("No sampled page has a detectable question and answer block.");
  });

  it("headings that are not in question form do not count as pairs", () => {
    expect(one("A3.03", [ko(headingPairs(5, false))]).result).toBe("FAIL");
  });

  it("details and dl pairs count whatever their wording; only the heading variant needs a question", () => {
    const loose = `<details><summary>Delivery</summary><p>We deliver.</p></details><details><summary>Returns</summary><p>Within 30 days.</p></details><dl><dt>Opening</dt><dd>9 to 5</dd></dl>`;
    expect(one("A3.03", [ko(loose)]).result).toBe("PASS");
  });

  it("adds the three mechanisms together on one page (2 details + 1 dl = 3)", () => {
    const r = one("A3.03", [ko(detailsPairs(2) + dlPairs(1))]);
    expect(r.result).toBe("PASS");
    expect(pageRecords(r)[0]).toMatchObject({ pairs: 3, detailsSummary: 2, definitionList: 1, questionHeadingWithParagraph: 0 });
  });

  it("does not add pairs across pages: 2 + 2 is still a partial result", () => {
    const r = one("A3.03", [ko(detailsPairs(2)), ko(detailsPairs(2), { url: KO_URL_2, type: "faq" })]);
    expect(r).toMatchObject({ result: "PARTIAL", points: 10 });
  });

  it("uses the best page: a page with 3 pairs beats a page with 1", () => {
    const r = one("A3.03", [ko(detailsPairs(1)), ko(detailsPairs(3), { url: KO_URL_2, type: "faq" })]);
    expect(r.result).toBe("PASS");
    expect(r.explanation).toContain(KO_URL_2);
  });

  it("reads every sampled page, including the homepage and about page", () => {
    expect(one("A3.03", [home(detailsPairs(3))]).result).toBe("PASS");
    expect(one("A3.03", [home(), mainPage("https://example.ie/about", "about", dlPairs(4))]).result).toBe("PASS");
  });

  it("is NOT_OBSERVED when every page is render-dependent", () => {
    const r = one("A3.03", [sampled(HOME, "home", SPA_SHELL), sampled(KO_URL, "services", SPA_SHELL)]);
    expect(r.result).toBe("NOT_OBSERVED");
    expect(r.maxPoints).toBe(20);
  });

  it("is NOT_OBSERVED rather than FAIL when most pages could not be read and none shows a FAQ", () => {
    const r = one("A3.03", [home(), sampled(KO_URL, "services", SPA_SHELL), sampled(KO_URL_2, "faq", SPA_SHELL)]);
    expect(r.result).toBe("NOT_OBSERVED");
  });

  it("is still PASS when a readable page shows 3 pairs and the others are render-dependent", () => {
    const r = one("A3.03", [sampled(HOME, "home", SPA_SHELL), sampled(KO_URL, "services", SPA_SHELL), ko(detailsPairs(3), { url: KO_URL_2, type: "faq" })]);
    expect(r.result).toBe("PASS");
  });

  it("scores FAIL from the readable pages when at least half were read", () => {
    const r = one("A3.03", [home(), ko(para(40)), sampled(KO_URL_2, "faq", SPA_SHELL)]);
    expect(r.result).toBe("FAIL");
  });

  it("is SCAN_ERROR when fewer than half could be read because of fetch failures", () => {
    const r = one("A3.03", [
      home(),
      sampled(KO_URL, "services", null, { status: 500 }),
      sampled(KO_URL_2, "faq", null, { status: null, error: failure("TIMEOUT") }),
    ]);
    expect(r.result).toBe("SCAN_ERROR");
  });

  it("is NOT_OBSERVED when there is no sampled page at all", () => {
    expect(one("A3.03", []).result).toBe("NOT_OBSERVED");
  });

  it("reads Chinese, Japanese, Korean and Thai pages too (pairs are not word counts)", () => {
    expect(one("A3.03", [ko(dlPairs(3), { lang: "ja" })]).result).toBe("PASS");
  });
});

// ---------------------------------------------------------------------------
// A3.04 Scannable structure
// ---------------------------------------------------------------------------

describe("A3.04 scannable structure", () => {
  // Exactly `total` counted words in main, including the fixed markup words.
  const padded = (total: number, fixed: string, fixedWords: number) => `${para(total - fixedWords)}${fixed}`;
  const list3 = "<ul><li>one</li><li>two</li><li>three</li></ul>";
  const list2 = "<ul><li>one</li><li>two</li></ul>";

  it("PASS with a list of 3 items on a page of 300 words", () => {
    const r = one("A3.04", [ko(padded(300, list3, 3))]);
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(15);
    expect(pageRecords(r)[0]).toMatchObject({ branch: "list_of_3_or_more", mainWords: 300, longestListItems: 3 });
  });

  it("counts an ordered list", () => {
    expect(one("A3.04", [ko(padded(300, "<ol><li>one</li><li>two</li><li>three</li><li>four</li></ol>", 4))]).result).toBe("PASS");
  });

  it("PASS with a table that has a header cell and 2 rows (header row counts as a row)", () => {
    const table = "<table><tr><th>Plan</th></tr><tr><td>Basic</td></tr></table>";
    const r = one("A3.04", [ko(padded(300, table, 2))]);
    expect(r.result).toBe("PASS");
    expect(pageRecords(r)[0]).toMatchObject({ branch: "table_with_header_and_2_rows", qualifyingTables: 1 });
  });

  it("FAIL for a list of only 2 items, a table without a header cell, or a one-row table", () => {
    expect(one("A3.04", [ko(padded(300, list2, 2))]).result).toBe("FAIL");
    expect(one("A3.04", [ko(padded(300, "<table><tr><td>a</td></tr><tr><td>b</td></tr></table>", 2))]).result).toBe("FAIL");
    expect(one("A3.04", [ko(padded(300, "<table><tr><th>a</th></tr></table>", 1))]).result).toBe("FAIL");
  });

  it("FAIL for a long page with no list or table", () => {
    const r = one("A3.04", [ko(para(400))]);
    expect(r).toMatchObject({ result: "FAIL", points: 0 });
    expect(pageRecords(r)[0].branch).toBe("no_list_or_table");
  });

  it("word boundary: 299 words is NOT_APPLICABLE and 300 words is assessed", () => {
    const short = one("A3.04", [ko(padded(299, list3, 3))]);
    expect(short.result).toBe("NOT_APPLICABLE");
    expect(pageRecords(short)[0]).toMatchObject({ branch: "under_300_words", mainWords: 299 });
    expect(one("A3.04", [ko(padded(300, list3, 3))]).result).toBe("PASS");
  });

  it("a list in navigation outside main does not count", () => {
    const page = sampled(
      KO_URL,
      "services",
      doc({ body: `<nav>${list3}</nav><main>${para(320)}</main>` }),
    );
    expect(one("A3.04", [page]).result).toBe("FAIL");
  });

  it("the page left out as short does not drag the mean", () => {
    const r = one("A3.04", [ko(padded(300, list3, 3)), ko(para(120), { url: KO_URL_2, type: "faq" })]);
    expect(r.result).toBe("PASS");
  });

  it("mean across pages (one PASS, one FAIL)", () => {
    const r = one("A3.04", [ko(padded(300, list3, 3)), ko(para(400), { url: KO_URL_2, type: "faq" })]);
    expect(r).toMatchObject({ result: "PARTIAL", points: 7.5 });
  });

  it("NOT_APPLICABLE when every knowledge page is under 300 words", () => {
    const r = one("A3.04", [home(), ko(para(100)), ko(para(120), { url: KO_URL_2, type: "faq" })]);
    expect(r.result).toBe("NOT_APPLICABLE");
    expect(r.maxPoints).toBeNull();
  });

  it("applies to French pages and is NOT_APPLICABLE for Chinese, Japanese, Korean and Thai", () => {
    expect(one("A3.04", [ko(padded(300, list3, 3), { lang: "fr" })]).result).toBe("PASS");
    for (const lang of ["zh", "ja", "ko", "th"]) {
      expect(one("A3.04", [ko(padded(300, list3, 3), { lang })]).result).toBe("NOT_APPLICABLE");
    }
  });

  it("NOT_OBSERVED for a render-dependent page", () => {
    const r = one("A3.04", [sampled(KO_URL, "services", SPA_SHELL)]);
    expect(r.result).toBe("NOT_OBSERVED");
    expect(r.maxPoints).toBe(15);
  });

  it("NOT_APPLICABLE when no knowledge page was sampled", () => {
    expect(one("A3.04", [home()]).result).toBe("NOT_APPLICABLE");
  });
});

// ---------------------------------------------------------------------------
// A3.05 Sentence and paragraph length
// ---------------------------------------------------------------------------

describe("A3.05 sentence and paragraph length", () => {
  it("PASS when the median sentence is 24 words and the median paragraph is within 100", () => {
    const r = one("A3.05", [ko(para(24))]);
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(10);
    expect(pageRecords(r)[0]).toMatchObject({ branch: "both_within_limits", medianSentenceWords: 24, medianParagraphWords: 24 });
  });

  it("sentence boundary: 25 words exceeds the 24-word median", () => {
    const r = one("A3.05", [ko(para(25))]);
    expect(r).toMatchObject({ result: "PARTIAL", points: 5 });
    expect(pageRecords(r)[0].branch).toBe("sentence_limit_exceeded");
  });

  it("paragraph boundary: 100 words is within the limit and 101 exceeds it", () => {
    expect(one("A3.05", [ko(paraOfSentences(5, 20))]).result).toBe("PASS");
    const over = one("A3.05", [ko(`<p>${sentence(20, "a")} ${sentence(20, "b")} ${sentence(20, "c")} ${sentence(20, "d")} ${sentence(21, "e")}</p>`)]);
    expect(over).toMatchObject({ result: "PARTIAL", points: 5 });
    expect(pageRecords(over)[0]).toMatchObject({ branch: "paragraph_limit_exceeded", medianParagraphWords: 101, medianSentenceWords: 20 });
  });

  it("FAIL when both medians exceed their limit", () => {
    const r = one("A3.05", [ko(para(150))]);
    expect(r).toMatchObject({ result: "FAIL", points: 0 });
    expect(pageRecords(r)[0].branch).toBe("both_limits_exceeded");
  });

  it("uses the median, not the mean: one very long paragraph among short ones passes", () => {
    const inner = para(10) + para(12) + para(300);
    const r = one("A3.05", [ko(inner)]);
    expect(pageRecords(r)[0]).toMatchObject({ medianParagraphWords: 12 });
    expect(r.result).toBe("PASS");
  });

  it("splits sentences on full stops, question marks and exclamation marks", () => {
    const inner = `<p>${sentence(30, "a").slice(0, -1)}! ${sentence(30, "b").slice(0, -1)}? ${sentence(30, "c")}</p>`;
    const r = one("A3.05", [ko(inner)]);
    expect(pageRecords(r)[0]).toMatchObject({ sentences: 3, medianSentenceWords: 30 });
  });

  it("is NOT_OBSERVED, not a failure, when the main content has no p element", () => {
    const r = one("A3.05", [ko(`<div>${sentence(200)}</div>`)]);
    expect(r.result).toBe("NOT_OBSERVED");
    expect(r.points).toBeNull();
    expect(pageRecords(r)[0]).toMatchObject({ branch: "no_paragraphs", status: "not_observed" });
  });

  it("NOT_APPLICABLE for non-English or undeclared language", () => {
    for (const lang of ["fr", "ja", null]) {
      expect(one("A3.05", [ko(para(150), { lang })]).result).toBe("NOT_APPLICABLE");
    }
  });

  it("applies to en-IE", () => {
    expect(one("A3.05", [ko(para(20), { lang: "en-IE" })]).result).toBe("PASS");
  });

  it("NOT_OBSERVED for a render-dependent page", () => {
    expect(one("A3.05", [sampled(KO_URL, "services", SPA_SHELL)]).result).toBe("NOT_OBSERVED");
  });

  it("mean across pages (PASS and FAIL give 5 points)", () => {
    const r = one("A3.05", [ko(para(20)), ko(para(150), { url: KO_URL_2, type: "faq" })]);
    expect(r).toMatchObject({ result: "PARTIAL", points: 5 });
  });

  it("NOT_APPLICABLE when no knowledge page was sampled", () => {
    expect(one("A3.05", [home()]).result).toBe("NOT_APPLICABLE");
  });
});

// ---------------------------------------------------------------------------
// A3.06 Entity statement near the top
// ---------------------------------------------------------------------------

describe("A3.06 entity statement near the top", () => {
  const org = (extra: Record<string, unknown> = {}) => ({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Fernhill Joinery",
    ...extra,
  });
  const head = (value: unknown, extraHead = "") => ld(value) + extraHead;
  const intro = (text: string, filler = 60) => `<h1>${text}</h1>${para(filler)}`;

  it("PASS when name, locality and topic all appear in the first 200 words", () => {
    const schema = org({
      address: { "@type": "PostalAddress", addressLocality: "Galway" },
      knowsAbout: ["bespoke kitchens"],
    });
    const r = one("A3.06", [home(intro("Fernhill Joinery builds bespoke kitchens in Galway"), { head: head(schema) })]);
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(15);
    const evidence = r.evidence as Record<string, unknown>;
    expect(evidence.branch).toBe("3_of_3_checks_passed");
    expect(evidence.url).toBe(HOME);
  });

  it("PARTIAL with 2 of 3 passed (10 points) and 1 of 3 (5 points)", () => {
    const schema = org({
      address: { "@type": "PostalAddress", addressLocality: "Galway" },
      knowsAbout: "bespoke kitchens",
    });
    const two = one("A3.06", [home(intro("Fernhill Joinery builds bespoke kitchens"), { head: head(schema) })]);
    expect(two).toMatchObject({ result: "PARTIAL", points: 10 });
    const oneOnly = one("A3.06", [home(intro("Fernhill Joinery makes furniture"), { head: head(schema) })]);
    expect(oneOnly).toMatchObject({ result: "PARTIAL", points: 5 });
  });

  it("FAIL when none of the applicable checks pass", () => {
    const schema = org({ address: { addressLocality: "Galway" }, knowsAbout: "kitchens" });
    const r = one("A3.06", [home(intro("Welcome to our website"), { head: head(schema) })]);
    expect(r).toMatchObject({ result: "FAIL", points: 0 });
  });

  it("the first 200 words are inclusive: a term at word 200 counts and a term at word 201 does not", () => {
    const filler = (n: number) => Array.from({ length: n }, (_, i) => `filler${i}`).join(" ");
    const schema = org({ address: { addressLocality: "Galway" } });
    const locality = (r: MetricResult) => (r.evidence as Record<string, unknown>).locality as Record<string, unknown>;
    const at200 = one("A3.06", [home(`<p>Fernhill ${filler(198)} Galway</p><p>${sentence(30)}</p>`, { head: head(schema) })]);
    expect(locality(at200).passed).toBe(true);
    const at201 = one("A3.06", [home(`<p>Fernhill ${filler(199)} Galway</p><p>${sentence(30)}</p>`, { head: head(schema) })]);
    expect(locality(at201).passed).toBe(false);
  });

  it("a check applies only if its reference data exists: name only gives 1 of 1", () => {
    const pass = one("A3.06", [home(intro("Fernhill Joinery"), { head: head(org()) })]);
    expect(pass.result).toBe("PASS");
    expect((pass.evidence as Record<string, unknown>).branch).toBe("1_of_1_checks_passed");
    const fail = one("A3.06", [home(intro("Welcome"), { head: head(org()) })]);
    expect(fail.result).toBe("FAIL");
  });

  it("NOT_APPLICABLE when there is no JSON-LD, or the JSON-LD has no name, place or topic", () => {
    expect(one("A3.06", [home(intro("Fernhill Joinery"))]).result).toBe("NOT_APPLICABLE");
    const bare = { "@context": "https://schema.org", "@type": "WebSite", url: "https://example.ie/" };
    const r = one("A3.06", [home(intro("Fernhill Joinery"), { head: head(bare) })]);
    expect(r.result).toBe("NOT_APPLICABLE");
    expect(r.maxPoints).toBeNull();
    expect((r.evidence as Record<string, unknown>).branch).toBe("no_reference_data");
  });

  it("ignores an invalid JSON-LD block", () => {
    const broken = `<script type="application/ld+json">{ not json </script>`;
    expect(one("A3.06", [home(intro("Fernhill Joinery"), { head: broken })]).result).toBe("NOT_APPLICABLE");
  });

  it("uses og:site_name only when an organisation node exists without a name", () => {
    const og = `<meta property="og:site_name" content="Fernhill Joinery">`;
    const noName = { "@context": "https://schema.org", "@type": "Organization", url: "https://example.ie/" };
    const withFallback = one("A3.06", [home(intro("Fernhill Joinery"), { head: head(noName, og) })]);
    expect(withFallback.result).toBe("PASS");
    expect(((withFallback.evidence as Record<string, unknown>).name as Record<string, unknown>).source).toBe("og:site_name");
    // no JSON-LD at all: the og:site_name alone is not reference data in the JSON-LD
    expect(one("A3.06", [home(intro("Fernhill Joinery"), { head: og })]).result).toBe("NOT_APPLICABLE");
    // the JSON-LD name wins over og:site_name
    const named = one("A3.06", [home(intro("Fernhill Joinery"), { head: head(org({ name: "Other Name" }), og) })]);
    expect(named.result).toBe("FAIL");
  });

  it("reads the locality from areaServed as a string, a place object and a list", () => {
    for (const area of ["Galway", { "@type": "City", name: "Galway" }, ["Mayo", { "@type": "AdministrativeArea", name: "Galway" }]]) {
      const r = one("A3.06", [home(intro("Fernhill Joinery in Galway"), { head: head(org({ areaServed: area })) })]);
      expect((r.evidence as Record<string, unknown>).branch).toBe("2_of_2_checks_passed");
    }
  });

  it("reads the locality from addressRegion and from an address given as a string", () => {
    const region = one("A3.06", [home(intro("Fernhill Joinery in Connacht"), { head: head(org({ address: { addressRegion: "Connacht" } })) })]);
    expect(region.result).toBe("PASS");
    const text = one("A3.06", [home(intro("Fernhill Joinery in Kilcock"), { head: head(org({ address: "Main Street, Kilcock" })) })]);
    expect(text.result).toBe("PASS");
  });

  it("does not use the street address or postcode as a locality", () => {
    const r = one("A3.06", [home(intro("Fernhill Joinery 12 Main Street"), { head: head(org({ address: { streetAddress: "12 Main Street", postalCode: "A91" } })) })]);
    expect((r.evidence as Record<string, unknown>).branch).toBe("1_of_1_checks_passed");
  });

  it("reads serviceType and knowsAbout, strings or named objects", () => {
    const service = one("A3.06", [home(intro("Fernhill Joinery fitted wardrobes"), { head: head(org({ serviceType: "fitted wardrobes" })) })]);
    expect(service.result).toBe("PASS");
    const thing = one("A3.06", [home(intro("Fernhill Joinery and AI training"), { head: head(org({ knowsAbout: [{ "@type": "Thing", name: "AI training" }] })) })]);
    expect(thing.result).toBe("PASS");
  });

  it("matches case-insensitively and after text normalisation", () => {
    const r = one("A3.06", [home(intro("FERNHILL   JOINERY"), { head: head(org()) })]);
    expect(r.result).toBe("PASS");
  });

  it("accepts a Person node for a sole trader as the business name", () => {
    const person = { "@context": "https://schema.org", "@type": "Person", name: "Jane Doe" };
    expect(one("A3.06", [home(intro("Jane Doe, plumber"), { head: head(person) })]).result).toBe("PASS");
  });

  it("prefers the shallowest organisation node, then the first in document order", () => {
    const website = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Site",
      publisher: { "@type": "Organization", name: "Nested Publisher" },
    };
    // The nested publisher comes first in the document but sits deeper than the top-level organisation.
    const deeper = one("A3.06", [home(intro("Fernhill Joinery"), { head: head([website, org()]) })]);
    expect(deeper.result).toBe("PASS");
    expect(((deeper.evidence as Record<string, unknown>).name as Record<string, unknown>).matched).toBe("Fernhill Joinery");

    // Two organisations at the same depth: the first one wins.
    const second = { "@context": "https://schema.org", "@type": "Organization", name: "Second" };
    const firstWins = one("A3.06", [home(intro("Fernhill Joinery"), { head: head([org(), second]) })]);
    expect(firstWins.result).toBe("PASS");
    const secondText = one("A3.06", [home(intro("Second"), { head: head([org(), second]) })]);
    expect(secondText.result).toBe("FAIL");
  });

  it("is NOT_APPLICABLE for Chinese, Japanese, Korean and Thai homepages, even with markers", () => {
    for (const lang of ["zh", "ja", "ko", "th"]) {
      expect(one("A3.06", [home(intro("Fernhill Joinery"), { head: head(org()), lang })]).result).toBe("NOT_APPLICABLE");
    }
    const jaShell = sampled(HOME, "home", doc({ lang: "ja", head: head(org()), body: `<div id="root"></div>` }));
    expect(one("A3.06", [jaShell]).result).toBe("NOT_APPLICABLE");
  });

  it("applies to a French homepage", () => {
    expect(one("A3.06", [home(intro("Fernhill Joinery"), { head: head(org()), lang: "fr" })]).result).toBe("PASS");
  });

  it("is NOT_OBSERVED for a render-dependent homepage, including when it carries JSON-LD", () => {
    const shell = sampled(HOME, "home", doc({ head: head(org()), body: `<div id="root"></div><noscript>Please enable JavaScript.</noscript>` }));
    const r = one("A3.06", [shell]);
    expect(r.result).toBe("NOT_OBSERVED");
    expect(r.maxPoints).toBe(15);
    expect((r.evidence as Record<string, unknown>).branch).toBe("render_dependent");
  });

  it("is NOT_OBSERVED when the homepage is missing, SCAN_ERROR when it failed to load", () => {
    expect(one("A3.06", [ko(para(60))]).result).toBe("NOT_OBSERVED");
    expect(one("A3.06", [sampled(HOME, "home", null, { status: 503 })]).result).toBe("SCAN_ERROR");
    expect(one("A3.06", [sampled(HOME, "home", null, { status: null, error: failure("TIMEOUT") })]).result).toBe("SCAN_ERROR");
  });

  it("keeps long and hostile terms short in evidence", () => {
    const bidi = String.fromCodePoint(0x202e);
    const schema = org({ name: `${"N".repeat(400)}${bidi}`, knowsAbout: ["k".repeat(300)] });
    const r = one("A3.06", [home(intro("Welcome"), { head: head(schema) })]);
    expectCleanEvidence(r);
  });
});

// ---------------------------------------------------------------------------
// Evidence hygiene across scenarios
// ---------------------------------------------------------------------------

describe("A3 evidence hygiene", () => {
  it("every result in a spread of scenarios carries plain, short, escaped evidence and a one-line explanation", () => {
    const bidi = String.fromCodePoint(0x202e);
    const zwsp = String.fromCodePoint(0x200b);
    const hostileHeading = `Why ${"h".repeat(400)}${bidi}${zwsp}?`;
    const hostileSections = [hostileHeading, "Topic one", "Topic two"].map((h) => section(h, 20)).join("");
    const schema = ld({
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: `${"N".repeat(300)}${bidi}`,
      knowsAbout: [`${"k".repeat(300)}`],
      areaServed: `${"a".repeat(300)}`,
    });
    const scenarios: SampledPage[][] = [
      [],
      [home(), ko(hostileSections)],
      [sampled(HOME, "home", SPA_SHELL), sampled(KO_URL, "services", SPA_SHELL)],
      [sampled(HOME, "home", null, { status: 503 }), sampled(KO_URL, "services", null, { status: null, error: failure("TIMEOUT") })],
      [home(para(80), { head: schema }), ko(hostileSections + `<details><summary>${hostileHeading}</summary><p>${"x ".repeat(300)}</p></details>`)],
      [home(para(80), { lang: "ja" }), ko(hostileSections, { lang: "ja" })],
    ];
    for (const pages of scenarios) {
      for (const result of evaluateA3(ctxOf(pages))) {
        expectCleanEvidence(result);
        expect(result.explanation.trim().length).toBeGreaterThan(0);
        expect(result.explanation).not.toMatch(/[\r\n]/);
      }
    }
  });
});
