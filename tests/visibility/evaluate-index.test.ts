import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildEvalContext } from "@/lib/visibility/context";
import {
  CATEGORY_EVALUATORS,
  CORRECTION_ROUTE,
  canonicalJson,
  computeSnapshotHash,
  deriveCriticalFindings,
  evaluateSnapshot,
  scoreBands,
} from "@/lib/visibility/evaluate";
import { AI_AGENTS, isListStale } from "@/lib/visibility/lists";
import { METHODOLOGY, getMetricDefinition } from "@/lib/visibility/methodology";
import { runScan } from "@/lib/visibility/scan";
import { computeScoreSummary, notObserved, resultFromScore } from "@/lib/visibility/scoring";
import {
  CATEGORY_IDS,
  METRIC_IDS,
  type CategoryEvaluators,
  type CategoryId,
  type MetricResult,
  type ScanReport,
  type ScanSnapshot,
} from "@/lib/visibility/types";
import {
  createFixtureFetcher,
  createSiteFetcher,
  fixtureNames,
  loadFixture,
  type FixtureResource,
  type FixtureSite,
} from "./helpers/fixture-fetcher";

const NOW = new Date("2026-10-02T09:15:00.000Z");
const HTML = "text/html; charset=utf-8";
const ORIGIN = "https://example.ie";
const PAGE_PATHS = ["/services", "/about", "/faq", "/blog/post-one"];
const FORBIDDEN_WORDS = /\b(rank(s|ed|ing)?|grade[sd]?|worst|league|leaderboard|you will be cited|AI visibility score)\b/i;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const words = (n: number): string => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

function pageHtml(title: string, opts: { head?: string; body?: string } = {}): string {
  const links = PAGE_PATHS.map((p) => `<a href="${p}">Read about ${p.replace(/[^a-z]+/gi, " ").trim()}</a>`).join(" ");
  const body = opts.body ?? `<main><h1>${title}</h1><p>${words(90)}</p><p>${links}</p></main>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title} for the example site</title>${opts.head ?? ""}</head><body>${body}</body></html>`;
}

function page(body: string, extra: Partial<FixtureResource> = {}): FixtureResource {
  return {
    status: 200,
    headers: { "content-type": HTML },
    inlineBody: body,
    ttfbMs: 120,
    tls: { authorized: true, daysToExpiry: 90 },
    ...extra,
  };
}

function text(contentType: string, body: string): FixtureResource {
  return { status: 200, headers: { "content-type": contentType }, inlineBody: body, ttfbMs: 60 };
}

function urlset(paths: readonly string[]): string {
  const entries = paths.map((p) => `<url><loc>${ORIGIN}${p}</loc></url>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`;
}

type Resources = Record<string, FixtureResource>;

function coreResources(over: { home?: string; robots?: string } = {}): Resources {
  const resources: Resources = {
    [`${ORIGIN}/`]: page(over.home ?? pageHtml("Home"), { ttfbSamplesMs: [100, 120, 140] }),
    [`${ORIGIN}/robots.txt`]: text("text/plain; charset=utf-8", over.robots ?? "User-agent: *\nAllow: /\n"),
    [`${ORIGIN}/sitemap.xml`]: text("application/xml; charset=utf-8", urlset(PAGE_PATHS)),
    "http://example.ie/": { status: 301, headers: { location: `${ORIGIN}/` }, ttfbMs: 40 },
  };
  for (const path of PAGE_PATHS) resources[`${ORIGIN}${path}`] = page(pageHtml(path.slice(1)));
  return resources;
}

async function scan(resources: Resources, input = `${ORIGIN}/`, region?: string): Promise<ScanSnapshot> {
  const site: FixtureSite = { scannedAt: NOW.toISOString(), inputUrl: input, resources };
  return runScan(input, createSiteFetcher(site), {
    now: NOW,
    scannerVersion: "test-1",
    ...(region === undefined ? {} : { scannerRegion: region }),
  });
}

async function scanFixture(name: string): Promise<ScanSnapshot> {
  const fixture = loadFixture(name);
  return runScan(fixture.site.inputUrl, createFixtureFetcher(fixture), {
    now: new Date(fixture.site.scannedAt),
    scannerVersion: "test-1",
  });
}

function metric(report: ScanReport, id: string): MetricResult {
  const found = report.metrics.find((m) => m.metricId === id);
  if (found === undefined) throw new Error(`No metric ${id}`);
  return found;
}

const findingIds = (report: ScanReport): string[] => report.criticalFindings.map((f) => f.id);

async function completed(resources: Resources): Promise<ScanReport> {
  const snapshot = await scan(resources);
  expect(snapshot.outcome).toBe("COMPLETED");
  return evaluateSnapshot(snapshot, NOW);
}

async function findings(resources: Resources): Promise<string[]> {
  const snapshot = await scan(resources);
  expect(snapshot.outcome).toBe("COMPLETED");
  return findingIds(evaluateSnapshot(snapshot, NOW));
}

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) strings(item, out);
  else if (value !== null && typeof value === "object") for (const item of Object.values(value)) strings(item, out);
  return out;
}

function reverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).reverse()) out[key] = reverseKeys((value as Record<string, unknown>)[key]);
    return out;
  }
  return value;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function evaluators(over: Partial<Record<CategoryId, CategoryEvaluators[CategoryId]>>): CategoryEvaluators {
  return { ...CATEGORY_EVALUATORS, ...over };
}

function allNotObserved(id: CategoryId): MetricResult[] {
  const category = METHODOLOGY.categories.find((c) => c.id === id);
  if (category === undefined) throw new Error(`No category ${id}`);
  return category.metricIds.map((metricId) => notObserved(metricId, "Not observed in this test."));
}

function forEachCategory(make: (id: CategoryId) => CategoryEvaluators[CategoryId]): CategoryEvaluators {
  return {
    S1: make("S1"),
    S2: make("S2"),
    S3: make("S3"),
    S4: make("S4"),
    A1: make("A1"),
    A2: make("A2"),
    A3: make("A3"),
    A4: make("A4"),
  };
}

const INVISIBLE = /[\u{0}-\u{8}\u{B}-\u{1F}\u{7F}-\u{9F}\u{200B}-\u{200F}\u{202A}-\u{202E}\u{2060}-\u{2064}\u{2066}-\u{2069}\u{FEFF}]/u;

