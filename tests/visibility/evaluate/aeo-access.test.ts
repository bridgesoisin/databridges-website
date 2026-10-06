import { describe, expect, it } from "vitest";
import { buildEvalContext } from "@/lib/visibility/context";
import { evaluateA1 } from "@/lib/visibility/evaluate/aeo-access";
import { normaliseUrl } from "@/lib/visibility/normalise";
import { CANDIDATE_EXCLUSIONS, PAGE_TYPES } from "@/lib/visibility/types";
import type {
  CandidateExclusion,
  EvalContext,
  FetchError,
  FetchRecord,
  MetricResult,
  PageType,
  SampledPage,
  ScanSnapshot,
} from "@/lib/visibility/types";

const SCANNED_AT = "2026-10-02T09:15:00.000Z";
const NOW = new Date(SCANNED_AT);
const HOME = "https://example.ie/";
const ORIGIN = "https://example.ie";

const words = (n: number, prefix = "word"): string =>
  Array.from({ length: n }, (_, i) => `${prefix}${i}`).join(" ");

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

function fail(code: FetchError["code"]): FetchError {
  return { code, message: code };
}

function html(opts: { head?: string; body?: string; lang?: string; title?: string } = {}): string {
  const lang = opts.lang === undefined ? ' lang="en"' : opts.lang === "" ? "" : ` lang="${opts.lang}"`;
  const body = opts.body ?? `<main><h1>Heading</h1><p>${words(80)}</p></main>`;
  return `<!doctype html><html${lang}><head><title>${opts.title ?? "A page title"}</title>${opts.head ?? ""}</head><body>${body}</body></html>`;
}

const SPA_SHELL = `<!doctype html><html lang="en"><head><title>App</title></head><body><div id="root"></div><noscript>You need to enable JavaScript to run this app.</noscript></body></html>`;

type PageSpec = {
  path: string;
  type: PageType;
  body?: string | null;
  over?: Partial<FetchRecord>;
};

function sampled(spec: PageSpec): SampledPage {
  const url = normaliseUrl(spec.path, HOME) as string;
  const depth = new URL(url).pathname.split("/").filter((s) => s !== "").length;
  return {
    url,
    type: spec.type,
    reason: `test ${spec.type}`,
    depth,
    record: record(url, { body: spec.body === undefined ? html() : spec.body, ...spec.over }),
  };
}

const home = (body: string | null = html(), over: Partial<FetchRecord> = {}): PageSpec => ({
  path: "/",
  type: "home",
  body,
  over,
});

function zeroed<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
}

type RobotsSpec = { status: number | null; body?: string | null; over?: Partial<FetchRecord> } | null;

function contextFor(
  pages: PageSpec[],
  opts: { robots?: RobotsSpec; llms?: FetchRecord | null } = {},
): EvalContext {
  const robotsSpec = opts.robots === undefined ? { status: 404 } : opts.robots;
  const robots =
    robotsSpec === null
      ? []
      : [
          {
            origin: ORIGIN,
            record: record(`${ORIGIN}/robots.txt`, {
              kind: "robots",
              status: robotsSpec.status,
              body: robotsSpec.body ?? null,
              contentType: "text/plain",
              ...robotsSpec.over,
            }),
          },
        ];
  const snapshot: ScanSnapshot = {
    snapshotVersion: 1,
    scannerVersion: "test",
    inputUrl: HOME,
    homeUrl: HOME,
    scannedAt: SCANNED_AT,
    outcome: "COMPLETED",
    outcomeDetail: null,
    scannerRegion: null,
    httpsAttempt: null,
    robots,
    sitemaps: [],
    llms: opts.llms === undefined ? null : opts.llms,
    httpVariant: null,
    timing: [],
    linkChecks: [],
    pages: pages.map(sampled),
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
  return buildEvalContext(snapshot, NOW);
}

function llms(over: Partial<FetchRecord> = {}): FetchRecord {
  return record(`${ORIGIN}/llms.txt`, {
    kind: "llms",
    contentType: "text/plain; charset=utf-8",
    ...over,
  });
}

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) strings(item, out);
  else if (typeof value === "object" && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      out.push(key);
      strings(item, out);
    }
  }
  return out;
}

