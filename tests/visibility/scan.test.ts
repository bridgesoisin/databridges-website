import { describe, expect, it } from "vitest";
import {
  LINKS_PER_JOB,
  LINKS_PER_PAGE,
  MAX_REQUESTS,
  createOwnAgentGate,
  runScan,
  scanSite,
  type ScanOptions,
} from "@/lib/visibility/scan";
import type { FetchRecord, FetchRequest, Fetcher, LinkCheckResult, ScanSnapshot } from "@/lib/visibility/types";
import {
  createFixtureFetcher,
  createSiteFetcher,
  expectedSample,
  fixtureNames,
  loadFixture,
  type FixtureFetcher,
  type FixtureFetcherOptions,
  type FixtureResource,
  type FixtureSite,
} from "./helpers/fixture-fetcher";

const NOW = new Date("2026-10-02T09:15:00.000Z");
const OPTIONS: ScanOptions = { now: NOW, scannerVersion: "test-1" };
const HTML = "text/html; charset=utf-8";
const ORIGIN = "https://example.ie";
const PAGE_PATHS = ["/services", "/about", "/faq", "/blog/post-one"];

function pageResource(body: string, extra: Partial<FixtureResource> = {}): FixtureResource {
  return {
    status: 200,
    headers: { "content-type": HTML },
    inlineBody: body,
    ttfbMs: 120,
    tls: { authorized: true, daysToExpiry: 90 },
    ...extra,
  };
}

function textResource(contentType: string, body: string, extra: Partial<FixtureResource> = {}): FixtureResource {
  return { status: 200, headers: { "content-type": contentType }, inlineBody: body, ttfbMs: 60, ...extra };
}

function redirect(to: string, status = 301): FixtureResource {
  return { status, headers: { location: to }, ttfbMs: 40 };
}

function anchors(paths: readonly string[]): string {
  return paths.map((p) => `<a href="${p}">Go to ${p.replace(/[^a-z0-9]+/gi, " ").trim()}</a>`).join("\n");
}

function html(title: string, parts: { nav?: string; main?: string; footer?: string } = {}): string {
  return [
    "<!doctype html>",
    '<html lang="en"><head><meta charset="utf-8">',
    `<title>${title}</title>`,
    "</head><body>",
    parts.nav ? `<nav>${parts.nav}</nav>` : "",
    `<main><h1>${title}</h1><p>Short body text for ${title}.</p>${parts.main ?? ""}</main>`,
    parts.footer ? `<footer>${parts.footer}</footer>` : "",
    "</body></html>",
  ].join("\n");
}