describe("evaluateSnapshot: report shape on a completed scan", () => {
  it("carries every contract field, the methodology order and the snapshot facts", async () => {
    const snapshot = await scanFixture("fx-strong");
    const report = evaluateSnapshot(snapshot, new Date(snapshot.scannedAt));

    expect(Object.keys(report).sort()).toEqual(
      [
        "reportVersion", "methodologyVersion", "scannerVersion", "scannedAt", "snapshotHash", "homeUrl", "outcome",
        "outcomeDetail", "coverage", "scores", "pagesSampled", "criticalFindings", "metrics", "informational",
        "listVersions", "staleLists", "limitations", "correctionRoute",
      ].sort(),
    );
    expect(report.reportVersion).toBe(1);
    expect(report.methodologyVersion).toBe(METHODOLOGY.version);
    expect(report.scannerVersion).toBe("test-1");
    expect(report.scannedAt).toBe(snapshot.scannedAt);
    expect(report.homeUrl).toBe(snapshot.homeUrl);
    expect(report.outcome).toBe("COMPLETED");
    expect(report.outcomeDetail).toBeNull();
    expect(report.correctionRoute).toBe("oisin@databridges.ie");
    expect(CORRECTION_ROUTE).toBe("oisin@databridges.ie");
    expect(report.listVersions).toEqual(METHODOLOGY.listVersions);
    expect(report.coverage).toBe(report.scores.coverage);
    expect(report.metrics.map((m) => m.metricId)).toEqual([...METRIC_IDS]);
    expect(report.metrics).toHaveLength(52);
    expect(Object.keys(report.scores.categories)).toEqual([...CATEGORY_IDS]);
  });

  it("scores exactly the metrics it reports", async () => {
    const report = evaluateSnapshot(await scanFixture("fx-minimal"), NOW);
    expect(report.scores).toEqual(computeScoreSummary(report.metrics));
  });

  it("summarises each sampled page from the evaluation context", async () => {
    const snapshot = await scanFixture("fx-spa-shell");
    const report = evaluateSnapshot(snapshot, new Date(snapshot.scannedAt));
    expect(report.pagesSampled.map((p) => p.url)).toEqual(snapshot.pages.map((p) => p.url));
    expect(report.pagesSampled[0]).toMatchObject({ type: "home", fetchClass: "ok", observed: true, renderDependent: true });
    expect(report.pagesSampled.every((p) => p.renderDependent)).toBe(true);
    expect(report.pagesSampled.every((p) => p.reason.length > 0)).toBe(true);
  });

  it("is JSON-safe: a round trip changes nothing", async () => {
    const report = evaluateSnapshot(await scanFixture("fx-strong"), NOW);
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  });

  it("returns the metrics in methodology order with the maxPoints convention", async () => {
    const report = evaluateSnapshot(await scanFixture("fx-minimal"), NOW);
    for (const result of report.metrics) {
      const definition = getMetricDefinition(result.metricId);
      if (result.result === "NOT_APPLICABLE") {
        expect(result.maxPoints).toBeNull();
        expect(result.points).toBeNull();
      } else {
        expect(result.maxPoints).toBe(definition.maxPoints);
      }
    }
  });
});

describe("evaluateSnapshot: the golden fixtures", () => {
  describe.each(fixtureNames())("%s", (name) => {
    it("agrees with the fixture on outcome, critical findings and which scores are withheld", async () => {
      const fixture = loadFixture(name);
      const snapshot = await scanFixture(name);
      const report = evaluateSnapshot(snapshot, new Date(snapshot.scannedAt));

      expect(report.outcome).toBe(fixture.expected.outcome === "SCORED" ? "COMPLETED" : fixture.expected.outcome);
      expect(findingIds(report)).toEqual(fixture.expected.criticalFindings);
      expect(report.metrics).toHaveLength(52);
      if (fixture.expected.scores !== null) {
        expect(report.scores.overall === null).toBe(fixture.expected.scores.overall === null);
        expect(report.scores.seo === null).toBe(fixture.expected.scores.seo === null);
        expect(report.scores.aeo === null).toBe(fixture.expected.scores.aeo === null);
        expect(report.coverage).toBe(fixture.expected.scores.coverage);
      }
    });

    it("holds its snapshot hash and produces a JSON-safe report", async () => {
      const snapshot = await scanFixture(name);
      const report = evaluateSnapshot(snapshot, new Date(snapshot.scannedAt));
      expect(report.snapshotHash).toBe(computeSnapshotHash(snapshot));
      expect(JSON.parse(JSON.stringify(report))).toEqual(report);
    });
  });

  it("keeps every evidence string in a hostile site short and free of control and bidi characters", async () => {
    const snapshot = await scanFixture("fx-hostile");
    const started = performance.now();
    const report = evaluateSnapshot(snapshot, new Date(snapshot.scannedAt));
    expect(performance.now() - started).toBeLessThan(20_000);

    const leaves = strings(report.metrics.map((m) => [m.evidence, m.explanation]));
    expect(leaves.length).toBeGreaterThan(100);
    for (const leaf of leaves) {
      expect(leaf.length).toBeLessThanOrEqual(200);
      expect(INVISIBLE.test(leaf)).toBe(false);
    }
    for (const finding of report.criticalFindings) expect(INVISIBLE.test(finding.summary)).toBe(false);
    for (const limitation of report.limitations) expect(INVISIBLE.test(limitation)).toBe(false);
    for (const pageSummary of report.pagesSampled) expect(INVISIBLE.test(pageSummary.reason)).toBe(false);
  });
});

