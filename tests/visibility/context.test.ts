import { describe, expect, it, vi } from "vitest";
import {
  CHALLENGE_BODY_MARKERS,
  CHALLENGE_STATUSES,
  buildEvalContext,
  classifyPageFetch,
} from "@/lib/visibility/context";
import { METHODOLOGY } from "@/lib/visibility/methodology";
import { normaliseText, parseIsoDate } from "@/lib/visibility/text";
import { normaliseUrl, sameSite, siteHost } from "@/lib/visibility/normalise";
import { CANDIDATE_EXCLUSIONS, PAGE_TYPES } from "@/lib/visibility/types";
import type {
  CandidateExclusion,
  EvalContext,
  FetchErrorCode,
  FetchRecord,
  PageFetchClass,
  PageType,
  RobotsRecord,
  SampledPage,
  ScanSnapshot,
  SitemapRecord,
  SitemapRole,
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

function failure(code: FetchErrorCode): { code: FetchErrorCode; message: string } {
  return { code, message: code };
}

const words = (n: number, prefix = "word"): string =>
  Array.from({ length: n }, (_, i) => `${prefix}${i}`).join(" ");

function html(
  opts: { title?: string; head?: string; body?: string; lang?: string } = {},
): string {
  const lang = opts.lang ?? "en";
  const body = opts.body ?? `<main><h1>Heading</h1><p>${words(80)}</p></main>`;
  return `<!doctype html><html lang="${lang}"><head><title>${opts.title ?? "A page title"}</title>${opts.head ?? ""}</head><body>${body}</body></html>`;
}

const SPA_SHELL = `<!doctype html><html lang="en"><head><title>App</title></head><body><div id="root"></div><noscript>You need to enable JavaScript to run this app.</noscript></body></html>`;

function ldScript(value: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
}

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

function robotsRec(origin: string, status: number | null, body: string | null, over: Partial<FetchRecord> = {}): RobotsRecord {
  const url = `${origin}/robots.txt`;
  return {
    origin,
    record: record(url, { kind: "robots", status, body, contentType: "text/plain", ...over }),
  };
}

function sitemapRec(
  url: string,
  role: SitemapRole,
  body: string | null,
  over: Partial<FetchRecord> = {},
  parentUrl: string | null = null,
): SitemapRecord {
  return {
    url,
    role,
    parentUrl,
    record: record(url, { kind: "sitemap", body, contentType: "application/xml", ...over }),
  };
}

function urlset(locs: readonly string[], lastmods: readonly (string | null)[] = []): string {
  const items = locs.map((loc, i) => {
    const lastmod = lastmods[i] ?? null;
    return `<url><loc>${loc}</loc>${lastmod === null ? "" : `<lastmod>${lastmod}</lastmod>`}</url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items.join("")}</urlset>`;
}

function sitemapIndex(locs: readonly string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locs
    .map((loc) => `<sitemap><loc>${loc}</loc><lastmod>2026-09-01</lastmod></sitemap>`)
    .join("")}</sitemapindex>`;
}

function build(over: Partial<ScanSnapshot> = {}): EvalContext {
  return buildEvalContext(snapshot(over), NOW);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

describe("buildEvalContext: pages and facts", () => {
  it("extracts facts for every ok HTML page, keeps snapshot order and puts home first", () => {
    const snap = snapshot({
      pages: [
        sampled(HOME, "home", html({ title: "Home" })),
        sampled("https://example.ie/services", "services", html({ title: "Services" })),
        sampled("https://example.ie/about", "about", html({ title: "About" })),
      ],
    });
    const ctx = buildEvalContext(snap, NOW);

    expect(ctx.now).toBe(NOW);
    expect(ctx.snapshot).toBe(snap);
    expect(ctx.methodology).toBe(METHODOLOGY);
    expect(ctx.pages.map((p) => p.url)).toEqual([
      HOME,
      "https://example.ie/services",
      "https://example.ie/about",
    ]);
    expect(ctx.home).toBe(ctx.pages[0]);
    expect(ctx.homeFacts).toBe(ctx.pages[0].facts);
    expect(ctx.homeFacts?.head.titles[0].text).toBe("Home");
    for (const page of ctx.pages) {
      expect(page.fetchClass).toBe("ok");
      expect(page.observed).toBe(true);
      expect(page.facts).not.toBeNull();
      expect(page.facts?.url).toBe(page.url);
      expect(page.renderDependent).toBe(false);
    }
    expect(ctx.pages[1].type).toBe("services");
    expect(ctx.pages[1].depth).toBe(1);
    expect(ctx.pages[1].reason).toBe("test services");
    expect(ctx.pages[1].record).toBe(snap.pages[1].record);
  });

  it("flags a render-dependent page but still extracts its facts", () => {
    const ctx = build({
      pages: [
        sampled(HOME, "home", SPA_SHELL),
        sampled("https://example.ie/services", "services", html()),
      ],
    });
    const [spa, normal] = ctx.pages;

    expect(spa.renderDependent).toBe(true);
    expect(spa.observed).toBe(true);
    expect(spa.facts?.render.renderDependent).toBe(true);
    expect(spa.facts?.render.spaRootMarkers).toContain("#root");
    expect(ctx.home?.renderDependent).toBe(true);
    expect(ctx.homeFacts?.head.titles[0].text).toBe("App");
    expect(normal.renderDependent).toBe(false);
  });

  it.each([
    ["a thin page with no marker", html({ body: "<main><p>Only a few words here.</p></main>" }), false],
    [
      "an empty noscript JavaScript message alone",
      html({ body: "<main></main><noscript>Please enable JavaScript to continue.</noscript>" }),
      true,
    ],
    [
      "a framework root holding 60 server-rendered words",
      html({ body: `<div id="__next"><main><p>${words(60)}</p></main></div>` }),
      false,
    ],
    [
      "an empty #__next root",
      html({ body: `<div id="__next"></div>` }),
      true,
    ],
  ])("render verdict: %s", (_label, body, expected) => {
    const ctx = build({ pages: [sampled(HOME, "home", body)] });
    expect(ctx.pages[0].renderDependent).toBe(expected);
    expect(ctx.pages[0].observed).toBe(true);
  });

  it("uses the record's final URL and headers when extracting", () => {
    const oldUrl = "https://example.ie/old";
    const newUrl = "https://example.ie/new";
    const ctx = build({
      pages: [
        {
          url: oldUrl,
          type: "other",
          reason: "r",
          depth: 1,
          record: record(oldUrl, {
            finalUrl: newUrl,
            headers: { link: `<${newUrl}>; rel="canonical"` },
            body: html(),
          }),
        },
      ],
    });
    const page = ctx.pages[0];
    expect(page.url).toBe(oldUrl);
    expect(page.finalUrl).toBe(newUrl);
    expect(page.facts?.url).toBe(newUrl);
    expect(page.facts?.head.canonicals).toContainEqual({ source: "header", href: newUrl, url: newUrl });
  });

  type Case = [string, Partial<FetchRecord>, PageFetchClass];
  const cases: Case[] = [
    ["404 with an HTML body", { status: 404, body: html() }, "http_error"],
    ["500", { status: 500, body: html() }, "http_error"],
    ["an unresolved 301", { status: 301, body: null }, "http_error"],
    ["a timeout with no status", { status: null, error: failure("TIMEOUT") }, "fetch_error"],
    ["200 with RESPONSE_TOO_LARGE", { status: 200, body: null, error: failure("RESPONSE_TOO_LARGE") }, "fetch_error"],
    ["404 that also carries an error", { status: 404, body: html(), error: failure("TIMEOUT") }, "fetch_error"],
    ["redirects exhausted", { status: 302, error: failure("TOO_MANY_REDIRECTS") }, "fetch_error"],
    ["no status and no error", { status: null }, "fetch_error"],
    ["2xx HTML with a null body", { status: 200, body: null }, "fetch_error"],
    ["own-agent robots refusal", { status: null, body: null, error: failure("ROBOTS_DISALLOWED") }, "robots_blocked"],
    [
      "a PDF rejected by content type",
      { status: 200, contentType: "application/pdf", body: null, error: failure("CONTENT_TYPE_REJECTED") },
      "non_html",
    ],
    ["200 text/plain with a body", { status: 200, contentType: "text/plain", body: "hello" }, "non_html"],
    ["200 with no content type at all", { status: 200, contentType: null, body: html() }, "non_html"],
    ["text/html", { contentType: "text/html", body: html() }, "ok"],
    ["mixed-case text/html with a charset", { contentType: "TEXT/HTML; Charset=UTF-8", body: html() }, "ok"],
    ["application/xhtml+xml", { contentType: "application/xhtml+xml", body: html() }, "ok"],
    [
      "a content type only in the headers",
      { contentType: null, headers: { "content-type": "text/html" }, body: html() },
      "ok",
    ],
    ["an empty but present body", { body: "" }, "ok"],
  ];

  it.each(cases)("classifies %s", (_label, over, expected) => {
    const url = "https://example.ie/p";
    expect(classifyPageFetch(record(url, over))).toBe(expected);
    const ctx = build({
      pages: [{ url, type: "other", reason: "r", depth: 1, record: record(url, over) }],
    });
    const page = ctx.pages[0];
    expect(page.fetchClass).toBe(expected);
    expect(page.observed).toBe(expected === "ok");
    expect(page.facts === null).toBe(expected !== "ok");
    expect(page.renderDependent).toBe(false);
  });

  it("builds a usable context when the scan did not complete", () => {
    const unreachable = build({
      outcome: "UNREACHABLE",
      outcomeDetail: "no route",
      httpsAttempt: record("https://example.ie/", { status: null, error: failure("DNS_FAILED") }),
    });
    expect(unreachable.pages).toEqual([]);
    expect(unreachable.home).toBeNull();
    expect(unreachable.homeFacts).toBeNull();
    expect(unreachable.jsonLd.nodes).toEqual([]);
    expect(unreachable.sitemap).toEqual({ documents: [], declaredInRobots: false, urls: [] });
    expect(unreachable.challenge).toEqual({ detected: false, sources: [] });

    const blocked = build({
      outcome: "BLOCKED_BY_ROBOTS",
      robots: [robotsRec("https://example.ie", 200, "User-agent: *\nDisallow: /")],
    });
    expect(blocked.home).toBeNull();
    expect(blocked.robots.stateFor(HOME)).toBe("found");
    expect(blocked.robots.isAllowed("*", HOME)).toBe(false);
  });

  it("returns a home with no facts when the homepage itself failed", () => {
    const ctx = build({
      pages: [
        sampled(HOME, "home", html(), { status: 503 }),
        sampled("https://example.ie/about", "about", html()),
      ],
    });
    expect(ctx.home).toBe(ctx.pages[0]);
    expect(ctx.home?.fetchClass).toBe("http_error");
    expect(ctx.homeFacts).toBeNull();
    expect(ctx.pages[1].observed).toBe(true);
  });
});

describe("buildEvalContext: robots per origin", () => {
  const ROBOTS_BODY = [
    "User-agent: *",
    "Disallow: /private",
    "",
    "User-agent: Googlebot",
    "Allow: /",
    "",
    "User-agent: DataBridgesBot",
    "Disallow: /secret",
    "",
    "Sitemap: https://example.ie/sitemap.xml",
    "Sitemap: not-an-absolute-url",
  ].join("\n");

  it("parses robots.txt into rules for its origin", () => {
    const ctx = build({ robots: [robotsRec("https://example.ie", 200, ROBOTS_BODY)] });
    const rules = ctx.robots.byOrigin.get("https://example.ie");

    expect([...ctx.robots.byOrigin.keys()]).toEqual(["https://example.ie"]);
    expect(rules?.state).toBe("found");
    expect(rules?.status).toBe(200);
    expect(rules?.origin).toBe("https://example.ie");
    expect(rules?.sitemaps).toEqual(["https://example.ie/sitemap.xml"]);
    expect(ctx.robots.stateFor("https://example.ie/anything")).toBe("found");
  });

  it("applies the wildcard group for * and the own group (else wildcard) for any other token", () => {
    const ctx = build({ robots: [robotsRec("https://example.ie", 200, ROBOTS_BODY)] });
    const allowed = (token: string, path: string): boolean | null =>
      ctx.robots.isAllowed(token, `https://example.ie${path}`);

    expect(allowed("*", "/private/page")).toBe(false);
    expect(allowed("*", "/")).toBe(true);
    expect(allowed("*", "/secret")).toBe(true);
    expect(allowed("Googlebot", "/private/page")).toBe(true);
    expect(allowed("OAI-SearchBot", "/private/page")).toBe(false);
    expect(allowed("OAI-SearchBot", "/secret")).toBe(true);
    expect(allowed("DataBridgesBot", "/secret")).toBe(false);
    expect(allowed("DataBridgesBot", "/private/page")).toBe(true);
    expect(allowed("googlebot", "/private/page")).toBe(true);
  });

  it("keeps a separate state for each origin", () => {
    const ctx = build({
      robots: [
        robotsRec("https://example.ie", 200, "User-agent: *\nDisallow: /"),
        robotsRec("https://www.example.ie", 404, null),
        robotsRec("http://example.ie", 500, null),
      ],
    });

    expect(ctx.robots.stateFor("https://example.ie/x")).toBe("found");
    expect(ctx.robots.isAllowed("Googlebot", "https://example.ie/x")).toBe(false);

    expect(ctx.robots.stateFor("https://www.example.ie/x")).toBe("not_found");
    expect(ctx.robots.byOrigin.get("https://www.example.ie")?.status).toBe(404);
    expect(ctx.robots.isAllowed("Googlebot", "https://www.example.ie/x")).toBe(true);
    expect(ctx.robots.isAllowed("*", "https://www.example.ie/")).toBe(true);

    expect(ctx.robots.stateFor("http://example.ie/x")).toBe("error");
    expect(ctx.robots.byOrigin.get("http://example.ie")?.status).toBe(500);
    expect(ctx.robots.isAllowed("Googlebot", "http://example.ie/x")).toBeNull();
    expect(ctx.robots.byOrigin.get("http://example.ie")?.sitemaps).toEqual([]);
  });

  it.each([400, 401, 403, 404, 410, 429])("treats a %i robots.txt as allow-all", (status) => {
    const ctx = build({ robots: [robotsRec("https://example.ie", status, null)] });
    expect(ctx.robots.stateFor(HOME)).toBe("not_found");
    expect(ctx.robots.isAllowed("*", "https://example.ie/private")).toBe(true);
    expect(ctx.robots.isAllowed("OAI-SearchBot", "https://example.ie/private")).toBe(true);
  });

  it.each([500, 502, 503])("returns null for a %i robots.txt", (status) => {
    const ctx = build({ robots: [robotsRec("https://example.ie", status, null)] });
    expect(ctx.robots.stateFor(HOME)).toBe("error");
    expect(ctx.robots.isAllowed("Googlebot", HOME)).toBeNull();
  });

  it.each<[string, Partial<FetchRecord>, "error" | "not_fetched"]>([
    ["a timeout", { error: failure("TIMEOUT") }, "error"],
    ["a DNS failure", { error: failure("DNS_FAILED") }, "error"],
    ["a connection reset", { error: failure("CONNECTION_RESET") }, "error"],
    ["the request cap being reached first", { error: failure("REQUEST_CAP_REACHED") }, "not_fetched"],
    ["an allowlist refusal", { error: failure("HOST_NOT_ALLOWLISTED") }, "not_fetched"],
  ])("maps %s on robots.txt without a status", (_label, over, state) => {
    const ctx = build({ robots: [robotsRec("https://example.ie", null, null, over)] });
    expect(ctx.robots.byOrigin.get("https://example.ie")?.state).toBe(state);
    expect(ctx.robots.isAllowed("Googlebot", HOME)).toBeNull();
  });

  it("returns null and not_fetched for an origin with no robots record", () => {
    const ctx = build({ robots: [robotsRec("https://example.ie", 200, "User-agent: *\nDisallow: /")] });
    expect(ctx.robots.stateFor("https://other.example.org/")).toBe("not_fetched");
    expect(ctx.robots.isAllowed("Googlebot", "https://other.example.org/")).toBeNull();
    expect(ctx.robots.stateFor("http://example.ie/")).toBe("not_fetched");
    expect(ctx.robots.stateFor("https://example.ie:8443/")).toBe("not_fetched");
    expect(ctx.robots.stateFor("not a url")).toBe("not_fetched");
    expect(ctx.robots.isAllowed("Googlebot", "not a url")).toBeNull();
    expect(ctx.robots.stateFor("ftp://example.ie/file")).toBe("not_fetched");
  });

  it("returns null when asked about a URL on another origin through the per-origin rules", () => {
    const ctx = build({ robots: [robotsRec("https://example.ie", 200, "User-agent: *\nDisallow: /x")] });
    const rules = ctx.robots.byOrigin.get("https://example.ie");
    expect(rules?.isAllowed("*", "https://example.ie/x")).toBe(false);
    expect(rules?.isAllowed("*", "https://example.org/x")).toBeNull();
    const absent = build({ robots: [robotsRec("https://example.ie", 404, null)] });
    expect(absent.robots.byOrigin.get("https://example.ie")?.isAllowed("*", "https://example.org/")).toBeNull();
  });

  it("normalises the origin key and keeps the first record for a duplicate origin", () => {
    const ctx = build({
      robots: [
        robotsRec("HTTPS://Example.IE/", 200, "User-agent: *\nDisallow: /one"),
        robotsRec("https://example.ie", 200, "User-agent: *\nDisallow: /two"),
      ],
    });
    expect([...ctx.robots.byOrigin.keys()]).toEqual(["https://example.ie"]);
    expect(ctx.robots.isAllowed("*", "https://example.ie/one")).toBe(false);
    expect(ctx.robots.isAllowed("*", "https://example.ie/two")).toBe(true);
    expect(ctx.robots.isAllowed("*", "https://EXAMPLE.ie:443/one")).toBe(false);
  });

  it("keeps a non-default port as part of the origin", () => {
    const ctx = build({
      robots: [
        robotsRec("http://example.ie", 200, "User-agent: *\nDisallow: /a"),
        robotsRec("http://example.ie:8080", 200, "User-agent: *\nDisallow: /b"),
      ],
    });
    expect(ctx.robots.isAllowed("*", "http://example.ie/a")).toBe(false);
    expect(ctx.robots.isAllowed("*", "http://example.ie/b")).toBe(true);
    expect(ctx.robots.isAllowed("*", "http://example.ie:8080/b")).toBe(false);
  });

  it("reads a size-capped robots.txt prefix as found", () => {
    const ctx = build({
      robots: [
        robotsRec("https://example.ie", 200, "User-agent: *\nDisallow: /cut", {
          truncated: true,
          error: failure("RESPONSE_TOO_LARGE"),
        }),
      ],
    });
    expect(ctx.robots.stateFor(HOME)).toBe("found");
    expect(ctx.robots.isAllowed("*", "https://example.ie/cut")).toBe(false);
  });

  it("matches an RFC 9309 longest rule over the URL path and query", () => {
    const ctx = build({
      robots: [
        robotsRec(
          "https://example.ie",
          200,
          "User-agent: *\nDisallow: /docs/\nAllow: /docs/public/\nDisallow: /*.pdf$",
        ),
      ],
    });
    expect(ctx.robots.isAllowed("*", "https://example.ie/docs/secret")).toBe(false);
    expect(ctx.robots.isAllowed("*", "https://example.ie/docs/public/a")).toBe(true);
    expect(ctx.robots.isAllowed("*", "https://example.ie/a.pdf")).toBe(false);
    expect(ctx.robots.isAllowed("*", "https://example.ie/a.pdf?x=1")).toBe(true);
  });
});

