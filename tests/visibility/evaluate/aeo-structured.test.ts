import { describe, expect, it } from "vitest";
import { buildEvalContext } from "@/lib/visibility/context";
import { evaluateA2 } from "@/lib/visibility/evaluate/aeo-structured";
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

const SPA_SHELL = `<!doctype html><html lang="en"><head><title>App</title>HEAD_EXTRA</head><body><div id="root"></div><noscript>You need to enable JavaScript to run this app.</noscript></body></html>`;

const ld = (value: unknown): string =>
  `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
const rawLd = (text: string): string => `<script type="application/ld+json">${text}</script>`;

const CTX = "https://schema.org";

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

function zeroed<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
}

function contextFor(pages: PageSpec[]): EvalContext {
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
    robots: [],
    sitemaps: [],
    llms: null,
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

function run(pages: PageSpec[]): Record<string, MetricResult> {
  return checked(evaluateA2(contextFor(pages)));
}

function rows(result: MetricResult): Record<string, unknown>[] {
  return result.evidence as Record<string, unknown>[];
}

function record1(result: MetricResult): Record<string, unknown> {
  return result.evidence as Record<string, unknown>;
}

const homeLd = (...blocks: unknown[]): PageSpec => ({
  path: "/",
  type: "home",
  body: html({ head: blocks.map(ld).join("") }),
});

const ORG = {
  "@context": CTX,
  "@type": "Organization",
  name: "Example Ltd",
  url: "https://example.ie/",
  logo: "https://example.ie/logo.png",
  telephone: "+353 1 555 0100",
  description: "We help small firms.",
};

const bad = (path: string, status = 500): PageSpec => ({
  path,
  type: "other",
  body: null,
  over: { status },
});

describe("evaluateA2: shape", () => {
  it("returns one result per A2 metric in id order with the plan's point values", () => {
    const results = evaluateA2(contextFor([homeLd(ORG)]));
    expect(results.map((r) => r.metricId)).toEqual([
      "A2.01", "A2.02", "A2.03", "A2.04", "A2.05", "A2.06", "A2.07", "A2.08",
    ]);
    for (const r of results) {
      if (r.maxPoints !== null) {
        expect([15, 20, 10, 10, 15, 5, 15, 10]).toContain(r.maxPoints);
      }
    }
  });

  it("is deterministic: the same context scores identically twice", () => {
    const ctx = contextFor([homeLd(ORG), { path: "/faq", type: "faq" }]);
    expect(evaluateA2(ctx)).toEqual(evaluateA2(ctx));
  });

  it("keeps every evidence string within 200 characters even for hostile page text", () => {
    const long = "x".repeat(900);
    const results = checked(
      evaluateA2(
        contextFor([
          homeLd({ ...ORG, name: long, sameAs: [`https://a.example/${long}`] }, { "@id": `https://example.ie/#${long}` }),
        ]),
      ),
    );
    expect(results["A2.02"].result).toBe("PASS");
  });
});

describe("A2.01 valid JSON-LD", () => {
  const one = (head: string, extra = ""): MetricResult =>
    run([{ path: "/", type: "home", body: html({ head }) + extra }])["A2.01"];
  const valid = { "@context": CTX, "@type": "Thing", name: "x" };

  it.each([
    ["a typed object with the https context", valid],
    ["the http context", { ...valid, "@context": "http://schema.org" }],
    ["the context with a trailing slash", { ...valid, "@context": "https://schema.org/" }],
    ["a context array holding schema.org", { ...valid, "@context": [CTX, { "@language": "en" }] }],
    ["an @vocab context", { ...valid, "@context": { "@vocab": "https://schema.org/" } }],
    ["a @graph container", { "@context": CTX, "@graph": [{ "@type": "Thing" }] }],
    ["a top-level array of typed objects", [valid]],
  ])("PASS for %s", (_label, value) => {
    const r = one(ld(value));
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(15);
    expect(rows(r)[0]).toMatchObject({ branch: "all_blocks_valid", valid: 1, invalid: 0 });
  });

  it.each([
    ["a block with no @context", { "@type": "Thing" }],
    ["a block with a non-schema.org context", { "@context": "https://example.com/ctx", "@type": "Thing" }],
    ["a block with neither @type nor @graph", { "@context": CTX, name: "x" }],
  ])("FAIL when the only block is %s", (_label, value) => {
    const r = one(ld(value));
    expect(r.result).toBe("FAIL");
    expect(rows(r)[0]).toMatchObject({ branch: "no_valid_block", valid: 0, invalid: 1 });
  });

  it.each([
    ["invalid JSON", rawLd('{"@context":"https://schema.org","@type":"Thing",}')],
    ["an empty script", rawLd("   ")],
    ["a JSON string", rawLd('"hello"')],
    ["a JSON number", rawLd("42")],
  ])("FAIL when the only block is %s", (_label, head) => {
    const r = one(head);
    expect(r.result).toBe("FAIL");
    expect(rows(r)[0]).toMatchObject({ branch: "no_valid_block", valid: 0 });
  });

  it("FAIL with no JSON-LD at all", () => {
    const r = one("");
    expect(r.result).toBe("FAIL");
    expect(r.points).toBe(0);
    expect(rows(r)[0]).toMatchObject({ branch: "no_json_ld", blocks: 0 });
  });

  it("ignores script blocks of another type", () => {
    const r = one('<script type="application/json">{"@type":"Thing"}</script>');
    expect(rows(r)[0]).toMatchObject({ branch: "no_json_ld" });
  });

  it("PASS for two valid blocks", () => {
    const r = one(ld(valid) + ld({ ...valid, name: "y" }));
    expect(r.result).toBe("PASS");
    expect(rows(r)[0]).toMatchObject({ valid: 2, invalid: 0 });
  });

  it.each([
    ["an unparseable block", rawLd("{nope")],
    ["a block with no schema.org context", ld({ "@type": "Thing" })],
  ])("PARTIAL 0.5 for a valid block next to %s", (_label, extra) => {
    const r = one(ld(valid) + extra);
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(7.5);
    expect(rows(r)[0]).toMatchObject({ branch: "some_blocks_invalid", valid: 1, invalid: 1 });
  });

  it("FAIL when two blocks are both invalid", () => {
    expect(one(rawLd("{a") + rawLd("{b")).result).toBe("FAIL");
  });

  it("PARTIAL 0.5 for microdata only", () => {
    const r = run([
      { path: "/", type: "home", body: html({ body: `<main itemscope itemtype="https://schema.org/WebPage"><p>${words(60)}</p></main>` }) },
    ])["A2.01"];
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(7.5);
    expect(rows(r)[0]).toMatchObject({ branch: "microdata_or_rdfa_only", microdataOrRdfa: true });
  });

  it("PARTIAL 0.5 for RDFa only", () => {
    const r = run([
      { path: "/", type: "home", body: html({ body: `<main vocab="https://schema.org/" typeof="WebPage"><p>${words(60)}</p></main>` }) },
    ])["A2.01"];
    expect(r.result).toBe("PARTIAL");
    expect(rows(r)[0]).toMatchObject({ branch: "microdata_or_rdfa_only" });
  });

  it("gives microdata the 0.5 even beside an invalid JSON-LD block (conservative reading)", () => {
    const r = run([
      { path: "/", type: "home", body: html({ head: rawLd("{oops"), body: `<main itemscope><p>${words(60)}</p></main>` }) },
    ])["A2.01"];
    expect(r.result).toBe("PARTIAL");
    expect(rows(r)[0]).toMatchObject({ branch: "microdata_or_rdfa_only", invalid: 1 });
  });

  it("does not downgrade valid JSON-LD because microdata is also present", () => {
    const r = run([
      { path: "/", type: "home", body: html({ head: ld(valid), body: `<main itemscope><p>${words(60)}</p></main>` }) },
    ])["A2.01"];
    expect(r.result).toBe("PASS");
  });

  it("averages the page scores: 1, 0.5 and 0 give 7.5 points", () => {
    const r = run([
      homeLd(valid),
      { path: "/services", type: "services", body: html({ head: ld(valid) + rawLd("{x") }) },
      { path: "/about", type: "about", body: html() },
    ])["A2.01"];
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(7.5);
    expect(rows(r).map((row) => row.s_p)).toEqual([1, 0.5, 0]);
    expect(r.explanation).toBe("1 of 3 observed pages has only valid JSON-LD, and 1 has mixed or microdata-only markup.");
  });

  it("reads the static head of a render-dependent page", () => {
    const shell = SPA_SHELL.replace("HEAD_EXTRA", ld(valid));
    const r = run([{ path: "/", type: "home", body: shell }])["A2.01"];
    expect(r.result).toBe("PASS");
  });

  it("ignores a block over the size cap when another block is valid", () => {
    const huge = rawLd(`{"@context":"https://schema.org","@type":"Thing","name":"${"x".repeat(300000)}"}`);
    const r = one(ld(valid) + huge);
    expect(r.result).toBe("PASS");
    expect(rows(r)[0]).toMatchObject({ valid: 1, invalid: 0, unreadable: 1 });
  });

  it("is NOT_OBSERVED when the only block is over the size cap", () => {
    const huge = rawLd(`{"@context":"https://schema.org","@type":"Thing","name":"${"x".repeat(300000)}"}`);
    const r = one(huge);
    expect(r.result).toBe("NOT_OBSERVED");
    expect(r.maxPoints).toBe(15);
    expect(rows(r)[0]).toMatchObject({ status: "not_observed", branch: "json_ld_beyond_scanner_limits" });
  });

  it("is NOT_OBSERVED when the only block is nested deeper than the cap", () => {
    const deep = rawLd(`{"@context":"https://schema.org","@type":"Thing","x":${"[".repeat(40)}${"]".repeat(40)}}`);
    expect(one(deep).result).toBe("NOT_OBSERVED");
  });

  it("is NOT_OBSERVED when invalid blocks fill the cap and more blocks follow", () => {
    const r = one(Array.from({ length: 21 }, () => rawLd("{bad")).join(""));
    expect(r.result).toBe("NOT_OBSERVED");
    expect(rows(r)[0]).toMatchObject({ blocks: 20, blocksSeen: 21 });
  });

  it("still PASSes 21 valid blocks, since the first 20 are valid", () => {
    const r = one(Array.from({ length: 21 }, () => ld(valid)).join(""));
    expect(r.result).toBe("PASS");
  });

  it("treats pages that failed to fetch as unobserved and applies the half rule", () => {
    const ok = run([homeLd(valid), { path: "/a", type: "other", body: html({ head: ld(valid) }) }, bad("/b")])["A2.01"];
    expect(ok.result).toBe("PASS");
    expect(rows(ok)[2]).toMatchObject({ status: "scan_error", fetchClass: "http_error", httpStatus: 500 });

    const few = run([homeLd(valid), bad("/b"), bad("/c")])["A2.01"];
    expect(few.result).toBe("SCAN_ERROR");
  });

  it("is NOT_OBSERVED when most pages were blocked by robots or were not HTML", () => {
    const blocked: PageSpec = { path: "/x", type: "other", body: null, over: { status: null, error: fail("ROBOTS_DISALLOWED") } };
    const pdf: PageSpec = { path: "/y", type: "other", body: null, over: { contentType: "application/pdf", error: fail("CONTENT_TYPE_REJECTED") } };
    expect(run([homeLd(valid), blocked, pdf])["A2.01"].result).toBe("NOT_OBSERVED");
  });

  it("is NOT_OBSERVED when no page was sampled", () => {
    expect(run([])["A2.01"].result).toBe("NOT_OBSERVED");
  });
});