describe("evaluateSnapshot: critical findings", () => {
  it("raises none on a clean site", async () => {
    expect(await findings(coreResources())).toEqual([]);
  });

  describe("CF-01 robots.txt disallows the root", () => {
    const wildcardBlockedOwnAllowed = "User-agent: DataBridgesBot\nAllow: /\n\nUser-agent: *\nDisallow: /\n";

    it("is raised, with CF-03, when the wildcard group disallows / and the scanner has its own allow group", async () => {
      const snapshot = await scan(coreResources({ robots: wildcardBlockedOwnAllowed }));
      expect(snapshot.outcome).toBe("COMPLETED");
      const report = evaluateSnapshot(snapshot, NOW);
      expect(findingIds(report)).toEqual(["CF-01", "CF-03"]);
      expect(report.criticalFindings[0].summary).toMatch(/^Detected: /);
      expect(report.criticalFindings[0].summary).toContain("all crawlers");
      expect(metric(report, "S1.02").result).toBe("FAIL");
      expect(metric(report, "A1.01").result).toBe("FAIL");
    });

    it("is raised for the Googlebot group alone, and then CF-03 is not", async () => {
      const report = evaluateSnapshot(
        await scan(coreResources({ robots: "User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nAllow: /\n" })),
        NOW,
      );
      expect(findingIds(report)).toEqual(["CF-01"]);
      expect(report.criticalFindings[0].summary).toContain("Googlebot");
      expect(report.criticalFindings[0].summary).not.toContain("all crawlers");
      expect(metric(report, "S1.02").result).toBe("PARTIAL");
    });

    it("is not raised when only a subdirectory is disallowed", async () => {
      expect(await findings(coreResources({ robots: "User-agent: *\nDisallow: /private\n" }))).toEqual([]);
    });

    it("is not raised when Allow: /$ keeps the root open", async () => {
      const ids = await findings(coreResources({ robots: "User-agent: *\nDisallow: /\nAllow: /$\n" }));
      expect(ids).not.toContain("CF-01");
      expect(ids).not.toContain("CF-03");
    });

    it("is not raised when robots.txt is missing or unreadable", async () => {
      const missing = coreResources();
      missing[`${ORIGIN}/robots.txt`] = { status: 404, ttfbMs: 40 };
      expect(await findings(missing)).toEqual([]);

      const broken = coreResources();
      broken[`${ORIGIN}/robots.txt`] = { status: 500, headers: { "content-type": "text/plain" }, inlineBody: "oops", ttfbMs: 40 };
      expect(await findings(broken)).toEqual([]);
    });
  });

  describe("CF-02 homepage noindex", () => {
    const metaHome = (content: string, name = "robots") =>
      pageHtml("Home", { head: `<meta name="${name}" content="${content}">` });

    it("is raised for a robots meta tag", async () => {
      expect(await findings(coreResources({ home: metaHome("noindex, follow") }))).toEqual(["CF-02"]);
    });

    it("is raised for none, for the googlebot and bingbot meta names, and for the X-Robots-Tag header", async () => {
      expect(await findings(coreResources({ home: metaHome("none") }))).toEqual(["CF-02"]);
      expect(await findings(coreResources({ home: metaHome("noindex", "googlebot") }))).toEqual(["CF-02"]);
      expect(await findings(coreResources({ home: metaHome("noindex", "bingbot") }))).toEqual(["CF-02"]);

      const header = coreResources();
      header[`${ORIGIN}/`] = page(pageHtml("Home"), {
        headers: { "content-type": HTML, "x-robots-tag": "noindex" },
        ttfbSamplesMs: [100, 120, 140],
      });
      expect(await findings(header)).toEqual(["CF-02"]);
    });

    it("is not raised when only another page carries noindex", async () => {
      const resources = coreResources();
      resources[`${ORIGIN}/about`] = page(pageHtml("about", { head: '<meta name="robots" content="noindex">' }));
      const report = await completed(resources);
      expect(findingIds(report)).toEqual([]);
      expect(metric(report, "S1.01").result).toBe("PARTIAL");
    });

    it("is not raised for noindex aimed at some other crawler or for index directives", async () => {
      expect(await findings(coreResources({ home: metaHome("noindex", "slurp") }))).toEqual([]);
      expect(await findings(coreResources({ home: metaHome("index, follow") }))).toEqual([]);
    });
  });

  describe("CF-03 AI search crawlers disallowed", () => {
    it("is raised when all three are disallowed for the homepage but classic search is open", async () => {
      const robots = [
        "User-agent: OAI-SearchBot",
        "User-agent: PerplexityBot",
        "User-agent: Claude-SearchBot",
        "Disallow: /",
        "",
        "User-agent: *",
        "Allow: /",
        "",
      ].join("\n");
      const report = await completed(coreResources({ robots }));
      expect(findingIds(report)).toEqual(["CF-03"]);
      expect(report.criticalFindings[0].summary).toContain("OAI-SearchBot");
      expect(metric(report, "A1.01").result).toBe("FAIL");
      expect(metric(report, "S1.02").result).toBe("PASS");
    });

    it("is not raised when one of the three is still allowed", async () => {
      const robots = "User-agent: OAI-SearchBot\nUser-agent: PerplexityBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n";
      const report = await completed(coreResources({ robots }));
      expect(findingIds(report)).toEqual([]);
      expect(metric(report, "A1.01").result).toBe("PARTIAL");
    });

    it("is not raised for training-crawler opt-outs, which are informational", async () => {
      const robots = "User-agent: GPTBot\nUser-agent: CCBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n";
      const report = await completed(coreResources({ robots }));
      expect(findingIds(report)).toEqual([]);
      expect(metric(report, "A1.01").result).toBe("PASS");
    });
  });

  describe("CF-04 render-dependent homepage", () => {
    const shell = '<!doctype html><html lang="en"><head><title>App</title></head><body><div id="root"></div><noscript>You need to enable JavaScript to run this app.</noscript></body></html>';

    it("is raised for a JavaScript app shell", async () => {
      const report = await completed(coreResources({ home: shell }));
      expect(findingIds(report)).toContain("CF-04");
      expect(metric(report, "A1.04").result).toBe("PARTIAL");
      expect(JSON.stringify(metric(report, "A1.04").evidence)).toContain("render_dependent");
      expect(report.pagesSampled[0].renderDependent).toBe(true);
    });

    it("is not raised when only a sampled page is render-dependent", async () => {
      const resources = coreResources();
      resources[`${ORIGIN}/about`] = page(shell);
      const report = await completed(resources);
      expect(findingIds(report)).toEqual([]);
      expect(report.limitations.join("\n")).toMatch(/1 sampled page is built by JavaScript/);
    });
  });

  describe("CF-05 HTTPS not served or certificate invalid", () => {
    it("is raised when the homepage was only reachable over http", async () => {
      const resources = coreResources();
      resources[`${ORIGIN}/`] = { error: { code: "CONNECT_REFUSED", message: "refused" } };
      resources["http://example.ie/"] = page(pageHtml("Home"), { tls: undefined });
      const snapshot = await scan(resources);
      expect(snapshot.httpsAttempt).not.toBeNull();
      const report = evaluateSnapshot(snapshot, NOW);
      expect(findingIds(report)).toContain("CF-05");
      expect(report.criticalFindings.find((f) => f.id === "CF-05")?.summary).toContain("could not be loaded over https");
      expect(metric(report, "S3.01").result).toBe("FAIL");
    });

    it("is raised for a certificate that failed validation", async () => {
      const resources = coreResources();
      resources[`${ORIGIN}/`] = page(pageHtml("Home"), {
        tls: { authorized: false, error: "CERT_HAS_EXPIRED" },
        ttfbSamplesMs: [100, 120, 140],
      });
      const report = await completed(resources);
      expect(findingIds(report)).toEqual(["CF-05"]);
      expect(report.criticalFindings[0].summary).toContain("did not pass validation");
      expect(metric(report, "S3.02").result).toBe("FAIL");
    });

    it("is raised for a certificate that has expired", async () => {
      const resources = coreResources();
      resources[`${ORIGIN}/`] = page(pageHtml("Home"), {
        tls: { authorized: true, daysToExpiry: -3 },
        ttfbSamplesMs: [100, 120, 140],
      });
      const report = await completed(resources);
      expect(findingIds(report)).toEqual(["CF-05"]);
      expect(report.criticalFindings[0].summary).toContain("expired");
    });

    it("is not raised for a valid certificate that expires soon", async () => {
      const resources = coreResources();
      resources[`${ORIGIN}/`] = page(pageHtml("Home"), {
        tls: { authorized: true, daysToExpiry: 5 },
        ttfbSamplesMs: [100, 120, 140],
      });
      const report = await completed(resources);
      expect(findingIds(report)).toEqual([]);
      expect(metric(report, "S3.02").result).toBe("PARTIAL");
    });

    it("is not raised when http simply serves content as well as https", async () => {
      const resources = coreResources();
      resources["http://example.ie/"] = page(pageHtml("Home"), { tls: undefined });
      const report = await completed(resources);
      expect(findingIds(report)).toEqual([]);
      expect(metric(report, "S3.01").result).toBe("FAIL");
    });
  });

  describe("CF-06 homepage canonical points to a different site", () => {
    const canonicalHome = (href: string) => pageHtml("Home", { head: `<link rel="canonical" href="${href}">` });

    it("is raised for a cross-site canonical", async () => {
      expect(await findings(coreResources({ home: canonicalHome("https://other.example/") }))).toEqual(["CF-06"]);
    });

    it("is not raised for a self canonical or a canonical to another page of the same site", async () => {
      expect(await findings(coreResources({ home: canonicalHome(`${ORIGIN}/`) }))).toEqual([]);
      expect(await findings(coreResources({ home: canonicalHome(`${ORIGIN}/services`) }))).toEqual([]);
    });

    it("is not raised when only another page has a cross-site canonical", async () => {
      const resources = coreResources();
      resources[`${ORIGIN}/faq`] = page(pageHtml("faq", { head: '<link rel="canonical" href="https://other.example/faq">' }));
      const report = await completed(resources);
      expect(findingIds(report)).toEqual([]);
      expect(JSON.stringify(metric(report, "S1.04").evidence)).toContain("cross_site");
    });
  });

  describe("CF-07 scanner challenged", () => {
    const challengePage = (headers: Record<string, string>, body: string): FixtureResource => ({
      status: 403,
      headers: { "content-type": HTML, ...headers },
      inlineBody: body,
      ttfbMs: 50,
    });

    it("is raised for a 403 with a challenge header and for a 403 with challenge markup", async () => {
      const header = coreResources();
      header[`${ORIGIN}/about`] = challengePage({ "cf-mitigated": "challenge" }, "<html><body>blocked</body></html>");
      const withHeader = await completed(header);
      expect(findingIds(withHeader)).toEqual(["CF-07"]);
      expect(withHeader.informational.challengeDetected).toBe(true);
      expect(withHeader.limitations.join("\n")).toMatch(/challenged or blocked/);

      const markup = coreResources();
      markup[`${ORIGIN}/about`] = challengePage({}, "<html><title>Just a moment...</title></html>");
      expect(findingIds(await completed(markup))).toEqual(["CF-07"]);
    });

    it("is not raised for a plain 403, or for challenge words on a 200 page", async () => {
      const plain = coreResources();
      plain[`${ORIGIN}/about`] = challengePage({}, "<html><body>Forbidden</body></html>");
      const report = await completed(plain);
      expect(findingIds(report)).toEqual([]);
      expect(report.informational.challengeDetected).toBe(false);

      const talk = coreResources();
      talk[`${ORIGIN}/about`] = page(pageHtml("about", { body: `<main><h1>About</h1><p>Just a moment, verify you are human? ${words(90)}</p></main>` }));
      expect(await findings(talk)).toEqual([]);
    });
  });

  it("lists several findings in id order and never changes the score they sit beside", async () => {
    const robots = "User-agent: DataBridgesBot\nAllow: /\n\nUser-agent: *\nDisallow: /\n";
    const home = pageHtml("Home", {
      head: '<meta name="robots" content="noindex"><link rel="canonical" href="https://other.example/">',
    });
    const resources = coreResources({ robots, home });
    resources[`${ORIGIN}/about`] = { status: 403, headers: { "content-type": HTML, "cf-mitigated": "challenge" }, inlineBody: "x", ttfbMs: 40 };
    const report = await completed(resources);

    expect(findingIds(report)).toEqual(["CF-01", "CF-02", "CF-03", "CF-06", "CF-07"]);
    expect(report.scores).toEqual(computeScoreSummary(report.metrics));
    for (const finding of report.criticalFindings) {
      expect(finding.summary).toMatch(/^Detected: /);
      expect(finding.summary).not.toMatch(FORBIDDEN_WORDS);
    }
  });

  it("derives findings from the context and the metric results it is given", async () => {
    const snapshot = await scan(coreResources({ home: pageHtml("Home", { head: '<meta name="robots" content="noindex">' }) }));
    const report = evaluateSnapshot(snapshot, NOW);
    const ctx = buildEvalContext(snapshot, NOW);
    expect(deriveCriticalFindings(ctx, report.metrics)).toEqual(report.criticalFindings);
    expect(deriveCriticalFindings(ctx, [])).toEqual([]);
  });
});

