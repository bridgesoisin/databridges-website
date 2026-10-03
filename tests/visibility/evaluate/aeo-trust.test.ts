import { describe, expect, it, vi } from "vitest";
import { buildEvalContext } from "@/lib/visibility/context";
import { evaluateA4 } from "@/lib/visibility/evaluate/aeo-trust";
import { METHODOLOGY } from "@/lib/visibility/methodology";
import { CANDIDATE_EXCLUSIONS, PAGE_TYPES } from "@/lib/visibility/types";
import type {
  EvalContext,
  FetchErrorCode,
  FetchRecord,
  LinkCheckPurpose,
  LinkCheckResult,
  MetricResult,
  PageType,
  SampledPage,
  ScanSnapshot,
  SitemapRecord,
} from "@/lib/visibility/types";

const SCANNED_AT = "2026-10-02T09:15:00.000Z";
const NOW = new Date(SCANNED_AT);
const HOME = "https://example.ie/";
const DAY_MS = 86_400_000;

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

function ctxOf(pages: SampledPage[], over: Partial<ScanSnapshot> = {}, now: Date = NOW): EvalContext {
  return buildEvalContext(snapshot(pages, over), now);
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

function sentence(n: number, prefix = "word"): string {
  const tokens = Array.from({ length: n }, (_, i) => `${prefix}${i}`);
  return `${tokens.join(" ")}.`;
}

function para(n: number): string {
  return `<p>${sentence(n)}</p>`;
}

function mainPage(url: string, type: PageType, inner: string, opts: { lang?: string | null; head?: string } = {}): SampledPage {
  return sampled(url, type, doc({ lang: opts.lang, head: opts.head, body: `<main>${inner}</main>` }));
}

type HomeParts = { nav?: string; main?: string; footer?: string; head?: string; lang?: string | null };

function homePage(parts: HomeParts = {}): SampledPage {
  const body =
    (parts.nav === undefined ? "" : `<nav>${parts.nav}</nav>`) +
    `<main>${parts.main ?? `<h1>Welcome</h1>${para(60)}`}</main>` +
    (parts.footer === undefined ? "" : `<footer>${parts.footer}</footer>`);
  return sampled(HOME, "home", doc({ lang: parts.lang, head: parts.head, body }));
}

function link(href: string, text = "link"): string {
  return `<a href="${href}">${text}</a>`;
}

function run(pages: SampledPage[], over: Partial<ScanSnapshot> = {}, now: Date = NOW): Record<string, MetricResult> {
  const results = evaluateA4(ctxOf(pages, over, now));
  return Object.fromEntries(results.map((r) => [r.metricId, r]));
}

function one(id: string, pages: SampledPage[], over: Partial<ScanSnapshot> = {}, now: Date = NOW): MetricResult {
  return run(pages, over, now)[id];
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

function evidenceOf(result: MetricResult): Record<string, unknown> {
  return result.evidence as Record<string, unknown>;
}

function linkCheck(url: string, status: number | null, purposes: LinkCheckPurpose[] = ["A4.01"]): LinkCheckResult {
  return {
    url,
    sourceUrls: [HOME],
    purposes,
    method: "HEAD",
    status,
    errorCode: status === null ? "TIMEOUT" : null,
    outcome: status === null ? "unobserved" : status < 400 ? "ok" : "broken",
    retried: false,
  };
}

function urlset(locs: readonly string[], lastmods: readonly (string | null)[] = []): string {
  const items = locs.map((loc, i) => {
    const lastmod = lastmods[i] ?? null;
    return `<url><loc>${loc}</loc>${lastmod === null ? "" : `<lastmod>${lastmod}</lastmod>`}</url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items.join("")}</urlset>`;
}

function sitemapIndexXml(locs: readonly string[], lastmod: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locs
    .map((loc) => `<sitemap><loc>${loc}</loc><lastmod>${lastmod}</lastmod></sitemap>`)
    .join("")}</sitemapindex>`;
}

function sitemaps(body: string, url = "https://example.ie/sitemap.xml"): SitemapRecord[] {
  return [
    {
      url,
      role: "default",
      parentUrl: null,
      record: record(url, { kind: "sitemap", body, contentType: "application/xml" }),
    },
  ];
}

const ARTICLE_URL = "https://example.ie/blog/post";
const ARTICLE_URL_2 = "https://example.ie/blog/second";
const KO_URL = "https://example.ie/services";
const KO_URL_2 = "https://example.ie/faq";

function article(inner: string, opts: { url?: string; head?: string; lang?: string | null } = {}): SampledPage {
  return mainPage(opts.url ?? ARTICLE_URL, "article", `<h1>Title</h1>${inner}`, { head: opts.head, lang: opts.lang });
}

// ---------------------------------------------------------------------------
// Category contract
// ---------------------------------------------------------------------------

describe("evaluateA4: result contract", () => {
  it("returns one result per A4 metric, in id order", () => {
    const results = evaluateA4(ctxOf([homePage(), article(para(60))]));
    const category = METHODOLOGY.categories.find((c) => c.id === "A4");
    expect(results.map((r) => r.metricId)).toEqual(category?.metricIds);
    expect(results.map((r) => r.metricId)).toEqual(["A4.01", "A4.02", "A4.03", "A4.04", "A4.05", "A4.06", "A4.07"]);
    const max = [15, 15, 15, 10, 20, 10, 15];
    results.forEach((result, i) => {
      expect(result.metricVersion).toBe(1);
      expect(result.reviewedBy).toBeNull();
      expect(result.explanation).not.toBe("");
      expect(result.maxPoints).toBe(result.result === "NOT_APPLICABLE" ? null : max[i]);
    });
  });

  it("returns seven results even when nothing was sampled", () => {
    const results = evaluateA4(ctxOf([]));
    expect(results).toHaveLength(7);
    expect(results.map((r) => r.result)).toEqual([
      "NOT_OBSERVED",
      "NOT_OBSERVED",
      "NOT_APPLICABLE",
      "NOT_APPLICABLE",
      "NOT_OBSERVED",
      "NOT_OBSERVED",
      "NOT_APPLICABLE",
    ]);
  });

  it("does not mutate the snapshot it reads", () => {
    const snap = snapshot([homePage({ nav: link("/about") }), article(para(60))]);
    const before = JSON.stringify(snap);
    evaluateA4(buildEvalContext(snap, NOW));
    expect(JSON.stringify(snap)).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// A4.01 About page discoverable
// ---------------------------------------------------------------------------

describe("A4.01 about page discoverable", () => {
  const aboutPage = (url = "https://example.ie/about", over: Partial<FetchRecord> = {}) =>
    sampled(url, "about", doc({ body: `<main>${para(60)}</main>` }), over);

  it("PASS when the homepage links to a sampled About page that returns 200", () => {
    const r = one("A4.01", [homePage({ nav: link("/about", "About") }), aboutPage()]);
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(15);
    expect(evidenceOf(r)).toMatchObject({ branch: "homepage_links_to_working_about", url: HOME });
    expect(r.explanation).toContain("https://example.ie/about");
  });

  it("PASS when the About page was not sampled but a link check returned 2xx", () => {
    const r = one("A4.01", [homePage({ footer: link("/about-us") })], { linkChecks: [linkCheck("https://example.ie/about-us", 200)] });
    expect(r.result).toBe("PASS");
    expect((evidenceOf(r).aboutLinks as Record<string, unknown>[])[0]).toMatchObject({ source: "link_check", status: 200 });
  });

  it("accepts any link check for the URL, whatever its purpose", () => {
    const r = one("A4.01", [homePage({ nav: link("/about") })], { linkChecks: [linkCheck("https://example.ie/about", 204, ["S3.06"])] });
    expect(r.result).toBe("PASS");
  });

  it("matches the About path patterns and nothing else", () => {
    for (const href of ["/about", "/about-us", "/who-we-are", "/our-story", "/team", "/company", "/about/team", "/About-Us", "https://www.example.ie/about"]) {
      const url = new URL(href, HOME).href;
      const r = one("A4.01", [homePage({ nav: link(href) })], { linkChecks: [linkCheck(url.replace(/\/$/, ""), 200)] });
      expect(r.result, href).toBe("PASS");
    }
    for (const href of ["/aboutus", "/abouts", "/teams", "/contact", "/blog/about", "https://other.ie/about", "#about", "/services?page=about"]) {
      const r = one("A4.01", [homePage({ nav: link(href) })], { linkChecks: [linkCheck(new URL(href, HOME).href, 200)] });
      expect(r.result, href).toBe("FAIL");
    }
  });

  it("a link inside the main content counts as well as navigation and footer links", () => {
    const r = one("A4.01", [homePage({ main: `<h1>Hi</h1>${para(60)}<p>${link("/about", "Read about us")}</p>` }), aboutPage()]);
    expect(r.result).toBe("PASS");
  });

  it("matches a sampled page by its final URL after a redirect", () => {
    const redirected = sampled("https://example.ie/about", "about", doc({ body: `<main>${para(60)}</main>` }), {
      finalUrl: "https://example.ie/about-us",
    });
    const r = one("A4.01", [homePage({ nav: link("/about-us") }), redirected]);
    expect(r.result).toBe("PASS");
  });

  it("PASS if any one of several About links works", () => {
    const r = one("A4.01", [homePage({ nav: link("/about") + link("/team") })], {
      linkChecks: [linkCheck("https://example.ie/about", 404), linkCheck("https://example.ie/team", 200)],
    });
    expect(r.result).toBe("PASS");
  });

  it("PARTIAL (0.5) when an About URL is only in the sitemap", () => {
    const r = one("A4.01", [homePage({ nav: link("/services") })], {
      sitemaps: sitemaps(urlset(["https://example.ie/", "https://example.ie/about-us"])),
    });
    expect(r).toMatchObject({ result: "PARTIAL", points: 7.5 });
    expect(evidenceOf(r).branch).toBe("about_url_only_in_sitemap_or_sample");
    expect(evidenceOf(r).sitemapMatches).toEqual(["https://example.ie/about-us"]);
  });

  it("PARTIAL (0.5) when an About URL is only a sampled page that returns 200", () => {
    const r = one("A4.01", [homePage({ nav: link("/services") }), aboutPage()]);
    expect(r).toMatchObject({ result: "PARTIAL", points: 7.5 });
    expect(evidenceOf(r).sampledMatches).toEqual(["https://example.ie/about"]);
  });

  it("an About page that is sampled but returns 404 and is not linked does not earn the half mark", () => {
    const r = one("A4.01", [homePage({ nav: link("/services") }), aboutPage("https://example.ie/about", { status: 404 })]);
    expect(r.result).toBe("FAIL");
  });

  it("an About link that returns 404 is a FAIL even if the same URL is in the sitemap", () => {
    const r = one("A4.01", [homePage({ nav: link("/about") })], {
      linkChecks: [linkCheck("https://example.ie/about", 404)],
      sitemaps: sitemaps(urlset(["https://example.ie/about"])),
    });
    expect(r.result).toBe("FAIL");
    expect(evidenceOf(r).branch).toBe("about_link_failed");
  });

  it("a broken About link still earns the half mark when a different About URL is in the sitemap", () => {
    const r = one("A4.01", [homePage({ nav: link("/about") })], {
      linkChecks: [linkCheck("https://example.ie/about", 410)],
      sitemaps: sitemaps(urlset(["https://example.ie/our-story"])),
    });
    expect(r.result).toBe("PARTIAL");
  });

  it("FAIL when there is no About link, sitemap URL or sampled About page", () => {
    const r = one("A4.01", [homePage({ nav: link("/services") }), mainPage(KO_URL, "services", para(60))]);
    expect(r).toMatchObject({ result: "FAIL", points: 0 });
    expect(evidenceOf(r).branch).toBe("no_about_url");
  });

  it("treats 5xx as a failure but 401, 403, 429 and missing statuses as unobserved", () => {
    const home = homePage({ nav: link("/about") });
    expect(one("A4.01", [home], { linkChecks: [linkCheck("https://example.ie/about", 500)] }).result).toBe("FAIL");
    for (const status of [401, 403, 429, null, 301]) {
      const r = one("A4.01", [home], { linkChecks: [linkCheck("https://example.ie/about", status)] });
      expect(r.result, String(status)).toBe("NOT_OBSERVED");
      expect(r.points).toBeNull();
      expect(r.maxPoints).toBe(15);
    }
  });

  it("is NOT_OBSERVED when the About link was never checked (status unknown)", () => {
    const r = one("A4.01", [homePage({ nav: link("/about") })]);
    expect(r.result).toBe("NOT_OBSERVED");
    expect(evidenceOf(r).branch).toBe("about_link_unverified");
  });

  it("is NOT_OBSERVED when one About link failed and another could not be checked", () => {
    const r = one("A4.01", [homePage({ nav: link("/about") + link("/team") })], { linkChecks: [linkCheck("https://example.ie/about", 404)] });
    expect(r.result).toBe("NOT_OBSERVED");
  });

  it("a sampled About page that errored at the network level is unobserved, not failed", () => {
    const failed = sampled("https://example.ie/about", "about", null, { status: null, error: failure("TIMEOUT") });
    expect(one("A4.01", [homePage({ nav: link("/about") }), failed]).result).toBe("NOT_OBSERVED");
  });

  it("is NOT_OBSERVED for a render-dependent homepage", () => {
    const r = one("A4.01", [sampled(HOME, "home", SPA_SHELL)]);
    expect(r.result).toBe("NOT_OBSERVED");
    expect(evidenceOf(r).branch).toBe("render_dependent");
  });

  it("is NOT_OBSERVED when there is no homepage, and SCAN_ERROR when it failed to load", () => {
    expect(one("A4.01", [aboutPage()]).result).toBe("NOT_OBSERVED");
    expect(one("A4.01", [sampled(HOME, "home", null, { status: 500 })]).result).toBe("SCAN_ERROR");
  });

  it("ignores fragment-only links and links to other sites", () => {
    const r = one("A4.01", [homePage({ nav: link("#about") + link("https://other.ie/about") })]);
    expect(r.result).toBe("FAIL");
  });

  it("stays fast and bounded on a homepage with thousands of About-pattern links", () => {
    const links = Array.from({ length: 5000 }, (_, i) => link(`/about?x=${i}`)).join("");
    const started = Date.now();
    const r = one("A4.01", [homePage({ main: `<h1>Hi</h1>${para(60)}<p>${links}</p>` })]);
    expect(Date.now() - started).toBeLessThan(5000);
    expect(r.result).toBe("NOT_OBSERVED");
    expect(evidenceOf(r).aboutLinks as unknown[]).toHaveLength(5);
    expectCleanEvidence(r);
  });
});

// ---------------------------------------------------------------------------
// A4.02 Contact information visible
// ---------------------------------------------------------------------------

describe("A4.02 contact information visible", () => {
  const withMain = (main: string, extra: HomeParts = {}) => homePage({ main: `<h1>Hi</h1>${para(60)}${main}`, ...extra });

  it("FAIL with no signals", () => {
    const r = one("A4.02", [withMain("")]);
    expect(r).toMatchObject({ result: "FAIL", points: 0 });
    expect(evidenceOf(r).branch).toBe("0_signals");
  });

  it("one signal gives PARTIAL 0.5 for each kind of signal", () => {
    const cases: [string, HomeParts][] = [
      ["mailto link", { main: `<h1>Hi</h1>${para(60)}<p>${link("mailto:hello@example.ie", "Write to us")}</p>` }],
      ["email in text", { main: `<h1>Hi</h1>${para(60)}<p>Email hello@example.ie today</p>` }],
      ["tel link", { main: `<h1>Hi</h1>${para(60)}<p>${link("tel:+35312345678", "Call us")}</p>` }],
      ["address element", { main: `<h1>Hi</h1>${para(60)}<address>12 Main Street, Kilcock</address>` }],
      ["contact link", { nav: link("/contact", "Contact") }],
    ];
    for (const [label, parts] of cases) {
      const r = one("A4.02", [homePage(parts)]);
      expect(r, label).toMatchObject({ result: "PARTIAL", points: 7.5 });
      expect(evidenceOf(r).branch).toBe("1_signals");
    }
  });

  it("two signals give 0.75, three give 1, four stay at 1", () => {
    const two = one("A4.02", [withMain(`<p>${link("tel:+35312345678", "Call")}</p><address>12 Main Street, Kilcock</address>`)]);
    expect(two).toMatchObject({ result: "PARTIAL", points: 11.25 });
    const three = one("A4.02", [withMain(`<p>${link("tel:+35312345678", "Call")} hello@example.ie</p><address>12 Main Street, Kilcock</address>`)]);
    expect(three).toMatchObject({ result: "PASS", points: 15 });
    const four = one("A4.02", [withMain(`<p>${link("tel:+35312345678", "Call")} hello@example.ie</p><address>12 Main Street, Kilcock</address>`, { nav: link("/contact-us") })]);
    expect(four).toMatchObject({ result: "PASS", points: 15 });
    expect(evidenceOf(four).branch).toBe("4_signals");
  });

  it("a mailto link and email text together are one signal, not two", () => {
    const r = one("A4.02", [withMain(`<p>${link("mailto:hello@example.ie", "hello@example.ie")}</p>`)]);
    expect(r.points).toBe(7.5);
  });

  it("an email address in the footer counts", () => {
    const r = one("A4.02", [homePage({ footer: "<p>Write to hello@example.ie</p>" })]);
    expect(r.points).toBe(7.5);
  });

  it("address element boundary: 9 characters do not count, 10 do", () => {
    expect(one("A4.02", [withMain("<address>123456789</address>")]).result).toBe("FAIL");
    expect(one("A4.02", [withMain("<address>1234567890</address>")]).points).toBe(7.5);
  });

  it("reads a JSON-LD telephone, including one nested in a contactPoint", () => {
    const flat = { "@context": "https://schema.org", "@type": "LocalBusiness", name: "X", telephone: "+353 1 234 5678" };
    expect(one("A4.02", [homePage({ head: ld(flat) })]).points).toBe(7.5);
    const nested = { "@context": "https://schema.org", "@type": "Organization", name: "X", contactPoint: { "@type": "ContactPoint", telephone: "+353 1 234 5678" } };
    const r = one("A4.02", [homePage({ head: ld(nested) })]);
    expect(r.points).toBe(7.5);
    expect((evidenceOf(r).phone as Record<string, unknown>).jsonLdTelephone).toBe(true);
  });

  it("reads a JSON-LD address, but not an empty one", () => {
    const filled = { "@context": "https://schema.org", "@type": "LocalBusiness", name: "X", address: { "@type": "PostalAddress", addressLocality: "Galway" } };
    expect(one("A4.02", [homePage({ head: ld(filled) })]).points).toBe(7.5);
    const empty = { "@context": "https://schema.org", "@type": "LocalBusiness", name: "X", address: { "@type": "PostalAddress" } };
    expect(one("A4.02", [homePage({ head: ld(empty) })]).result).toBe("FAIL");
    const blank = { "@context": "https://schema.org", "@type": "LocalBusiness", name: "X", telephone: "  " };
    expect(one("A4.02", [homePage({ head: ld(blank) })]).result).toBe("FAIL");
  });

  it("JSON-LD telephone and a tel link are one phone signal", () => {
    const flat = { "@context": "https://schema.org", "@type": "LocalBusiness", name: "X", telephone: "+353 1 234 5678" };
    const r = one("A4.02", [withMain(`<p>${link("tel:+35312345678", "Call")}</p>`, { head: ld(flat) })]);
    expect(r.points).toBe(7.5);
  });

  it("matches the contact path patterns only, on this site", () => {
    for (const href of ["/contact", "/contact-us", "/get-in-touch", "/enquiries", "/enquire", "/Contact"]) {
      expect(one("A4.02", [homePage({ nav: link(href) })]).points, href).toBe(7.5);
    }
    for (const href of ["/contacts", "/contactless", "https://other.ie/contact", "#contact", "/blog/contact"]) {
      expect(one("A4.02", [homePage({ nav: link(href) })]).result, href).toBe("FAIL");
    }
  });

  it("is NOT_OBSERVED for a render-dependent homepage", () => {
    const r = one("A4.02", [sampled(HOME, "home", SPA_SHELL)]);
    expect(r.result).toBe("NOT_OBSERVED");
    expect(r.maxPoints).toBe(15);
  });

  it("is NOT_OBSERVED without a homepage and SCAN_ERROR when it failed", () => {
    expect(one("A4.02", [mainPage(KO_URL, "services", para(60))]).result).toBe("NOT_OBSERVED");
    expect(one("A4.02", [sampled(HOME, "home", null, { status: 502 })]).result).toBe("SCAN_ERROR");
  });
});

// ---------------------------------------------------------------------------
// A4.03 Author attribution
// ---------------------------------------------------------------------------

describe("A4.03 author attribution", () => {
  const person = (name: unknown) => ({ "@type": "Person", name });
  const articleLd = (author: unknown) => ({ "@context": "https://schema.org", "@type": "Article", headline: "H", author });

  it("NOT_APPLICABLE when no article page was sampled", () => {
    const r = one("A4.03", [homePage(), mainPage(KO_URL, "services", para(60))]);
    expect(r.result).toBe("NOT_APPLICABLE");
    expect(r.points).toBeNull();
    expect(r.maxPoints).toBeNull();
    expect(evidenceOf(r).branch).toBe("no_pages_in_scope");
  });

  it("PASS for each visible byline signal", () => {
    const cases: [string, string, string][] = [
      ["rel=author", `<p>${para(30)}</p><a rel="author" href="/team/jane">Jane Doe</a>`, "rel=author"],
      ["itemprop", `<span itemprop="author">Jane Doe</span>${para(30)}`, "itemprop=author"],
      ["byline class", `<p class="byline">Jane Doe</p>${para(30)}`, "byline or author class"],
      ["author class", `<p class="post-author">Jane Doe</p>${para(30)}`, "byline or author class"],
      ["By text", `<p>By Jane Doe</p>${para(30)}`, "By in the first 400 characters"],
      ["lower-case by", `<p>Written by Jane Doe</p>${para(30)}`, "By in the first 400 characters"],
    ];
    for (const [label, inner, signal] of cases) {
      const r = one("A4.03", [article(inner)]);
      expect(r, label).toMatchObject({ result: "PASS", points: 15 });
      expect(pageRecords(r)[0]).toMatchObject({ branch: "visible_byline" });
      expect(pageRecords(r)[0].visibleSignals).toContain(signal);
    }
  });

  it("'By ' counts only within the first 400 characters of the main content", () => {
    const late = article(`${para(120)}<p>By Jane Doe</p>`);
    expect(one("A4.03", [late]).result).toBe("FAIL");
    const early = article(`<p>By Jane Doe</p>${para(120)}`);
    expect(one("A4.03", [early]).result).toBe("PASS");
  });

  it("does not take words that merely contain 'by' for a byline", () => {
    for (const text of ["Standby mode is available", "Nearby shops are open", "Goodbye for now"]) {
      expect(one("A4.03", [article(`<p>${text} ${sentence(20)}</p>`)]).result, text).toBe("FAIL");
    }
  });

  it("a class that only contains the letters 'author' is not a byline class", () => {
    const r = one("A4.03", [article(`<p class="authority">Trusted ${sentence(20)}</p>`)]);
    expect(r.result).toBe("FAIL");
  });

  it("PASS from a JSON-LD author name when there is no visible byline", () => {
    const r = one("A4.03", [article(para(40), { head: ld(articleLd(person("Jane Doe"))) })]);
    expect(r.result).toBe("PASS");
    expect(pageRecords(r)[0]).toMatchObject({ branch: "json_ld_author_name", jsonLdAuthor: "Jane Doe" });
  });

  it("reads a JSON-LD author given as a list, as a plain string, and by @id reference", () => {
    const list = one("A4.03", [article(para(40), { head: ld(articleLd([person("Jane Doe"), person("Sam Lee")])) })]);
    expect(list.result).toBe("PASS");
    const text = one("A4.03", [article(para(40), { head: ld(articleLd("Jane Doe")) })]);
    expect(text.result).toBe("PASS");
    const graph = {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "Article", headline: "H", author: { "@id": "https://example.ie/#jane" } },
        { "@type": "Person", "@id": "https://example.ie/#jane", name: "Jane Doe" },
      ],
    };
    const ref = one("A4.03", [article(para(40), { head: ld(graph) })]);
    expect(ref.result).toBe("PASS");
  });

  it("FAIL when the JSON-LD author has no name or the @id reference does not resolve", () => {
    expect(one("A4.03", [article(para(40), { head: ld(articleLd(person(""))) })]).result).toBe("FAIL");
    expect(one("A4.03", [article(para(40), { head: ld(articleLd({ "@type": "Person" })) })]).result).toBe("FAIL");
    expect(one("A4.03", [article(para(40), { head: ld(articleLd({ "@id": "https://example.ie/#nobody" })) })]).result).toBe("FAIL");
    const invalid = `<script type="application/ld+json">{ "author": </script>`;
    expect(one("A4.03", [article(para(40), { head: invalid })]).result).toBe("FAIL");
  });

  it("FAIL when there is no byline and no JSON-LD author", () => {
    const r = one("A4.03", [article(para(60))]);
    expect(r).toMatchObject({ result: "FAIL", points: 0 });
    expect(pageRecords(r)[0].branch).toBe("no_author_signal");
  });

  it("mean across article pages (one with a byline, one without)", () => {
    const r = one("A4.03", [article(`<p>By Jane</p>${para(30)}`), article(para(60), { url: ARTICLE_URL_2 })]);
    expect(r).toMatchObject({ result: "PARTIAL", points: 7.5 });
  });

  it("only article pages count: a byline on a services page is irrelevant", () => {
    const r = one("A4.03", [mainPage(KO_URL, "services", `<p>By Jane</p>${para(30)}`), article(para(60))]);
    expect(r.result).toBe("FAIL");
    expect(pageRecords(r)).toHaveLength(1);
  });

  it("is NOT_OBSERVED for a render-dependent article, SCAN_ERROR for one that failed to load", () => {
    expect(one("A4.03", [sampled(ARTICLE_URL, "article", SPA_SHELL)]).result).toBe("NOT_OBSERVED");
    expect(one("A4.03", [sampled(ARTICLE_URL, "article", null, { status: 500 })]).result).toBe("SCAN_ERROR");
  });

  it("scores from the readable article when half of the articles could be read", () => {
    const r = one("A4.03", [sampled(ARTICLE_URL_2, "article", SPA_SHELL), article(`<p>By Jane</p>${para(30)}`)]);
    expect(r.result).toBe("PASS");
  });

  it("keeps the byline sample short and clean", () => {
    const bidi = String.fromCodePoint(0x202e);
    const r = one("A4.03", [article(`<p class="byline">${"J".repeat(500)}${bidi}</p>${para(30)}`)]);
    expectCleanEvidence(r);
    expect(r.result).toBe("PASS");
  });
});

// ---------------------------------------------------------------------------
// A4.04 Dates on articles
// ---------------------------------------------------------------------------

describe("A4.04 dates on articles", () => {
  const articleLd = (extra: Record<string, unknown>) => ({ "@context": "https://schema.org", "@type": "Article", headline: "H", ...extra });
  const withLd = (extra: Record<string, unknown>, inner = para(40)) => article(inner, { head: ld(articleLd(extra)) });

  it("NOT_APPLICABLE when no article page was sampled", () => {
    expect(one("A4.04", [homePage()]).result).toBe("NOT_APPLICABLE");
  });

  it("PASS with a published and a modified date in the JSON-LD", () => {
    const r = one("A4.04", [withLd({ datePublished: "2026-05-01", dateModified: "2026-06-01T10:00:00Z" })]);
    expect(r).toMatchObject({ result: "PASS", points: 10 });
    expect(pageRecords(r)[0]).toMatchObject({ branch: "published_and_modified" });
  });

  it("PARTIAL (5 points) with only a published date, and with only a modified date", () => {
    const published = one("A4.04", [withLd({ datePublished: "2026-05-01" })]);
    expect(published).toMatchObject({ result: "PARTIAL", points: 5 });
    expect(pageRecords(published)[0].branch).toBe("published_only");
    const modified = one("A4.04", [withLd({ dateModified: "2026-05-01" })]);
    expect(modified).toMatchObject({ result: "PARTIAL", points: 5 });
    expect(pageRecords(modified)[0].branch).toBe("modified_only");
  });

  it("FAIL with no dates", () => {
    const r = one("A4.04", [withLd({})]);
    expect(r).toMatchObject({ result: "FAIL", points: 0 });
    expect(pageRecords(r)[0].branch).toBe("no_dates");
  });

  it("a time element in the byline or the header counts as the published date", () => {
    const inByline = one("A4.04", [article(`<p class="byline">By Jane <time datetime="2026-05-01">1 May</time></p>${para(30)}`)]);
    expect(inByline).toMatchObject({ result: "PARTIAL", points: 5 });
    expect((pageRecords(inByline)[0].published as Record<string, unknown>).source).toBe("time in byline");
    const inHeader = one("A4.04", [article(`<header><time datetime="2026-05-01">1 May</time></header>${para(30)}`)]);
    expect(inHeader.points).toBe(5);
    expect((pageRecords(inHeader)[0].published as Record<string, unknown>).source).toBe("time in header");
  });

  it("a time element elsewhere in the body does not count as a date unless it names the property", () => {
    const plain = one("A4.04", [article(`<p>Updated <time datetime="2026-05-01">1 May</time></p>${para(30)}`)]);
    expect(plain.result).toBe("FAIL");
    const published = one("A4.04", [article(`<p><time itemprop="datePublished" datetime="2026-05-01">1 May</time></p>${para(30)}`)]);
    expect(published.points).toBe(5);
    const modified = one("A4.04", [article(`<p><time itemprop="dateModified" datetime="2026-05-01">1 May</time></p>${para(30)}`)]);
    expect(modified.points).toBe(5);
    expect(pageRecords(modified)[0].branch).toBe("modified_only");
  });

  it("a header time element marked dateModified is a modified date, not also a published date", () => {
    const r = one("A4.04", [article(`<header><time itemprop="dateModified" datetime="2026-05-01">1 May</time></header>${para(30)}`)]);
    expect(r.points).toBe(5);
    expect(pageRecords(r)[0].branch).toBe("modified_only");
  });

  it("PASS when the published date is in the page and the modified date in the JSON-LD", () => {
    const r = one("A4.04", [
      article(`<p class="byline"><time datetime="2026-05-01">1 May</time></p>${para(30)}`, { head: ld(articleLd({ dateModified: "2026-06-01" })) }),
    ]);
    expect(r).toMatchObject({ result: "PASS", points: 10 });
  });

  it("accepts ISO 8601 and W3C datetimes with an offset, and ignores other formats", () => {
    expect(one("A4.04", [withLd({ datePublished: "2026-05-01T10:00:00+01:00" })]).points).toBe(5);
    expect(one("A4.04", [withLd({ datePublished: "2026-05" })]).points).toBe(5);
    for (const bad of ["14 September 2026", "01/09/2026", "2026-13-01", "yesterday", "", 20260501]) {
      expect(one("A4.04", [withLd({ datePublished: bad })]).result, String(bad)).toBe("FAIL");
    }
  });

  it("reads dates given as a list", () => {
    expect(one("A4.04", [withLd({ datePublished: ["nonsense", "2026-05-01"] })]).points).toBe(5);
  });

  it("ignores a date later than the scan time plus one day (and accepts exactly one day ahead)", () => {
    const oneDay = new Date(NOW.getTime() + DAY_MS).toISOString();
    expect(one("A4.04", [withLd({ datePublished: oneDay })]).points).toBe(5);
    const later = new Date(NOW.getTime() + DAY_MS + 1000).toISOString();
    expect(one("A4.04", [withLd({ datePublished: later })]).result).toBe("FAIL");
    const futureTime = one("A4.04", [article(`<header><time datetime="${later}">soon</time></header>${para(30)}`)]);
    expect(futureTime.result).toBe("FAIL");
  });

  it("mean across articles (full and none give 5 points)", () => {
    const r = one("A4.04", [withLd({ datePublished: "2026-05-01", dateModified: "2026-06-01" }), article(para(40), { url: ARTICLE_URL_2 })]);
    expect(r).toMatchObject({ result: "PARTIAL", points: 5 });
  });

  it("is NOT_OBSERVED for a render-dependent article", () => {
    const r = one("A4.04", [sampled(ARTICLE_URL, "article", SPA_SHELL)]);
    expect(r.result).toBe("NOT_OBSERVED");
    expect(r.maxPoints).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// A4.05 Freshness
// ---------------------------------------------------------------------------

describe("A4.05 freshness", () => {
  const jsonLdPage = (extra: Record<string, unknown>) =>
    article(para(40), { head: ld({ "@context": "https://schema.org", "@type": "Article", headline: "H", ...extra }) });
  const timePage = (iso: string) => article(`<header><time datetime="${iso}">date</time></header>${para(40)}`);
  const fromDate = (iso: string) => run([homePage(), jsonLdPage({ dateModified: iso })])["A4.05"];

  it("band boundaries in whole days: 180 is 1, 181 and 365 are 0.5, 366 is 0", () => {
    // NOW is 2026-10-02T09:15:00Z, so these date-only values are 180d09h, 181d09h, 365d09h and 366d09h old.
    expect(fromDate("2026-04-05")).toMatchObject({ result: "PASS", points: 20 });
    expect(fromDate("2026-04-04")).toMatchObject({ result: "PARTIAL", points: 10 });
    expect(fromDate("2025-10-02")).toMatchObject({ result: "PARTIAL", points: 10 });
    expect(fromDate("2025-10-01")).toMatchObject({ result: "FAIL", points: 0 });
  });

  it("measures age in completed days against the exact scan time", () => {
    expect(fromDate("2026-04-04T10:15:00Z").result).toBe("PASS"); // 180d 23h
    expect(fromDate("2026-04-04T09:15:01Z").result).toBe("PASS"); // 180d 23h 59m 59s
    expect(fromDate("2026-04-04T09:15:00Z").result).toBe("PARTIAL"); // exactly 181d
    expect(fromDate("2025-10-01T10:15:00Z").result).toBe("PARTIAL"); // 365d 23h
    expect(fromDate("2025-10-01T09:15:00Z").result).toBe("FAIL"); // exactly 366d
  });

  it("reports the age, the newest date and its source in the evidence", () => {
    const r = fromDate("2026-09-28T12:00:00Z");
    expect(evidenceOf(r)).toMatchObject({
      branch: "age_180_days_or_less",
      latest: "2026-09-28T12:00:00.000Z",
      latestSource: "json-ld dateModified",
      latestUrl: ARTICLE_URL,
      ageDays: 3,
      scanTime: SCANNED_AT,
    });
    expect(r.explanation).toContain("2026-09-28");
  });

  it("uses each source on its own: JSON-LD dateModified, datePublished, time element and sitemap lastmod", () => {
    const modified = run([homePage(), jsonLdPage({ dateModified: "2026-09-01" })])["A4.05"];
    expect(evidenceOf(modified).latestSource).toBe("json-ld dateModified");
    const published = run([homePage(), jsonLdPage({ datePublished: "2026-09-01" })])["A4.05"];
    expect(evidenceOf(published).latestSource).toBe("json-ld datePublished");
    const time = run([homePage(), timePage("2026-09-01")])["A4.05"];
    expect(evidenceOf(time).latestSource).toBe("time element");
    const sitemap = run([homePage()], { sitemaps: sitemaps(urlset(["https://example.ie/", "https://example.ie/a"], ["2026-09-01", "2026-08-01"])) })["A4.05"];
    expect(evidenceOf(sitemap)).toMatchObject({ latestSource: "sitemap lastmod", latest: "2026-09-01T00:00:00.000Z" });
    for (const r of [modified, published, time, sitemap]) expect(r.result).toBe("PASS");
  });

  it("takes the newest date across all sources", () => {
    const r = run([homePage(), jsonLdPage({ dateModified: "2025-01-01" }), timePage("2026-09-15")], {
      sitemaps: sitemaps(urlset(["https://example.ie/a"], ["2024-01-01"])),
    })["A4.05"];
    expect(evidenceOf(r)).toMatchObject({ latest: "2026-09-15T00:00:00.000Z", latestSource: "time element" });
    expect(evidenceOf(r).validDates).toMatchObject({ jsonLdDateModified: 1, timeElements: 1, sitemapLastmod: 1 });
  });

  it("a time element on the homepage counts as well as one on a sampled article", () => {
    const home = homePage({ main: `<h1>Hi</h1><p><time datetime="2026-09-20">20 Sept</time></p>${para(60)}` });
    expect(run([home])["A4.05"].result).toBe("PASS");
  });

  it("sitemap lastmod identical on 5 or more URLs is ignored as a build-time stamp", () => {
    const locs = Array.from({ length: 5 }, (_, i) => `https://example.ie/p${i}`);
    const stamped = run([homePage()], { sitemaps: sitemaps(urlset(locs, locs.map(() => "2026-09-30"))) })["A4.05"];
    expect(stamped.result).toBe("NOT_OBSERVED");
    expect(stamped.maxPoints).toBe(20);
    expect(evidenceOf(stamped).sitemap).toMatchObject({
      documents: ["https://example.ie/sitemap.xml"],
      lastmodValues: 5,
      distinctValues: 1,
      ignoredAsBuildStamp: true,
    });
    expect(stamped.explanation).toContain("build-time stamp");
  });

  it("identical lastmod on only 4 URLs is used", () => {
    const locs = Array.from({ length: 4 }, (_, i) => `https://example.ie/p${i}`);
    const r = run([homePage()], { sitemaps: sitemaps(urlset(locs, locs.map(() => "2026-09-30"))) })["A4.05"];
    expect(r.result).toBe("PASS");
    expect(evidenceOf(r).sitemap).toMatchObject({ ignoredAsBuildStamp: false });
  });

  it("5 URLs whose lastmod values differ are used", () => {
    const locs = Array.from({ length: 5 }, (_, i) => `https://example.ie/p${i}`);
    const dates = ["2026-09-30", "2026-09-30", "2026-09-30", "2026-09-30", "2026-09-29"];
    expect(run([homePage()], { sitemaps: sitemaps(urlset(locs, dates)) })["A4.05"].result).toBe("PASS");
  });

  it("compares lastmod values as written, so different formats of one instant are not identical", () => {
    const locs = Array.from({ length: 5 }, (_, i) => `https://example.ie/p${i}`);
    const dates = ["2026-09-30", "2026-09-30T00:00:00Z", "2026-09-30", "2026-09-30", "2026-09-30"];
    expect(run([homePage()], { sitemaps: sitemaps(urlset(locs, dates)) })["A4.05"].result).toBe("PASS");
  });

  it("when the sitemap is a build stamp, other dates still decide the result", () => {
    const locs = Array.from({ length: 6 }, (_, i) => `https://example.ie/p${i}`);
    const r = run([homePage(), jsonLdPage({ dateModified: "2025-01-01" })], { sitemaps: sitemaps(urlset(locs, locs.map(() => "2026-10-01"))) })["A4.05"];
    expect(r.result).toBe("FAIL");
    expect(evidenceOf(r)).toMatchObject({ latestSource: "json-ld dateModified", ageDays: 639 });
  });

  it("is NOT_OBSERVED when there is no valid date anywhere", () => {
    const r = run([homePage(), article(para(40))])["A4.05"];
    expect(r.result).toBe("NOT_OBSERVED");
    expect(r.points).toBeNull();
    expect(evidenceOf(r).branch).toBe("no_valid_date");
  });

  it("ignores dates that are not ISO 8601 or W3C datetime", () => {
    const r = run([homePage(), jsonLdPage({ dateModified: "14 September 2026" }), timePage("1 October 2026")])["A4.05"];
    expect(r.result).toBe("NOT_OBSERVED");
    expect(evidenceOf(r).ignoredInvalid).toBe(2);
  });

  it("ignores a date later than the scan time plus one day, and accepts exactly one day ahead", () => {
    const later = new Date(NOW.getTime() + DAY_MS + 1000).toISOString();
    const future = run([homePage(), jsonLdPage({ dateModified: later })])["A4.05"];
    expect(future.result).toBe("NOT_OBSERVED");
    expect(evidenceOf(future).ignoredFuture).toBe(1);
    const exact = run([homePage(), jsonLdPage({ dateModified: new Date(NOW.getTime() + DAY_MS).toISOString() })])["A4.05"];
    expect(exact.result).toBe("PASS");
    expect(evidenceOf(exact).ageDays).toBe(-1);
  });

  it("a future date does not hide an older valid one", () => {
    const later = new Date(NOW.getTime() + 10 * DAY_MS).toISOString();
    const r = run([homePage(), jsonLdPage({ dateModified: later, datePublished: "2026-05-01" })])["A4.05"];
    expect(evidenceOf(r)).toMatchObject({ latest: "2026-05-01T00:00:00.000Z", ignoredFuture: 1 });
  });

  it("ignores sitemap entries on other sites and the lastmod of sitemap index children", () => {
    const foreign = run([homePage()], { sitemaps: sitemaps(urlset(["https://other.ie/a"], ["2026-09-30"])) })["A4.05"];
    expect(foreign.result).toBe("NOT_OBSERVED");
    const index = run([homePage()], { sitemaps: sitemaps(sitemapIndexXml(["https://example.ie/s1.xml"], "2026-09-30")) })["A4.05"];
    expect(index.result).toBe("NOT_OBSERVED");
  });

  it("accepts a www sitemap entry as the same site", () => {
    const r = run([homePage()], { sitemaps: sitemaps(urlset(["https://www.example.ie/a"], ["2026-09-30"])) })["A4.05"];
    expect(r.result).toBe("PASS");
  });

  it("still reads the sitemap and JSON-LD when every page is render-dependent", () => {
    const r = run([sampled(HOME, "home", SPA_SHELL)], { sitemaps: sitemaps(urlset(["https://example.ie/a"], ["2026-09-30"])) })["A4.05"];
    expect(r.result).toBe("PASS");
  });

  it("measures age from the context's scan time, never from the wall clock", () => {
    const pages = [homePage(), jsonLdPage({ dateModified: "2026-04-04" })];
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2020-01-01T00:00:00Z"));
      const early = run(pages)["A4.05"];
      vi.setSystemTime(new Date("2040-01-01T00:00:00Z"));
      const late = run(pages)["A4.05"];
      expect(late).toEqual(early);
      expect(early.result).toBe("PARTIAL");
    } finally {
      vi.useRealTimers();
    }
    const later = run(pages, {}, new Date("2027-06-01T00:00:00Z"))["A4.05"];
    expect(later.result).toBe("FAIL");
  });
});