describe("A2.02 organisation identity", () => {
  const score = (node: Record<string, unknown>): MetricResult =>
    run([homeLd({ "@context": CTX, "@type": "Organization", ...node })])["A2.02"];

  it("PASS with every property", () => {
    const r = run([homeLd(ORG)])["A2.02"];
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(20);
    expect(record1(r)).toMatchObject({
      branch: "organisation_node_scored",
      nodeType: "Organization",
      points: 20,
      of: 20,
      present: { name: true, url: true, logoOrImage: true, contact: true, description: true },
    });
    expect(r.explanation).toBe("The homepage organisation node earns 20 of 20 identity points.");
  });

  it.each([
    ["name only", { name: "Example" }, 4],
    ["url only", { url: "https://example.ie/" }, 4],
    ["name and url", { name: "Example", url: "https://example.ie/" }, 8],
    ["name, url and a logo", { name: "E", url: "https://e.ie/", logo: "https://e.ie/l.png" }, 12],
    ["name, url and an image", { name: "E", url: "https://e.ie/", image: "https://e.ie/i.png" }, 12],
    ["name, url, logo and a telephone", { name: "E", url: "https://e.ie/", logo: "l", telephone: "01" }, 16],
    ["name, url, logo, telephone and a description", { name: "E", url: "https://e.ie/", logo: "l", telephone: "01", description: "d" }, 20],
  ])("scores %s as %i of 20", (_label, node, points) => {
    const r = score(node);
    expect(record1(r).points).toBe(points);
    expect(r.points).toBe(points);
    expect(r.result).toBe(points === 20 ? "PASS" : "PARTIAL");
  });

  it.each(["telephone", "email", "address", "contactPoint"])("counts %s as contact information", (key) => {
    const value =
      key === "address"
        ? { "@type": "PostalAddress", addressLocality: "Kilcock" }
        : key === "contactPoint"
          ? { "@type": "ContactPoint", telephone: "01" }
          : "x@example.ie";
    const r = score({ [key]: value });
    expect(record1(r).present).toMatchObject({ contact: true });
    expect(r.points).toBe(4);
  });

  it("counts a logo given as an ImageObject", () => {
    const r = score({ logo: { "@type": "ImageObject", url: "https://example.ie/l.png" } });
    expect(record1(r).present).toMatchObject({ logoOrImage: true });
  });

  it.each([
    ["an empty name", { name: "" }, "name"],
    ["a whitespace name", { name: "   " }, "name"],
    ["an empty logo", { logo: "" }, "logoOrImage"],
    ["a logo object with no data", { logo: { "@type": "ImageObject" } }, "logoOrImage"],
    ["an empty contact list", { telephone: "", email: [], address: {} }, "contact"],
    ["a blank description", { description: " " }, "description"],
    ["a numeric name", { name: 5 }, "name"],
  ])("does not count %s", (_label, node, key) => {
    const r = score(node);
    expect((record1(r).present as Record<string, boolean>)[key]).toBe(false);
  });

  it("accepts a language-tagged name value", () => {
    const r = score({ name: { "@value": "Example", "@language": "en" } });
    expect(record1(r).present).toMatchObject({ name: true });
  });

  it("FAIL when the homepage has no Organization or Person node", () => {
    const r = run([homeLd({ "@context": CTX, "@type": "WebSite", name: "Example", url: "https://example.ie/" })])["A2.02"];
    expect(r.result).toBe("FAIL");
    expect(r.points).toBe(0);
    expect(record1(r)).toMatchObject({ branch: "no_organisation_node", jsonLdNodes: 1 });
  });

  it("FAIL when there is no JSON-LD at all", () => {
    expect(run([{ path: "/", type: "home" }])["A2.02"].result).toBe("FAIL");
  });

  it.each(["LocalBusiness", "ProfessionalService", "Corporation", "NGO", "Store", "LegalService"])(
    "accepts the %s type",
    (type) => {
      expect(score({ "@type": type, name: "E" }).points).toBe(4);
    },
  );

  it("accepts a type given as an array that includes an organisation type", () => {
    expect(score({ "@type": ["Thing", "LocalBusiness"], name: "E" }).points).toBe(4);
  });

  it("does not accept a type outside the list (lists change only through a versioned release)", () => {
    expect(score({ "@type": "Dentist", name: "E" }).result).toBe("FAIL");
  });

  it("accepts a Person node for a sole trader", () => {
    const r = run([homeLd({ "@context": CTX, "@type": "Person", name: "Jo", url: "https://jo.ie/", email: "jo@jo.ie" })])["A2.02"];
    expect(r.points).toBe(12);
    expect(record1(r).nodeType).toBe("Person");
  });

  it("prefers an Organization over a Person on the same page", () => {
    const r = run([
      homeLd({
        "@context": CTX,
        "@graph": [
          { "@type": "Person", name: "Jo", url: "https://jo.ie/", email: "jo@jo.ie", description: "d", image: "i" },
          { "@type": "Organization", name: "Org" },
        ],
      }),
    ])["A2.02"];
    expect(record1(r).nodeType).toBe("Organization");
    expect(r.points).toBe(4);
  });

  it("reads an Organization inside a @graph", () => {
    const r = run([homeLd({ "@context": CTX, "@graph": [{ "@type": "WebSite", name: "W" }, ORG] })])["A2.02"];
    expect(r.result).toBe("PASS");
    expect(record1(r).nodePath).toBe("@graph[1]");
  });

  it("takes the shallowest organisation node, not a nested publisher", () => {
    const r = run([
      homeLd({
        "@context": CTX,
        "@type": "Article",
        headline: "H",
        publisher: { "@type": "Organization", name: "Nested Publisher", url: "https://p.ie/", logo: "l", telephone: "1", description: "d" },
        about: { "@type": "Thing", sameAs: "https://x.example/" },
      }, { "@context": CTX, "@type": "Organization", name: "Top" }),
    ])["A2.02"];
    expect(record1(r).nodePath).toBe("");
    expect(r.points).toBe(4);
  });

  it("takes the earliest node when two organisations sit at the same depth", () => {
    const r = run([
      homeLd({ "@context": CTX, "@graph": [{ "@type": "Organization", name: "First" }, { "@type": "Organization", name: "Second", url: "https://s.ie/" }] }),
    ])["A2.02"];
    expect(r.points).toBe(4);
    expect(record1(r).nodePath).toBe("@graph[0]");
  });

  it("ignores an organisation node that sits on another page", () => {
    const r = run([
      { path: "/", type: "home", body: html() },
      { path: "/about", type: "about", body: html({ head: ld(ORG) }) },
    ])["A2.02"];
    expect(r.result).toBe("FAIL");
  });

  it("reads the head of a render-dependent homepage", () => {
    const r = run([{ path: "/", type: "home", body: SPA_SHELL.replace("HEAD_EXTRA", ld(ORG)) }])["A2.02"];
    expect(r.result).toBe("PASS");
  });

  it("is NOT_OBSERVED when the only evidence of an organisation may sit in an unreadable block", () => {
    const huge = rawLd(`{"@context":"https://schema.org","@type":"Organization","name":"${"x".repeat(300000)}"}`);
    const r = run([{ path: "/", type: "home", body: html({ head: huge }) }])["A2.02"];
    expect(r.result).toBe("NOT_OBSERVED");
    expect(record1(r).branch).toBe("json_ld_beyond_scanner_limits");
  });

  it("is SCAN_ERROR when the homepage returned a server error", () => {
    const r = run([{ path: "/", type: "home", body: null, over: { status: 500 } }])["A2.02"];
    expect(r.result).toBe("SCAN_ERROR");
    expect(r.maxPoints).toBe(20);
    expect(record1(r)).toMatchObject({ fetchClass: "http_error", httpStatus: 500 });
  });

  it("is NOT_OBSERVED when the homepage was blocked by the scanner's own robots rule", () => {
    const r = run([{ path: "/", type: "home", body: null, over: { status: null, error: fail("ROBOTS_DISALLOWED") } }])["A2.02"];
    expect(r.result).toBe("NOT_OBSERVED");
  });

  it("is NOT_OBSERVED when no homepage was sampled", () => {
    const r = run([{ path: "/about", type: "about" }])["A2.02"];
    expect(r.result).toBe("NOT_OBSERVED");
    expect(r.maxPoints).toBe(20);
  });
});