describe("evaluateSnapshot: withheld scores", () => {
  it("withholds the overall score on low coverage and still publishes both pillars at the boundary", async () => {
    const snapshot = await scanFixture("fx-spa-shell");
    const report = evaluateSnapshot(snapshot, new Date(snapshot.scannedAt));
    expect(report.scores.overall).toBeNull();
    expect(report.scores.seo).not.toBeNull();
    expect(report.scores.aeo).not.toBeNull();
    expect(report.scores.withheld.overall).toBe("OVERALL_WEIGHT_BELOW_MINIMUM");
    expect(report.scores.shownWeight.overall).toBe(60);
    expect(findingIds(report)).toEqual(["CF-04"]);
    expect(report.coverage).toBeLessThan(1);
    expect(report.limitations.join("\n")).toMatch(/scores are withheld/);
    expect(metric(report, "S2.05").result).toBe("NOT_OBSERVED");
  });

  it("withholds a pillar, and then the overall score, when a whole pillar cannot be observed", async () => {
    const snapshot = await scanFixture("fx-strong");
    const report = evaluateSnapshot(
      snapshot,
      NOW,
      evaluators({
        A1: () => allNotObserved("A1"),
        A2: () => allNotObserved("A2"),
        A3: () => allNotObserved("A3"),
        A4: () => allNotObserved("A4"),
      }),
    );
    expect(report.scores.seo).not.toBeNull();
    expect(report.scores.aeo).toBeNull();
    expect(report.scores.overall).toBeNull();
    expect(report.scores.withheld.aeo).toBe("PILLAR_WEIGHT_BELOW_MINIMUM");
    expect(report.scores.withheld.overall).toBe("PILLAR_NOT_PUBLISHED");
    expect(report.scores.categories.A1).toMatchObject({ score: null, coverage: 0, shown: false });
    expect(report.coverage).toBe(0.5);
    expect(report.metrics.filter((m) => m.result === "NOT_OBSERVED")).toHaveLength(25);
  });

  it("withholds everything when no category can be observed, yet still reports a hash and limitations", async () => {
    const snapshot = await scanFixture("fx-strong");
    const none = forEachCategory((id) => () => allNotObserved(id));
    const report = evaluateSnapshot(snapshot, NOW, none);
    expect(report.scores).toMatchObject({ overall: null, seo: null, aeo: null, coverage: 0 });
    expect(report.limitations.length).toBeGreaterThan(3);
    expect(report.snapshotHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("handles a completed snapshot that holds no pages at all", () => {
    const snapshot = emptyCompleted();
    const report = evaluateSnapshot(snapshot, NOW);
    expect(report.metrics).toHaveLength(52);
    expect(report.scores.overall).toBeNull();
    expect(report.pagesSampled).toEqual([]);
    expect(report.criticalFindings).toEqual([]);
    expect(report.informational.homepageHtmlBytes).toBeNull();
    expect(report.informational.homepageRedirects).toBeNull();
  });
});

function emptyCompleted(over: Partial<ScanSnapshot> = {}): ScanSnapshot {
  return {
    snapshotVersion: 1,
    scannerVersion: "test-1",
    inputUrl: `${ORIGIN}/`,
    homeUrl: `${ORIGIN}/`,
    scannedAt: NOW.toISOString(),
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
      excluded: { other_site: 0, non_http: 0, non_html_extension: 0, utility_path: 0, duplicate: 0, homepage: 0 },
      byType: { home: 0, services: 0, about: 0, faq: 0, article: 0, contact: 0, legal: 0, other: 0 },
      capped: false,
    },
    stats: { requestCount: 0, requestCapReached: false, jobTimedOut: false, jobDurationMs: 0 },
    ...over,
  };
}

describe("evaluateSnapshot: outcomes that produce no score", () => {
  function expectNoScoreReport(report: ScanReport): void {
    expect(report.metrics.map((m) => m.metricId)).toEqual([...METRIC_IDS]);
    for (const result of report.metrics) {
      expect(result.result).toBe("NOT_OBSERVED");
      expect(result.points).toBeNull();
      expect(result.maxPoints).toBe(getMetricDefinition(result.metricId).maxPoints);
      expect(result.reviewedBy).toBeNull();
    }
    expect(report.metrics.filter((m) => m.result === "NOT_OBSERVED")).toHaveLength(52);
    expect(report.criticalFindings).toEqual([]);
    expect(report.coverage).toBe(0);
    expect(report.scores).toMatchObject({ overall: null, seo: null, aeo: null, coverage: 0 });
    expect(report.scores.withheld).toEqual({
      seo: "NO_SCORE_OUTCOME",
      aeo: "NO_SCORE_OUTCOME",
      overall: "NO_SCORE_OUTCOME",
    });
    for (const id of CATEGORY_IDS) {
      expect(report.scores.categories[id]).toMatchObject({ score: null, coverage: 0, shown: false });
    }
    expect(report.limitations.length).toBeGreaterThanOrEqual(2);
    expect(report.snapshotHash).toMatch(/^[0-9a-f]{64}$/);
    expect(report.correctionRoute).toBe("oisin@databridges.ie");
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  }

  const neverCalled = forEachCategory((id) => () => {
    throw new Error(`evaluator ${id} must not run for a scan without a score`);
  });

  it("BLOCKED_BY_ROBOTS: 52 NOT_OBSERVED metrics, no findings, no evaluator run", async () => {
    const snapshot = await scan(coreResources({ robots: "User-agent: *\nDisallow: /\n" }));
    expect(snapshot.outcome).toBe("BLOCKED_BY_ROBOTS");
    const report = evaluateSnapshot(snapshot, NOW, neverCalled);

    expectNoScoreReport(report);
    expect(report.outcome).toBe("BLOCKED_BY_ROBOTS");
    expect(report.outcomeDetail).toContain("DataBridgesBot");
    expect(report.limitations[0]).toContain("DataBridgesBot");
    expect(report.metrics[0].explanation).toContain("robots.txt");
    expect(report.informational.trainingCrawlerPolicy.every((p) => p.allowed === false)).toBe(true);
  });

  it("UNREACHABLE: the homepage failed over https and http", async () => {
    const resources = coreResources();
    resources[`${ORIGIN}/`] = { error: { code: "CONNECT_REFUSED", message: "refused" } };
    resources["http://example.ie/"] = { error: { code: "CONNECT_REFUSED", message: "refused" } };
    const snapshot = await scan(resources);
    expect(snapshot.outcome).toBe("UNREACHABLE");
    const report = evaluateSnapshot(snapshot, NOW, neverCalled);

    expectNoScoreReport(report);
    expect(report.outcome).toBe("UNREACHABLE");
    expect(report.limitations[0]).toMatch(/could not be fetched/);
    expect(report.pagesSampled).toEqual([]);
  });

  it("JOB_ERROR: a rejected target gives a report instead of an exception", async () => {
    const snapshot = await scan({}, "ftp://example.ie/");
    expect(snapshot.outcome).toBe("JOB_ERROR");
    const report = evaluateSnapshot(snapshot, NOW, neverCalled);

    expectNoScoreReport(report);
    expect(report.outcome).toBe("JOB_ERROR");
    expect(report.outcomeDetail).not.toBeNull();
    expect(report.informational.trainingCrawlerPolicy.every((p) => p.allowed === null)).toBe(true);
    expect(report.informational.challengeDetected).toBe(false);
  });

  it("survives a corrupt snapshot: odd home URL, unknown outcome, hostile text", () => {
    const snapshot = emptyCompleted({
      homeUrl: "not a url \u{202E}<script>",
      inputUrl: "not a url",
      outcome: "SOMETHING_ELSE" as ScanSnapshot["outcome"],
      outcomeDetail: "x".repeat(5000),
    });
    const report = evaluateSnapshot(snapshot, NOW);
    expectNoScoreReport(report);
    expect(report.outcomeDetail?.length).toBeLessThanOrEqual(300);
    expect(INVISIBLE.test(report.outcomeDetail ?? "")).toBe(false);
  });

  it("rejects an invalid scan time rather than reporting on a guess", async () => {
    const snapshot = await scanFixture("fx-strong");
    expect(() => evaluateSnapshot(snapshot, new Date("not a date"))).toThrow(RangeError);
    expect(() => evaluateSnapshot({ ...snapshot, scannedAt: "garbage" })).toThrow(RangeError);
    expect(() => evaluateSnapshot(emptyCompleted({ outcome: "JOB_ERROR" }), new Date(Number.NaN))).toThrow(RangeError);
  });
});

describe("evaluateSnapshot: evaluator wiring and containment", () => {
  it("runs the eight evaluators once each, in category order, on one context built for the scan time", async () => {
    const snapshot = await scanFixture("fx-strong");
    const calls: Array<{ id: CategoryId; now: number; snapshot: ScanSnapshot }> = [];
    const spied = forEachCategory((id) => (ctx) => {
      calls.push({ id, now: ctx.now.getTime(), snapshot: ctx.snapshot });
      return CATEGORY_EVALUATORS[id](ctx);
    });

    const later = new Date("2027-01-01T00:00:00.000Z");
    const report = evaluateSnapshot(snapshot, later, spied);

    expect(calls.map((c) => c.id)).toEqual([...CATEGORY_IDS]);
    expect(new Set(calls.map((c) => c.now))).toEqual(new Set([later.getTime()]));
    expect(calls.every((c) => c.snapshot === snapshot)).toBe(true);
    expect(report.scannedAt).toBe(snapshot.scannedAt);
  });

  it("uses the stored scan time by default, and a re-score at another time changes age rules but not the hash", async () => {
    const snapshot = await scanFixture("fx-strong");
    const byDefault = evaluateSnapshot(snapshot);
    expect(byDefault).toEqual(evaluateSnapshot(snapshot, new Date(snapshot.scannedAt)));

    const rescored = evaluateSnapshot(snapshot, new Date("2029-10-02T09:15:00.000Z"));
    expect(rescored.snapshotHash).toBe(byDefault.snapshotHash);
    expect(rescored.scannedAt).toBe(byDefault.scannedAt);
    expect(metric(byDefault, "A4.05").result).toBe("PASS");
    expect(metric(rescored, "A4.05").result).toBe("FAIL");
  });

  it("turns a throwing evaluator into SCAN_ERROR metrics for that category only", async () => {
    const snapshot = await scanFixture("fx-strong");
    const baseline = evaluateSnapshot(snapshot, NOW);
    const report = evaluateSnapshot(
      snapshot,
      NOW,
      evaluators({
        A2: () => {
          throw new Error("boom \u{202E}<script>");
        },
      }),
    );

    const a2 = report.metrics.filter((m) => m.metricId.startsWith("A2."));
    expect(a2).toHaveLength(8);
    for (const result of a2) {
      expect(result.result).toBe("SCAN_ERROR");
      expect(result.points).toBeNull();
      expect(result.maxPoints).toBe(getMetricDefinition(result.metricId).maxPoints);
      expect(JSON.stringify(result.evidence)).toContain("evaluator_failed");
      expect(INVISIBLE.test(JSON.stringify(result.evidence))).toBe(false);
    }
    expect(report.metrics.filter((m) => !m.metricId.startsWith("A2."))).toEqual(
      baseline.metrics.filter((m) => !m.metricId.startsWith("A2.")),
    );
    expect(report.scores.categories.A2).toMatchObject({ score: null, coverage: 0, shown: false });
    expect(report.coverage).toBeLessThan(1);
    expect(report.limitations.join("\n")).toMatch(/internal error stopped A2/);
  });

  it("rejects an evaluator result set that is incomplete, mislabelled or out of range", async () => {
    const snapshot = await scanFixture("fx-strong");
    const real = (id: CategoryId) => CATEGORY_EVALUATORS[id];

    const short = evaluateSnapshot(snapshot, NOW, evaluators({ S1: (ctx) => real("S1")(ctx).slice(0, 4) }));
    expect(short.metrics.filter((m) => m.metricId.startsWith("S1.")).map((m) => m.result)).toEqual(Array(5).fill("SCAN_ERROR"));

    const wrongOrder = evaluateSnapshot(snapshot, NOW, evaluators({ S2: (ctx) => [...real("S2")(ctx)].reverse() }));
    expect(wrongOrder.metrics.filter((m) => m.metricId.startsWith("S2.")).every((m) => m.result === "SCAN_ERROR")).toBe(true);

    const foreign = evaluateSnapshot(
      snapshot,
      NOW,
      evaluators({ S3: (ctx) => real("S3")(ctx).map((r, i) => (i === 0 ? { ...r, metricId: "S1.01" } : r)) }),
    );
    expect(foreign.metrics.filter((m) => m.metricId.startsWith("S3.")).every((m) => m.result === "SCAN_ERROR")).toBe(true);
    expect(foreign.metrics.map((m) => m.metricId)).toEqual([...METRIC_IDS]);

    const outOfRange = evaluateSnapshot(
      snapshot,
      NOW,
      evaluators({ S4: () => METHODOLOGY.categories[3].metricIds.map((id) => ({ ...resultFromScore(id, 1, {}, "ok"), points: 999 })) }),
    );
    expect(outOfRange.metrics.filter((m) => m.metricId.startsWith("S4.")).every((m) => m.result === "SCAN_ERROR")).toBe(true);

    const nullPoints = evaluateSnapshot(
      snapshot,
      NOW,
      evaluators({ A4: (ctx) => real("A4")(ctx).map((r) => (r.result === "PASS" ? { ...r, points: null } : r)) }),
    );
    expect(nullPoints.metrics.filter((m) => m.metricId.startsWith("A4.")).every((m) => m.result === "SCAN_ERROR")).toBe(true);

    const notAnArray = evaluateSnapshot(
      snapshot,
      NOW,
      evaluators({ A3: (() => undefined) as unknown as CategoryEvaluators["A3"] }),
    );
    expect(notAnArray.metrics.filter((m) => m.metricId.startsWith("A3.")).every((m) => m.result === "SCAN_ERROR")).toBe(true);
  });

  it("keeps a valid evaluator result set untouched, including NOT_APPLICABLE", async () => {
    const report = evaluateSnapshot(await scanFixture("fx-minimal"), NOW);
    const codes = new Set(report.metrics.map((m) => m.result));
    expect(codes.has("NOT_APPLICABLE") || codes.has("NOT_OBSERVED")).toBe(true);
    expect(report.metrics.some((m) => m.result === "SCAN_ERROR" && JSON.stringify(m.evidence).includes("evaluator_failed"))).toBe(false);
  });
});

describe("evaluateSnapshot: purity and determinism", () => {
  it("does not modify a deeply frozen snapshot", async () => {
    const snapshot = await scanFixture("fx-strong");
    const before = canonicalJson(snapshot);
    deepFreeze(snapshot);
    const report = evaluateSnapshot(snapshot, NOW);
    expect(canonicalJson(snapshot)).toBe(before);
    expect(report.metrics).toHaveLength(52);
  });

  it("returns byte-identical reports for the same snapshot, ten times over", async () => {
    for (const name of ["fx-strong", "fx-minimal", "fx-noindex-home"]) {
      const snapshot = await scanFixture(name);
      const first = JSON.stringify(evaluateSnapshot(snapshot, new Date(snapshot.scannedAt)));
      for (let i = 0; i < 9; i += 1) {
        expect(JSON.stringify(evaluateSnapshot(snapshot, new Date(snapshot.scannedAt)))).toBe(first);
      }
    }
  });

  it("does not read the clock or a random source", async () => {
    const snapshot = await scanFixture("fx-strong");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2001-01-01T00:00:00.000Z"));
    const early = JSON.stringify(evaluateSnapshot(snapshot, NOW));
    vi.setSystemTime(new Date("2040-06-06T00:00:00.000Z"));
    vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random must not be used");
    });
    const late = JSON.stringify(evaluateSnapshot(snapshot, NOW));
    expect(late).toBe(early);
  });

  it("gives the same report for a snapshot rebuilt from JSON with reordered keys", async () => {
    const snapshot = await scanFixture("fx-canonical-variants");
    const rebuilt = reverseKeys(JSON.parse(JSON.stringify(snapshot))) as ScanSnapshot;
    const a = evaluateSnapshot(snapshot, NOW);
    const b = evaluateSnapshot(rebuilt, NOW);
    expect(b.snapshotHash).toBe(a.snapshotHash);
    expect(b.metrics.map((m) => [m.metricId, m.result, m.points])).toEqual(a.metrics.map((m) => [m.metricId, m.result, m.points]));
    expect(b.scores.overall).toBe(a.scores.overall);
    expect(findingIds(b)).toEqual(findingIds(a));
  });
});