describe("buildEvalContext: sitemaps", () => {
  it("parses a urlset into entries and normalised same-site URLs", () => {
    const body = urlset(
      [
        "https://example.ie/",
        "https://example.ie/about/",
        "https://www.example.ie/services#top",
        "https://other.example.net/page",
        "https://example.ie/about",
        "https://example.ie/blog/a%2fb",
      ],
      ["2026-09-28", "not a date", null, "2026-01-01T10:00:00+02:00", "2026-02-30", null],
    );
    const ctx = build({
      sitemaps: [sitemapRec("https://example.ie/sitemap.xml", "default", body)],
    });
    const [doc] = ctx.sitemap.documents;

    expect(ctx.sitemap.documents).toHaveLength(1);
    expect(doc.kind).toBe("urlset");
    expect(doc.url).toBe("https://example.ie/sitemap.xml");
    expect(doc.role).toBe("default");
    expect(doc.parentUrl).toBeNull();
    expect(doc.entries.map((e) => e.loc)).toEqual([
      "https://example.ie/",
      "https://example.ie/about/",
      "https://www.example.ie/services#top",
      "https://other.example.net/page",
      "https://example.ie/about",
      "https://example.ie/blog/a%2fb",
    ]);
    expect(doc.entries.map((e) => e.lastmod)).toEqual([
      "2026-09-28",
      "not a date",
      null,
      "2026-01-01T10:00:00+02:00",
      "2026-02-30",
      null,
    ]);
    expect(doc.entries.map((e) => e.lastmodParsed)).toEqual([
      "2026-09-28T00:00:00.000Z",
      null,
      null,
      "2026-01-01T08:00:00.000Z",
      null,
      null,
    ]);
    expect(doc.sameSiteLocCount).toBe(5);
    expect(doc.locCapHit).toBe(false);
    expect(ctx.sitemap.urls).toEqual([
      "https://example.ie/",
      "https://example.ie/about",
      "https://www.example.ie/services",
      "https://example.ie/blog/a%2Fb",
    ]);
  });

  it("handles a sitemap index with its children and counts only urlset URLs", () => {
    const idx = "https://example.ie/sitemap_index.xml";
    const child1 = "https://example.ie/sitemap-1.xml";
    const child2 = "https://example.ie/sitemap-2.xml";
    const child3 = "https://example.ie/sitemap-3.xml";
    const ctx = build({
      sitemaps: [
        sitemapRec(idx, "declared", sitemapIndex([child1, child2, child3, "https://elsewhere.test/s.xml"])),
        sitemapRec(child1, "index-child", urlset(["https://example.ie/a", "https://example.ie/b"]), {}, idx),
        sitemapRec(child2, "index-child", urlset(["https://example.ie/b", "https://example.ie/c"]), {}, idx),
        sitemapRec(child3, "index-child", null, { status: 404 }, idx),
      ],
    });
    const docs = ctx.sitemap.documents;

    expect(docs.map((d) => d.url)).toEqual([idx, child1, child2, child3]);
    expect(docs.map((d) => d.role)).toEqual(["declared", "index-child", "index-child", "index-child"]);
    expect(docs.map((d) => d.parentUrl)).toEqual([null, idx, idx, idx]);
    expect(docs.map((d) => d.kind)).toEqual(["sitemapindex", "urlset", "urlset", "not_found"]);
    expect(docs[0].entries.map((e) => e.loc)).toEqual([
      child1,
      child2,
      child3,
      "https://elsewhere.test/s.xml",
    ]);
    expect(docs[0].entries[0].lastmodParsed).toBe("2026-09-01T00:00:00.000Z");
    expect(docs[0].sameSiteLocCount).toBe(3);
    expect(docs[1].sameSiteLocCount).toBe(2);
    expect(ctx.sitemap.urls).toEqual([
      "https://example.ie/a",
      "https://example.ie/b",
      "https://example.ie/c",
    ]);
  });

  type SitemapCase = [string, Partial<FetchRecord>, string];
  const sitemapCases: SitemapCase[] = [
    ["an HTML page served with 200", { body: "<!doctype html><html><body>hi</body></html>" }, "malformed"],
    ["an empty 200 body", { body: "" }, "malformed"],
    ["plain text", { body: "https://example.ie/a\nhttps://example.ie/b" }, "malformed"],
    ["a content type the fetch layer rejected", { body: null, error: failure("CONTENT_TYPE_REJECTED") }, "malformed"],
    ["404", { status: 404, body: null }, "not_found"],
    ["410", { status: 410, body: null }, "not_found"],
    ["400", { status: 400, body: null }, "not_found"],
    ["401", { status: 401, body: null }, "error"],
    ["403", { status: 403, body: null }, "error"],
    ["429", { status: 429, body: null }, "error"],
    ["500", { status: 500, body: null }, "error"],
    ["an unresolved 301", { status: 301, body: null }, "error"],
    ["a timeout", { status: null, body: null, error: failure("TIMEOUT") }, "error"],
    ["a 200 with a null body", { body: null }, "error"],
    ["a 200 that failed while reading", { body: urlset(["https://example.ie/a"]), error: failure("CONNECTION_RESET") }, "error"],
    ["the own-agent robots refusal", { status: null, body: null, error: failure("ROBOTS_DISALLOWED") }, "error"],
  ];

  it.each(sitemapCases)("classifies %s", (_label, over, kind) => {
    const ctx = build({
      sitemaps: [sitemapRec("https://example.ie/sitemap.xml", "default", "<unused/>", over)],
    });
    const [doc] = ctx.sitemap.documents;
    expect(doc.kind).toBe(kind);
    expect(doc.entries).toEqual([]);
    expect(doc.sameSiteLocCount).toBe(0);
    expect(ctx.sitemap.urls).toEqual([]);
  });

  it("caps a sitemap at 5,000 locs and reports the cap", () => {
    const locs = Array.from({ length: 5001 }, (_, i) => `https://example.ie/p${i}`);
    const ctx = build({
      sitemaps: [sitemapRec("https://example.ie/sitemap.xml", "default", urlset(locs))],
    });
    const [doc] = ctx.sitemap.documents;
    expect(doc.entries).toHaveLength(5000);
    expect(doc.locCapHit).toBe(true);
    expect(doc.sameSiteLocCount).toBe(5000);
    expect(ctx.sitemap.urls).toHaveLength(5000);
  });

  it("reads a size-capped sitemap prefix and flags it as incomplete", () => {
    const cut = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.ie/a</loc></url><url><loc>https://example.ie/b</loc></url><url><loc>https://exam`;
    const ctx = build({
      sitemaps: [
        sitemapRec("https://example.ie/sitemap.xml", "default", cut, {
          truncated: true,
          error: failure("RESPONSE_TOO_LARGE"),
        }),
      ],
    });
    const [doc] = ctx.sitemap.documents;
    expect(doc.kind).toBe("urlset");
    expect(doc.entries.map((e) => e.loc)).toEqual(["https://example.ie/a", "https://example.ie/b"]);
    expect(doc.locCapHit).toBe(true);
  });

  it("counts a sitemap with no same-site URL as a urlset with zero same-site locs", () => {
    const ctx = build({
      sitemaps: [
        sitemapRec("https://example.ie/sitemap.xml", "default", urlset(["https://other.example.net/a"])),
      ],
    });
    expect(ctx.sitemap.documents[0].kind).toBe("urlset");
    expect(ctx.sitemap.documents[0].entries).toHaveLength(1);
    expect(ctx.sitemap.documents[0].sameSiteLocCount).toBe(0);
    expect(ctx.sitemap.urls).toEqual([]);
  });

  it("judges same-site against the final homepage URL", () => {
    const ctx = build({
      homeUrl: "https://www.example.ie/",
      sitemaps: [
        sitemapRec(
          "https://www.example.ie/sitemap.xml",
          "default",
          urlset(["https://example.ie/a", "https://www.example.ie/b", "https://example.org/c"]),
        ),
      ],
    });
    expect(ctx.sitemap.documents[0].sameSiteLocCount).toBe(2);
    expect(ctx.sitemap.urls).toEqual(["https://example.ie/a", "https://www.example.ie/b"]);
  });

  it("reports whether robots.txt declares a sitemap for the home site", () => {
    const withLine = "User-agent: *\nDisallow:\nSitemap: https://example.ie/sitemap.xml";
    expect(build({ robots: [robotsRec("https://example.ie", 200, withLine)] }).sitemap.declaredInRobots).toBe(true);
    expect(
      build({ robots: [robotsRec("https://example.ie", 200, "User-agent: *\nDisallow:")] }).sitemap.declaredInRobots,
    ).toBe(false);
    expect(build({ robots: [robotsRec("https://example.ie", 404, null)] }).sitemap.declaredInRobots).toBe(false);
    expect(build({ robots: [robotsRec("https://example.ie", 500, null)] }).sitemap.declaredInRobots).toBe(false);
    expect(build({ robots: [] }).sitemap.declaredInRobots).toBe(false);
    expect(build({ robots: [robotsRec("https://www.example.ie", 200, withLine)] }).sitemap.declaredInRobots).toBe(true);
    expect(
      build({ robots: [robotsRec("https://unrelated.example.org", 200, withLine)] }).sitemap.declaredInRobots,
    ).toBe(false);
  });

  it("counts a declared sitemap on another host as declared in robots", () => {
    const body = "User-agent: *\nDisallow:\nSitemap: https://cdn.example.net/sitemap.xml";
    const ctx = build({ robots: [robotsRec("https://example.ie", 200, body)] });
    expect(ctx.sitemap.declaredInRobots).toBe(true);
    expect(ctx.sitemap.documents).toEqual([]);
  });
});