describe("A2.03 profile links (sameAs)", () => {
  const withSameAs = (sameAs: unknown, extra: Record<string, unknown> = {}): MetricResult =>
    run([homeLd({ ...ORG, sameAs, ...extra })])["A2.03"];

  it("PASS for two distinct profiles on other hosts", () => {
    const r = withSameAs(["https://www.linkedin.com/company/example", "https://www.facebook.com/example"]);
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(10);
    expect(record1(r)).toMatchObject({ distinctProfiles: 2, branch: "two_or_more_profiles" });
    expect(record1(r).hosts).toEqual(["linkedin.com", "facebook.com"]);
  });

  it("PARTIAL 0.5 for one profile, given as a string", () => {
    const r = withSameAs("https://www.linkedin.com/company/example");
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(5);
    expect(record1(r).branch).toBe("one_profile");
  });

  it("FAIL when there is no sameAs", () => {
    const r = run([homeLd(ORG)])["A2.03"];
    expect(r.result).toBe("FAIL");
    expect(r.points).toBe(0);
    expect(record1(r).branch).toBe("no_profiles");
  });

  it("FAIL when there is no JSON-LD", () => {
    expect(run([{ path: "/", type: "home" }])["A2.03"].result).toBe("FAIL");
  });

  it("counts two URLs on the same other host as two profiles", () => {
    const r = withSameAs(["https://www.linkedin.com/company/example", "https://www.linkedin.com/in/jo"]);
    expect(r.result).toBe("PASS");
  });

  it("ignores URLs on the site's own host, including the www form", () => {
    const r = withSameAs(["https://example.ie/about", "https://www.example.ie/team", "https://www.linkedin.com/company/example"]);
    expect(r.result).toBe("PARTIAL");
    expect(record1(r).ignored).toMatchObject({ sameSite: 2 });
  });

  it("ignores http URLs, relative URLs and non-URLs", () => {
    const r = withSameAs(["http://www.linkedin.com/company/example", "/about", "not a url", "mailto:a@b.ie"]);
    expect(r.result).toBe("FAIL");
    expect(record1(r).ignored).toMatchObject({ notHttps: 1, notAbsolute: 3 });
  });

  it("counts a duplicate once, whatever the trailing slash or fragment", () => {
    const r = withSameAs(["https://www.linkedin.com/company/example", "https://www.linkedin.com/company/example/", "https://www.linkedin.com/company/example#top"]);
    expect(r.result).toBe("PARTIAL");
    expect(record1(r).ignored).toMatchObject({ duplicate: 2 });
  });

  it("ignores non-string sameAs values", () => {
    const r = withSameAs([{ "@id": "https://www.linkedin.com/company/example" }, 7, null]);
    expect(r.result).toBe("FAIL");
  });

  it("reads sameAs from any homepage node, not only the organisation", () => {
    const r = run([
      homeLd(ORG, { "@context": CTX, "@type": "WebSite", sameAs: ["https://a.example/x", "https://b.example/y"] }),
    ])["A2.03"];
    expect(r.result).toBe("PASS");
  });

  it("does not read sameAs on other pages", () => {
    const r = run([
      { path: "/", type: "home", body: html({ head: ld(ORG) }) },
      { path: "/about", type: "about", body: html({ head: ld({ ...ORG, sameAs: ["https://a.example/x", "https://b.example/y"] }) }) },
    ])["A2.03"];
    expect(r.result).toBe("FAIL");
  });

  it("is NOT_OBSERVED when none is found but a block could not be read", () => {
    const huge = rawLd(`{"@context":"https://schema.org","@type":"Organization","name":"${"x".repeat(300000)}"}`);
    const r = run([{ path: "/", type: "home", body: html({ head: huge }) }])["A2.03"];
    expect(r.result).toBe("NOT_OBSERVED");
  });

  it("is SCAN_ERROR or NOT_OBSERVED when the homepage cannot be read", () => {
    expect(run([{ path: "/", type: "home", body: null, over: { status: 503 } }])["A2.03"].result).toBe("SCAN_ERROR");
    expect(run([{ path: "/x", type: "other" }])["A2.03"].result).toBe("NOT_OBSERVED");
  });
});