describe("snapshotHash", () => {
  it("is the SHA-256 hex of the canonical JSON of the snapshot", async () => {
    const snapshot = await scanFixture("fx-minimal");
    const expected = createHash("sha256").update(canonicalJson(snapshot), "utf8").digest("hex");
    expect(computeSnapshotHash(snapshot)).toBe(expected);
    expect(computeSnapshotHash(snapshot)).toMatch(/^[0-9a-f]{64}$/);
    expect(evaluateSnapshot(snapshot, NOW).snapshotHash).toBe(expected);
  });

  it("canonicalises with sorted keys, no whitespace and JSON.stringify's value rules", () => {
    expect(canonicalJson({ b: [1, { d: 1, c: 2 }], a: "x" })).toBe('{"a":"x","b":[1,{"c":2,"d":1}]}');
    expect(canonicalJson({ z: null, y: true, x: false, w: "quo\"te\n" })).toBe('{"w":"quo\\"te\\n","x":false,"y":true,"z":null}');
    expect(canonicalJson({ a: undefined, b: 1, c: () => 1 })).toBe('{"b":1}');
    expect(canonicalJson([undefined, () => 1, Number.NaN, Number.POSITIVE_INFINITY])).toBe("[null,null,null,null]");
    expect(canonicalJson({ n: -0, e: 1e21, f: 0.1 })).toBe('{"e":1e+21,"f":0.1,"n":0}');
    expect(canonicalJson({ B: 1, a: 2, "\u{E9}": 3 })).toBe('{"B":1,"a":2,"\u{E9}":3}');
    expect(canonicalJson(new Date("2026-10-02T09:15:00.000Z"))).toBe('"2026-10-02T09:15:00.000Z"');
    expect(canonicalJson(undefined)).toBe("null");
    expect(canonicalJson("s")).toBe('"s"');
  });

  it("hashes a tiny known value to a known digest", () => {
    const digest = createHash("sha256").update('{"a":1,"b":[true,null]}', "utf8").digest("hex");
    expect(computeSnapshotHash({ b: [true, null], a: 1 } as unknown as ScanSnapshot)).toBe(digest);
  });

  it("does not depend on key order, at any depth", async () => {
    const snapshot = await scanFixture("fx-strong");
    const reordered = reverseKeys(snapshot) as ScanSnapshot;
    expect(JSON.stringify(reordered)).not.toBe(JSON.stringify(snapshot));
    expect(computeSnapshotHash(reordered)).toBe(computeSnapshotHash(snapshot));
  });

  it("is stable across calls, across scan time parameters and across a JSON round trip", async () => {
    const snapshot = await scanFixture("fx-strong");
    const hash = computeSnapshotHash(snapshot);
    expect(computeSnapshotHash(snapshot)).toBe(hash);
    expect(computeSnapshotHash(JSON.parse(JSON.stringify(snapshot)))).toBe(hash);
    expect(evaluateSnapshot(snapshot, new Date("2031-01-01T00:00:00.000Z")).snapshotHash).toBe(hash);
  });

  it("treats a missing key and an undefined value alike", () => {
    const withUndefined = { a: 1, b: undefined } as unknown as ScanSnapshot;
    const without = { a: 1 } as unknown as ScanSnapshot;
    expect(computeSnapshotHash(withUndefined)).toBe(computeSnapshotHash(without));
  });

  it("changes when any observed content changes, and when array order changes", async () => {
    const snapshot = await scanFixture("fx-strong");
    const hash = computeSnapshotHash(snapshot);
    expect(computeSnapshotHash({ ...snapshot, scannerVersion: "other" })).not.toBe(hash);
    expect(computeSnapshotHash({ ...snapshot, scannedAt: "2026-10-02T09:15:01.000Z" })).not.toBe(hash);

    const body = snapshot.pages[1].record.body ?? "";
    const edited = {
      ...snapshot,
      pages: snapshot.pages.map((p, i) => (i === 1 ? { ...p, record: { ...p.record, body: `${body} ` } } : p)),
    };
    expect(computeSnapshotHash(edited)).not.toBe(hash);

    const swapped = { ...snapshot, pages: [snapshot.pages[0], snapshot.pages[2], snapshot.pages[1], ...snapshot.pages.slice(3)] };
    expect(computeSnapshotHash(swapped)).not.toBe(hash);
  });

  it("refuses values that have no JSON form", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => canonicalJson(circular)).toThrow(TypeError);
    expect(() => canonicalJson({ n: BigInt(1) })).toThrow(TypeError);
    const shared = { x: 1 };
    expect(canonicalJson({ a: shared, b: shared })).toBe('{"a":{"x":1},"b":{"x":1}}');
  });
});