describe("buildEvalContext: JSON-LD index", () => {
  const ORG = { "@type": "Organization", "@id": "/#org", name: "Fernhill Joinery", url: "https://example.ie/" };
  const homeHtml = html({
    head: ldScript({ "@context": "https://schema.org", "@graph": [ORG, { "@type": "WebSite", name: "Fernhill" }] }),
  });
  const servicesHtml = html({
    head: ldScript({
      "@context": "https://schema.org",
      "@type": "Service",
      name: "Kitchens",
      provider: { "@id": "/#org" },
    }),
  });

  it("indexes nodes from every page and resolves the homepage's nodes from other pages", () => {
    const ctx = build({
      pages: [
        sampled(HOME, "home", homeHtml),
        sampled("https://example.ie/services", "services", servicesHtml),
      ],
    });
    const { nodes, references, definitions } = ctx.jsonLd;

    expect(nodes.map((n) => [n.pageUrl, n.pageType, n.blockIndex, n.node.types.join("|") || n.node.id])).toEqual([
      [HOME, "home", 0, "Organization"],
      [HOME, "home", 0, "WebSite"],
      ["https://example.ie/services", "services", 0, "Service"],
      ["https://example.ie/services", "services", 0, "/#org"],
    ]);
    expect(references).toHaveLength(1);
    expect(references[0].pageUrl).toBe("https://example.ie/services");
    expect(references[0].pageType).toBe("services");
    expect(references[0].node.isReference).toBe(true);
    expect(references[0].node.iri).toBe("https://example.ie/#org");

    expect([...definitions.keys()]).toEqual(["https://example.ie/#org"]);
    const defs = definitions.get("https://example.ie/#org") ?? [];
    expect(defs).toHaveLength(1);
    expect(defs[0].pageUrl).toBe(HOME);
    expect(defs[0].node.types).toEqual(["Organization"]);
    expect(defs[0].node.isReference).toBe(false);
    expect(definitions.get(references[0].node.iri ?? "")).toBe(defs);
  });

  it("does not list a reference as a definition", () => {
    const ctx = build({
      pages: [sampled("https://example.ie/services", "services", servicesHtml)],
    });
    expect(ctx.jsonLd.references).toHaveLength(1);
    expect(ctx.jsonLd.definitions.size).toBe(0);
  });

  it("lists every page that defines the same IRI, in page order", () => {
    const def = (name: string): string =>
      html({ head: ldScript({ "@context": "https://schema.org", "@type": "Person", "@id": "https://example.ie/#me", name }) });
    const ctx = build({
      pages: [
        sampled(HOME, "home", def("One")),
        sampled("https://example.ie/about", "about", def("Two")),
      ],
    });
    const defs = ctx.jsonLd.definitions.get("https://example.ie/#me") ?? [];
    expect(defs.map((d) => [d.pageUrl, d.node.properties.name])).toEqual([
      [HOME, "One"],
      ["https://example.ie/about", "Two"],
    ]);
  });

  it("includes JSON-LD from a render-dependent page", () => {
    const shell = html({
      head: ldScript({ "@context": "https://schema.org", "@type": "Organization", "@id": "https://example.ie/#spa", name: "Spa" }),
      body: `<div id="root"></div><noscript>You need to enable JavaScript to run this app.</noscript>`,
    });
    const ctx = build({ pages: [sampled(HOME, "home", shell)] });
    expect(ctx.pages[0].renderDependent).toBe(true);
    expect(ctx.jsonLd.nodes).toHaveLength(1);
    expect(ctx.jsonLd.definitions.has("https://example.ie/#spa")).toBe(true);
  });

  it("leaves out pages without facts", () => {
    const ctx = build({
      pages: [
        sampled(HOME, "home", homeHtml),
        sampled("https://example.ie/gone", "other", servicesHtml, { status: 404 }),
        sampled("https://example.ie/pdf", "other", null, {
          contentType: "application/pdf",
          error: failure("CONTENT_TYPE_REJECTED"),
        }),
      ],
    });
    expect(new Set(ctx.jsonLd.nodes.map((n) => n.pageUrl))).toEqual(new Set([HOME]));
    expect(ctx.jsonLd.references).toEqual([]);
  });

  it("skips a block that fails to parse and keeps the block index of the next one", () => {
    const broken = html({
      head: `<script type="application/ld+json">{ not json</script>${ldScript({
        "@context": "https://schema.org",
        "@type": "Organization",
        "@id": "https://example.ie/#ok",
        name: "Ok",
      })}`,
    });
    const ctx = build({ pages: [sampled(HOME, "home", broken)] });
    expect(ctx.jsonLd.nodes).toHaveLength(1);
    expect(ctx.jsonLd.nodes[0].blockIndex).toBe(1);
    expect(ctx.jsonLd.definitions.has("https://example.ie/#ok")).toBe(true);
  });

  it("indexes a node with no @id but keeps it out of the definitions", () => {
    const page = html({ head: ldScript({ "@context": "https://schema.org", "@type": "WebSite", name: "No id" }) });
    const ctx = build({ pages: [sampled(HOME, "home", page)] });
    expect(ctx.jsonLd.nodes).toHaveLength(1);
    expect(ctx.jsonLd.nodes[0].node.iri).toBeNull();
    expect(ctx.jsonLd.definitions.size).toBe(0);
    expect(ctx.jsonLd.references).toEqual([]);
  });
});