describe("A2.04 identity graph coherence", () => {
  const ORG_ID = "https://example.ie/#org";
  const homeGraph = (extra: unknown[] = []): Record<string, unknown> => ({
    "@context": CTX,
    "@graph": [{ "@type": "Organization", "@id": ORG_ID, name: "Example" }, ...extra],
  });

  it("is NOT_APPLICABLE when nothing refers to another node by @id", () => {
    const r = run([homeLd(ORG)])["A2.04"];
    expect(r.result).toBe("NOT_APPLICABLE");
    expect(r.points).toBeNull();
    expect(record1(r).branch).toBe("no_references");
  });

  it("PASS when every reference resolves on the same page", () => {
    const r = run([homeLd(homeGraph([{ "@type": "WebSite", "@id": "https://example.ie/#site", publisher: { "@id": ORG_ID } }]))])["A2.04"];
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(10);
    expect(record1(r)).toMatchObject({ references: 1, resolved: 1, branch: "all_references_resolve" });
    expect(r.explanation).toBe("1 of 1 @id reference points to a node defined on the same page or the homepage.");
  });

  it("resolves a reference on another page against the homepage", () => {
    const r = run([
      homeLd(homeGraph()),
      { path: "/services", type: "services", body: html({ head: ld({ "@context": CTX, "@type": "Service", name: "S", provider: { "@id": ORG_ID } }) }) },
    ])["A2.04"];
    expect(r.result).toBe("PASS");
  });

  it("resolves a reference to a node defined later on the same page", () => {
    const r = run([
      homeLd(
        { "@context": CTX, "@type": "WebSite", publisher: { "@id": "https://example.ie/#late" } },
        { "@context": CTX, "@type": "Organization", "@id": "https://example.ie/#late", name: "L" },
      ),
    ])["A2.04"];
    expect(r.result).toBe("PASS");
  });

  it("FAIL when the only reference dangles", () => {
    const r = run([homeLd({ "@context": CTX, "@type": "WebSite", publisher: { "@id": "https://example.ie/#missing" } })])["A2.04"];
    expect(r.result).toBe("FAIL");
    expect(r.points).toBe(0);
    expect(record1(r)).toMatchObject({ references: 1, resolved: 0, branch: "some_references_dangling" });
    expect(record1(r).unresolved).toEqual([{ url: "https://example.ie/", id: "https://example.ie/#missing" }]);
  });

  it("PARTIAL when one of two references dangles", () => {
    const r = run([
      homeLd(
        homeGraph([
          { "@type": "WebSite", publisher: { "@id": ORG_ID } },
          { "@type": "WebPage", isPartOf: { "@id": "https://example.ie/#nowhere" } },
        ]),
      ),
    ])["A2.04"];
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(5);
  });

  it("does not resolve a reference against a page that is neither the same page nor the homepage", () => {
    const r = run([
      homeLd(ORG),
      { path: "/about", type: "about", body: html({ head: ld({ "@context": CTX, "@type": "Organization", "@id": "https://example.ie/#x", name: "X" }) }) },
      { path: "/services", type: "services", body: html({ head: ld({ "@context": CTX, "@type": "Service", provider: { "@id": "https://example.ie/#x" } }) }) },
    ])["A2.04"];
    expect(r.result).toBe("FAIL");
  });

  it("follows JSON-LD relative IRI rules, so '#org' on another page is a different node", () => {
    const r = run([
      homeLd({ "@context": CTX, "@type": "Organization", "@id": "#org", name: "Example" }),
      { path: "/services", type: "services", body: html({ head: ld({ "@context": CTX, "@type": "Service", provider: { "@id": "#org" } }) }) },
    ])["A2.04"];
    expect(r.result).toBe("FAIL");
  });

  it("resolves a relative '#org' reference on the same page", () => {
    const r = run([
      homeLd({ "@context": CTX, "@graph": [{ "@type": "Organization", "@id": "#org", name: "E" }, { "@type": "WebSite", publisher: { "@id": "#org" } }] }),
    ])["A2.04"];
    expect(r.result).toBe("PASS");
  });

  it("does not let a bare reference count as a definition", () => {
    const r = run([
      homeLd({ "@context": CTX, "@graph": [{ "@type": "WebSite", publisher: { "@id": "https://example.ie/#o" } }, { "@id": "https://example.ie/#o" }] }),
    ])["A2.04"];
    expect(r.result).toBe("FAIL");
    expect(record1(r).references).toBe(2);
  });

  it("accepts a definition that holds only @id and @type", () => {
    const r = run([
      homeLd({ "@context": CTX, "@graph": [{ "@type": "WebSite", publisher: { "@id": "https://example.ie/#o" } }, { "@id": "https://example.ie/#o", "@type": "Organization" }] }),
    ])["A2.04"];
    expect(r.result).toBe("PASS");
  });

  it("matches a blank-node reference to a blank-node definition on the same page", () => {
    const r = run([
      homeLd({ "@context": CTX, "@graph": [{ "@type": "WebSite", publisher: { "@id": "_:org" } }, { "@type": "Organization", "@id": "_:org", name: "E" }] }),
    ])["A2.04"];
    expect(r.result).toBe("PASS");
  });

  it("counts an undefined blank-node reference as dangling", () => {
    const r = run([homeLd({ "@context": CTX, "@type": "WebSite", publisher: { "@id": "_:ghost" } })])["A2.04"];
    expect(r.result).toBe("FAIL");
  });

  it("does not count references inside an unparseable block", () => {
    const r = run([
      { path: "/", type: "home", body: html({ head: rawLd('{"@context":"https://schema.org","publisher":{"@id":"#a"},}') }) },
    ])["A2.04"];
    expect(r.result).toBe("NOT_APPLICABLE");
  });

  it("reads the static head of a render-dependent page", () => {
    const shell = SPA_SHELL.replace("HEAD_EXTRA", ld(homeGraph([{ "@type": "WebSite", publisher: { "@id": ORG_ID } }])));
    expect(run([{ path: "/", type: "home", body: shell }])["A2.04"].result).toBe("PASS");
  });

  it("is NOT_OBSERVED when no sampled page could be read", () => {
    const r = run([{ path: "/", type: "home", body: null, over: { status: 500 } }])["A2.04"];
    expect(r.result).toBe("NOT_OBSERVED");
    expect(r.maxPoints).toBe(10);
  });
});

