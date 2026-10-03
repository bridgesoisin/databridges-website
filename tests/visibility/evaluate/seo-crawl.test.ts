import { describe, expect, it } from "vitest";
import { buildEvalContext } from "@/lib/visibility/context";
import { evaluateS1 } from "@/lib/visibility/evaluate/seo-crawl";
import { METHODOLOGY } from "@/lib/visibility/methodology";
import { CANDIDATE_EXCLUSIONS, PAGE_TYPES } from "@/lib/visibility/types";
import type {
  CandidateExclusion,
  EvalContext,
  FetchRecord,
  MetricResult,
  PageType,
  RedirectHop,
  RobotsRecord,
  SampledPage,
  ScanSnapshot,
  SitemapRecord,
  SitemapRole,
} from "@/lib/visibility/types";

const SCANNED_AT = "2026-10-02T09:15:00.000Z";
const NOW = new Date(SCANNED_AT);
const HOME = "https://example.ie/";
const ORIGIN = "https://example.ie";

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

function doc(head = "", body = `<main><h1>Heading</h1><p>${words(80)}</p></main>`): string {
  return `<!doctype html><html lang="en"><head><title>A good page title for testing</title>${head}</head><body>${body}</body></html>`;
}

const SPA_BODY = `<div id="root"></div><noscript>You need to enable JavaScript to run this app.</noscript>`;

type Spec = {
  path?: string;
  url?: string;
  type?: PageType;
  html: string | null;
  record?: Partial<FetchRecord>;
};

function sampled(spec: Spec, index: number): SampledPage {
  const path = spec.path ?? (index === 0 ? "/" : `/page-${index}`);
  const url = spec.url ?? `${ORIGIN}${path}`;
  return {
    url,
    type: spec.type ?? (index === 0 ? "home" : "other"),
    reason: "test",
    depth: new URL(url).pathname.split("/").filter((s) => s !== "").length,
    record: record(url, { body: spec.html, ...spec.record }),
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
      excluded: zeroed<CandidateExclusion>(CANDIDATE_EXCLUSIONS),
      byType: zeroed<PageType>(PAGE_TYPES),
      capped: false,
    },
    stats: { requestCount: 0, requestCapReached: false, jobTimedOut: false, jobDurationMs: 0 },
    ...over,
  };
}

function ctxOf(specs: Spec[], over: Partial<ScanSnapshot> = {}): EvalContext {
  return buildEvalContext(snapshot(specs.map(sampled), over), NOW);
}

function metricOf(results: MetricResult[], id: string): MetricResult {
  const found = results.find((r) => r.metricId === id);
  if (found === undefined) throw new Error(`no result for ${id}`);
  return found;
}

function run(id: string, specs: (string | Spec)[], over: Partial<ScanSnapshot> = {}): MetricResult {
  const list = specs.map((s): Spec => (typeof s === "string" ? { html: s } : s));
  return metricOf(evaluateS1(ctxOf(list, over)), id);
}

function pageEvidence(result: MetricResult): Record<string, unknown>[] {
  return result.evidence as Record<string, unknown>[];
}