describe("buildEvalContext: helpers", () => {
  it("exposes the shared single implementations", () => {
    const { helpers } = build();
    expect(helpers.sameSite).toBe(sameSite);
    expect(helpers.siteHost).toBe(siteHost);
    expect(helpers.normaliseUrl).toBe(normaliseUrl);
    expect(helpers.normaliseText).toBe(normaliseText);
    expect(helpers.parseIsoDate).toBe(parseIsoDate);
  });

  it("answers same-site questions with www stripped", () => {
    const { helpers } = build();
    expect(helpers.sameSite("https://www.example.ie/a", "https://example.ie/")).toBe(true);
    expect(helpers.sameSite("https://example.ie", "https://blog.example.ie")).toBe(false);
    expect(helpers.siteHost("https://WWW.Example.IE/x")).toBe("example.ie");
  });

  it("answers isHomeSite against the final homepage URL", () => {
    const { helpers } = build({ homeUrl: "https://www.example.ie/" });
    expect(helpers.isHomeSite("https://example.ie/page")).toBe(true);
    expect(helpers.isHomeSite("https://www.example.ie/page")).toBe(true);
    expect(helpers.isHomeSite("https://example.org/page")).toBe(false);
    expect(helpers.isHomeSite("https://sub.example.ie/")).toBe(false);
  });

  it("normalises URLs, text and dates", () => {
    const { helpers } = build();
    expect(helpers.normaliseUrl("/a/b/?q=%2f#x", "https://Example.IE")).toBe("https://example.ie/a/b?q=%2F");
    expect(helpers.normaliseUrl("mailto:a@b.ie")).toBeNull();
    expect(helpers.normaliseText("  A\u{A0}\u{A0}b \n c\u{200B} ")).toBe("A b c");
    expect(helpers.parseIsoDate("2026-09-28")).toBe("2026-09-28T00:00:00.000Z");
    expect(helpers.parseIsoDate("28 September 2026")).toBeNull();
  });
});