describe("A2.05 page-type schema", () => {
  const person = { "@type": "Person", name: "Jo Doe" };
  const article = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    "@context": CTX,
    "@type": "Article",
    headline: "How to file",
    datePublished: "2026-09-01",
    author: person,
    ...over,
  });
  const faq = (questions: number, answered = true): Record<string, unknown> => ({
    "@context": CTX,
    "@type": "FAQPage",
    mainEntity: Array.from({ length: questions }, (_, i) => ({
      "@type": "Question",
      name: `Question ${i}?`,
      acceptedAnswer: answered ? { "@type": "Answer", text: `Answer ${i}` } : { "@type": "Answer" },
    })),
  });
  const service = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    "@context": CTX,
    "@type": "Service",
    name: "Audit",
    description: "We audit things.",
    ...over,
  });
  const page = (type: PageType, ...blocks: unknown[]): PageSpec => ({
    path: type === "home" ? "/" : type === "article" ? "/blog/post" : `/${type}`,
    type,
    body: html({ head: blocks.map(ld).join("") }),
  });
  const single = (type: PageType, ...blocks: unknown[]): MetricResult =>
    run([page(type, ...blocks)])["A2.05"];

  it("PASS for a complete Article", () => {
    const r = single("article", article());
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(15);
    expect(rows(r)[0]).toMatchObject({
      pageType: "article",
      passed: 4,
      of: 4,
      checks: { articleNode: true, headline: true, datePublished: true, authorName: true },
    });
  });

  it.each(["Article", "BlogPosting", "NewsArticle", "TechArticle"])("accepts %s as an Article-family type", (type) => {
    expect(single("article", article({ "@type": type })).result).toBe("PASS");
  });

  it.each([
    ["headline", { headline: undefined }, 3],
    ["an empty headline", { headline: "  " }, 3],
    ["datePublished", { datePublished: undefined }, 3],
    ["author", { author: undefined }, 3],
    ["an author without a name", { author: { "@type": "Person" } }, 3],
  ])("PARTIAL 3/4 when an Article lacks %s", (_label, over, passed) => {
    const r = single("article", article(over));
    expect(r.result).toBe("PARTIAL");
    expect(rows(r)[0]).toMatchObject({ passed, of: 4, branch: "some_checks_passed" });
    expect(r.points).toBe(11.25);
  });

  it("accepts an author given as a plain name", () => {
    expect(single("article", article({ author: "Jo Doe" })).result).toBe("PASS");
  });

  it("accepts an author given as a list of people", () => {
    expect(single("article", article({ author: [person, { "@type": "Person", name: "Al" }] })).result).toBe("PASS");
  });

  it("resolves an author given as an @id reference to a named Person", () => {
    const r = single(
      "article",
      { "@context": CTX, "@graph": [article({ "@context": undefined, author: { "@id": "https://example.ie/#jo" } }), { "@type": "Person", "@id": "https://example.ie/#jo", name: "Jo" }] },
    );
    expect(r.result).toBe("PASS");
  });

  it("does not credit an author reference that resolves to nothing", () => {
    const r = single("article", article({ author: { "@id": "https://example.ie/#ghost" } }));
    expect(rows(r)[0]).toMatchObject({ checks: { authorName: false } });
  });

  it("scores the best Article node when there are several", () => {
    const r = single("article", { "@context": CTX, "@graph": [{ "@type": "Article" }, article({ "@context": undefined })] });
    expect(r.result).toBe("PASS");
  });

  it("FAIL when an article page has no Article node (all four checks fail)", () => {
    const r = single("article", { "@context": CTX, "@type": "WebPage", name: "x" });
    expect(r.result).toBe("FAIL");
    expect(rows(r)[0]).toMatchObject({ passed: 0, of: 4, branch: "no_checks_passed" });
  });

  it("FAIL when an article page has no JSON-LD", () => {
    expect(run([{ path: "/blog/post", type: "article" }])["A2.05"].result).toBe("FAIL");
  });

  it("PASS for a FAQPage with two answered questions", () => {
    const r = single("faq", faq(2));
    expect(r.result).toBe("PASS");
    expect(rows(r)[0]).toMatchObject({
      pageType: "faq",
      passed: 3,
      of: 3,
      checks: { faqPageNode: true, twoOrMoreQuestions: true, everyQuestionHasAnswerText: true },
    });
  });

  it("PARTIAL 2/3 with only one question", () => {
    const r = single("faq", faq(1));
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(10);
    expect(rows(r)[0]).toMatchObject({ checks: { twoOrMoreQuestions: false } });
  });

  it("PARTIAL 2/3 when an answer has no text", () => {
    const r = single("faq", faq(3, false));
    expect(r.points).toBe(10);
    expect(rows(r)[0]).toMatchObject({ checks: { everyQuestionHasAnswerText: false } });
  });

  it("PARTIAL 2/3 when one of three answers is empty", () => {
    const block = faq(3) as { mainEntity: { acceptedAnswer: { text: string } }[] };
    block.mainEntity[1].acceptedAnswer.text = "";
    expect(single("faq", block).points).toBe(10);
  });

  it("PARTIAL 2/3 for Question nodes without a FAQPage", () => {
    const block = { ...faq(2), "@type": "WebPage" };
    const r = single("faq", block);
    expect(r.points).toBe(10);
    expect(rows(r)[0]).toMatchObject({ checks: { faqPageNode: false, twoOrMoreQuestions: true } });
  });

  it("accepts answers given as a list", () => {
    const block = faq(2) as { mainEntity: Record<string, unknown>[] };
    for (const q of block.mainEntity) q.acceptedAnswer = [q.acceptedAnswer];
    expect(single("faq", block).result).toBe("PASS");
  });

  it("FAIL for a FAQ page with no FAQPage markup", () => {
    expect(single("faq", { "@context": CTX, "@type": "WebPage" }).result).toBe("FAIL");
  });

  it("scores a microdata-only FAQ page 0, since A2.05 reads JSON-LD nodes only", () => {
    const r = run([
      { path: "/faq", type: "faq", body: html({ body: `<main itemscope itemtype="https://schema.org/FAQPage"><p>${words(60)}</p></main>` }) },
    ])["A2.05"];
    expect(r.result).toBe("FAIL");
  });

  it.each(["Service", "Product", "OfferCatalog"])("PASS for a %s with a name and description", (type) => {
    const r = single("services", service({ "@type": type }));
    expect(r.result).toBe("PASS");
    expect(rows(r)[0]).toMatchObject({ passed: 3, of: 3 });
  });

  it.each([
    ["description", { description: undefined }],
    ["name", { name: undefined }],
  ])("PARTIAL 2/3 for a Service with no %s", (_label, over) => {
    const r = single("services", service(over));
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(10);
  });

  it("FAIL for a services page with no Service, Product or OfferCatalog node", () => {
    expect(single("services", { "@context": CTX, "@type": "WebPage", name: "S" }).result).toBe("FAIL");
  });

  it.each(["AboutPage", "ProfilePage", "Person"])("PASS for an about page with a %s node", (type) => {
    const r = single("about", { "@context": CTX, "@type": type, name: "About" });
    expect(r.result).toBe("PASS");
    expect(rows(r)[0]).toMatchObject({ passed: 1, of: 1 });
  });

  it("FAIL for an about page with only a WebPage node", () => {
    expect(single("about", { "@context": CTX, "@type": "WebPage" }).result).toBe("FAIL");
  });

  it.each(["home", "contact", "legal", "other"] as const)("%s pages have no expectation", (type) => {
    const r = run([page(type, ORG)])["A2.05"];
    expect(r.result).toBe("NOT_APPLICABLE");
    expect(r.points).toBeNull();
  });

  it("averages only the pages that have an expectation", () => {
    const r = run([
      homeLd(ORG),
      page("article", article()),
      page("faq", faq(1)),
      page("services"),
      page("about", { "@context": CTX, "@type": "AboutPage" }),
    ])["A2.05"];
    expect(rows(r)).toHaveLength(4);
    expect(rows(r).map((row) => row.s_p)).toEqual([1, 2 / 3, 0, 1]);
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(10.0);
    expect(r.explanation).toBe("The structured data expected for the page type is complete on 2 of 4 observed pages.");
  });

  it("keeps the metric applicable when the only expecting page has no JSON-LD (it scores 0)", () => {
    const r = run([homeLd(ORG), { path: "/faq", type: "faq" }])["A2.05"];
    expect(r.result).toBe("FAIL");
  });

  it("is NOT_OBSERVED for a page whose only JSON-LD may be in an unreadable block", () => {
    const huge = rawLd(`{"@context":"https://schema.org","@type":"FAQPage","name":"${"x".repeat(300000)}"}`);
    const r = run([{ path: "/faq", type: "faq", body: html({ head: huge }) }])["A2.05"];
    expect(r.result).toBe("NOT_OBSERVED");
  });

  it("reads the static head of a render-dependent page", () => {
    const shell = SPA_SHELL.replace("HEAD_EXTRA", ld(faq(2)));
    expect(run([{ path: "/faq", type: "faq", body: shell }])["A2.05"].result).toBe("PASS");
  });

  it("treats failed expecting pages as unobserved and applies the half rule", () => {
    const failing = (path: string, type: PageType): PageSpec => ({ path, type, body: null, over: { status: 404 } });
    const ok = run([page("faq", faq(2)), page("services", service()), failing("/about", "about")])["A2.05"];
    expect(ok.result).toBe("PASS");
    const few = run([page("faq", faq(2)), failing("/about", "about"), failing("/services", "services")])["A2.05"];
    expect(few.result).toBe("SCAN_ERROR");
    expect(few.maxPoints).toBe(15);
  });

  it("ignores unreadable pages that have no expectation", () => {
    const r = run([homeLd(ORG), bad("/other"), page("faq", faq(2))])["A2.05"];
    expect(r.result).toBe("PASS");
    expect(rows(r)).toHaveLength(1);
  });
});