function robotsRec(
  body: string | null,
  status: number | null = 200,
  over: Partial<FetchRecord> = {},
  origin: string = ORIGIN,
): RobotsRecord {
  return {
    origin,
    record: record(`${origin}/robots.txt`, { kind: "robots", status, body, contentType: "text/plain", ...over }),
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

function urlset(locs: readonly string[]): string {
  const items = locs.map((loc) => `<url><loc>${loc}</loc></url>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</urlset>`;
}

function sitemapIndex(locs: readonly string[]): string {
  const items = locs.map((loc) => `<sitemap><loc>${loc}</loc></sitemap>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</sitemapindex>`;
}

function hops(count: number, status = 301): RedirectHop[] {
  return Array.from({ length: count }, (_, i) => ({
    url: `${ORIGIN}/hop-${i}`,
    status,
    location: `${ORIGIN}/hop-${i + 1}`,
  }));
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

describe("evaluateS1: contract", () => {
  it("returns one result per S1 metric, in id order, with methodology points", () => {
    const results = evaluateS1(ctxOf([{ html: doc() }]));
    expect(results.map((r) => r.metricId)).toEqual(["S1.01", "S1.02", "S1.03", "S1.04", "S1.05"]);
    expect(results.map((r) => r.maxPoints === null ? null : r.maxPoints)).toEqual([25, 25, 20, 20, 10]);
    for (const r of results) {
      const def = METHODOLOGY.metrics.find((m) => m.id === r.metricId);
      expect(r.metricVersion).toBe(def?.version);
      expect(r.reviewedBy).toBeNull();
      expect(r.explanation.length).toBeGreaterThan(0);
      if (r.result === "PASS" || r.result === "PARTIAL" || r.result === "FAIL") expect(r.points).not.toBeNull();
      else expect(r.points).toBeNull();
    }
  });

  it("is deterministic and its evidence is plain JSON", () => {
    const specs: Spec[] = [{ html: doc('<meta name="robots" content="noindex">') }, { html: doc() }];
    const over = { robots: [robotsRec("User-agent: *\nDisallow: /page-1")] };
    const first = evaluateS1(ctxOf(specs, over));
    const second = evaluateS1(ctxOf(specs, over));
    expect(second).toEqual(first);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
  });

  it("caps every evidence string at 200 characters, even for hostile input", () => {
    const huge = "z".repeat(6000);
    const results = evaluateS1(
      ctxOf(
        [
          {
            html: doc(`<meta name="robots" content="noindex, ${huge}"><link rel="canonical" href="https://other.example/${huge}">`),
            record: { headers: { "x-robots-tag": `noindex, ${huge}` } },
          },
          { html: doc(), record: { finalUrl: `${ORIGIN}/${huge}`, redirectChain: hops(2) } },
        ],
        {
          robots: [robotsRec("User-agent: *\nDisallow: /")],
          sitemaps: [sitemapRec(`${ORIGIN}/${huge}.xml`, "declared", "<nope")],
        },
      ),
    );
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

  it("returns NOT_OBSERVED for page metrics when no page was sampled", () => {
    const results = evaluateS1(buildEvalContext(snapshot([]), NOW));
    for (const id of ["S1.01", "S1.02", "S1.04", "S1.05"]) {
      const r = metricOf(results, id);
      expect(r.result).toBe("NOT_OBSERVED");
      expect(r.points).toBeNull();
      expect(r.maxPoints).toBe(METHODOLOGY.metrics.find((m) => m.id === id)?.maxPoints);
    }
  });

  it("turns an unexpected internal error into SCAN_ERROR for that metric only", () => {
    const ctx = ctxOf([{ html: doc() }], { robots: [robotsRec(null, 404)] });
    const broken: EvalContext = {
      ...ctx,
      robots: {
        ...ctx.robots,
        stateFor: () => {
          throw new Error("boom");
        },
      },
    };
    const results = evaluateS1(broken);
    expect(metricOf(results, "S1.02").result).toBe("SCAN_ERROR");
    expect(JSON.stringify(metricOf(results, "S1.02").evidence)).toContain("internal_error");
    expect(metricOf(results, "S1.01").result).toBe("PASS");
  });
});

describe("S1.01 Pages are indexable", () => {
  const withMeta = (content: string, name = "robots"): string => doc(`<meta name="${name}" content="${content}">`);

  it("is PASS when no page carries a noindex or none directive", () => {
    const r = run("S1.01", [doc(), doc(), doc()]);
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(25);
    expect(pageEvidence(r)[0].branch).toBe("indexable");
  });

  it.each(["noindex", "NOINDEX", "none", "None", "noindex, nofollow", "nofollow, noindex", "index, noindex", "noarchive,noindex"])(
    "scores meta robots %s as 0",
    (content) => {
      const r = run("S1.01", [withMeta(content)]);
      expect(r.result).toBe("FAIL");
      expect(r.points).toBe(0);
      expect(pageEvidence(r)[0].branch).toBe("noindex_directive");
      expect(String((pageEvidence(r)[0].noindexSources as string[])[0])).toContain("meta robots");
    },
  );

  it.each(["googlebot", "bingbot", "Googlebot", "BingBot"])("honours a %s meta tag", (name) => {
    const r = run("S1.01", [withMeta("noindex", name)]);
    expect(r.result).toBe("FAIL");
    expect(String((pageEvidence(r)[0].noindexSources as string[])[0])).toContain(name.toLowerCase());
  });

  it("ignores meta tags for other agents and other directives", () => {
    for (const html of [
      withMeta("noindex", "slurp"),
      withMeta("noindex", "googlebot-news"),
      withMeta("index, follow"),
      withMeta("noarchive, nosnippet, max-snippet:0, noimageindex"),
      withMeta("nofollow"),
      withMeta("all"),
      withMeta("unavailable_after: 2020-01-01"),
    ]) {
      expect(run("S1.01", [html]).result).toBe("PASS");
    }
  });

  it("reads noindex from an X-Robots-Tag header with no agent prefix", () => {
    for (const header of ["noindex", "none", "NOINDEX, nofollow", "nofollow, noindex"]) {
      const r = run("S1.01", [{ html: doc(), record: { headers: { "x-robots-tag": header } } }]);
      expect(r.result, header).toBe("FAIL");
      expect(String((pageEvidence(r)[0].noindexSources as string[])[0])).toContain("X-Robots-Tag");
    }
  });

  it("reads X-Robots-Tag directives prefixed with googlebot or bingbot, but not other agents", () => {
    const hit = (header: string): string =>
      run("S1.01", [{ html: doc(), record: { headers: { "x-robots-tag": header } } }]).result;
    expect(hit("googlebot: noindex")).toBe("FAIL");
    expect(hit("bingbot: none")).toBe("FAIL");
    expect(hit("otherbot: noindex")).toBe("PASS");
    expect(hit("googlebot-news: noindex")).toBe("PASS");
    expect(hit("slurp: noindex")).toBe("PASS");
    expect(hit("bingbot-news: none")).toBe("PASS");
    expect(hit("nofollow, googlebot: noindex")).toBe("FAIL");
    expect(hit("googlebot: nofollow, otherbot: noindex")).toBe("PASS");
  });

  it("treats a page as indexable when the only noindex is for an unrelated agent in the header", () => {
    expect(run("S1.01", [{ html: doc(), record: { headers: { "x-robots-tag": "otherbot: noindex, nofollow" } } }]).result).toBe("PASS");
  });

  it("averages page scores: one noindex page of five gives 20 of 25", () => {
    const r = run("S1.01", [doc(), doc(), withMeta("noindex"), doc(), doc()]);
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(20);
    expect(r.explanation).toBe("Of 5 pages, 4 can be indexed and 1 carries a noindex or none directive.");
    expect(run("S1.01", [doc(), doc()]).explanation).toBe("All 2 pages can be indexed.");
  });

  it("gives FAIL only when every observed page is noindex, and 12.5 when half are", () => {
    expect(run("S1.01", [withMeta("noindex"), withMeta("none")]).points).toBe(0);
    expect(run("S1.01", [withMeta("noindex"), doc(), doc(), withMeta("none")]).points).toBe(12.5);
  });

  it("evaluates the homepage on its own: a noindex homepage in a one-page sample is FAIL", () => {
    const r = run("S1.01", [withMeta("noindex")]);
    expect(r.result).toBe("FAIL");
    expect(pageEvidence(r)[0].url).toBe(HOME);
  });

  it("still reads a render-dependent page, because it only needs the head", () => {
    const r = run("S1.01", [doc('<meta name="robots" content="noindex">', SPA_BODY)]);
    expect(r.result).toBe("FAIL");
  });

  it("leaves unreadable pages out of the mean and flags a majority of them", () => {
    expect(run("S1.01", [doc(), notFoundPage, doc()]).result).toBe("PASS");
    const mostlyUnread = run("S1.01", [doc(), fetchFailure, fetchFailure]);
    expect(mostlyUnread.result).toBe("SCAN_ERROR");
    expect(mostlyUnread.points).toBeNull();
    expect(mostlyUnread.maxPoints).toBe(25);
    expect(run("S1.01", [doc(), robotsBlockedPage, robotsBlockedPage]).result).toBe("NOT_OBSERVED");
  });

  it("treats a non-HTML 200 response as not observed", () => {
    const pdf: Spec = { html: null, record: { contentType: "application/pdf" } };
    expect(run("S1.01", [doc(), pdf, pdf]).result).toBe("NOT_OBSERVED");
  });
});

describe("S1.02 Crawlable by Googlebot and bingbot", () => {
  const allow = (body: string | null, status: number | null = 200, over: Partial<FetchRecord> = {}): Partial<ScanSnapshot> => ({
    robots: [robotsRec(body, status, over)],
  });

  it("is PASS when robots.txt allows both agents (no rules, or a 404)", () => {
    expect(run("S1.02", [doc(), doc()], allow("User-agent: *\nDisallow:")).result).toBe("PASS");
    const r = run("S1.02", [doc(), doc()], allow(null, 404));
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(25);
    expect(pageEvidence(r)[0].robotsState).toBe("not_found");
    expect(pageEvidence(r)[0].agents).toEqual({ Googlebot: true, bingbot: true });
  });

  it("treats any 4xx robots.txt response as allowed", () => {
    for (const status of [401, 403, 404, 410, 429]) {
      expect(run("S1.02", [doc()], allow(null, status)).result, String(status)).toBe("PASS");
    }
  });

  it("is FAIL when the wildcard group disallows everything", () => {
    const r = run("S1.02", [doc(), doc(), doc()], allow("User-agent: *\nDisallow: /"));
    expect(r.result).toBe("FAIL");
    expect(r.points).toBe(0);
    expect(pageEvidence(r)[0].branch).toBe("blocked_for_both");
  });

  it("scores half a page when only one of the two agents is blocked", () => {
    const g = run("S1.02", [doc(), doc()], allow("User-agent: Googlebot\nDisallow: /"));
    expect(g.result).toBe("PARTIAL");
    expect(g.points).toBe(12.5);
    expect(pageEvidence(g)[0].branch).toBe("blocked_for_googlebot");
    expect(pageEvidence(g)[0].agents).toEqual({ Googlebot: false, bingbot: true });

    const b = run("S1.02", [doc(), doc()], allow("User-agent: bingbot\nDisallow: /"));
    expect(b.points).toBe(12.5);
    expect(pageEvidence(b)[0].branch).toBe("blocked_for_bingbot");
  });

  it("uses the agent's own group over the wildcard group", () => {
    const body = "User-agent: *\nDisallow: /\n\nUser-agent: Googlebot\nAllow: /\n";
    const r = run("S1.02", [doc()], allow(body));
    expect(r.points).toBe(12.5);
    expect(pageEvidence(r)[0].agents).toEqual({ Googlebot: true, bingbot: false });
  });

  it("applies RFC 9309 longest-match and allow-wins-ties rules per page", () => {
    const body = "User-agent: *\nDisallow: /private\nAllow: /private/open\nDisallow: /tie\nAllow: /tie\n";
    const r = run(
      "S1.02",
      [
        { html: doc(), path: "/" },
        { html: doc(), path: "/private/secret" },
        { html: doc(), path: "/private/open" },
        { html: doc(), path: "/tie" },
      ],
      allow(body),
    );
    expect(pageEvidence(r).map((e) => e.s_p)).toEqual([1, 0, 1, 1]);
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(18.75);
  });

  it("is SCAN_ERROR for a 5xx response, a timeout or an unreadable reply, never a failure", () => {
    for (const rec of [
      robotsRec(null, 500),
      robotsRec(null, 503),
      robotsRec(null, null, { error: { code: "TIMEOUT", message: "t" } }),
      robotsRec("<html>soft 404</html>", 200, { contentType: "text/html", error: { code: "CONTENT_TYPE_REJECTED", message: "x" } }),
    ]) {
      const r = run("S1.02", [doc(), doc()], { robots: [rec] });
      expect(r.result).toBe("SCAN_ERROR");
      expect(r.points).toBeNull();
      expect(r.maxPoints).toBe(25);
    }
  });

  it("is NOT_OBSERVED when robots.txt was never fetched for the page's origin", () => {
    const r = run("S1.02", [doc(), doc()]);
    expect(r.result).toBe("NOT_OBSERVED");
    expect(pageEvidence(r)[0].robotsState).toBe("not_fetched");
  });

  it("checks the final URL, so a redirect target is judged by its own robots rules", () => {
    const r = run(
      "S1.02",
      [{ html: doc(), path: "/old", record: { finalUrl: `${ORIGIN}/new` } }],
      allow("User-agent: *\nDisallow: /new"),
    );
    expect(r.result).toBe("FAIL");
    expect(pageEvidence(r)[0].checkedUrl).toBe(`${ORIGIN}/new`);
  });

  it("applies to every sampled page, including pages that could not be parsed or fetched", () => {
    const r = run(
      "S1.02",
      [{ html: doc() }, { ...notFoundPage, path: "/private/a" }, { ...robotsBlockedPage, path: "/private/b" }],
      allow("User-agent: *\nDisallow: /private"),
    );
    expect(pageEvidence(r).map((e) => e.s_p)).toEqual([1, 0, 0]);
    expect(r.points).toBeCloseTo(8.33, 2);
  });

  it("uses each page's own origin: a page on an origin with no robots record is unobserved", () => {
    const r = run(
      "S1.02",
      [{ html: doc() }, { html: doc(), url: "https://www.example.ie/about" }],
      allow(null, 404),
    );
    expect(r.result).toBe("PASS");
    expect(pageEvidence(r)[1].status).toBe("not_observed");
  });

  it("is SCAN_ERROR when most pages sit on an origin whose robots.txt failed", () => {
    const r = run(
      "S1.02",
      [{ html: doc() }, { html: doc(), url: "https://www.example.ie/a" }, { html: doc(), url: "https://www.example.ie/b" }],
      { robots: [robotsRec(null, 404), robotsRec(null, 500, {}, "https://www.example.ie")] },
    );
    expect(r.result).toBe("SCAN_ERROR");
  });
});

describe("S1.03 Valid XML sitemap discoverable", () => {
  const robotsWithSitemap = (url: string): RobotsRecord => robotsRec(`User-agent: *\nDisallow:\nSitemap: ${url}\n`);
  const MAP = `${ORIGIN}/sitemap.xml`;
  const pages: Spec[] = [{ html: doc() }];

  it("is PASS for a sitemap declared in robots.txt with same-site addresses", () => {
    const declared = `${ORIGIN}/maps/main.xml`;
    const r = run("S1.03", pages, {
      robots: [robotsWithSitemap(declared)],
      sitemaps: [sitemapRec(declared, "declared", urlset([HOME, `${ORIGIN}/about`]))],
    });
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(20);
    const evidence = r.evidence as { branch: string; declaredInRobots: boolean; documents: { role: string; kind: string; sameSiteLocs: number; httpStatus: number }[] };
    expect(evidence.branch).toBe("valid_sitemap");
    expect(evidence.declaredInRobots).toBe(true);
    expect(evidence.documents[0]).toMatchObject({ role: "declared", kind: "urlset", sameSiteLocs: 2, httpStatus: 200 });
  });

  it("is PASS for the default /sitemap.xml when robots.txt declares none", () => {
    const r = run("S1.03", pages, {
      robots: [robotsRec(null, 404)],
      sitemaps: [sitemapRec(MAP, "default", urlset([HOME]))],
    });
    expect(r.result).toBe("PASS");
    expect((r.evidence as { declaredInRobots: boolean }).declaredInRobots).toBe(false);
  });

  it("is PASS for a sitemap index with same-site children, and reports the children read", () => {
    const children = [`${ORIGIN}/s1.xml`, `${ORIGIN}/s2.xml`];
    const r = run("S1.03", pages, {
      robots: [robotsRec(null, 404)],
      sitemaps: [
        sitemapRec(MAP, "default", sitemapIndex(children)),
        sitemapRec(children[0], "index-child", urlset([HOME]), {}, MAP),
        sitemapRec(children[1], "index-child", null, { status: 404 }, MAP),
      ],
    });
    expect(r.result).toBe("PASS");
    expect((r.evidence as { childSitemapsRead: number }).childSitemapsRead).toBe(2);
  });

  it("counts the www variant of the site as same-site", () => {
    const r = run("S1.03", pages, {
      robots: [robotsRec(null, 404)],
      sitemaps: [sitemapRec(MAP, "default", urlset(["https://www.example.ie/about"]))],
    });
    expect(r.result).toBe("PASS");
  });

  it("is PARTIAL (0.5) when the sitemap is valid but lists no same-site address", () => {
    for (const body of [urlset(["https://other.example/a"]), urlset([]), sitemapIndex(["https://other.example/s.xml"])]) {
      const r = run("S1.03", pages, { robots: [robotsRec(null, 404)], sitemaps: [sitemapRec(MAP, "default", body)] });
      expect(r.result).toBe("PARTIAL");
      expect(r.points).toBe(10);
      expect((r.evidence as { branch: string }).branch).toBe("no_same_site_url");
    }
  });

  it("is PARTIAL (0.5) when a sitemap was found but is malformed", () => {
    for (const body of ["this is not xml at all", "<html><body>Hello</body></html>", "<urlset", ""]) {
      const r = run("S1.03", pages, { robots: [robotsRec(null, 404)], sitemaps: [sitemapRec(MAP, "default", body)] });
      expect(r.result, body).toBe("PARTIAL");
      expect(r.points).toBe(10);
      expect((r.evidence as { branch: string }).branch).toBe("malformed");
    }
  });

  it("treats a 200 reply of the wrong content type (a browser-only page or soft 404) as found but malformed", () => {
    const r = run("S1.03", pages, {
      robots: [robotsRec(null, 404)],
      sitemaps: [
        sitemapRec(MAP, "default", null, {
          contentType: "text/html",
          error: { code: "CONTENT_TYPE_REJECTED", message: "text/html" },
        }),
      ],
    });
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(10);
  });

  it("is FAIL when no sitemap is found (the declared or default address returns 4xx)", () => {
    for (const status of [404, 410, 400]) {
      const r = run("S1.03", pages, {
        robots: [robotsRec("User-agent: *\nDisallow:", 200)],
        sitemaps: [sitemapRec(MAP, "default", null, { status })],
      });
      expect(r.result, String(status)).toBe("FAIL");
      expect(r.points).toBe(0);
      expect((r.evidence as { branch: string }).branch).toBe("not_found");
    }
    const declared = run("S1.03", pages, {
      robots: [robotsWithSitemap(`${ORIGIN}/gone.xml`)],
      sitemaps: [sitemapRec(`${ORIGIN}/gone.xml`, "declared", null, { status: 404 })],
    });
    expect(declared.result).toBe("FAIL");
  });

  it("is FAIL when robots.txt is a 404 and the default sitemap is a 404", () => {
    const r = run("S1.03", pages, { robots: [robotsRec(null, 404)], sitemaps: [sitemapRec(MAP, "default", null, { status: 404 })] });
    expect(r.result).toBe("FAIL");
  });

  it("takes the best declared sitemap: one valid among several is PASS, a malformed one beats a missing one", () => {
    const a = `${ORIGIN}/a.xml`;
    const b = `${ORIGIN}/b.xml`;
    const robots = [robotsRec(`Sitemap: ${a}\nSitemap: ${b}\n`)];
    const valid = run("S1.03", pages, {
      robots,
      sitemaps: [sitemapRec(a, "declared", null, { status: 404 }), sitemapRec(b, "declared", urlset([HOME]))],
    });
    expect(valid.result).toBe("PASS");
    const partial = run("S1.03", pages, {
      robots,
      sitemaps: [sitemapRec(a, "declared", null, { status: 404 }), sitemapRec(b, "declared", "garbage")],
    });
    expect(partial.result).toBe("PARTIAL");
  });

  it("is SCAN_ERROR for a 5xx reply or a timeout, never a failure", () => {
    for (const over of [{ status: 500 }, { status: 503 }, { status: null, error: { code: "TIMEOUT" as const, message: "t" } }]) {
      const r = run("S1.03", pages, {
        robots: [robotsRec(null, 404)],
        sitemaps: [sitemapRec(MAP, "default", null, over)],
      });
      expect(r.result).toBe("SCAN_ERROR");
      expect(r.points).toBeNull();
      expect(r.maxPoints).toBe(20);
    }
  });

  it("is NOT_OBSERVED when the sitemap request was refused (401, 403, 429)", () => {
    for (const status of [401, 403, 429]) {
      const r = run("S1.03", pages, {
        robots: [robotsRec(null, 404)],
        sitemaps: [sitemapRec(MAP, "default", null, { status })],
      });
      expect(r.result, String(status)).toBe("NOT_OBSERVED");
    }
  });

  it("is NOT_OBSERVED when no sitemap request was recorded", () => {
    const r = run("S1.03", pages, { robots: [robotsRec(null, 404)] });
    expect(r.result).toBe("NOT_OBSERVED");
    expect(r.maxPoints).toBe(20);
  });

  it("is NOT_OBSERVED, not FAIL, when the default sitemap is missing but robots.txt could not be read", () => {
    for (const robots of [[robotsRec(null, 500)], []]) {
      const r = run("S1.03", pages, { robots, sitemaps: [sitemapRec(MAP, "default", null, { status: 404 })] });
      expect(r.result).toBe("NOT_OBSERVED");
    }
  });

  it("does not let an unreadable robots.txt hide a sitemap that was found", () => {
    const r = run("S1.03", pages, {
      robots: [robotsRec(null, 500)],
      sitemaps: [sitemapRec(MAP, "default", urlset([HOME]))],
    });
    expect(r.result).toBe("PASS");
  });
});

describe("S1.04 Canonical URL is consistent", () => {
  const canon = (href: string): string => doc(`<link rel="canonical" href="${href}">`);
  const about = (html: string, over: Partial<FetchRecord> = {}): Spec => ({ path: "/about", html, record: over });

  it("is PASS when the single canonical equals the page's own address", () => {
    const r = run("S1.04", [about(canon("https://example.ie/about"))]);
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(20);
    expect(pageEvidence(r)[0].branch).toBe("self_canonical");
  });

  it("compares normalised URLs: trailing slash, fragments, relative hrefs and default ports", () => {
    for (const href of ["https://example.ie/about/", "https://example.ie/about#top", "/about", "https://EXAMPLE.ie:443/about"]) {
      expect(run("S1.04", [about(canon(href))]).result, href).toBe("PASS");
    }
  });

  it("upper-cases percent-escape hex on both sides but does not decode escapes", () => {
    const accented: Spec = { path: "/caf%C3%A9", html: canon("/caf%c3%a9") };
    expect(run("S1.04", [accented]).result).toBe("PASS");
    expect(run("S1.04", [about(canon("https://example.ie/a%62out"))]).result).toBe("PARTIAL");
  });

  it("accepts a canonical supplied only in a Link response header", () => {
    const r = run("S1.04", [about(doc(), { headers: { link: '<https://example.ie/about>; rel="canonical"' } })]);
    expect(r.result).toBe("PASS");
    expect(String(((pageEvidence(r)[0].canonicals as string[])[0]))).toContain("header");
  });

  it("treats a head canonical and a Link header canonical that agree as one canonical", () => {
    const r = run("S1.04", [about(canon("https://example.ie/about"), { headers: { link: '<https://example.ie/about>; rel="canonical"' } })]);
    expect(r.result).toBe("PASS");
    expect(pageEvidence(r)[0].canonicalCount).toBe(2);
  });

  it("treats two head canonicals that agree as one canonical", () => {
    const html = doc('<link rel="canonical" href="https://example.ie/about"><link rel="canonical" href="https://example.ie/about/">');
    expect(run("S1.04", [about(html)]).result).toBe("PASS");
  });

  it("scores 0 for conflicting canonicals, whether in the head or between head and header", () => {
    const twoHead = doc('<link rel="canonical" href="https://example.ie/about"><link rel="canonical" href="https://example.ie/other">');
    const r = run("S1.04", [about(twoHead)]);
    expect(r.result).toBe("FAIL");
    expect(pageEvidence(r)[0].branch).toBe("conflicting");
    const mixed = run("S1.04", [about(canon("https://example.ie/about"), { headers: { link: '<https://example.ie/different>; rel="canonical"' } })]);
    expect(pageEvidence(mixed)[0].branch).toBe("conflicting");
  });

  it("scores 0.5 when the single canonical points to a different page on the same site", () => {
    for (const href of [
      "https://example.ie/other",
      "https://www.example.ie/about",
      "http://example.ie/about",
      "https://example.ie/about?page=2",
      "https://example.ie/",
    ]) {
      const r = run("S1.04", [about(canon(href))]);
      expect(r.result, href).toBe("PARTIAL");
      expect(r.points).toBe(10);
      expect(pageEvidence(r)[0].branch).toBe("other_same_site");
    }
  });

  it("scores 0 when the canonical points to another site", () => {
    const r = run("S1.04", [about(canon("https://other.example/about"))]);
    expect(r.result).toBe("FAIL");
    expect(pageEvidence(r)[0].branch).toBe("cross_site");
    expect(pageEvidence(r)[0].canonical).toBe("https://other.example/about");
  });

  it("records a cross-site homepage canonical in evidence for the CF-06 finding", () => {
    const r = run("S1.04", [{ html: canon("https://other.example/") }]);
    expect(pageEvidence(r)[0]).toMatchObject({ url: HOME, branch: "cross_site" });
  });

  it("scores 0 when there is no canonical", () => {
    const r = run("S1.04", [about(doc())]);
    expect(r.result).toBe("FAIL");
    expect(pageEvidence(r)[0].branch).toBe("missing");
    expect(pageEvidence(r)[0].canonicalCount).toBe(0);
  });

  it("scores 0 for an empty, unparsable or non-HTTP canonical", () => {
    for (const href of ["", "javascript:void(0)", "mailto:a@example.ie", "ftp://example.ie/about", "https://"]) {
      const r = run("S1.04", [about(canon(href))]);
      expect(r.result, href).toBe("FAIL");
      expect(pageEvidence(r)[0].branch, href).toBe("unusable");
    }
  });

  it("ignores an unusable canonical when exactly one usable canonical exists (conservative reading)", () => {
    const html = doc('<link rel="canonical" href=""><link rel="canonical" href="https://example.ie/about">');
    const r = run("S1.04", [about(html)]);
    expect(r.result).toBe("PASS");
    expect(pageEvidence(r)[0].ignoredUnusable).toBe(1);
  });

  it("compares with the final URL after redirects", () => {
    const r = run("S1.04", [
      { path: "/old", html: canon("https://example.ie/new"), record: { finalUrl: `${ORIGIN}/new`, redirectChain: hops(1) } },
    ]);
    expect(r.result).toBe("PASS");
    expect(pageEvidence(r)[0].ownUrl).toBe(`${ORIGIN}/new`);
  });

  it("ignores link elements that are not rel=canonical", () => {
    const html = doc('<link rel="alternate canonical-ish" href="https://other.example/"><link rel="stylesheet" href="/a.css">');
    expect(run("S1.04", [about(html)]).result).toBe("FAIL");
  });

  it("averages page scores across the branches: [1, 0.5, 0, 0, 0] gives 6 of 20", () => {
    const r = run("S1.04", [
      { path: "/", html: canon("https://example.ie/") },
      about(canon("https://www.example.ie/about")),
      { path: "/faq", html: doc() },
      { path: "/services", html: canon("https://other.example/services") },
      { path: "/blog/post", html: doc('<link rel="canonical" href="https://example.ie/a"><link rel="canonical" href="https://example.ie/b">') },
    ]);
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(6);
    expect(pageEvidence(r).map((e) => e.s_p)).toEqual([1, 0.5, 0, 0, 0]);
  });

  it("still reads a render-dependent page, because it only needs the head", () => {
    const r = run("S1.04", [{ path: "/about", html: doc('<link rel="canonical" href="https://example.ie/about">', SPA_BODY) }]);
    expect(r.result).toBe("PASS");
  });

  it("leaves unreadable pages out of the mean and flags a majority of them", () => {
    expect(run("S1.04", [{ path: "/", html: canon("https://example.ie/") }, notFoundPage, { path: "/x", html: canon("https://example.ie/x") }]).result).toBe("PASS");
    expect(run("S1.04", [{ html: canon("https://example.ie/") }, fetchFailure, fetchFailure]).result).toBe("SCAN_ERROR");
  });
});

describe("S1.05 Page returns success directly", () => {
  const reply = (status: number | null, chain: RedirectHop[] = [], over: Partial<FetchRecord> = {}): Spec => ({
    html: doc(),
    record: { status, redirectChain: chain, ...over },
  });

  it("is PASS for a direct 2xx response and for one redirect hop", () => {
    for (const status of [200, 201, 204, 299]) {
      expect(run("S1.05", [reply(status)]).result, String(status)).toBe("PASS");
    }
    const direct = run("S1.05", [reply(200)]);
    expect(direct.points).toBe(10);
    expect(pageEvidence(direct)[0].branch).toBe("direct");
    const one = run("S1.05", [reply(200, hops(1))]);
    expect(one.result).toBe("PASS");
    expect(pageEvidence(one)[0].branch).toBe("one_redirect");
    expect(pageEvidence(one)[0].redirectHops).toBe(1);
  });

  it.each([
    [0, "PASS", 10],
    [1, "PASS", 10],
    [2, "PARTIAL", 5],
    [3, "PARTIAL", 5],
    [4, "FAIL", 0],
    [6, "FAIL", 0],
  ] as const)("a 200 reached after %i hops gives %s with %f points", (count, code, points) => {
    const r = run("S1.05", [reply(200, hops(count))]);
    expect(r.result).toBe(code);
    expect(r.points).toBe(points);
  });

  it("is FAIL for a final 4xx or 5xx status, however direct", () => {
    for (const status of [400, 403, 404, 410, 500, 502, 503]) {
      const r = run("S1.05", [reply(status)]);
      expect(r.result, String(status)).toBe("FAIL");
      expect(pageEvidence(r)[0].branch).toBe("error_status");
    }
    expect(run("S1.05", [reply(404, hops(1))]).result).toBe("FAIL");
  });

  it("is FAIL when the fetch layer gave up on too many redirects", () => {
    const r = run("S1.05", [
      reply(302, hops(4, 302), { error: { code: "TOO_MANY_REDIRECTS", message: "limit" } }),
    ]);
    expect(r.result).toBe("FAIL");
    expect(pageEvidence(r)[0].branch).toBe("too_many_redirects");
    expect(pageEvidence(r)[0].redirectHops).toBe(4);
  });

  it("is SCAN_ERROR for a redirect loop, a blocked redirect or no response, never a failure", () => {
    const cases: Spec[] = [
      reply(302, hops(2, 302), { error: { code: "REDIRECT_LOOP", message: "loop" } }),
      reply(302, hops(1, 302), { error: { code: "REDIRECT_BLOCKED", message: "blocked" } }),
      reply(null, [], { error: { code: "CONNECT_REFUSED", message: "refused" } }),
      reply(null, [], { error: { code: "TIMEOUT", message: "timed out" } }),
      reply(302, hops(1, 302)),
    ];
    for (const spec of cases) {
      const r = run("S1.05", [spec]);
      expect(r.result).toBe("SCAN_ERROR");
      expect(r.points).toBeNull();
      expect(r.maxPoints).toBe(10);
    }
    const loop = run("S1.05", [cases[0]]);
    expect(String(pageEvidence(loop)[0].reason)).toContain("REDIRECT_LOOP");
    const blocked = run("S1.05", [cases[1]]);
    expect(String(pageEvidence(blocked)[0].reason)).toContain("REDIRECT_BLOCKED");
  });

  it("is NOT_OBSERVED for a page the scanner's own robots.txt rules blocked", () => {
    expect(run("S1.05", [robotsBlockedPage]).result).toBe("NOT_OBSERVED");
  });

  it("uses the status even when the body was rejected for size or type", () => {
    const rejected = run("S1.05", [
      reply(200, [], { body: null, contentType: "application/pdf", error: { code: "CONTENT_TYPE_REJECTED", message: "pdf" } }),
    ]);
    expect(rejected.result).toBe("PASS");
    const large = run("S1.05", [reply(200, [], { error: { code: "RESPONSE_TOO_LARGE", message: "big" } })]);
    expect(large.result).toBe("PASS");
  });

  it("does not penalise a 403, 429 or 503 that the scanner identified as a bot challenge", () => {
    const challenged = (status: number): Spec => reply(status, [], { headers: { "cf-mitigated": "challenge" } });
    for (const status of [403, 429, 503]) {
      const r = run("S1.05", [reply(200), reply(200), challenged(status)]);
      expect(r.result, String(status)).toBe("PASS");
      expect(pageEvidence(r)[2].status).toBe("not_observed");
    }
    const unchallenged = run("S1.05", [reply(200), reply(200), reply(403)]);
    expect(unchallenged.result).toBe("PARTIAL");
    expect(unchallenged.points).toBeCloseTo(6.67, 2);
  });

  it("averages page scores: [1, 0.5, 0] gives 5 of 10", () => {
    const r = run("S1.05", [reply(200, hops(1)), reply(200, hops(3)), reply(404)]);
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(5);
  });

  it("applies to pages whose HTML could not be parsed, such as a 404", () => {
    const r = run("S1.05", [{ html: doc() }, notFoundPage, { html: doc() }]);
    expect(r.result).toBe("PARTIAL");
    expect(pageEvidence(r)[1].s_p).toBe(0);
  });

  it("flags a majority of unobserved pages", () => {
    expect(run("S1.05", [reply(200), fetchFailure, fetchFailure]).result).toBe("SCAN_ERROR");
    expect(run("S1.05", [reply(200), robotsBlockedPage, robotsBlockedPage]).result).toBe("NOT_OBSERVED");
  });

  it("records the redirect statuses and the final URL in evidence", () => {
    const r = run("S1.05", [
      { path: "/old", html: doc(), record: { status: 200, redirectChain: [...hops(1, 301), ...hops(1, 302)], finalUrl: `${ORIGIN}/new` } },
    ]);
    expect(pageEvidence(r)[0]).toMatchObject({ httpStatus: 200, redirectHops: 2, redirectStatuses: [301, 302], finalUrl: `${ORIGIN}/new`, branch: "two_or_three_redirects" });
  });
});