function checked(results: MetricResult[]): Record<string, MetricResult> {
  const byId: Record<string, MetricResult> = {};
  for (const r of results) {
    byId[r.metricId] = r;
    expect(r.metricVersion).toBe(1);
    expect(r.reviewedBy).toBeNull();
    expect(r.explanation).toMatch(/^[^\n]+\.$/);
    expect(JSON.parse(JSON.stringify(r.evidence))).toEqual(r.evidence);
    for (const text of strings(r.evidence)) expect(text.length).toBeLessThanOrEqual(200);
    if (r.result === "PASS") expect(r.points).toBe(r.maxPoints);
    if (r.result === "FAIL") expect(r.points).toBe(0);
    if (r.result === "PARTIAL") {
      expect(r.points).toBeGreaterThan(0);
      expect(r.points as number).toBeLessThan(r.maxPoints as number);
    }
    if (r.result === "NOT_APPLICABLE") {
      expect(r.points).toBeNull();
      expect(r.maxPoints).toBeNull();
    }
    if (r.result === "NOT_OBSERVED" || r.result === "SCAN_ERROR") {
      expect(r.points).toBeNull();
      expect(r.maxPoints).not.toBeNull();
    }
  }
  return byId;
}

function run(ctx: EvalContext): Record<string, MetricResult> {
  return checked(evaluateA1(ctx));
}

function pagesOf(result: MetricResult): Record<string, unknown>[] {
  return result.evidence as Record<string, unknown>[];
}

const AI_ALL = "User-agent: OAI-SearchBot\nUser-agent: PerplexityBot\nUser-agent: Claude-SearchBot\nDisallow: /\n";

describe("evaluateA1: shape", () => {
  it("returns one result per A1 metric in id order with the plan's point values", () => {
    const results = evaluateA1(contextFor([home()]));
    expect(results.map((r) => r.metricId)).toEqual(["A1.01", "A1.02", "A1.03", "A1.04"]);
    expect(results.map((r) => r.result === "NOT_APPLICABLE" ? null : r.maxPoints)).toEqual([40, 15, 5, 40]);
  });

  it("is deterministic: the same context scores identically twice", () => {
    const ctx = contextFor([home(), { path: "/services", type: "services" }], { robots: { status: 200, body: AI_ALL } });
    expect(evaluateA1(ctx)).toEqual(evaluateA1(ctx));
  });
});