describe("A2.06 breadcrumbs", () => {
  const item = (position: number, name: string, target?: string): Record<string, unknown> => ({
    "@type": "ListItem",
    position,
    name,
    ...(target === undefined ? {} : { item: target }),
  });
  const crumbs = (...items: unknown[]): Record<string, unknown> => ({
    "@context": CTX,
    "@type": "BreadcrumbList",
    itemListElement: items,
  });
  const deepPage = (...blocks: unknown[]): PageSpec => ({
    path: "/services/audit",
    type: "services",
    body: html({ head: blocks.map(ld).join("") }),
  });
  const single = (...blocks: unknown[]): MetricResult => run([deepPage(...blocks)])["A2.06"];

  it("PASS for a BreadcrumbList with two complete items", () => {
    const r = single(crumbs(item(1, "Home", "https://example.ie/"), item(2, "Services", "https://example.ie/services")));
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(5);
    expect(rows(r)[0]).toMatchObject({ depth: 2, breadcrumbLists: 1, items: 2, qualifyingItems: 2, branch: "breadcrumb_complete" });
  });

  it("PASS when the last item has a name and position but no item URL", () => {
    expect(single(crumbs(item(1, "Home", "https://example.ie/"), item(2, "Audit"))).result).toBe("PASS");
  });

  it("PASS when items have a name and an item URL but no position", () => {
    const noPosition = (name: string, target: string): Record<string, unknown> => ({ "@type": "ListItem", name, item: target });
    expect(single(crumbs(noPosition("Home", "https://example.ie/"), noPosition("Audit", "https://example.ie/a"))).result).toBe("PASS");
  });

  it("accepts a position written as a string", () => {
    const r = single(crumbs({ "@type": "ListItem", position: "1", name: "Home" }, { "@type": "ListItem", position: "2", name: "Audit" }));
    expect(r.result).toBe("PASS");
  });

  it("takes the name from the item object", () => {
    const r = single(
      crumbs(
        { "@type": "ListItem", position: 1, item: { "@id": "https://example.ie/", name: "Home" } },
        { "@type": "ListItem", position: 2, item: { "@id": "https://example.ie/a", name: "Audit" } },
      ),
    );
    expect(r.result).toBe("PASS");
  });

  it("FAIL with one item only", () => {
    const r = single(crumbs(item(1, "Home", "https://example.ie/")));
    expect(r.result).toBe("FAIL");
    expect(r.points).toBe(0);
    expect(rows(r)[0]).toMatchObject({ branch: "too_few_complete_items", items: 1, qualifyingItems: 1 });
  });

  it("FAIL when the items lack names", () => {
    const r = single(crumbs({ "@type": "ListItem", position: 1, item: "https://example.ie/" }, { "@type": "ListItem", position: 2, item: "https://example.ie/a" }));
    expect(r.result).toBe("FAIL");
    expect(rows(r)[0]).toMatchObject({ qualifyingItems: 0 });
  });

  it("FAIL when the items have neither an item nor a position", () => {
    const r = single(crumbs({ "@type": "ListItem", name: "Home" }, { "@type": "ListItem", name: "Audit" }));
    expect(r.result).toBe("FAIL");
  });

  it("counts only complete items toward the two needed", () => {
    const r = single(crumbs(item(1, "Home", "https://example.ie/"), { "@type": "ListItem", name: "Broken" }));
    expect(r.result).toBe("FAIL");
    expect(rows(r)[0]).toMatchObject({ items: 2, qualifyingItems: 1 });
  });

  it("FAIL without any BreadcrumbList", () => {
    const r = single({ "@context": CTX, "@type": "WebPage" });
    expect(r.result).toBe("FAIL");
    expect(rows(r)[0]).toMatchObject({ branch: "no_breadcrumb_list", breadcrumbLists: 0 });
  });

  it("FAIL when the breadcrumb sits in an unparseable block", () => {
    const r = run([{ path: "/services/audit", type: "services", body: html({ head: rawLd('{"@type":"BreadcrumbList",}') }) }])["A2.06"];
    expect(r.result).toBe("FAIL");
  });

  it("finds a BreadcrumbList inside a @graph", () => {
    const r = single({ "@context": CTX, "@graph": [{ "@type": "WebPage" }, crumbs(item(1, "Home", "https://example.ie/"), item(2, "Audit", "https://example.ie/a"))] });
    expect(r.result).toBe("PASS");
  });

  it("applies only to pages with a path depth of 2 or more", () => {
    const shallow = run([homeLd(ORG), { path: "/services", type: "services" }])["A2.06"];
    expect(shallow.result).toBe("NOT_APPLICABLE");

    const mixed = run([
      homeLd(ORG),
      { path: "/services", type: "services" },
      deepPage(crumbs(item(1, "Home", "https://example.ie/"), item(2, "Audit"))),
    ])["A2.06"];
    expect(mixed.result).toBe("PASS");
    expect(rows(mixed)).toHaveLength(1);
  });

  it("averages the deep pages", () => {
    const r = run([
      deepPage(crumbs(item(1, "Home", "https://example.ie/"), item(2, "Audit"))),
      { path: "/blog/post", type: "article" },
    ])["A2.06"];
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(2.5);
    expect(r.explanation).toBe("1 of 2 observed pages below the top level has a complete BreadcrumbList.");
  });

  it("reads the static head of a render-dependent page", () => {
    const shell = SPA_SHELL.replace("HEAD_EXTRA", ld(crumbs(item(1, "Home", "https://example.ie/"), item(2, "Audit"))));
    expect(run([{ path: "/services/audit", type: "services", body: shell }])["A2.06"].result).toBe("PASS");
  });

  it("is NOT_OBSERVED for a deep page whose only JSON-LD may be unreadable", () => {
    const huge = rawLd(`{"@context":"https://schema.org","@type":"BreadcrumbList","name":"${"x".repeat(300000)}"}`);
    const r = run([{ path: "/services/audit", type: "services", body: html({ head: huge }) }])["A2.06"];
    expect(r.result).toBe("NOT_OBSERVED");
  });

  it("treats failed deep pages as unobserved and applies the half rule", () => {
    const failing = (path: string): PageSpec => ({ path, type: "other", body: null, over: { status: 500 } });
    const good = deepPage(crumbs(item(1, "Home", "https://example.ie/"), item(2, "Audit")));
    expect(run([good, failing("/a/b")])["A2.06"].result).toBe("PASS");
    expect(run([failing("/a/b"), failing("/c/d"), good])["A2.06"].result).toBe("SCAN_ERROR");
  });
});