describe("informational signals", () => {
  it("reports training-crawler and user-agent policy neutrally from robots.txt", async () => {
    const snapshot = await scanFixture("fx-strong");
    const report = evaluateSnapshot(snapshot, NOW);
    const training = Object.fromEntries(report.informational.trainingCrawlerPolicy.map((p) => [p.token, p.allowed]));
    expect(training).toMatchObject({ GPTBot: false, CCBot: false, ClaudeBot: true });
    expect(report.informational.trainingCrawlerPolicy.map((p) => p.token)).toEqual([
      "GPTBot", "ClaudeBot", "Google-Extended", "Applebot-Extended", "CCBot", "Amazonbot", "Bytespider", "meta-externalagent",
    ]);
    expect(report.informational.userAgentPolicy).toEqual([
      { token: "ChatGPT-User", allowed: true },
      { token: "Claude-User", allowed: true },
      { token: "Perplexity-User", allowed: true },
    ]);
    expect(metric(report, "A1.01").result).toBe("PASS");
  });

  it("keeps scored crawlers out of the informational lists", async () => {
    const report = evaluateSnapshot(await scanFixture("fx-strong"), NOW);
    const tokens = [...report.informational.trainingCrawlerPolicy, ...report.informational.userAgentPolicy].map((p) => p.token);
    for (const scored of ["Googlebot", "bingbot", "OAI-SearchBot", "PerplexityBot", "Claude-SearchBot"]) {
      expect(tokens).not.toContain(scored);
    }
  });

  it("marks policy unknown when robots.txt cannot be read", async () => {
    const resources = coreResources();
    resources[`${ORIGIN}/robots.txt`] = { status: 500, headers: { "content-type": "text/plain" }, inlineBody: "x", ttfbMs: 20 };
    const report = evaluateSnapshot(await scan(resources), NOW);
    expect(report.informational.trainingCrawlerPolicy.every((p) => p.allowed === null)).toBe(true);
    expect(report.informational.userAgentPolicy.every((p) => p.allowed === null)).toBe(true);
  });

  it("lists JSON-LD types sorted and unique, with the homepage size, redirects and region", async () => {
    const snapshot = await scanFixture("fx-strong");
    const report = evaluateSnapshot(snapshot, NOW);
    const { jsonLdTypes } = report.informational;
    expect(jsonLdTypes).toEqual([...new Set(jsonLdTypes)].sort());
    expect(jsonLdTypes).toEqual(expect.arrayContaining(["ProfessionalService", "FAQPage", "BlogPosting", "BreadcrumbList", "Service", "AboutPage", "WebSite"]));
    expect(report.informational.homepageHtmlBytes).toBe(snapshot.pages[0].record.decodedBytes);
    expect(report.informational.homepageHtmlBytes).toBeGreaterThan(1000);
    expect(report.informational.homepageRedirects).toBe(snapshot.pages[0].record.redirectChain.length);

    const regional = evaluateSnapshot(await scan(coreResources(), `${ORIGIN}/`, "eu-west-1"), NOW);
    expect(regional.informational.scannerRegion).toBe("eu-west-1");
    expect(report.informational.scannerRegion).toBeNull();
  });

  it("counts homepage redirects", async () => {
    const resources = coreResources();
    resources["https://www.example.ie/"] = { status: 301, headers: { location: `${ORIGIN}/` }, ttfbMs: 20 };
    const report = evaluateSnapshot(await scan(resources, "https://www.example.ie/"), NOW);
    expect(report.informational.homepageRedirects).toBe(1);
    expect(report.homeUrl).toBe(`${ORIGIN}/`);
  });
});