describe("A1.01 AI search and answer crawlers allowed", () => {
  const three = [home(), { path: "/services", type: "services" as const }, { path: "/blog/post", type: "article" as const }];

  it("PASS when robots.txt is absent (4xx means allowed)", () => {
    const r = run(contextFor(three))["A1.01"];
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(40);
    const rows = pagesOf(r);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      branch: "all_allowed",
      robotsState: "not_found",
      agents: { "OAI-SearchBot": true, PerplexityBot: true, "Claude-SearchBot": true },
      allowed: 3,
      of: 3,
      s_p: 1,
    });
    expect(r.explanation).toBe("robots.txt allows 9 of 9 combinations of AI search crawler and sampled page.");
  });

  it("PASS when robots.txt allows everything explicitly", () => {
    const r = run(contextFor(three, { robots: { status: 200, body: "User-agent: *\nAllow: /\n" } }))["A1.01"];
    expect(r.result).toBe("PASS");
    expect(pagesOf(r)[0]).toMatchObject({ robotsState: "found" });
  });

  it("PASS for a 403 robots.txt (any 4xx counts as allowed)", () => {
    expect(run(contextFor(three, { robots: { status: 403 } }))["A1.01"].result).toBe("PASS");
  });

  it("PARTIAL 2/3 when one agent is blocked site-wide", () => {
    const body = "User-agent: PerplexityBot\nDisallow: /\n";
    const r = run(contextFor(three, { robots: { status: 200, body } }))["A1.01"];
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(26.67);
    expect(pagesOf(r)[0]).toMatchObject({
      branch: "partly_blocked",
      agents: { "OAI-SearchBot": true, PerplexityBot: false, "Claude-SearchBot": true },
      allowed: 2,
    });
    expect(r.explanation).toContain("6 of 9");
  });

  it("FAIL when all three agents are blocked", () => {
    const r = run(contextFor(three, { robots: { status: 200, body: AI_ALL } }))["A1.01"];
    expect(r.result).toBe("FAIL");
    expect(r.points).toBe(0);
    expect(pagesOf(r)[0]).toMatchObject({ branch: "all_blocked", allowed: 0, s_p: 0 });
  });

  it("scores a path-level block per page and averages the pages", () => {
    const body = "User-agent: OAI-SearchBot\nDisallow: /blog\n";
    const r = run(contextFor(three, { robots: { status: 200, body } }))["A1.01"];
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(35.56);
    expect(pagesOf(r).map((row) => row.allowed)).toEqual([3, 3, 2]);
  });

  it("falls back to the wildcard group for an agent without its own group", () => {
    const body = "User-agent: *\nDisallow: /\n\nUser-agent: OAI-SearchBot\nAllow: /\n";
    const r = run(contextFor(three, { robots: { status: 200, body } }))["A1.01"];
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(13.33);
    expect(pagesOf(r)[0]).toMatchObject({
      agents: { "OAI-SearchBot": true, PerplexityBot: false, "Claude-SearchBot": false },
    });
  });

  it("uses longest-match precedence and lets Allow win a tie", () => {
    const body = `${AI_ALL}\nUser-agent: OAI-SearchBot\nUser-agent: PerplexityBot\nUser-agent: Claude-SearchBot\nAllow: /services\n`;
    const r = run(contextFor(three, { robots: { status: 200, body } }))["A1.01"];
    expect(pagesOf(r).map((row) => row.allowed)).toEqual([0, 3, 0]);
  });

  it("matches agent tokens case-insensitively", () => {
    const body = "user-agent: CLAUDE-SEARCHBOT\ndisallow: /\n";
    const r = run(contextFor(three, { robots: { status: 200, body } }))["A1.01"];
    expect(pagesOf(r)[0]).toMatchObject({ agents: { "Claude-SearchBot": false, PerplexityBot: true } });
  });

  it("ignores training, user-initiated and classic search agents", () => {
    const body = [
      "User-agent: GPTBot",
      "User-agent: ClaudeBot",
      "User-agent: Google-Extended",
      "User-agent: CCBot",
      "User-agent: ChatGPT-User",
      "User-agent: Claude-User",
      "User-agent: Googlebot",
      "User-agent: bingbot",
      "Disallow: /",
    ].join("\n");
    const r = run(contextFor(three, { robots: { status: 200, body } }))["A1.01"];
    expect(r.result).toBe("PASS");
  });

  it("counts a page that could not be fetched, because the rule reads robots.txt only", () => {
    const ctx = contextFor(
      [home(), { path: "/gone", type: "other", body: null, over: { status: 404 } }],
      { robots: { status: 200, body: "User-agent: *\nDisallow: /gone\n" } },
    );
    const r = run(ctx)["A1.01"];
    expect(r.result).toBe("PARTIAL");
    expect(pagesOf(r).map((row) => row.allowed)).toEqual([3, 0]);
  });

  it("counts a page the scanner's own agent was blocked from fetching", () => {
    const ctx = contextFor([
      home(),
      { path: "/private", type: "other", body: null, over: { status: null, error: fail("ROBOTS_DISALLOWED") } },
    ]);
    expect(run(ctx)["A1.01"].result).toBe("PASS");
  });

  it("is SCAN_ERROR when robots.txt returned a 5xx response", () => {
    const r = run(contextFor(three, { robots: { status: 503, body: "busy" } }))["A1.01"];
    expect(r.result).toBe("SCAN_ERROR");
    expect(r.points).toBeNull();
    expect(r.maxPoints).toBe(40);
    expect(pagesOf(r)[0]).toMatchObject({ branch: "robots_unreadable", robotsState: "error" });
  });

  it("is SCAN_ERROR when the robots.txt request timed out", () => {
    const r = run(
      contextFor(three, { robots: { status: null, over: { error: fail("TIMEOUT") } } }),
    )["A1.01"];
    expect(r.result).toBe("SCAN_ERROR");
  });

  it("is SCAN_ERROR for a 2xx robots.txt the fetch layer refused on content type", () => {
    const r = run(
      contextFor(three, { robots: { status: 200, body: null, over: { error: fail("CONTENT_TYPE_REJECTED") } } }),
    )["A1.01"];
    expect(r.result).toBe("SCAN_ERROR");
  });

  it("is NOT_OBSERVED when no robots.txt record exists for the origin", () => {
    const r = run(contextFor(three, { robots: null }))["A1.01"];
    expect(r.result).toBe("NOT_OBSERVED");
    expect(r.points).toBeNull();
    expect(r.maxPoints).toBe(40);
    expect(pagesOf(r)[0]).toMatchObject({ robotsState: "not_fetched", agents: { PerplexityBot: null } });
  });

  it("is NOT_OBSERVED when the robots.txt request was never made", () => {
    const r = run(
      contextFor(three, { robots: { status: null, over: { error: fail("REQUEST_CAP_REACHED") } } }),
    )["A1.01"];
    expect(r.result).toBe("NOT_OBSERVED");
  });

  it("scores only the pages whose origin has a readable robots.txt when at least half are observed", () => {
    const ctx = contextFor(
      [home(), { path: "/services", type: "services" }, { path: "/team", type: "about" }],
      { robots: { status: 200, body: "User-agent: *\nDisallow: /team\n" } },
    );
    expect(run(ctx)["A1.01"].points).toBe(26.67);

    const offsite: PageSpec = { path: "https://www.example.ie/x", type: "other" };
    const mixed = run(contextFor([home(), { path: "/services", type: "services" }, offsite]))["A1.01"];
    expect(mixed.result).toBe("PASS");
    expect(pagesOf(mixed)[2]).toMatchObject({ status: "not_observed", robotsState: "not_fetched" });
  });

  it("is NOT_OBSERVED when fewer than half of the pages have a readable origin", () => {
    const ctx = contextFor([
      home(),
      { path: "https://www.example.ie/a", type: "other" },
      { path: "https://www.example.ie/b", type: "other" },
    ]);
    expect(run(ctx)["A1.01"].result).toBe("NOT_OBSERVED");
  });

  it("is NOT_OBSERVED when no page was sampled", () => {
    const r = run(contextFor([]))["A1.01"];
    expect(r.result).toBe("NOT_OBSERVED");
    expect(r.maxPoints).toBe(40);
  });
});