describe("A2.07 schema matches visible content", () => {
  const orgNamed = (name: string): Record<string, unknown> => ({ "@context": CTX, "@type": "Organization", name });
  const faqOf = (...questions: string[]): Record<string, unknown> => ({
    "@context": CTX,
    "@type": "FAQPage",
    mainEntity: questions.map((q) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: "Yes." } })),
  });
  const articleOf = (headline: string): Record<string, unknown> => ({ "@context": CTX, "@type": "Article", headline });
  const make = (opts: { blocks: unknown[]; body?: string; title?: string; path?: string; type?: PageType }): PageSpec => ({
    path: opts.path ?? "/",
    type: opts.type ?? "home",
    body: html({
      head: opts.blocks.map(ld).join(""),
      title: opts.title,
      body: opts.body ?? `<main><h1>Welcome</h1><p>${words(60)}</p></main>`,
    }),
  });
  const one = (opts: Parameters<typeof make>[0]): MetricResult => run([make(opts)])["A2.07"];

  it("is NOT_APPLICABLE when no check applies to any page", () => {
    const r = run([{ path: "/", type: "home" }, { path: "/about", type: "about" }])["A2.07"];
    expect(r.result).toBe("NOT_APPLICABLE");
    expect(r.points).toBeNull();
  });

  it("PASS when the organisation name appears in the visible text", () => {
    const r = one({ blocks: [orgNamed("Fernhill Joinery")], body: `<main><h1>Fernhill Joinery</h1><p>${words(60)}</p></main>` });
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(15);
    expect(rows(r)[0]).toMatchObject({ organisationName: { value: "fernhill joinery", found: true }, passed: 1, applicable: 1 });
  });

  it("PASS when the organisation name appears only in the title", () => {
    const r = one({ blocks: [orgNamed("Fernhill Joinery")], title: "Home | Fernhill Joinery" });
    expect(r.result).toBe("PASS");
  });

  it("matches the name case-insensitively and ignores extra whitespace", () => {
    const r = one({ blocks: [orgNamed("FERNHILL   Joinery")], body: `<main><p>fernhill joinery builds. ${words(60)}</p></main>` });
    expect(r.result).toBe("PASS");
  });

  it("FAIL when the organisation name is in neither the text nor the title", () => {
    const r = one({ blocks: [orgNamed("Fernhill Joinery")] });
    expect(r.result).toBe("FAIL");
    expect(rows(r)[0]).toMatchObject({ organisationName: { found: false }, branch: "no_checks_passed" });
  });

  it("does not count organisation text that is hidden", () => {
    const r = one({
      blocks: [orgNamed("Fernhill Joinery")],
      body: `<main><p style="display:none">Fernhill Joinery</p><p hidden>Fernhill Joinery</p><p>${words(60)}</p></main>`,
    });
    expect(r.result).toBe("FAIL");
  });

  it("does not check a Person node's name (only organisations)", () => {
    const r = one({ blocks: [{ "@context": CTX, "@type": "Person", name: "Nobody Here" }] });
    expect(r.result).toBe("NOT_APPLICABLE");
  });

  it("checks every FAQ question against the visible text", () => {
    const r = one({
      blocks: [faqOf("How long does it take?", "What does it cost?")],
      type: "faq",
      path: "/faq",
      body: `<main><h2>How long does it take?</h2><p>Two weeks.</p><h2>What does it cost?</h2><p>${words(50)}</p></main>`,
    });
    expect(r.result).toBe("PASS");
    expect(rows(r)[0]).toMatchObject({ questions: { found: 2, checked: 2, missing: [] }, passed: 2, applicable: 2 });
  });

  it("PARTIAL when one of two FAQ questions is missing from the page", () => {
    const r = one({
      blocks: [faqOf("How long does it take?", "Is parking available?")],
      type: "faq",
      path: "/faq",
      body: `<main><h2>How long does it take?</h2><p>${words(60)}</p></main>`,
    });
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(7.5);
    expect(rows(r)[0]).toMatchObject({ questions: { missing: ["is parking available?"] } });
  });

  it("matches questions after NFKC normalisation (full-width question mark)", () => {
    const r = one({
      blocks: [faqOf("Do you travel?")],
      type: "faq",
      path: "/faq",
      body: `<main><h2>Do you travel？</h2><p>${words(60)}</p></main>`,
    });
    expect(r.result).toBe("PASS");
  });

  it("ignores a Question with no name", () => {
    const block = faqOf("Real question?");
    (block.mainEntity as Record<string, unknown>[]).push({ "@type": "Question", acceptedAnswer: { "@type": "Answer", text: "x" } });
    const r = one({ blocks: [block], type: "faq", path: "/faq", body: `<main><h2>Real question?</h2><p>${words(60)}</p></main>` });
    expect(rows(r)[0]).toMatchObject({ questions: { found: 2, checked: 1 } });
    expect(r.result).toBe("PASS");
  });

  it("checks at most 100 questions on a page", () => {
    const many = Array.from({ length: 150 }, (_, i) => `Question number ${i}?`);
    const r = one({
      blocks: [faqOf(...many)],
      type: "faq",
      path: "/faq",
      body: `<main><p>${many.join(" ")} ${words(60)}</p></main>`,
    });
    expect(rows(r)[0]).toMatchObject({ questions: { found: 150, checked: 100 }, applicable: 100 });
    expect(r.result).toBe("PASS");
  });

  it.each([
    ["equals the h1", "Preliminary tax explained", "<h1>Preliminary tax explained</h1>", "Site", 1],
    ["is contained in the h1", "Preliminary tax explained", "<h1>Preliminary tax explained for sole traders</h1>", "Site", 1],
    ["differs only by case and spacing", "PRELIMINARY  tax Explained", "<h1>Preliminary tax explained</h1>", "Site", 1],
    ["is contained in the title only", "Preliminary tax explained", "<h1>Something else</h1>", "Preliminary tax explained | Blog", 1],
    ["is in neither", "Preliminary tax explained", "<h1>Something else</h1>", "Another title", 0],
    ["is longer than the h1 (the h1 is contained in the headline)", "Preliminary tax explained for sole traders", "<h1>Preliminary tax explained</h1>", "Site", 0],
  ])("Article headline %s", (_label, headline, h1, title, score) => {
    const r = one({
      blocks: [articleOf(headline)],
      type: "article",
      path: "/blog/post",
      title,
      body: `<main>${h1}<p>${words(60)}</p></main>`,
    });
    expect(rows(r)[0].s_p).toBe(score);
    expect(r.result).toBe(score === 1 ? "PASS" : "FAIL");
  });

  it("combines applicable checks on one page", () => {
    const r = one({
      blocks: [orgNamed("Fernhill Joinery"), faqOf("Are you insured?", "Do you deliver?")],
      type: "faq",
      path: "/faq",
      title: "FAQ | Fernhill Joinery",
      body: `<main><h2>Are you insured?</h2><p>${words(60)}</p></main>`,
    });
    expect(rows(r)[0]).toMatchObject({ passed: 2, applicable: 3 });
    expect(r.points).toBe(10);
  });

  it("leaves out pages with no applicable check, rather than scoring them 1", () => {
    const r = run([
      make({ blocks: [orgNamed("Fernhill Joinery")], title: "Fernhill Joinery" }),
      { path: "/about", type: "about" },
      make({ blocks: [faqOf("Not on the page?")], type: "faq", path: "/faq" }),
    ])["A2.07"];
    expect(rows(r).map((row) => row.s_p)).toEqual([1, null, 0]);
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(7.5);
  });

  it("is NOT_OBSERVED when every page is render-dependent", () => {
    const shell = SPA_SHELL.replace("HEAD_EXTRA", ld(orgNamed("Fernhill Joinery")));
    const r = run([
      { path: "/", type: "home", body: shell },
      { path: "/services", type: "services", body: shell },
    ])["A2.07"];
    expect(r.result).toBe("NOT_OBSERVED");
    expect(r.maxPoints).toBe(15);
    expect(rows(r)[0]).toMatchObject({ status: "not_observed", branch: "render_dependent" });
  });

  it("excludes a render-dependent page and scores the rest", () => {
    const shell = SPA_SHELL.replace("HEAD_EXTRA", ld(orgNamed("Fernhill Joinery")));
    const r = run([
      make({ blocks: [orgNamed("Fernhill Joinery")], title: "Fernhill Joinery" }),
      { path: "/services", type: "services", body: shell },
      { path: "/about", type: "about", body: shell },
    ])["A2.07"];
    expect(r.result).toBe("NOT_OBSERVED");
    const withTwo = run([
      make({ blocks: [orgNamed("Fernhill Joinery")], title: "Fernhill Joinery" }),
      make({ blocks: [orgNamed("Fernhill Joinery")], title: "Fernhill Joinery", path: "/about", type: "about" }),
      { path: "/services", type: "services", body: shell },
    ])["A2.07"];
    expect(withTwo.result).toBe("PASS");
  });

  it("treats failed pages as unobserved and applies the half rule", () => {
    const good = make({ blocks: [orgNamed("Fernhill Joinery")], title: "Fernhill Joinery" });
    expect(run([good, bad("/b")])["A2.07"].result).toBe("PASS");
    expect(run([good, bad("/b"), bad("/c")])["A2.07"].result).toBe("SCAN_ERROR");
  });

  it("reads only the first Article node on a page", () => {
    const r = one({
      blocks: [{ "@context": CTX, "@graph": [{ "@type": "Article", headline: "Matches the heading" }, { "@type": "BlogPosting", headline: "Never on the page" }] }],
      type: "article",
      path: "/blog/post",
      body: `<main><h1>Matches the heading</h1><p>${words(60)}</p></main>`,
    });
    expect(r.result).toBe("PASS");
  });
});