function urlset(origin: string, paths: readonly string[]): string {
  const entries = paths.map((p) => `<url><loc>${origin}${p}</loc></url>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`;
}

function sitemapIndex(urls: readonly string[]): string {
  const entries = urls.map((u) => `<sitemap><loc>${u}</loc></sitemap>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</sitemapindex>`;
}

function robotsText(body: string): FixtureResource {
  return textResource("text/plain; charset=utf-8", body);
}

function coreResources(origin = ORIGIN, home = html("Home", { main: anchors(PAGE_PATHS) })): Record<string, FixtureResource> {
  const resources: Record<string, FixtureResource> = {
    [`${origin}/`]: pageResource(home, { ttfbSamplesMs: [100, 120, 140] }),
    [`${origin}/robots.txt`]: robotsText("User-agent: *\nAllow: /\n"),
    [`${origin}/sitemap.xml`]: textResource("application/xml; charset=utf-8", urlset(origin, PAGE_PATHS)),
    [`http://${new URL(origin).host}/`]: redirect(`${origin}/`),
  };
  for (const path of PAGE_PATHS) resources[`${origin}${path}`] = pageResource(html(path));
  return resources;
}

type Run = { snapshot: ScanSnapshot; fetcher: FixtureFetcher };

async function scan(
  resources: Record<string, FixtureResource>,
  extra: { input?: string; fetcher?: FixtureFetcherOptions; options?: Partial<ScanOptions> } = {},
): Promise<Run> {
  const input = extra.input ?? `${ORIGIN}/`;
  const site: FixtureSite = { scannedAt: NOW.toISOString(), inputUrl: input, resources };
  const fetcher = createSiteFetcher(site, extra.fetcher);
  const snapshot = await runScan(input, fetcher, { ...OPTIONS, ...extra.options });
  return { snapshot, fetcher };
}

function requested(fetcher: FixtureFetcher): string[] {
  return fetcher.requests.map((r) => `${r.method} ${r.kind} ${r.url}`);
}

function urlsOfKind(fetcher: FixtureFetcher, kind: string): string[] {
  return fetcher.requests.filter((r) => r.kind === kind).map((r) => r.url);
}

function linkCheck(snapshot: ScanSnapshot, url: string): LinkCheckResult {
  const found = snapshot.linkChecks.find((entry) => entry.url === url);
  if (found === undefined) throw new Error(`No link check recorded for ${url}`);
  return found;
}

describe("runScan on the golden fixtures", () => {
  describe.each(fixtureNames())("%s", (name) => {
    const fixture = loadFixture(name);
    const scanOptions: ScanOptions = { now: new Date(fixture.site.scannedAt), scannerVersion: "test-1" };

    it("samples exactly the pages the fixture expects and stays inside the request budget", async () => {
      const fetcher = createFixtureFetcher(fixture);
      const snapshot = await runScan(fixture.site.inputUrl, fetcher, scanOptions);

      expect(snapshot.outcome).toBe(fixture.expected.outcome === "SCORED" ? "COMPLETED" : fixture.expected.outcome);
      expect(snapshot.pages.map((p) => p.url)).toEqual(expectedSample(fixture.site));
      expect(snapshot.snapshotVersion).toBe(1);
      expect(snapshot.scannerVersion).toBe("test-1");
      expect(snapshot.scannedAt).toBe(new Date(fixture.site.scannedAt).toISOString());
      expect(snapshot.inputUrl).toBe(fixture.site.inputUrl);
      expect(snapshot.stats.requestCount).toBeLessThanOrEqual(MAX_REQUESTS);
      expect(snapshot.stats.requestCount).toBe(fetcher.requestCount);
      expect(snapshot.stats.requestCapReached).toBe(false);
      expect(snapshot.stats.jobTimedOut).toBe(false);
    });

    it("only asks for URLs the fixture lists, apart from the conventional site files", async () => {
      const fetcher = createFixtureFetcher(fixture);
      await runScan(fixture.site.inputUrl, fetcher, scanOptions);
      const conventional = new Set(["/robots.txt", "/sitemap.xml", "/llms.txt"]);
      for (const url of fetcher.unknown) expect(conventional.has(new URL(url).pathname), url).toBe(true);
      for (const url of fetcher.hops) expect(new URL(url).hostname).toBe("fixture.example");
    });

    it("fetches robots.txt before anything else for each origin", async () => {
      const fetcher = createFixtureFetcher(fixture);
      const snapshot = await runScan(fixture.site.inputUrl, fetcher, scanOptions);
      expect(fetcher.requests[0]).toMatchObject({ kind: "robots", url: "https://fixture.example/robots.txt" });
      const seen = new Set<string>();
      for (const request of fetcher.requests) {
        const origin = new URL(request.url).origin;
        if (request.kind === "robots") seen.add(origin);
        else expect(seen.has(origin), `${request.kind} ${request.url}`).toBe(true);
      }
      expect(snapshot.robots[0]?.origin).toBe("https://fixture.example");
    });

    it("keeps the sampling summary consistent", async () => {
      const snapshot = await runScan(fixture.site.inputUrl, createFixtureFetcher(fixture), scanOptions);
      if (snapshot.outcome !== "COMPLETED") return;
      const { candidates } = snapshot;
      const excluded = Object.values(candidates.excluded).reduce((sum, n) => sum + n, 0);
      expect(candidates.fromSitemap + candidates.fromHomepageLinks).toBe(candidates.considered + excluded);
      expect(snapshot.pages[0]).toMatchObject({ type: "home", depth: 0 });
      expect(snapshot.pages.length).toBeLessThanOrEqual(5);
    });
  });

  it("produces byte-identical snapshots on repeated runs", async () => {
    const fixture = loadFixture("fx-strong");
    const options = { now: new Date(fixture.site.scannedAt), scannerVersion: "test-1" };
    const first = await runScan(fixture.site.inputUrl, createFixtureFetcher(fixture), options);
    const second = await runScan(fixture.site.inputUrl, createFixtureFetcher(fixture), options);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });
});

describe("fx-strong", () => {
  const fixture = loadFixture("fx-strong");
  const run = async () => {
    const fetcher = createFixtureFetcher(fixture);
    const snapshot = await runScan(fixture.site.inputUrl, fetcher, { now: new Date(fixture.site.scannedAt), scannerVersion: "test-1" });
    return { fetcher, snapshot };
  };

  it("maps SCORED to COMPLETED and records every resource kind", async () => {
    const { snapshot } = await run();
    expect(snapshot.outcome).toBe("COMPLETED");
    expect(snapshot.outcomeDetail).toBeNull();
    expect(snapshot.httpsAttempt).toBeNull();
    expect(snapshot.homeUrl).toBe("https://fixture.example/");
    expect(snapshot.pages[0].record.status).toBe(200);
    expect(snapshot.pages.every((page) => page.record.status === 200)).toBe(true);
    expect(snapshot.llms?.status).toBe(200);
    expect(snapshot.sitemaps).toHaveLength(1);
    expect(snapshot.sitemaps[0]).toMatchObject({ role: "declared", url: "https://fixture.example/sitemap.xml", parentUrl: null });
  });

  it("records the robots.txt of both origins it asked, https first", async () => {
    const { snapshot } = await run();
    expect(snapshot.robots.map((r) => r.origin)).toEqual(["https://fixture.example", "http://fixture.example"]);
    expect(snapshot.robots[0].record.status).toBe(200);
  });

  it("records the http variant with its redirect hop and reuses the first timing sample", async () => {
    const { snapshot } = await run();
    expect(snapshot.httpVariant).toMatchObject({ kind: "http-variant", status: 200, finalUrl: "https://fixture.example/" });
    expect(snapshot.httpVariant?.redirectChain).toEqual([
      { url: "http://fixture.example/", status: 301, location: "https://fixture.example/" },
    ]);
    expect(snapshot.httpVariant?.body).toBeNull();
    expect(snapshot.timing).toHaveLength(2);
    for (const sample of snapshot.timing) {
      expect(sample).toMatchObject({ kind: "timing", status: 200, error: null, finalUrl: "https://fixture.example/" });
      expect(sample.ttfbMs).not.toBeNull();
      expect(sample.body).toBeNull();
    }
  });

  it("checks internal links, merging purposes and reusing sampled pages", async () => {
    const { fetcher, snapshot } = await run();
    const checks = snapshot.linkChecks.filter((entry) => entry.purposes.includes("S3.06"));
    expect(checks.length).toBeGreaterThanOrEqual(5);
    expect(new Set(snapshot.linkChecks.map((entry) => entry.url)).size).toBe(snapshot.linkChecks.length);
    expect(linkCheck(snapshot, "https://fixture.example/about")).toMatchObject({
      purposes: ["S3.06", "A4.01"],
      method: "GET",
      status: 200,
      outcome: "ok",
      retried: false,
    });
    const headed = fetcher.requests.filter((r) => r.kind === "link-check");
    expect(headed.length).toBeGreaterThan(0);
    expect(headed.every((r) => r.method === "HEAD")).toBe(true);
    for (const page of snapshot.pages) {
      expect(headed.some((r) => r.url === page.url), `${page.url} was fetched again as a link check`).toBe(false);
    }
  });
});

describe("fx-robots-block-all", () => {
  it("stops after robots.txt with BLOCKED_BY_ROBOTS and requests nothing else", async () => {
    const fixture = loadFixture("fx-robots-block-all");
    const fetcher = createFixtureFetcher(fixture);
    const snapshot = await runScan(fixture.site.inputUrl, fetcher, { now: new Date(fixture.site.scannedAt), scannerVersion: "test-1" });

    expect(fetcher.requests).toEqual([{ method: "GET", kind: "robots", url: "https://fixture.example/robots.txt" }]);
    expect(snapshot.outcome).toBe("BLOCKED_BY_ROBOTS");
    expect(snapshot.outcomeDetail).toContain("DataBridgesBot");
    expect(snapshot.homeUrl).toBe("https://fixture.example/");
    expect(snapshot.pages).toEqual([]);
    expect(snapshot.sitemaps).toEqual([]);
    expect(snapshot.llms).toBeNull();
    expect(snapshot.httpVariant).toBeNull();
    expect(snapshot.httpsAttempt).toBeNull();
    expect(snapshot.timing).toEqual([]);
    expect(snapshot.linkChecks).toEqual([]);
    expect(snapshot.robots).toHaveLength(1);
    expect(snapshot.stats.requestCount).toBe(1);
    expect(snapshot.candidates.considered).toBe(0);
  });
});

describe("fx-spa-shell", () => {
  it("records a refused port 80 as the http variant and finds no links to check", async () => {
    const fixture = loadFixture("fx-spa-shell");
    const snapshot = await runScan(fixture.site.inputUrl, createFixtureFetcher(fixture), {
      now: new Date(fixture.site.scannedAt),
      scannerVersion: "test-1",
    });
    expect(snapshot.outcome).toBe("COMPLETED");
    expect(snapshot.httpsAttempt).toBeNull();
    expect(snapshot.httpVariant).toMatchObject({ status: null, error: { code: "CONNECT_REFUSED" } });
    expect(snapshot.linkChecks).toEqual([]);
    expect(snapshot.pages.map((p) => p.type)).toEqual(["home", "services", "about", "faq", "other"]);
  });
});

describe("fx-minimal", () => {
  it("records the 404 for the default sitemap and for llms.txt", async () => {
    const fixture = loadFixture("fx-minimal");
    const snapshot = await runScan(fixture.site.inputUrl, createFixtureFetcher(fixture), {
      now: new Date(fixture.site.scannedAt),
      scannerVersion: "test-1",
    });
    expect(snapshot.sitemaps).toHaveLength(1);
    expect(snapshot.sitemaps[0]).toMatchObject({ role: "default", url: "https://fixture.example/sitemap.xml" });
    expect(snapshot.sitemaps[0].record.status).toBe(404);
    expect(snapshot.llms?.status).toBe(404);
    expect(snapshot.robots[0].record.status).toBe(404);
    expect(snapshot.httpVariant?.redirectChain[0]).toMatchObject({ status: 302 });
    expect(snapshot.linkChecks).toHaveLength(4);
  });
});

describe("fx-canonical-variants", () => {
  it("keeps the Link header on the fetched record", async () => {
    const fixture = loadFixture("fx-canonical-variants");
    const snapshot = await runScan(fixture.site.inputUrl, createFixtureFetcher(fixture), {
      now: new Date(fixture.site.scannedAt),
      scannerVersion: "test-1",
    });
    const services = snapshot.pages.find((p) => p.url === "https://fixture.example/services");
    expect(services?.record.headers.link).toContain('rel="canonical"');
  });
});

describe("the baseline synthetic site", () => {
  it("makes its requests in the planned order and counts them", async () => {
    const { snapshot, fetcher } = await scan(coreResources());
    expect(requested(fetcher)).toEqual([
      "GET robots https://example.ie/robots.txt",
      "GET page https://example.ie/",
      "GET sitemap https://example.ie/sitemap.xml",
      "GET page https://example.ie/services",
      "GET page https://example.ie/about",
      "GET page https://example.ie/faq",
      "GET page https://example.ie/blog/post-one",
      "GET llms https://example.ie/llms.txt",
      "GET robots http://example.ie/robots.txt",
      "GET http-variant http://example.ie/",
      "GET timing https://example.ie/",
      "GET timing https://example.ie/",
    ]);
    expect(snapshot.outcome).toBe("COMPLETED");
    expect(snapshot.stats).toMatchObject({ requestCount: 13, requestCapReached: false, jobTimedOut: false });
    expect(fetcher.requestCount).toBe(13);
    expect(snapshot.sitemaps[0].role).toBe("default");
    expect(snapshot.pages.map((p) => p.type)).toEqual(["home", "services", "about", "faq", "article"]);
    expect(snapshot.pages[0]).toMatchObject({ url: "https://example.ie/", depth: 0, reason: "Homepage after redirects" });
    expect(snapshot.candidates).toMatchObject({ fromSitemap: 4, fromHomepageLinks: 4, considered: 4, capped: false });
    expect(snapshot.candidates.excluded.duplicate).toBe(4);
    expect(snapshot.scannerRegion).toBeNull();
  });

  it("stamps the scan time, version and region it was given", async () => {
    const { snapshot } = await scan(coreResources(), { options: { scannerVersion: "9.9.9", scannerRegion: "eu-west-1" } });
    expect(snapshot.scannedAt).toBe("2026-10-02T09:15:00.000Z");
    expect(snapshot.scannerVersion).toBe("9.9.9");
    expect(snapshot.scannerRegion).toBe("eu-west-1");
    expect(snapshot.inputUrl).toBe("https://example.ie/");
  });

  it("scans the host root even when the input names a path or a bare host", async () => {
    const deep = await scan(coreResources(), { input: "https://example.ie/some/page?x=1" });
    expect(deep.snapshot.outcome).toBe("COMPLETED");
    expect(deep.snapshot.homeUrl).toBe("https://example.ie/");
    expect(deep.fetcher.requests[1].url).toBe("https://example.ie/");
    const bare = await scan(coreResources(), { input: "example.ie" });
    expect(bare.snapshot.inputUrl).toBe("https://example.ie/");
    expect(bare.snapshot.homeUrl).toBe("https://example.ie/");
  });

  it("only requests http when the input says http", async () => {
    const home = html("Home", { main: anchors(PAGE_PATHS) });
    const resources = coreResources("http://example.ie", home);
    resources["http://example.ie/"] = pageResource(home);
    const { snapshot, fetcher } = await scan(resources, { input: "http://example.ie/" });
    expect(snapshot.outcome).toBe("COMPLETED");
    expect(snapshot.httpsAttempt).toBeNull();
    expect(fetcher.requests.every((r) => r.url.startsWith("http://"))).toBe(true);
    expect(snapshot.httpVariant?.status).toBe(200);
  });
});

describe("the scanner's own agent", () => {
  it("stops with BLOCKED_BY_ROBOTS when its own group disallows the homepage, whatever * allows", async () => {
    const resources = coreResources();
    resources[`${ORIGIN}/robots.txt`] = robotsText("User-agent: *\nAllow: /\n\nUser-agent: DataBridgesBot\nDisallow: /\n");
    const { snapshot, fetcher } = await scan(resources);
    expect(snapshot.outcome).toBe("BLOCKED_BY_ROBOTS");
    expect(requested(fetcher)).toEqual(["GET robots https://example.ie/robots.txt"]);
    expect(snapshot.pages).toEqual([]);
    expect(snapshot.homeUrl).toBe("https://example.ie/");
    expect(snapshot.robots).toHaveLength(1);
  });

  it("falls back to the * group when there is no group for it", async () => {
    const resources = coreResources();
    resources[`${ORIGIN}/robots.txt`] = robotsText("User-agent: *\nDisallow: /\n");
    const { snapshot, fetcher } = await scan(resources);
    expect(snapshot.outcome).toBe("BLOCKED_BY_ROBOTS");
    expect(fetcher.requests).toHaveLength(1);
  });

  it("carries on when its own group allows the site while * does not", async () => {
    const resources = coreResources();
    resources[`${ORIGIN}/robots.txt`] = robotsText("User-agent: DataBridgesBot\nAllow: /\n\nUser-agent: *\nDisallow: /\n");
    const { snapshot } = await scan(resources);
    expect(snapshot.outcome).toBe("COMPLETED");
    expect(snapshot.pages).toHaveLength(5);
  });

  it("ignores rules for paths other than the homepage when deciding to start", async () => {
    const resources = coreResources();
    resources[`${ORIGIN}/robots.txt`] = robotsText("User-agent: *\nDisallow: /private\n");
    const { snapshot } = await scan(resources);
    expect(snapshot.outcome).toBe("COMPLETED");
  });

  it("never requests a URL it is disallowed from, and keeps the refused page in the sample", async () => {
    const resources = coreResources();
    resources[`${ORIGIN}/robots.txt`] = robotsText("User-agent: DataBridgesBot\nDisallow: /services\nDisallow: /pricing\n");
    resources[`${ORIGIN}/`] = pageResource(html("Home", { main: anchors([...PAGE_PATHS, "/pricing"]) }));
    resources[`${ORIGIN}/pricing`] = pageResource(html("Pricing"));
    const { snapshot, fetcher } = await scan(resources);

    expect(snapshot.outcome).toBe("COMPLETED");
    expect(fetcher.hops.filter((url) => /\/(services|pricing)$/.test(url))).toEqual([]);
    const services = snapshot.pages.find((p) => p.url === `${ORIGIN}/services`);
    expect(services?.record).toMatchObject({ status: null, body: null, error: { code: "ROBOTS_DISALLOWED" } });
    expect(snapshot.pages).toHaveLength(5);
    expect(linkCheck(snapshot, `${ORIGIN}/services`)).toMatchObject({ outcome: "unobserved", errorCode: "ROBOTS_DISALLOWED", status: null });
    expect(linkCheck(snapshot, `${ORIGIN}/pricing`)).toMatchObject({ outcome: "unobserved", errorCode: "ROBOTS_DISALLOWED", method: "HEAD" });
  });

  it("does not request the sitemap, llms.txt or the http variant when robots.txt disallows them", async () => {
    const resources = coreResources();
    resources[`${ORIGIN}/robots.txt`] = robotsText("User-agent: DataBridgesBot\nDisallow: /sitemap.xml\nDisallow: /llms.txt\n");
    resources["http://example.ie/robots.txt"] = robotsText("User-agent: *\nDisallow: /\n");
    const { snapshot, fetcher } = await scan(resources);
    expect(snapshot.outcome).toBe("COMPLETED");
    expect(urlsOfKind(fetcher, "sitemap")).toEqual([]);
    expect(urlsOfKind(fetcher, "llms")).toEqual([]);
    expect(urlsOfKind(fetcher, "http-variant")).toEqual([]);
    expect(snapshot.sitemaps[0].record.error?.code).toBe("ROBOTS_DISALLOWED");
    expect(snapshot.llms?.error?.code).toBe("ROBOTS_DISALLOWED");
    expect(snapshot.httpVariant?.error?.code).toBe("ROBOTS_DISALLOWED");
    expect(snapshot.pages).toHaveLength(5);
  });

  it("carries on when robots.txt cannot be read (a server error), recording the failure", async () => {
    const resources = coreResources();
    resources[`${ORIGIN}/robots.txt`] = { ...robotsText("Service unavailable"), status: 503 };
    const { snapshot } = await scan(resources);
    expect(snapshot.outcome).toBe("COMPLETED");
    expect(snapshot.robots[0].record.status).toBe(503);
    expect(snapshot.sitemaps[0].role).toBe("default");
    expect(snapshot.pages).toHaveLength(5);
  });

  it("treats a missing robots.txt as permission to scan", async () => {
    const resources = coreResources();
    delete resources[`${ORIGIN}/robots.txt`];
    const { snapshot } = await scan(resources);
    expect(snapshot.outcome).toBe("COMPLETED");
    expect(snapshot.robots[0].record.status).toBe(404);
  });
});

describe("https and http", () => {
  const down = (code: string): FixtureResource => ({ error: { code, message: `${code} for the test` } });

  it("falls back to http when the https homepage cannot be fetched, keeping the failed attempt", async () => {
    const home = html("Home", { main: anchors(PAGE_PATHS) });
    const resources = coreResources("http://example.ie", home);
    resources["http://example.ie/"] = pageResource(home);
    resources["https://example.ie/robots.txt"] = down("CONNECT_REFUSED");
    resources["https://example.ie/"] = down("CONNECT_REFUSED");
    const { snapshot, fetcher } = await scan(resources);

    expect(snapshot.outcome).toBe("COMPLETED");
    expect(snapshot.homeUrl).toBe("http://example.ie/");
    expect(snapshot.inputUrl).toBe("https://example.ie/");
    expect(snapshot.httpsAttempt).toMatchObject({ url: "https://example.ie/", status: null, error: { code: "CONNECT_REFUSED" } });
    expect(snapshot.httpVariant).toBeNull();
    expect(snapshot.robots.map((r) => r.origin)).toEqual(["https://example.ie", "http://example.ie"]);
    expect(snapshot.pages.map((p) => p.url)).toEqual([
      "http://example.ie/",
      "http://example.ie/services",
      "http://example.ie/about",
      "http://example.ie/faq",
      "http://example.ie/blog/post-one",
    ]);
    expect(requested(fetcher).slice(0, 4)).toEqual([
      "GET robots https://example.ie/robots.txt",
      "GET page https://example.ie/",
      "GET robots http://example.ie/robots.txt",
      "GET page http://example.ie/",
    ]);
    expect(urlsOfKind(fetcher, "http-variant")).toEqual([]);
  });

  it("reports UNREACHABLE with both failed attempts when neither scheme works", async () => {
    const { snapshot, fetcher } = await scan({
      "https://example.ie/robots.txt": down("CONNECT_REFUSED"),
      "https://example.ie/": down("CONNECT_REFUSED"),
      "http://example.ie/": down("CONNECT_TIMEOUT"),
    });
    expect(snapshot.outcome).toBe("UNREACHABLE");
    expect(snapshot.outcomeDetail).toContain("CONNECT_REFUSED");
    expect(snapshot.outcomeDetail).toContain("CONNECT_TIMEOUT");
    expect(snapshot.httpsAttempt?.error?.code).toBe("CONNECT_REFUSED");
    expect(snapshot.httpVariant?.error?.code).toBe("CONNECT_TIMEOUT");
    expect(snapshot.pages).toEqual([]);
    expect(snapshot.sitemaps).toEqual([]);
    expect(snapshot.llms).toBeNull();
    expect(snapshot.timing).toEqual([]);
    expect(snapshot.homeUrl).toBe("https://example.ie/");
    expect(snapshot.stats.requestCount).toBe(4);
    expect(fetcher.requestCount).toBe(4);
  });

  it("does not fall back from an https server error: a 5xx is still a homepage", async () => {
    const resources = coreResources();
    resources[`${ORIGIN}/`] = pageResource(html("Home"), { status: 503 });
    const { snapshot, fetcher } = await scan(resources);
    expect(snapshot.outcome).toBe("COMPLETED");
    expect(snapshot.httpsAttempt).toBeNull();
    expect(snapshot.pages[0].record.status).toBe(503);
    expect(snapshot.timing).toEqual([]);
    expect(urlsOfKind(fetcher, "timing")).toEqual([]);
  });

  it("falls back when the https homepage redirects in a loop", async () => {
    const home = html("Home", { main: anchors(PAGE_PATHS) });
    const resources = coreResources("http://example.ie", home);
    resources["http://example.ie/"] = pageResource(home);
    resources["https://example.ie/"] = redirect("https://example.ie/");
    const { snapshot } = await scan(resources);
    expect(snapshot.outcome).toBe("COMPLETED");
    expect(snapshot.httpsAttempt?.error?.code).toBe("REDIRECT_LOOP");
    expect(snapshot.homeUrl).toBe("http://example.ie/");
  });
});

describe("redirects to another host", () => {
  const wwwResources = (): Record<string, FixtureResource> => {
    const resources = coreResources("https://www.example.ie");
    resources["https://example.ie/"] = redirect("https://www.example.ie/");
    return resources;
  };

  it("takes the final URL as the homepage, fetches robots.txt for the new origin and samples there", async () => {
    const { snapshot, fetcher } = await scan(wwwResources());
    expect(snapshot.outcome).toBe("COMPLETED");
    expect(snapshot.inputUrl).toBe("https://example.ie/");
    expect(snapshot.homeUrl).toBe("https://www.example.ie/");
    expect(snapshot.pages[0]).toMatchObject({ url: "https://www.example.ie/", type: "home" });
    expect(snapshot.pages[0].record.url).toBe("https://example.ie/");
    expect(snapshot.pages[0].record.redirectChain).toEqual([
      { url: "https://example.ie/", status: 301, location: "https://www.example.ie/" },
    ]);
    expect(snapshot.pages.slice(1).map((p) => p.url)).toEqual([
      "https://www.example.ie/services",
      "https://www.example.ie/about",
      "https://www.example.ie/faq",
      "https://www.example.ie/blog/post-one",
    ]);
    expect(snapshot.robots.map((r) => r.origin)).toEqual([
      "https://example.ie",
      "https://www.example.ie",
      "http://www.example.ie",
    ]);
    expect(requested(fetcher).slice(0, 3)).toEqual([
      "GET robots https://example.ie/robots.txt",
      "GET page https://example.ie/",
      "GET robots https://www.example.ie/robots.txt",
    ]);
    expect(snapshot.sitemaps[0].url).toBe("https://www.example.ie/sitemap.xml");
    expect(snapshot.httpVariant?.url).toBe("http://www.example.ie/");
  });

  it("stops with BLOCKED_BY_ROBOTS when the new origin disallows the scanner", async () => {
    const resources = wwwResources();
    resources["https://www.example.ie/robots.txt"] = robotsText("User-agent: DataBridgesBot\nDisallow: /\n");
    const { snapshot, fetcher } = await scan(resources);
    expect(snapshot.outcome).toBe("BLOCKED_BY_ROBOTS");
    expect(snapshot.outcomeDetail).toContain("redirects to");
    expect(snapshot.pages).toEqual([]);
    expect(snapshot.robots.map((r) => r.origin)).toEqual(["https://example.ie", "https://www.example.ie"]);
    expect(urlsOfKind(fetcher, "sitemap")).toEqual([]);
  });

  it("asks the own-agent gate before following a redirect, so a disallowed target is never requested", async () => {
    const resources = wwwResources();
    resources["https://www.example.ie/robots.txt"] = robotsText("User-agent: *\nDisallow: /\n");
    const gate = createOwnAgentGate();
    const { snapshot, fetcher } = await scan(resources, {
      fetcher: { robotsGate: gate.gate },
      options: { ownAgentGate: gate },
    });
    expect(snapshot.outcome).toBe("BLOCKED_BY_ROBOTS");
    expect(snapshot.outcomeDetail).toContain("redirect");
    expect(fetcher.hops).toEqual(["https://example.ie/robots.txt", "https://example.ie/", "https://www.example.ie/robots.txt"]);
    expect(snapshot.robots.map((r) => r.origin)).toEqual(["https://example.ie", "https://www.example.ie"]);
    expect(snapshot.pages).toEqual([]);
  });

  it("lets a gated redirect through when the target allows the scanner", async () => {
    const gate = createOwnAgentGate();
    const { snapshot, fetcher } = await scan(wwwResources(), {
      fetcher: { robotsGate: gate.gate },
      options: { ownAgentGate: gate },
    });
    expect(snapshot.outcome).toBe("COMPLETED");
    expect(snapshot.homeUrl).toBe("https://www.example.ie/");
    expect(snapshot.robots.map((r) => r.origin)).toEqual(["https://example.ie", "https://www.example.ie", "http://www.example.ie"]);
    expect(fetcher.hops.filter((url) => url === "https://www.example.ie/robots.txt")).toHaveLength(1);
  });

  it("follows a redirect to a different site and treats that as the site from then on", async () => {
    const resources = coreResources("https://other.ie");
    resources["https://example.ie/"] = redirect("https://other.ie/");
    const { snapshot } = await scan(resources);
    expect(snapshot.outcome).toBe("COMPLETED");
    expect(snapshot.inputUrl).toBe("https://example.ie/");
    expect(snapshot.homeUrl).toBe("https://other.ie/");
    expect(snapshot.pages.slice(1).every((p) => p.url.startsWith("https://other.ie/"))).toBe(true);
    expect(snapshot.pages).toHaveLength(5);
  });
});

describe("page sampling and failures", () => {
  it("does not replace a sampled page that fails", async () => {
    const resources = coreResources();
    resources[`${ORIGIN}/`] = pageResource(html("Home", { main: anchors([...PAGE_PATHS, "/team", "/contact-us-today"]) }));
    resources[`${ORIGIN}/about`] = pageResource(html("About"), { status: 500 });
    resources[`${ORIGIN}/team`] = pageResource(html("Team"));
    const { snapshot, fetcher } = await scan(resources);

    expect(snapshot.pages.map((p) => p.url)).toEqual([
      "https://example.ie/",
      "https://example.ie/services",
      "https://example.ie/about",
      "https://example.ie/faq",
      "https://example.ie/blog/post-one",
    ]);
    expect(snapshot.pages[2].record.status).toBe(500);
    expect(urlsOfKind(fetcher, "page")).not.toContain("https://example.ie/team");
  });

  it("records a page that never answers and keeps scanning", async () => {
    const resources = coreResources();
    resources[`${ORIGIN}/faq`] = { error: { code: "TIMEOUT", message: "timed out" } };
    const { snapshot } = await scan(resources);
    expect(snapshot.outcome).toBe("COMPLETED");
    const faq = snapshot.pages.find((p) => p.url === `${ORIGIN}/faq`);
    expect(faq?.record).toMatchObject({ status: null, error: { code: "TIMEOUT" } });
    expect(snapshot.pages).toHaveLength(5);
  });

  it("samples from homepage links alone when the sitemap is missing", async () => {
    const resources = coreResources();
    delete resources[`${ORIGIN}/sitemap.xml`];
    const { snapshot } = await scan(resources);
    expect(snapshot.sitemaps[0].record.status).toBe(404);
    expect(snapshot.pages).toHaveLength(5);
    expect(snapshot.candidates).toMatchObject({ fromSitemap: 0, fromHomepageLinks: 4 });
  });

  it("samples from the sitemap alone when the homepage has no links", async () => {
    const resources = coreResources();
    resources[`${ORIGIN}/`] = pageResource(html("Home"));
    const { snapshot } = await scan(resources);
    expect(snapshot.pages).toHaveLength(5);
    expect(snapshot.candidates).toMatchObject({ fromSitemap: 4, fromHomepageLinks: 0 });
  });

  it("does not parse a homepage that is not HTML, and still scans the sitemap", async () => {
    const resources = coreResources();
    resources[`${ORIGIN}/`] = pageResource("{}", { headers: { "content-type": "application/json" } });
    const { snapshot } = await scan(resources);
    expect(snapshot.outcome).toBe("COMPLETED");
    expect(snapshot.pages.map((p) => p.url).slice(1)).toEqual(PAGE_PATHS.map((p) => `${ORIGIN}${p}`));
  });

  it("flags a capped sitemap in the candidate summary", async () => {
    const resources = coreResources();
    const locs = Array.from({ length: 5002 }, (_, i) => `${ORIGIN}/p/${i}`);
    const body = `<?xml version="1.0"?><urlset>${locs.map((l) => `<url><loc>${l}</loc></url>`).join("")}</urlset>`;
    resources[`${ORIGIN}/sitemap.xml`] = textResource("application/xml", body);
    const { snapshot } = await scan(resources);
    expect(snapshot.candidates.capped).toBe(true);
  });
});

describe("sitemap discovery", () => {
  it("reads the first three children of a sitemap index in document order and ignores the rest", async () => {
    const resources = coreResources();
    resources[`${ORIGIN}/robots.txt`] = robotsText(`User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/index.xml\n`);
    delete resources[`${ORIGIN}/sitemap.xml`];
    resources[`${ORIGIN}/`] = pageResource(html("Home"));
    resources[`${ORIGIN}/index.xml`] = textResource(
      "application/xml",
      sitemapIndex([1, 2, 3, 4].map((n) => `${ORIGIN}/sm${n}.xml`)),
    );
    resources[`${ORIGIN}/sm1.xml`] = textResource("application/xml", urlset(ORIGIN, ["/services", "/about"]));
    resources[`${ORIGIN}/sm2.xml`] = textResource("application/xml", urlset(ORIGIN, ["/faq"]));
    resources[`${ORIGIN}/sm3.xml`] = textResource("application/xml", urlset(ORIGIN, ["/blog/post-one"]));
    resources[`${ORIGIN}/sm4.xml`] = textResource("application/xml", urlset(ORIGIN, ["/products"]));
    resources[`${ORIGIN}/products`] = pageResource(html("Products"));
    const { snapshot, fetcher } = await scan(resources);

    expect(urlsOfKind(fetcher, "sitemap")).toEqual([
      `${ORIGIN}/index.xml`,
      `${ORIGIN}/sm1.xml`,
      `${ORIGIN}/sm2.xml`,
      `${ORIGIN}/sm3.xml`,
    ]);
    expect(snapshot.sitemaps.map((s) => [s.role, s.url, s.parentUrl])).toEqual([
      ["declared", `${ORIGIN}/index.xml`, null],
      ["index-child", `${ORIGIN}/sm1.xml`, `${ORIGIN}/index.xml`],
      ["index-child", `${ORIGIN}/sm2.xml`, `${ORIGIN}/index.xml`],
      ["index-child", `${ORIGIN}/sm3.xml`, `${ORIGIN}/index.xml`],
    ]);
    expect(snapshot.pages.map((p) => p.url).slice(1)).toEqual(PAGE_PATHS.map((p) => `${ORIGIN}${p}`));
  });

  it("fetches at most three declared sitemaps and skips those on another site", async () => {
    const resources = coreResources();
    resources[`${ORIGIN}/robots.txt`] = robotsText(
      [
        "User-agent: *",
        "Allow: /",
        "Sitemap: https://cdn.other.ie/sitemap.xml",
        `Sitemap: ${ORIGIN}/sm-a.xml`,
        `Sitemap: ${ORIGIN}/sm-b.xml`,
        `Sitemap: ${ORIGIN}/sm-c.xml`,
        `Sitemap: ${ORIGIN}/sm-d.xml`,
      ].join("\n"),
    );
    const { snapshot, fetcher } = await scan(resources);
    expect(urlsOfKind(fetcher, "sitemap")).toEqual([`${ORIGIN}/sm-a.xml`, `${ORIGIN}/sm-b.xml`, `${ORIGIN}/sm-c.xml`]);
    expect(snapshot.sitemaps.every((s) => s.role === "declared")).toBe(true);
  });

  it("does not fall back to /sitemap.xml when robots.txt declares only sitemaps on another site", async () => {
    const resources = coreResources();
    resources[`${ORIGIN}/robots.txt`] = robotsText("User-agent: *\nAllow: /\nSitemap: https://cdn.other.ie/sitemap.xml\n");
    const { snapshot, fetcher } = await scan(resources);
    expect(urlsOfKind(fetcher, "sitemap")).toEqual([]);
    expect(snapshot.sitemaps).toEqual([]);
    expect(fetcher.hops.every((url) => !url.includes("cdn.other.ie"))).toBe(true);
    expect(snapshot.pages).toHaveLength(5);
  });

  it("still records a declared sitemap that is missing", async () => {
    const resources = coreResources();
    resources[`${ORIGIN}/robots.txt`] = robotsText(`User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/gone.xml\n`);
    const { snapshot } = await scan(resources);
    expect(snapshot.sitemaps).toHaveLength(1);
    expect(snapshot.sitemaps[0]).toMatchObject({ role: "declared", url: `${ORIGIN}/gone.xml` });
    expect(snapshot.sitemaps[0].record.status).toBe(404);
  });
});

describe("link checks", () => {
  const extraSite = (main: string[], extra: Record<string, FixtureResource> = {}): Record<string, FixtureResource> => ({
    ...coreResources(ORIGIN, html("Home", { main: anchors([...PAGE_PATHS, ...main]) })),
    ...extra,
  });

  it("falls back from HEAD to GET only on 405 and 501", async () => {
    const resources = extraSite(["/pricing", "/legacy", "/gone", "/secret", "/ok"], {
      [`${ORIGIN}/pricing`]: pageResource(html("Pricing"), { headStatus: 405 }),
      [`${ORIGIN}/legacy`]: pageResource(html("Legacy"), { headStatus: 501 }),
      [`${ORIGIN}/gone`]: pageResource(html("Gone"), { status: 404 }),
      [`${ORIGIN}/secret`]: pageResource(html("Secret"), { status: 403 }),
      [`${ORIGIN}/ok`]: pageResource(html("Ok")),
    });
    const { snapshot, fetcher } = await scan(resources);
    const checkRequests = fetcher.requests.filter((r) => r.kind === "link-check").map((r) => `${r.method} ${r.url}`);
    expect(checkRequests).toEqual(
      expect.arrayContaining([
        `HEAD ${ORIGIN}/pricing`,
        `GET ${ORIGIN}/pricing`,
        `HEAD ${ORIGIN}/legacy`,
        `GET ${ORIGIN}/legacy`,
        `HEAD ${ORIGIN}/gone`,
        `HEAD ${ORIGIN}/secret`,
        `HEAD ${ORIGIN}/ok`,
      ]),
    );
    expect(checkRequests).not.toContain(`GET ${ORIGIN}/gone`);
    expect(checkRequests).not.toContain(`GET ${ORIGIN}/secret`);
    expect(checkRequests).not.toContain(`GET ${ORIGIN}/ok`);
    expect(linkCheck(snapshot, `${ORIGIN}/pricing`)).toMatchObject({ method: "GET", status: 200, outcome: "ok" });
    expect(linkCheck(snapshot, `${ORIGIN}/legacy`)).toMatchObject({ method: "GET", status: 200, outcome: "ok" });
    expect(linkCheck(snapshot, `${ORIGIN}/ok`)).toMatchObject({ method: "HEAD", status: 200, outcome: "ok", errorCode: null });
    expect(linkCheck(snapshot, `${ORIGIN}/gone`)).toMatchObject({ method: "HEAD", status: 404, outcome: "broken" });
    expect(linkCheck(snapshot, `${ORIGIN}/secret`)).toMatchObject({ status: 403, outcome: "unobserved" });
  });

  it("follows redirects on a link check and reports the final status", async () => {
    const resources = extraSite(["/old"], {
      [`${ORIGIN}/old`]: redirect(`${ORIGIN}/new`),
      [`${ORIGIN}/new`]: pageResource(html("New")),
    });
    const { snapshot } = await scan(resources);
    expect(linkCheck(snapshot, `${ORIGIN}/old`)).toMatchObject({ status: 200, outcome: "ok", errorCode: null });
  });

  it("marks a connection failure unobserved with its error code", async () => {
    const resources = extraSite(["/down"], { [`${ORIGIN}/down`]: { error: { code: "CONNECTION_RESET", message: "reset" } } });
    const { snapshot } = await scan(resources);
    expect(linkCheck(snapshot, `${ORIGIN}/down`)).toMatchObject({ status: null, errorCode: "CONNECTION_RESET", outcome: "unobserved" });
  });

  it("passes the fetcher's retry flag through, and a 5xx is broken only when it was retried", async () => {
    const resources = extraSite(["/flaky", "/flaky-unretried"], {
      [`${ORIGIN}/flaky`]: pageResource(html("Flaky"), { status: 503 }),
      [`${ORIGIN}/flaky-unretried`]: pageResource(html("Flaky"), { status: 502 }),
    });
    const site: FixtureSite = { scannedAt: NOW.toISOString(), inputUrl: `${ORIGIN}/`, resources };
    const inner = createSiteFetcher(site);
    const wrapped: Fetcher & { wasRetried(req: FetchRequest): boolean } = {
      fetch: (req) => inner.fetch(req),
      wasRetried: (req) => req.url === `${ORIGIN}/flaky`,
    };
    const snapshot = await runScan(`${ORIGIN}/`, wrapped, OPTIONS);
    expect(linkCheck(snapshot, `${ORIGIN}/flaky`)).toMatchObject({ status: 503, retried: true, outcome: "broken" });
    expect(linkCheck(snapshot, `${ORIGIN}/flaky-unretried`)).toMatchObject({ status: 502, retried: false, outcome: "unobserved" });
  });

  it("takes main-content links before the rest, ten per page, in document order", async () => {
    const nav = anchors(Array.from({ length: 8 }, (_, i) => `/x/nav-${i + 1}`));
    const main = anchors([...PAGE_PATHS, "/x/main-1", "/x/main-2", "/x/main-3"]);
    const footer = anchors(["/x/foot-1"]);
    const resources = coreResources(ORIGIN, html("Home", { nav, main, footer }));
    for (const path of ["nav-1", "nav-2", "nav-3", "nav-4", "main-1", "main-2", "main-3", "foot-1"]) {
      resources[`${ORIGIN}/x/${path}`] = pageResource(html(path));
    }
    const { snapshot } = await scan(resources);
    const fromHome = snapshot.linkChecks
      .filter((entry) => entry.purposes.includes("S3.06") && entry.sourceUrls.includes(`${ORIGIN}/`))
      .map((entry) => entry.url.replace(`${ORIGIN}/`, ""));
    expect(fromHome).toHaveLength(LINKS_PER_PAGE);
    expect(new Set(fromHome)).toEqual(
      new Set([...PAGE_PATHS.map((p) => p.slice(1)), "x/main-1", "x/main-2", "x/main-3", "x/nav-1", "x/nav-2", "x/nav-3"]),
    );
  });

  it("caps link checks at ten per page and forty per job", async () => {
    const resources = coreResources(ORIGIN, html("Home", { main: anchors([...PAGE_PATHS, ...Array.from({ length: 6 }, (_, i) => `/h/${i + 1}`)]) }));
    PAGE_PATHS.forEach((path, p) => {
      const targets = Array.from({ length: 14 }, (_, i) => `/t/${p}-${i + 1}`);
      resources[`${ORIGIN}${path}`] = pageResource(html(path, { main: anchors(targets) }));
      for (const target of targets) resources[`${ORIGIN}${target}`] = pageResource(html(target));
    });
    for (let i = 1; i <= 6; i += 1) resources[`${ORIGIN}/h/${i}`] = pageResource(html(`h${i}`));
    const { snapshot, fetcher } = await scan(resources);

    const checks = snapshot.linkChecks.filter((entry) => entry.purposes.includes("S3.06"));
    expect(checks).toHaveLength(LINKS_PER_JOB);
    for (const path of PAGE_PATHS) {
      const own = checks.filter((entry) => entry.sourceUrls.includes(`${ORIGIN}${path}`));
      expect(own.length, path).toBeLessThanOrEqual(LINKS_PER_PAGE);
    }
    expect(snapshot.stats.requestCount).toBeLessThanOrEqual(MAX_REQUESTS);
    expect(fetcher.requestCount).toBe(snapshot.stats.requestCount);
    expect(snapshot.stats.requestCapReached).toBe(false);
  });

  it("checks About-pattern links the sample did not pick, even beyond the S3.06 selection", async () => {
    const many = Array.from({ length: 12 }, (_, i) => `/y/${String(i + 1).padStart(2, "0")}`);
    const resources = coreResources(ORIGIN, html("Home", { main: anchors([...PAGE_PATHS, ...many]), footer: anchors(["/team", "/about-us"]) }));
    for (const path of many) resources[`${ORIGIN}${path}`] = pageResource(html(path));
    resources[`${ORIGIN}/team`] = pageResource(html("Team"));
    resources[`${ORIGIN}/about-us`] = pageResource(html("About us"), { status: 404 });
    const { snapshot, fetcher } = await scan(resources);

    expect(linkCheck(snapshot, `${ORIGIN}/team`)).toMatchObject({ purposes: ["A4.01"], status: 200, outcome: "ok", method: "HEAD" });
    expect(linkCheck(snapshot, `${ORIGIN}/about-us`)).toMatchObject({ purposes: ["A4.01"], status: 404, outcome: "broken" });
    expect(linkCheck(snapshot, `${ORIGIN}/about`).purposes).toContain("A4.01");
    expect(fetcher.requests.filter((r) => r.kind === "link-check" && r.url === `${ORIGIN}/about`)).toEqual([]);
    expect(snapshot.linkChecks.filter((entry) => entry.purposes.includes("S3.06"))).toHaveLength(LINKS_PER_PAGE);
  });

  it("keeps one entry per URL when a page links the same target several times", async () => {
    const resources = coreResources(ORIGIN, html("Home", { main: anchors([...PAGE_PATHS, "/dup", "/dup", "/dup#frag"]) }));
    resources[`${ORIGIN}/dup`] = pageResource(html("Dup"));
    const { snapshot } = await scan(resources);
    expect(snapshot.linkChecks.filter((entry) => entry.url === `${ORIGIN}/dup`)).toHaveLength(1);
  });

  it("does not check links to other sites, mail links or fragments", async () => {
    const resources = coreResources(
      ORIGIN,
      html("Home", {
        main: anchors([...PAGE_PATHS, "https://elsewhere.ie/page", "mailto:hello@example.ie", "tel:+35312345678", "#top"]),
      }),
    );
    const { snapshot, fetcher } = await scan(resources);
    expect(fetcher.hops.some((url) => url.includes("elsewhere.ie"))).toBe(false);
    expect(snapshot.linkChecks.every((entry) => entry.url.startsWith(`${ORIGIN}/`))).toBe(true);
  });
});

describe("the request budget", () => {
  it("never exceeds 60 requests, even when link targets redirect, and keeps the earlier phases", async () => {
    const resources = coreResources(ORIGIN, html("Home", { main: anchors([...PAGE_PATHS, ...Array.from({ length: 6 }, (_, i) => `/r/h-${i + 1}`)]) }));
    const targetsOf = (key: string) => Array.from({ length: 12 }, (_, i) => `/r/${key}-${i + 1}`);
    for (const target of Array.from({ length: 6 }, (_, i) => `/r/h-${i + 1}`)) resources[`${ORIGIN}${target}`] = redirect(`${ORIGIN}${target}-hop`);
    PAGE_PATHS.forEach((path, p) => {
      const targets = targetsOf(`p${p}`);
      resources[`${ORIGIN}${path}`] = pageResource(html(path, { main: anchors(targets) }));
      for (const target of targets) resources[`${ORIGIN}${target}`] = redirect(`${ORIGIN}${target}-hop`);
    });
    const hops = Object.keys(resources).filter((key) => key.includes("/r/") && resources[key].status === 301);
    for (const key of hops) resources[`${key}-hop`] = redirect(`${key}-final`);
    for (const key of hops) resources[`${key}-final`] = pageResource(html("Final"));

    const { snapshot, fetcher } = await scan(resources, { fetcher: { maxRequests: MAX_REQUESTS } });

    expect(snapshot.outcome).toBe("COMPLETED");
    expect(fetcher.requestCount).toBeLessThanOrEqual(MAX_REQUESTS);
    expect(snapshot.stats.requestCount).toBeLessThanOrEqual(MAX_REQUESTS);
    expect(snapshot.stats.requestCount).toBe(fetcher.requestCount);
    expect(snapshot.stats.requestCapReached).toBe(true);
    expect(snapshot.pages).toHaveLength(5);
    expect(snapshot.llms).not.toBeNull();
    expect(snapshot.httpVariant).not.toBeNull();
    expect(snapshot.timing).toHaveLength(2);
    expect(snapshot.linkChecks.length).toBeGreaterThan(0);
    for (const entry of snapshot.linkChecks) expect([null, "REQUEST_CAP_REACHED"]).toContain(entry.errorCode);
  });

  it("reports a job that cannot even fetch the homepage as JOB_ERROR rather than UNREACHABLE", async () => {
    const { snapshot } = await scan(coreResources(), { fetcher: { maxRequests: 1 } });
    expect(snapshot.outcome).toBe("JOB_ERROR");
    expect(snapshot.outcomeDetail).toContain("ran out of time or requests");
    expect(snapshot.pages).toEqual([]);
    expect(snapshot.stats.requestCapReached).toBe(true);
  });
});

describe("the fetcher contract", () => {
  it("takes statistics from the fetcher when it keeps them, and closes it once", async () => {
    const site: FixtureSite = { scannedAt: NOW.toISOString(), inputUrl: `${ORIGIN}/`, resources: coreResources() };
    const inner = createSiteFetcher(site);
    let closed = 0;
    const stats = { requestCount: 7, requestCapReached: false, jobTimedOut: false, jobDurationMs: 321 };
    const wrapped = { fetch: (req: FetchRequest) => inner.fetch(req), stats: () => stats, close: () => { closed += 1; } };
    const snapshot = await runScan(`${ORIGIN}/`, wrapped, OPTIONS);
    expect(snapshot.stats).toEqual(stats);
    expect(closed).toBe(1);
    expect(snapshot.outcome).toBe("COMPLETED");
  });

  it("stops optional work once the fetcher says the job timed out", async () => {
    const site: FixtureSite = { scannedAt: NOW.toISOString(), inputUrl: `${ORIGIN}/`, resources: coreResources() };
    const inner = createSiteFetcher(site);
    const wrapped = {
      fetch: (req: FetchRequest) => inner.fetch(req),
      stats: () => ({ requestCount: inner.requestCount, requestCapReached: false, jobTimedOut: inner.requests.length >= 7, jobDurationMs: 0 }),
    };
    const snapshot = await runScan(`${ORIGIN}/`, wrapped, OPTIONS);
    expect(snapshot.outcome).toBe("COMPLETED");
    expect(snapshot.llms).toBeNull();
    expect(snapshot.httpVariant).toBeNull();
    expect(snapshot.timing).toEqual([]);
    expect(snapshot.stats.jobTimedOut).toBe(true);
    expect(snapshot.pages).toHaveLength(5);
  });

  it("turns a fetcher that throws into UNREACHABLE records rather than crashing", async () => {
    const throwing: Fetcher = {
      fetch: async () => {
        throw new Error("boom");
      },
    };
    const snapshot = await runScan(`${ORIGIN}/`, throwing, OPTIONS);
    expect(snapshot.outcome).toBe("UNREACHABLE");
    expect(snapshot.httpsAttempt?.error?.code).toBe("UNKNOWN");
    expect(snapshot.httpsAttempt?.error?.message).toContain("boom");
    expect(snapshot.robots).toHaveLength(2);
  });

  it("reports JOB_ERROR when the fetcher breaks the record contract", async () => {
    const broken: Fetcher = { fetch: async () => ({}) as FetchRecord };
    const snapshot = await runScan(`${ORIGIN}/`, broken, OPTIONS);
    expect(snapshot.outcome).toBe("JOB_ERROR");
    expect(snapshot.outcomeDetail).toContain("unexpected error");
    expect(snapshot.pages).toEqual([]);
    expect(snapshot.inputUrl).toBe(`${ORIGIN}/`);
  });
});

describe("input handling", () => {
  it.each([
    ["http://localhost/", "RESERVED_HOSTNAME"],
    ["http://127.0.0.1/", "IP_LITERAL_HOST"],
    ["ftp://example.ie/", "SCHEME_NOT_ALLOWED"],
    ["https://user:pass@example.ie/", "USERINFO_NOT_ALLOWED"],
    ["https://example.ie:8443/", "PORT_NOT_ALLOWED"],
    ["https://site.test/", "RESERVED_HOSTNAME"],
    ["", "EMPTY"],
  ])("rejects %j before any request", async (input, reason) => {
    const fetcher = createSiteFetcher({ scannedAt: NOW.toISOString(), inputUrl: input, resources: coreResources() });
    const snapshot = await runScan(input, fetcher, OPTIONS);
    expect(fetcher.requests).toEqual([]);
    expect(snapshot.outcome).toBe("JOB_ERROR");
    expect(snapshot.outcomeDetail).toContain(reason);
    expect(snapshot.pages).toEqual([]);
    expect(snapshot.robots).toEqual([]);
    expect(snapshot.stats.requestCount).toBe(0);
  });

  it("rejects a scan time that is not a valid date", async () => {
    const fetcher = createSiteFetcher({ scannedAt: NOW.toISOString(), inputUrl: `${ORIGIN}/`, resources: coreResources() });
    await expect(runScan(`${ORIGIN}/`, fetcher, { ...OPTIONS, now: new Date("not a date") })).rejects.toThrow(RangeError);
    expect(fetcher.requests).toEqual([]);
  });

  it("does not read the clock: the snapshot carries the supplied scan time even for old dates", async () => {
    const { snapshot } = await scan(coreResources(), { options: { now: new Date("2020-01-02T03:04:05.000Z") } });
    expect(snapshot.scannedAt).toBe("2020-01-02T03:04:05.000Z");
  });
});

describe("the own-agent gate", () => {
  it("is closed unless a scan is attached", async () => {
    const gate = createOwnAgentGate();
    expect(await gate.gate("https://example.ie/", "page")).toBe(false);
  });

  it("answers for a scan while it runs and closes again afterwards", async () => {
    const gate = createOwnAgentGate();
    const resources = coreResources();
    resources[`${ORIGIN}/robots.txt`] = robotsText("User-agent: *\nDisallow: /services\n");
    let duringScan: boolean[] = [];
    const site: FixtureSite = { scannedAt: NOW.toISOString(), inputUrl: `${ORIGIN}/`, resources };
    const inner = createSiteFetcher(site);
    const probing: Fetcher = {
      fetch: async (req) => {
        if (req.kind === "llms") duringScan = [await gate.gate(`${ORIGIN}/about`, "page") as boolean, await gate.gate(`${ORIGIN}/services`, "page") as boolean];
        return inner.fetch(req);
      },
    };
    await runScan(`${ORIGIN}/`, probing, { ...OPTIONS, ownAgentGate: gate });
    expect(duringScan).toEqual([true, false]);
    expect(await gate.gate(`${ORIGIN}/about`, "page")).toBe(false);
  });
});

describe("scanSite", () => {
  const resolverFor = (address: string) => {
    const asked: string[] = [];
    return {
      asked,
      resolver: async (host: string) => {
        asked.push(host);
        return [{ address, family: 4 }];
      },
    };
  };

  it("builds a guarded fetcher that refuses addresses on the block list, so nothing is sent", async () => {
    const { asked, resolver } = resolverFor("127.0.0.1");
    const snapshot = await scanSite("https://databridges.ie/", { ...OPTIONS, resolver });
    expect(snapshot.outcome).toBe("UNREACHABLE");
    expect(snapshot.httpsAttempt?.error?.code).toBe("ADDRESS_BLOCKED");
    expect(snapshot.httpVariant?.error?.code).toBe("ADDRESS_BLOCKED");
    expect(snapshot.stats.requestCount).toBe(0);
    expect(asked.length).toBeGreaterThan(0);
    expect(new Set(asked)).toEqual(new Set(["databridges.ie"]));
  });

  it("refuses a host that is not on the allowlist without resolving it", async () => {
    const { asked, resolver } = resolverFor("203.0.113.9");
    const snapshot = await scanSite("https://not-allowed.example/", { ...OPTIONS, resolver });
    expect(snapshot.outcome).toBe("UNREACHABLE");
    expect(snapshot.httpsAttempt?.error?.code).toBe("HOST_NOT_ALLOWLISTED");
    expect(asked).toEqual([]);
    expect(snapshot.stats.requestCount).toBe(0);
  });
});