describe("buildEvalContext: challenge detection (CF-07 input)", () => {
  const challengePage = (over: Partial<FetchRecord>): SampledPage => ({
    url: HOME,
    type: "home",
    reason: "home",
    depth: 0,
    record: record(HOME, over),
  });

  it("reports nothing for an ordinary scan", () => {
    const ctx = build({ pages: [sampled(HOME, "home", html())] });
    expect(ctx.challenge).toEqual({ detected: false, sources: [] });
  });

  it("uses the provisional statuses and markers from the brief", () => {
    expect([...CHALLENGE_STATUSES].sort()).toEqual([403, 429, 503]);
    expect(CHALLENGE_BODY_MARKERS).toEqual([
      "just a moment",
      "attention required",
      "verify you are human",
      "captcha",
    ]);
  });

  it("detects a 503 with challenge markup", () => {
    const ctx = build({
      pages: [challengePage({ status: 503, body: "<html><title>Just a moment...</title></html>" })],
    });
    expect(ctx.challenge).toEqual({
      detected: true,
      sources: [{ url: HOME, status: 503, marker: "just a moment" }],
    });
  });

  it("detects a cf-mitigated header without a body and prefers it to body text", () => {
    const withHeader = build({
      pages: [challengePage({ status: 403, body: null, headers: { "cf-mitigated": "challenge" } })],
    });
    expect(withHeader.challenge.sources).toEqual([
      { url: HOME, status: 403, marker: "cf-mitigated: challenge" },
    ]);

    const both = build({
      pages: [
        challengePage({ status: 403, body: "Please complete the captcha", headers: { "cf-mitigated": "challenge" } }),
      ],
    });
    expect(both.challenge.sources[0].marker).toBe("cf-mitigated: challenge");
  });

  it("reads the header name and value case-insensitively and inside a joined list", () => {
    const mixed = build({
      pages: [challengePage({ status: 429, body: null, headers: { "CF-Mitigated": "Challenge" } })],
    });
    expect(mixed.challenge.detected).toBe(true);
    const joined = build({
      pages: [challengePage({ status: 429, body: null, headers: { "cf-mitigated": "other, challenge" } })],
    });
    expect(joined.challenge.detected).toBe(true);
    const different = build({
      pages: [challengePage({ status: 429, body: null, headers: { "cf-mitigated": "blocked" } })],
    });
    expect(different.challenge.detected).toBe(false);
  });

  it.each([
    ["attention required", "<title>Attention Required! | Cloudflare</title>"],
    ["verify you are human", "<p>Please Verify You Are Human to continue</p>"],
    ["captcha", "<div class='g-recaptcha'>hCaptcha</div>"],
  ])("recognises the %s marker", (marker, body) => {
    const ctx = build({ pages: [challengePage({ status: 403, body })] });
    expect(ctx.challenge.sources).toEqual([{ url: HOME, status: 403, marker }]);
  });

  it.each([
    ["a 403 with no marker", { status: 403, body: "<h1>Forbidden</h1>" }],
    ["a 503 with a plain outage page", { status: 503, body: "<h1>Service Unavailable</h1>" }],
    ["a 404 that mentions a captcha", { status: 404, body: "captcha" }],
    ["a 200 that mentions a captcha", { status: 200, body: html({ body: "<main><p>Our captcha form</p></main>" }) }],
    ["a 500 with challenge text", { status: 500, body: "Just a moment" }],
    ["a challenge status with no body and no header", { status: 403, body: null }],
    ["a record with no status", { status: null, body: "captcha", error: failure("TIMEOUT") }],
  ])("does not detect %s", (_label, over) => {
    const ctx = build({ pages: [challengePage(over)] });
    expect(ctx.challenge).toEqual({ detected: false, sources: [] });
  });

  it("looks across the https attempt, robots, sitemaps, llms, http variant and timing records", () => {
    const blocked = (url: string, kind: FetchRecord["kind"]): FetchRecord =>
      record(url, { kind, status: 403, body: "Attention Required" });
    const ctx = build({
      httpsAttempt: blocked("https://example.ie/", "page"),
      robots: [{ origin: "https://example.ie", record: blocked("https://example.ie/robots.txt", "robots") }],
      pages: [challengePage({ status: 503, body: "Just a moment" })],
      sitemaps: [
        { url: "https://example.ie/sitemap.xml", role: "default", parentUrl: null, record: blocked("https://example.ie/sitemap.xml", "sitemap") },
      ],
      llms: blocked("https://example.ie/llms.txt", "llms"),
      httpVariant: record("http://example.ie/", { kind: "http-variant", status: 403, headers: { "cf-mitigated": "challenge" } }),
      timing: [record("https://example.ie/", { kind: "timing", status: 429, headers: { "cf-mitigated": "challenge" } })],
    });
    expect(ctx.challenge.detected).toBe(true);
    expect(ctx.challenge.sources).toEqual([
      { url: "https://example.ie/", status: 403, marker: "attention required" },
      { url: "https://example.ie/robots.txt", status: 403, marker: "attention required" },
      { url: HOME, status: 503, marker: "just a moment" },
      { url: "https://example.ie/sitemap.xml", status: 403, marker: "attention required" },
      { url: "https://example.ie/llms.txt", status: 403, marker: "attention required" },
      { url: "http://example.ie/", status: 403, marker: "cf-mitigated: challenge" },
      { url: HOME, status: 429, marker: "cf-mitigated: challenge" },
    ]);
  });

  it("lists the same URL, status and marker once", () => {
    const rec = { status: 403, body: null, headers: { "cf-mitigated": "challenge" } };
    const ctx = build({
      pages: [challengePage(rec)],
      timing: [record(HOME, { kind: "timing", ...rec }), record(HOME, { kind: "timing", ...rec })],
    });
    expect(ctx.challenge.sources).toHaveLength(1);
  });

  it("uses the final URL of the challenged response", () => {
    const ctx = build({
      pages: [
        {
          url: "https://example.ie/start",
          type: "other",
          reason: "r",
          depth: 1,
          record: record("https://example.ie/start", {
            finalUrl: "https://example.ie/verify",
            status: 403,
            body: "verify you are human",
          }),
        },
      ],
    });
    expect(ctx.challenge.sources).toEqual([
      { url: "https://example.ie/verify", status: 403, marker: "verify you are human" },
    ]);
  });
});