describe("A2.08 name consistency", () => {
  const home = (opts: { name?: string; siteName?: string | null; title: string; blocks?: unknown[] }): PageSpec[] => [
    {
      path: "/",
      type: "home",
      body: html({
        title: opts.title,
        head:
          (opts.blocks ?? [{ "@context": CTX, "@type": "Organization", name: opts.name }]).map(ld).join("") +
          (opts.siteName === undefined || opts.siteName === null ? "" : `<meta property="og:site_name" content="${opts.siteName}">`),
      }),
    },
  ];
  const score = (opts: Parameters<typeof home>[0]): MetricResult => run(home(opts))["A2.08"];

  it("PASS when the name equals og:site_name and appears in the title", () => {
    const r = score({ name: "Fernhill Joinery", siteName: "Fernhill Joinery", title: "Bespoke kitchens | Fernhill Joinery" });
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(10);
    expect(record1(r)).toMatchObject({ equalsSiteName: true, inTitle: true, branch: "name_consistent" });
    expect(r.explanation).toBe("The organisation name matches og:site_name and appears in the title.");
  });

  it("PARTIAL when only og:site_name matches", () => {
    const r = score({ name: "Fernhill Joinery", siteName: "Fernhill Joinery", title: "Bespoke kitchens" });
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(5);
    expect(record1(r)).toMatchObject({ equalsSiteName: true, inTitle: false, branch: "one_match" });
  });

  it("PARTIAL when only the title contains the name", () => {
    const r = score({ name: "Fernhill Joinery", siteName: "Fernhill", title: "Fernhill Joinery | Kitchens" });
    expect(r.result).toBe("PARTIAL");
    expect(record1(r)).toMatchObject({ equalsSiteName: false, inTitle: true });
  });

  it("PARTIAL when there is no og:site_name but the title contains the name", () => {
    const r = score({ name: "Fernhill Joinery", siteName: null, title: "Fernhill Joinery" });
    expect(r.result).toBe("PARTIAL");
    expect(record1(r).ogSiteName).toEqual([]);
  });

  it("FAIL when neither holds", () => {
    const r = score({ name: "Fernhill Joinery", siteName: "Fernhill Kitchens", title: "Bespoke kitchens" });
    expect(r.result).toBe("FAIL");
    expect(r.points).toBe(0);
    expect(record1(r).branch).toBe("no_match");
  });

  it("compares case-insensitively and ignores extra whitespace", () => {
    const r = score({ name: "Fernhill Joinery", siteName: "FERNHILL   JOINERY", title: "fernhill joinery" });
    expect(r.result).toBe("PASS");
  });

  it("does not treat a longer site name as equal", () => {
    const r = score({ name: "Fernhill", siteName: "Fernhill Joinery", title: "Fernhill Joinery" });
    expect(record1(r)).toMatchObject({ equalsSiteName: false, inTitle: true });
  });

  it("uses a Person name for a sole trader", () => {
    const r = score({ siteName: "Jo Doe", title: "Jo Doe", blocks: [{ "@context": CTX, "@type": "Person", name: "Jo Doe" }] });
    expect(r.result).toBe("PASS");
  });

  it("prefers a named organisation node over an earlier unnamed one", () => {
    const r = score({
      siteName: "Fernhill Joinery",
      title: "Fernhill Joinery",
      blocks: [{ "@context": CTX, "@graph": [{ "@type": "Organization" }, { "@type": "Organization", name: "Fernhill Joinery" }] }],
    });
    expect(r.result).toBe("PASS");
  });

  it("is NOT_APPLICABLE without a JSON-LD organisation name", () => {
    for (const blocks of [[], [{ "@context": CTX, "@type": "Organization" }], [{ "@context": CTX, "@type": "WebSite", name: "W" }]]) {
      const r = score({ siteName: "X", title: "X", blocks });
      expect(r.result).toBe("NOT_APPLICABLE");
      expect(r.points).toBeNull();
      expect(r.maxPoints).toBeNull();
    }
  });

  it("is NOT_OBSERVED when no name is found but a block could not be read", () => {
    const huge = rawLd(`{"@context":"https://schema.org","@type":"Organization","name":"${"x".repeat(300000)}"}`);
    const r = run([{ path: "/", type: "home", body: html({ head: huge }) }])["A2.08"];
    expect(r.result).toBe("NOT_OBSERVED");
  });

  it("reads the static head of a render-dependent homepage", () => {
    const shell = SPA_SHELL
      .replace("<title>App</title>", "<title>Fernhill Joinery</title>")
      .replace("HEAD_EXTRA", ld({ "@context": CTX, "@type": "Organization", name: "Fernhill Joinery" }) + '<meta property="og:site_name" content="Fernhill Joinery">');
    const r = run([{ path: "/", type: "home", body: shell }])["A2.08"];
    expect(r.result).toBe("PASS");
  });

  it("is SCAN_ERROR when the homepage returned a server error and NOT_OBSERVED without a homepage", () => {
    expect(run([{ path: "/", type: "home", body: null, over: { status: 502 } }])["A2.08"].result).toBe("SCAN_ERROR");
    expect(run([{ path: "/about", type: "about" }])["A2.08"].result).toBe("NOT_OBSERVED");
  });
});