// ---------------------------------------------------------------------------
// A4.06 Privacy policy linked
// ---------------------------------------------------------------------------

describe("A4.06 privacy policy linked", () => {
  it("PASS when the homepage links to a privacy policy path", () => {
    for (const href of ["/privacy", "/privacy-policy", "/privacy-notice", "/data-protection", "/Privacy-Policy", "/privacy/cookies", "https://www.example.ie/privacy"]) {
      const r = one("A4.06", [homePage({ footer: link(href, "Privacy") })]);
      expect(r, href).toMatchObject({ result: "PASS", points: 10 });
    }
  });

  it("PASS for a link in the main content or navigation as well as the footer", () => {
    expect(one("A4.06", [homePage({ nav: link("/privacy") })]).result).toBe("PASS");
    expect(one("A4.06", [homePage({ main: `<h1>Hi</h1>${para(60)}<p>${link("/privacy-policy")}</p>` })]).result).toBe("PASS");
  });

  it("FAIL when no link matches, including similar paths, other hosts and fragments", () => {
    for (const href of ["/privacypolicy", "/legal/privacy", "/terms", "/cookies", "https://other.ie/privacy", "#privacy", "/blog/privacy-policy"]) {
      const r = one("A4.06", [homePage({ footer: link(href, "Privacy") })]);
      expect(r, href).toMatchObject({ result: "FAIL", points: 0 });
      expect(evidenceOf(r).branch).toBe("no_privacy_link");
    }
  });

  it("does not need the policy page to be fetched or to load", () => {
    const r = one("A4.06", [homePage({ footer: link("/privacy") })], { linkChecks: [linkCheck("https://example.ie/privacy", 404)] });
    expect(r.result).toBe("PASS");
  });

  it("records presence only: the link text is not judged", () => {
    expect(one("A4.06", [homePage({ footer: link("/privacy", "x") })]).result).toBe("PASS");
  });

  it("is NOT_OBSERVED for a render-dependent homepage", () => {
    const r = one("A4.06", [sampled(HOME, "home", SPA_SHELL)]);
    expect(r.result).toBe("NOT_OBSERVED");
    expect(r.maxPoints).toBe(10);
  });

  it("is NOT_OBSERVED without a homepage and SCAN_ERROR when it failed", () => {
    expect(one("A4.06", [mainPage(KO_URL, "services", para(60))]).result).toBe("NOT_OBSERVED");
    expect(one("A4.06", [sampled(HOME, "home", null, { status: null, error: failure("CONNECTION_RESET") })]).result).toBe("SCAN_ERROR");
  });
});