describe("A1.02 snippet and preview eligibility", () => {
  const metaPage = (content: string, name = "robots"): PageSpec => ({
    path: "/",
    type: "home",
    body: html({ head: `<meta name="${name}" content="${content}">` }),
  });

  it.each([
    ["no directive at all", html(), 1, "no_snippet_restriction"],
    ["only noindex (indexing is S1.01's concern)", html({ head: '<meta name="robots" content="noindex, nofollow">' }), 1, "no_snippet_restriction"],
    ["max-snippet:-1 (no limit)", html({ head: '<meta name="robots" content="max-snippet:-1">' }), 1, "no_snippet_restriction"],
    ["max-snippet:50 (first value above the band)", html({ head: '<meta name="robots" content="max-snippet:50">' }), 1, "no_snippet_restriction"],
    ["max-snippet:160", html({ head: '<meta name="robots" content="max-image-preview:large, max-snippet:160">' }), 1, "no_snippet_restriction"],
    ["max-snippet:49 (top of the band)", html({ head: '<meta name="robots" content="max-snippet:49">' }), 0.5, "snippet_length_limited"],
    ["max-snippet:30", html({ head: '<meta name="robots" content="max-snippet:30">' }), 0.5, "snippet_length_limited"],
    ["max-snippet:1 (bottom of the band)", html({ head: '<meta name="robots" content="max-snippet:1">' }), 0.5, "snippet_length_limited"],
    ["max-snippet:0", html({ head: '<meta name="robots" content="max-snippet:0">' }), 0, "snippet_blocked"],
    ["nosnippet", html({ head: '<meta name="robots" content="nosnippet">' }), 0, "snippet_blocked"],
    ["none", html({ head: '<meta name="robots" content="none">' }), 0, "snippet_blocked"],
    ["uppercase directives", html({ head: '<meta name="robots" content="NOSNIPPET">' }), 0, "snippet_blocked"],
    ["spaces around the colon", html({ head: '<meta name="robots" content="max-snippet: 0">' }), 0, "snippet_blocked"],
    ["a non-numeric max-snippet value is ignored", html({ head: '<meta name="robots" content="max-snippet:abc">' }), 1, "no_snippet_restriction"],
    ["a decimal max-snippet value is ignored", html({ head: '<meta name="robots" content="max-snippet:30.5">' }), 1, "no_snippet_restriction"],
    ["the most restrictive of several limits wins", html({ head: '<meta name="robots" content="max-snippet:100, max-snippet:20">' }), 0.5, "snippet_length_limited"],
    ["a zero limit beats a banded one", html({ head: '<meta name="robots" content="max-snippet:20, max-snippet:0">' }), 0, "snippet_blocked"],
  ])("page score: %s", (_label, body, score, branch) => {
    const r = run(contextFor([{ path: "/", type: "home", body }]))["A1.02"];
    expect(pagesOf(r)[0]).toMatchObject({ s_p: score, branch });
    expect(r.points).toBe(15 * score);
    expect(r.result).toBe(score === 1 ? "PASS" : score === 0 ? "FAIL" : "PARTIAL");
  });

  it("reads the X-Robots-Tag header without an agent prefix", () => {
    const base = (value: string): PageSpec => ({
      path: "/",
      type: "home",
      body: html(),
      over: { headers: { "x-robots-tag": value } },
    });
    expect(run(contextFor([base("nosnippet")]))["A1.02"].result).toBe("FAIL");
    expect(run(contextFor([base("none")]))["A1.02"].result).toBe("FAIL");
    expect(run(contextFor([base("max-snippet:0")]))["A1.02"].result).toBe("FAIL");
    expect(run(contextFor([base("max-snippet:25")]))["A1.02"].points).toBe(7.5);
    expect(run(contextFor([base("noindex")]))["A1.02"].result).toBe("PASS");
    const r = run(contextFor([base("nosnippet")]))["A1.02"];
    expect(pagesOf(r)[0]).toMatchObject({ directives: ["header: nosnippet"] });
  });

  it("combines the meta tag and the header, taking the worse score", () => {
    const ctx = contextFor([
      {
        path: "/",
        type: "home",
        body: html({ head: '<meta name="robots" content="max-snippet:30">' }),
        over: { headers: { "x-robots-tag": "nosnippet" } },
      },
    ]);
    const r = run(ctx)["A1.02"];
    expect(r.result).toBe("FAIL");
    expect(pagesOf(r)[0].directives).toEqual(["meta: max-snippet:30", "header: nosnippet"]);
  });

  it("reads only directives that apply to every robot (conservative reading)", () => {
    const ctx = contextFor([
      {
        path: "/",
        type: "home",
        body: html({
          head: '<meta name="googlebot" content="nosnippet"><meta name="bingbot" content="max-snippet:0">',
        }),
        over: { headers: { "x-robots-tag": "googlebot: nosnippet, otherbot: none" } },
      },
    ]);
    expect(run(ctx)["A1.02"].result).toBe("PASS");
  });

  it("evaluates a render-dependent page, because it reads the head only", () => {
    const shell = SPA_SHELL.replace("<title>", '<meta name="robots" content="nosnippet"><title>');
    const r = run(contextFor([{ path: "/", type: "home", body: shell }]))["A1.02"];
    expect(r.result).toBe("FAIL");
    expect(pagesOf(r)[0].status).toBe("observed");
  });

  it("averages the pages and explains the split", () => {
    const ctx = contextFor([
      metaPage("index"),
      { path: "/services", type: "services", body: html({ head: '<meta name="robots" content="max-snippet:20">' }) },
      { path: "/about", type: "about", body: html({ head: '<meta name="robots" content="nosnippet">' }) },
      { path: "/faq", type: "faq", body: html() },
    ]);
    const r = run(ctx)["A1.02"];
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(9.38);
    expect(r.explanation).toBe("Of 4 observed pages, 2 allow full snippets, 1 limits the snippet length and 1 blocks snippets.");
  });

  it("lists at most eight directives and keeps the smallest limit", () => {
    const many = Array.from({ length: 12 }, (_, i) => `max-snippet:${40 - i}`).join(", ");
    const r = run(contextFor([metaPage(many)]))["A1.02"];
    const row = pagesOf(r)[0];
    expect((row.directives as string[]).length).toBe(8);
    expect(row.smallestLimit).toBe(29);
  });

  it("treats pages that failed to fetch as unobserved and applies the half rule", () => {
    const bad = (path: string): PageSpec => ({ path, type: "other", body: null, over: { status: 500 } });
    const okTwo = run(contextFor([home(), { path: "/a", type: "other" }, bad("/b")]))["A1.02"];
    expect(okTwo.result).toBe("PASS");
    expect(pagesOf(okTwo)[2]).toMatchObject({ status: "scan_error", fetchClass: "http_error", httpStatus: 500 });

    const tooFew = run(contextFor([home(), bad("/b"), bad("/c")]))["A1.02"];
    expect(tooFew.result).toBe("SCAN_ERROR");
    expect(tooFew.points).toBeNull();
  });

  it("marks robots-blocked and non-HTML pages NOT_OBSERVED", () => {
    const blocked: PageSpec = {
      path: "/x",
      type: "other",
      body: null,
      over: { status: null, error: fail("ROBOTS_DISALLOWED") },
    };
    const plain: PageSpec = {
      path: "/y",
      type: "other",
      body: null,
      over: { contentType: "application/pdf", error: fail("CONTENT_TYPE_REJECTED") },
    };
    const r = run(contextFor([home(), blocked, plain]))["A1.02"];
    expect(r.result).toBe("NOT_OBSERVED");
    expect(pagesOf(r).map((row) => row.status)).toEqual(["observed", "not_observed", "not_observed"]);
  });
});