describe("limitations and list staleness", () => {
  it("states the required limits on every completed report", async () => {
    const report = evaluateSnapshot(await scanFixture("fx-strong"), NOW);
    const joined = report.limitations.join("\n");
    expect(joined).toMatch(/raw HTML only/);
    expect(joined).toMatch(/JavaScript/);
    expect(joined).toMatch(/up to four other pages/);
    expect(joined).toMatch(/signals of readiness only/);
    expect(joined).toMatch(/do not compare this site with others/);
    expect(joined).toMatch(/Does not measure search positions, traffic, backlinks/);
    expect(joined).toMatch(/whether any AI system cites the site/);
    expect(joined).toMatch(/legal compliance/);
    expect(joined).toMatch(/heuristics/);
    expect(joined).toMatch(/Server response time/);
    expect(joined).toMatch(/Methodology 0\.1\.0-draft is a draft/);
    expect(joined).not.toMatch(/challenged or blocked/);
    expect(joined).not.toMatch(/withheld/);
    for (const limitation of report.limitations) {
      expect(limitation).not.toMatch(FORBIDDEN_WORDS);
      expect(limitation.length).toBeLessThanOrEqual(300);
      expect(INVISIBLE.test(limitation)).toBe(false);
    }
    expect(new Set(report.limitations).size).toBe(report.limitations.length);
  });

  it("adds only the limits that apply: unread pages, stopped scans", async () => {
    const resources = coreResources();
    resources[`${ORIGIN}/faq`] = { status: 500, headers: { "content-type": HTML }, inlineBody: "oops", ttfbMs: 20 };
    const snapshot = await scan(resources);
    const withStops = {
      ...snapshot,
      stats: { ...snapshot.stats, jobTimedOut: true, requestCapReached: true },
    };
    const report = evaluateSnapshot(withStops, NOW);
    const joined = report.limitations.join("\n");
    expect(joined).toMatch(/1 sampled page could not be read as HTML \(blocked, failed or not HTML\); unread pages lower coverage but not the score/);
    expect(joined).toMatch(/time limit/);
    expect(joined).toMatch(/request limit/);
  });

  it("flags lists without a verified review date as stale instead of failing", async () => {
    const report = evaluateSnapshot(await scanFixture("fx-strong"), NOW);
    expect(report.staleLists).toContain("patterns");
    for (const name of report.staleLists) expect(["aiAgents", "patterns"]).toContain(name);
    expect(report.staleLists.includes("aiAgents")).toBe(AI_AGENTS.some((agent) => isListStale(agent.reviewDueAt, NOW)));
    expect(report.limitations.join("\n")).toMatch(/pattern lists have no recorded review date/);
    if (report.staleLists.includes("aiAgents")) {
      expect(report.limitations.join("\n")).toMatch(/AI crawler list is unverified against vendor documentation or past its review date/);
    }
    expect(report.listVersions).toEqual(METHODOLOGY.listVersions);
  });

  it("never uses ranking language in anything it generates", async () => {
    for (const name of fixtureNames()) {
      const report = evaluateSnapshot(await scanFixture(name), NOW);
      const generated = [
        ...report.limitations,
        ...report.criticalFindings.map((f) => f.summary),
        ...report.metrics.map((m) => m.explanation),
      ];
      for (const sentence of generated) expect(sentence).not.toMatch(FORBIDDEN_WORDS);
    }
  });
});