// ---------------------------------------------------------------------------
// A4.07 External references
// ---------------------------------------------------------------------------

describe("A4.07 external references", () => {
  const ext = (href: string, rel = "") => `<p><a href="${href}"${rel === "" ? "" : ` rel="${rel}"`}>source</a></p>`;
  const withLink = (inner: string, type: PageType = "services", url = KO_URL) => mainPage(url, type, `<h1>T</h1>${para(30)}${inner}`);

  it("PASS when the main content has an outbound link to another site", () => {
    const r = one("A4.07", [withLink(ext("https://www.revenue.ie/en/home.aspx"))]);
    expect(r).toMatchObject({ result: "PASS", points: 15 });
    expect(pageRecords(r)[0]).toMatchObject({ branch: "outbound_link_in_main", outboundLinks: 1, firstOutbound: "https://www.revenue.ie/en/home.aspx" });
  });

  it("FAIL when the main content has no outbound link", () => {
    const r = one("A4.07", [withLink(`<p>${link("/about")}</p>`)]);
    expect(r).toMatchObject({ result: "FAIL", points: 0 });
    expect(pageRecords(r)[0].branch).toBe("no_outbound_link_in_main");
  });

  it("http and https links both count, and nofollow does not exclude a link", () => {
    expect(one("A4.07", [withLink(ext("http://example.org/page"))]).result).toBe("PASS");
    expect(one("A4.07", [withLink(ext("https://example.org/page", "nofollow noopener"))]).result).toBe("PASS");
  });

  it("excludes rel=sponsored and rel=ugc links", () => {
    for (const rel of ["sponsored", "ugc", "nofollow ugc", "SPONSORED"]) {
      const r = one("A4.07", [withLink(ext("https://example.org/page", rel))]);
      expect(r.result, rel).toBe("FAIL");
      expect(pageRecords(r)[0].excludedSponsoredOrUgc).toBe(1);
    }
  });

  it("excludes share links", () => {
    for (const href of [
      "https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fexample.ie",
      "https://twitter.com/intent/tweet?url=https%3A%2F%2Fexample.ie",
      "https://x.com/share?url=https%3A%2F%2Fexample.ie",
      "https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fexample.ie",
      "https://wa.me/?text=hello",
    ]) {
      const r = one("A4.07", [withLink(ext(href))]);
      expect(r.result, href).toBe("FAIL");
      expect(pageRecords(r)[0].excludedShare).toBe(1);
    }
  });

  it("a normal link to a social site is still an outbound link", () => {
    expect(one("A4.07", [withLink(ext("https://www.linkedin.com/company/example"))]).result).toBe("PASS");
  });

  it("does not count links to the same site, including the www form and fragments", () => {
    for (const href of ["/about", "https://example.ie/about", "https://www.example.ie/about", "http://example.ie/x", "#top"]) {
      expect(one("A4.07", [withLink(ext(href))]).result, href).toBe("FAIL");
    }
  });

  it("treats a different subdomain as another site", () => {
    expect(one("A4.07", [withLink(ext("https://blog.example.ie/post"))]).result).toBe("PASS");
  });

  it("does not count mailto and tel links", () => {
    expect(one("A4.07", [withLink(ext("mailto:hello@example.org") + ext("tel:+35312345678"))]).result).toBe("FAIL");
  });

  it("does not count outbound links outside the main content", () => {
    const page = sampled(
      KO_URL,
      "services",
      doc({
        body: `<header>${link("https://a.example.org/")}</header><nav>${link("https://b.example.org/")}</nav><aside>${link("https://c.example.org/")}</aside><main><h1>T</h1>${para(30)}</main><footer>${link("https://d.example.org/")}</footer>`,
      }),
    );
    const r = one("A4.07", [page]);
    expect(r.result).toBe("FAIL");
    expect(pageRecords(r)[0]).toMatchObject({ mainLinks: 0, outboundLinks: 0 });
  });

  it("reads the body minus boilerplate when a page has no main element", () => {
    const page = sampled(
      KO_URL,
      "services",
      doc({ body: `<nav>${link("https://nav.example.org/")}</nav><h1>T</h1>${para(30)}${ext("https://body.example.org/x")}` }),
    );
    const r = one("A4.07", [page]);
    expect(r.result).toBe("PASS");
    expect(pageRecords(r)[0].firstOutbound).toBe("https://body.example.org/x");
  });

  it("only knowledge pages count: the homepage, about, contact and legal pages are out of scope", () => {
    const linkHtml = ext("https://www.revenue.ie/");
    expect(one("A4.07", [homePage({ main: `<h1>Hi</h1>${para(60)}${linkHtml}` })]).result).toBe("NOT_APPLICABLE");
    for (const type of ["about", "contact", "legal"] as const) {
      expect(one("A4.07", [homePage(), withLink(linkHtml, type, `https://example.ie/${type}`)]).result, type).toBe("NOT_APPLICABLE");
    }
    for (const [type, url] of [["services", KO_URL], ["faq", KO_URL_2], ["article", ARTICLE_URL], ["other", "https://example.ie/pricing"]] as const) {
      expect(one("A4.07", [withLink(linkHtml, type, url)]).result, type).toBe("PASS");
    }
  });

  it("NOT_APPLICABLE when no knowledge page was sampled", () => {
    const r = one("A4.07", [homePage()]);
    expect(r.result).toBe("NOT_APPLICABLE");
    expect(r.maxPoints).toBeNull();
  });

  it("mean across pages (one with a reference, one without)", () => {
    const r = one("A4.07", [withLink(ext("https://www.revenue.ie/")), withLink("", "faq", KO_URL_2)]);
    expect(r).toMatchObject({ result: "PARTIAL", points: 7.5 });
  });

  it("is NOT_OBSERVED for a render-dependent page and for fewer than half readable", () => {
    expect(one("A4.07", [sampled(KO_URL, "services", SPA_SHELL)]).result).toBe("NOT_OBSERVED");
    const r = one("A4.07", [sampled(KO_URL, "services", SPA_SHELL), sampled(KO_URL_2, "faq", SPA_SHELL), withLink(ext("https://www.revenue.ie/"), "article", ARTICLE_URL)]);
    expect(r.result).toBe("NOT_OBSERVED");
    expect(r.maxPoints).toBe(15);
  });

  it("is SCAN_ERROR when the page failed to load", () => {
    expect(one("A4.07", [sampled(KO_URL, "services", null, { status: 404 })]).result).toBe("SCAN_ERROR");
  });

  it("keeps long URLs short in evidence", () => {
    const r = one("A4.07", [withLink(ext(`https://www.revenue.ie/${"a".repeat(600)}`))]);
    expectCleanEvidence(r);
    expect(r.result).toBe("PASS");
  });
});