describe("A1.03 llms.txt present", () => {
  const withLlms = (over: Partial<FetchRecord>): MetricResult =>
    run(contextFor([home()], { llms: llms(over) }))["A1.03"];

  it("PASS for a heading line and a markdown link", () => {
    const r = withLlms({ body: "# Example Ltd\n\n> Summary\n\n- [Services](https://example.ie/services): what we do\n" });
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(5);
    expect(r.evidence).toMatchObject({ branch: "structured", hasHeading: true, hasLink: true, httpStatus: 200 });
  });

  it("PASS for a heading and a bare URL", () => {
    expect(withLlms({ body: "# Example\nSee https://example.ie/about for details\n" }).result).toBe("PASS");
  });

  it("PASS when the file starts with a byte order mark", () => {
    expect(withLlms({ body: "﻿# Example\n[a](https://example.ie/a)\n" }).result).toBe("PASS");
  });

  it("accepts a heading indented by up to three spaces only", () => {
    expect(withLlms({ body: "   # Example\n[a](/a)\n" }).result).toBe("PASS");
    expect(withLlms({ body: "    # Example\n[a](/a)\n" }).result).toBe("PARTIAL");
  });

  it("PARTIAL 0.5 when there is a heading but no link", () => {
    const r = withLlms({ body: "# Example Ltd\n\nWe build things.\n" });
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(2.5);
    expect(r.evidence).toMatchObject({ branch: "no_recognisable_structure", hasHeading: true, hasLink: false });
  });

  it("PARTIAL 0.5 when there is a link but no heading", () => {
    const r = withLlms({ body: "Our site: [home](https://example.ie/)\n" });
    expect(r.result).toBe("PARTIAL");
    expect(r.evidence).toMatchObject({ hasHeading: false, hasLink: true });
  });

  it.each([
    ["an empty file", ""],
    ["plain prose", "Welcome to our site. We do things."],
    ["a second-level heading only", "## Docs\n[a](https://example.ie/a)\n"],
    ["a hashtag with no space", "#heading\n[a](https://example.ie/a)\n"],
    ["a hash that is not at the line start", "text # heading\n[a](https://example.ie/a)\n"],
    ["empty link parentheses", "# Title\n[a]()\n"],
    ["link text with no destination", "# Title\n[a] (https-less)\n"],
  ])("PARTIAL 0.5 for %s", (_label, body) => {
    const r = withLlms({ body });
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(2.5);
  });

  it("analyses the kept prefix of an oversized file", () => {
    const r = withLlms({
      body: "# Big\n[a](https://example.ie/a)\n",
      truncated: true,
      error: fail("RESPONSE_TOO_LARGE"),
    });
    expect(r.result).toBe("PASS");
    expect(r.evidence).toMatchObject({ truncated: true });
  });

  it("stays linear on a hostile file", () => {
    const started = Date.now();
    const r = withLlms({ body: "[".repeat(250000) });
    expect(r.result).toBe("PARTIAL");
    const r2 = withLlms({ body: "](".repeat(120000) });
    expect(r2.result).toBe("PARTIAL");
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it.each([404, 410, 400])("FAIL for a %i response (not found)", (status) => {
    const r = withLlms({ status, body: "Not found" });
    expect(r.result).toBe("FAIL");
    expect(r.points).toBe(0);
    expect(r.evidence).toMatchObject({ branch: "not_found", httpStatus: status });
  });

  it.each([401, 403, 429])("NOT_OBSERVED for a %i response (the server refused the scanner)", (status) => {
    const r = withLlms({ status, body: "denied" });
    expect(r.result).toBe("NOT_OBSERVED");
    expect(r.maxPoints).toBe(5);
    expect(r.evidence).toMatchObject({ branch: "refused" });
  });

  it("SCAN_ERROR for a 5xx response", () => {
    const r = withLlms({ status: 503, body: "busy" });
    expect(r.result).toBe("SCAN_ERROR");
    expect(r.maxPoints).toBe(5);
  });

  it("SCAN_ERROR when the request failed before any response", () => {
    const r = withLlms({ status: null, body: null, error: fail("CONNECTION_RESET") });
    expect(r.result).toBe("SCAN_ERROR");
    expect(r.evidence).toMatchObject({ branch: "request_failed", errorCode: "CONNECTION_RESET" });
  });

  it("NOT_OBSERVED when the request was never made", () => {
    for (const code of ["REQUEST_CAP_REACHED", "ROBOTS_DISALLOWED", "HOST_NOT_ALLOWLISTED"] as const) {
      const r = withLlms({ status: null, body: null, error: fail(code) });
      expect(r.result).toBe("NOT_OBSERVED");
      expect(r.evidence).toMatchObject({ branch: "not_attempted" });
    }
  });

  it("NOT_OBSERVED when a 2xx answer was not text (for example an HTML fallback page)", () => {
    const r = withLlms({
      status: 200,
      body: null,
      contentType: "text/html",
      error: fail("CONTENT_TYPE_REJECTED"),
    });
    expect(r.result).toBe("NOT_OBSERVED");
    expect(r.evidence).toMatchObject({ branch: "not_text" });
  });

  it("SCAN_ERROR when a 2xx body could not be decoded", () => {
    const r = withLlms({ status: 200, body: null, error: fail("DECODE_ERROR") });
    expect(r.result).toBe("SCAN_ERROR");
  });

  it("NOT_OBSERVED for an unresolved redirect", () => {
    const r = withLlms({ status: 301, body: null });
    expect(r.result).toBe("NOT_OBSERVED");
    expect(r.evidence).toMatchObject({ branch: "unresolved_response" });
  });

  it("NOT_OBSERVED when the snapshot holds no llms record", () => {
    const r = run(contextFor([home()], { llms: null }))["A1.03"];
    expect(r.result).toBe("NOT_OBSERVED");
    expect(r.maxPoints).toBe(5);
  });
});

describe("A1.04 primary content in the initial HTML", () => {
  const pageWithWords = (n: number): string =>
    html({ body: `<nav>${words(200, "menu")}</nav><main><h1>H</h1><p>${words(n)}</p></main>` });
  // The h1 adds one word, so a page with n paragraph words has n + 1 main-content words.

  it.each([
    [48, 0, "thin_content"],
    [49, 1, "content_in_initial_html"],
    [50, 1, "content_in_initial_html"],
    [51, 1, "content_in_initial_html"],
  ])("a page with %i paragraph words scores %i", (n, score, branch) => {
    const r = run(contextFor([{ path: "/", type: "home", body: pageWithWords(n) }]))["A1.04"];
    expect(pagesOf(r)[0]).toMatchObject({ s_p: score, branch, mainWords: n + 1, threshold: 50 });
    expect(r.points).toBe(40 * score);
    expect(r.result).toBe(score === 1 ? "PASS" : "FAIL");
  });

  it("counts main content only, not navigation words", () => {
    const body = html({ body: `<header><nav>${words(300, "menu")}</nav></header><main><h1>Hi</h1><p>${words(5)}</p></main>` });
    const r = run(contextFor([{ path: "/", type: "home", body }]))["A1.04"];
    expect(pagesOf(r)[0]).toMatchObject({ mainWords: 6, s_p: 0 });
  });

  it("uses the body fallback when there is no main element", () => {
    const body = html({ body: `<div><h1>Hi</h1><p>${words(70)}</p></div>` });
    const r = run(contextFor([{ path: "/", type: "home", body }]))["A1.04"];
    expect(r.result).toBe("PASS");
    expect(pagesOf(r)[0]).toMatchObject({ mainContentMethod: "body-fallback" });
  });

  it("scores a render-dependent page 0 with the markers as evidence", () => {
    const r = run(contextFor([{ path: "/", type: "home", body: SPA_SHELL }]))["A1.04"];
    expect(r.result).toBe("FAIL");
    expect(r.points).toBe(0);
    const row = pagesOf(r)[0];
    expect(row).toMatchObject({ branch: "render_dependent", renderDependent: true, mainWords: 0, s_p: 0 });
    expect(row.markers).toEqual(expect.arrayContaining(["#root"]));
  });

  it("carries the whole render-dependence penalty: observed pages, not NOT_OBSERVED", () => {
    const ctx = contextFor([
      { path: "/", type: "home", body: SPA_SHELL },
      { path: "/services", type: "services", body: SPA_SHELL },
      { path: "/about", type: "about", body: SPA_SHELL },
    ]);
    const r = run(ctx)["A1.04"];
    expect(r.result).toBe("FAIL");
    expect(pagesOf(r).every((row) => row.status === "observed")).toBe(true);
  });

  it("separates a genuinely thin server-rendered page from a render-dependent one", () => {
    const thin = html({ body: "<main><h1>Contact</h1><p>Call us.</p></main>" });
    const r = run(contextFor([{ path: "/", type: "home", body: thin }]))["A1.04"];
    expect(pagesOf(r)[0]).toMatchObject({ branch: "thin_content", renderDependent: false });
  });

  it("applies to home, about, services, faq, article and other pages only", () => {
    const thin = html({ body: "<main><p>Short.</p></main>" });
    const ctx = contextFor([
      home(),
      { path: "/contact", type: "contact", body: thin },
      { path: "/privacy", type: "legal", body: thin },
    ]);
    const r = run(ctx)["A1.04"];
    expect(r.result).toBe("PASS");
    expect(pagesOf(r)).toHaveLength(1);
  });

  it.each(["home", "about", "services", "faq", "article", "other"] as const)(
    "a thin %s page scores 0",
    (type) => {
      const thin = html({ body: "<main><p>Short.</p></main>" });
      const r = run(contextFor([{ path: type === "home" ? "/" : `/${type}`, type, body: thin }]))["A1.04"];
      expect(r.result).toBe("FAIL");
    },
  );

  it("averages pages: 2 of 4 with enough content gives 20 points", () => {
    const thin = html({ body: "<main><p>Short.</p></main>" });
    const ctx = contextFor([
      home(),
      { path: "/services", type: "services" },
      { path: "/about", type: "about", body: thin },
      { path: "/faq", type: "faq", body: SPA_SHELL },
    ]);
    const r = run(ctx)["A1.04"];
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(20);
    expect(r.explanation).toBe("2 of 4 observed content pages have 50 or more words of main content in the raw HTML.");
  });

  it("is NOT_APPLICABLE for a page whose language does not use word counts", () => {
    const ja = html({ lang: "ja", body: "<main><h1>見出し</h1><p>こんにちは世界</p></main>" });
    const r = run(contextFor([{ path: "/", type: "home", body: ja }]))["A1.04"];
    expect(r.result).toBe("NOT_APPLICABLE");
    expect(r.points).toBeNull();
    expect(r.maxPoints).toBeNull();
  });

  it.each(["zh", "ja-JP", "ko", "th"])("treats lang %s as word-count free", (lang) => {
    const body = html({ lang, body: "<main><p>短い</p></main>" });
    const r = run(contextFor([{ path: "/", type: "home", body }]))["A1.04"];
    expect(r.result).toBe("NOT_APPLICABLE");
    expect(pagesOf(r)[0]).toMatchObject({ branch: "word_count_not_applicable" });
  });

  it("leaves non-word-count pages out of the mean", () => {
    const ja = html({ lang: "ja", body: "<main><p>短い</p></main>" });
    const ctx = contextFor([home(), { path: "/services", type: "services", body: ja }]);
    const r = run(ctx)["A1.04"];
    expect(r.result).toBe("PASS");
  });

  it("is NOT_APPLICABLE when only contact and legal pages are sampled", () => {
    const ctx = contextFor([{ path: "/contact", type: "contact" }, { path: "/privacy", type: "legal" }]);
    expect(run(ctx)["A1.04"].result).toBe("NOT_APPLICABLE");
  });

  it("treats fetch failures as unobserved and applies the half rule", () => {
    const bad = (path: string): PageSpec => ({ path, type: "other", body: null, over: { status: null, error: fail("TIMEOUT") } });
    const ok = run(contextFor([home(), { path: "/a", type: "services" }, bad("/b")]))["A1.04"];
    expect(ok.result).toBe("PASS");
    expect(pagesOf(ok)[2]).toMatchObject({ status: "scan_error", fetchClass: "fetch_error", errorCode: "TIMEOUT" });

    const few = run(contextFor([home(), bad("/b"), bad("/c")]))["A1.04"];
    expect(few.result).toBe("SCAN_ERROR");
    expect(few.maxPoints).toBe(40);
  });

  it("is NOT_OBSERVED when the unobserved pages were blocked by the scanner's own robots rule", () => {
    const blocked = (path: string): PageSpec => ({
      path,
      type: "other",
      body: null,
      over: { status: null, error: fail("ROBOTS_DISALLOWED") },
    });
    const r = run(contextFor([home(), blocked("/b"), blocked("/c")]))["A1.04"];
    expect(r.result).toBe("NOT_OBSERVED");
  });

  it("is NOT_OBSERVED when no page was sampled", () => {
    expect(run(contextFor([]))["A1.04"].result).toBe("NOT_OBSERVED");
  });
});