describe("scoreBands", () => {
  it("labels the displayed whole-number score per 4.7", () => {
    const bands = (overall: number | null) => scoreBands({ overall, seo: overall, aeo: overall }).overall;
    expect(bands(100)).toBe("Strong signals detected");
    expect(bands(85)).toBe("Strong signals detected");
    expect(bands(84.5)).toBe("Strong signals detected");
    expect(bands(84.49)).toBe("Good foundations");
    expect(bands(70)).toBe("Good foundations");
    expect(bands(69.5)).toBe("Good foundations");
    expect(bands(69.49)).toBe("Some gaps");
    expect(bands(50)).toBe("Some gaps");
    expect(bands(49.5)).toBe("Some gaps");
    expect(bands(49.49)).toBe("Many gaps");
    expect(bands(0)).toBe("Many gaps");
  });

  it("gives no band to a withheld score", () => {
    expect(scoreBands({ overall: null, seo: 90, aeo: null })).toEqual({
      overall: null,
      seo: "Strong signals detected",
      aeo: null,
    });
  });

  it("matches the scores of real reports", async () => {
    const report = evaluateSnapshot(await scanFixture("fx-minimal"), NOW);
    expect(scoreBands(report.scores)).toEqual({ overall: "Some gaps", seo: "Some gaps", aeo: "Many gaps" });
    const spa = evaluateSnapshot(await scanFixture("fx-spa-shell"), NOW);
    expect(scoreBands(spa.scores)).toEqual({ overall: null, seo: "Strong signals detected", aeo: "Some gaps" });
  });
});