// ---------------------------------------------------------------------------
// Evidence hygiene across scenarios
// ---------------------------------------------------------------------------

describe("A4 evidence hygiene", () => {
  it("every result in a spread of scenarios carries plain, short, escaped evidence and one-sentence explanation", () => {
    const bidi = String.fromCodePoint(0x202e);
    const zwsp = String.fromCodePoint(0x200b);
    const scenarios: SampledPage[][] = [
      [],
      [homePage(), article(para(40))],
      [sampled(HOME, "home", SPA_SHELL), sampled(ARTICLE_URL, "article", SPA_SHELL), sampled(KO_URL, "services", SPA_SHELL)],
      [sampled(HOME, "home", null, { status: 503 }), sampled(ARTICLE_URL, "article", null, { status: null, error: failure("TIMEOUT") })],
      [
        homePage({ nav: link(`/about${"x".repeat(300)}`) + link("/privacy") + link("/contact"), footer: `<p>write${zwsp}@example.ie ${bidi}</p>` }),
        article(`<p class="byline">${"B".repeat(400)}${bidi}</p>${para(30)}`, {
          head: ld({ "@context": "https://schema.org", "@type": "Article", author: { name: `${"A".repeat(400)}${bidi}` }, datePublished: "2026-05-01" }),
        }),
        mainPage(KO_URL, "services", `<h1>T</h1>${para(30)}<p><a href="https://example.org/${"z".repeat(500)}">x</a></p>`),
      ],
    ];
    for (const pages of scenarios) {
      for (const result of evaluateA4(ctxOf(pages))) {
        expectCleanEvidence(result);
        expect(result.explanation.trim().length).toBeGreaterThan(0);
        expect(result.explanation).not.toMatch(/[\r\n]/);
      }
    }
  });
});