describe("buildEvalContext: purity", () => {
  const fullSnapshot = (): ScanSnapshot =>
    snapshot({
      robots: [robotsRec("https://example.ie", 200, "User-agent: *\nDisallow: /private\nSitemap: https://example.ie/sitemap.xml")],
      sitemaps: [sitemapRec("https://example.ie/sitemap.xml", "declared", urlset(["https://example.ie/a"], ["2026-09-01"]))],
      pages: [
        sampled(HOME, "home", html({ head: ldScript({ "@context": "https://schema.org", "@type": "Organization", "@id": "/#o", name: "O" }) })),
        sampled("https://example.ie/spa", "other", SPA_SHELL),
        sampled("https://example.ie/missing", "other", null, { status: 404 }),
      ],
    });

  it("does not mutate or depend on writing to the snapshot", () => {
    const snap = fullSnapshot();
    const before = JSON.stringify(snap);
    expect(() => buildEvalContext(deepFreeze(snap), NOW)).not.toThrow();
    expect(JSON.stringify(snap)).toBe(before);
  });

  it("gives identical results for identical input", () => {
    const view = (ctx: EvalContext): string =>
      JSON.stringify({
        pages: ctx.pages,
        sitemap: ctx.sitemap,
        nodes: ctx.jsonLd.nodes,
        defs: [...ctx.jsonLd.definitions.entries()],
        challenge: ctx.challenge,
        origins: [...ctx.robots.byOrigin.entries()].map(([k, v]) => [k, v.state, v.status, v.sitemaps]),
      });
    expect(view(buildEvalContext(fullSnapshot(), NOW))).toBe(view(buildEvalContext(fullSnapshot(), NOW)));
  });

  it("does not read the clock or randomness", () => {
    const now = vi.spyOn(Date, "now");
    const random = vi.spyOn(Math, "random");
    try {
      buildEvalContext(fullSnapshot(), NOW);
      expect(now).not.toHaveBeenCalled();
      expect(random).not.toHaveBeenCalled();
    } finally {
      now.mockRestore();
      random.mockRestore();
    }
  });

  it("passes the scan time through untouched", () => {
    const later = new Date("2031-01-01T00:00:00.000Z");
    expect(buildEvalContext(fullSnapshot(), later).now).toBe(later);
  });

  it("rejects an invalid scan time", () => {
    expect(() => buildEvalContext(fullSnapshot(), new Date("not a date"))).toThrow(RangeError);
    expect(() => buildEvalContext(fullSnapshot(), undefined as unknown as Date)).toThrow(RangeError);
  });
});
