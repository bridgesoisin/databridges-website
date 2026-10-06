import { describe, expect, it } from "vitest";
import { buildEvalContext } from "@/lib/visibility/context";
import { evaluateS3 } from "@/lib/visibility/evaluate/seo-technical";
import { normaliseUrl } from "@/lib/visibility/normalise";
import { CANDIDATE_EXCLUSIONS, PAGE_TYPES } from "@/lib/visibility/types";
import type {
  CandidateExclusion,
  FetchErrorCode,
  FetchRecord,
  LinkCheckResult,
  MetricResult,
  PageType,
  RedirectHop,
  SampledPage,
  ScanSnapshot,
  TlsInfo,
} from "@/lib/visibility/types";

const SCANNED_AT = "2026-10-02T09:15:00.000Z";
const NOW = new Date(SCANNED_AT);
const HOME = "https://example.ie/";
const HTTP_HOME = "http://example.ie/";

const S3_IDS = ["S3.01", "S3.02", "S3.03", "S3.04", "S3.05", "S3.06", "S3.07"];
const S3_MAX = [20, 10, 15, 10, 10, 25, 10];

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

const words = (n: number): string => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

function html(opts: { head?: string; body?: string; lang?: string } = {}): string {
  const body = opts.body ?? `<main><h1>Heading</h1><p>${words(80)}</p></main>`;
  return `<!doctype html><html lang="${opts.lang ?? "en"}"><head><title>A page title</title>${opts.head ?? ""}</head><body>${body}</body></html>`;
}

const VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1">';
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

function homePage(over: Partial<FetchRecord> = {}, body: string = html({ head: VIEWPORT })): SampledPage {
  return sampled(HOME, "home", body, over);
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
  expect(results.map((r) => r.metricId)).toEqual(S3_IDS);
  results.forEach((result, i) => {
    const where = result.metricId;
    expect(result.reviewedBy).toBeNull();
    if (result.result === "NOT_APPLICABLE") {
      expect(result.points, where).toBeNull();
      expect(result.maxPoints, where).toBeNull();
    } else {
      expect(result.maxPoints, where).toBe(S3_MAX[i]);
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

function evaluate(over: Partial<ScanSnapshot> = {}): Record<string, MetricResult> {
  const snap = snapshot({ pages: [homePage()], ...over });
  const results = evaluateS3(buildEvalContext(snap, NOW));
  checkShape(results);
  return Object.fromEntries(results.map((r) => [r.metricId, r]));
}

function ev(result: MetricResult): Record<string, unknown> {
  return result.evidence as Record<string, unknown>;
}

function evList(result: MetricResult): Record<string, unknown>[] {
  return result.evidence as Record<string, unknown>[];
}

// ---------------------------------------------------------------------------
// S3.01
// ---------------------------------------------------------------------------

function variant(chain: [number, string | null][], over: Partial<FetchRecord> = {}): FetchRecord {
  let current = HTTP_HOME;
  const hops: RedirectHop[] = [];
  for (const [status, location] of chain) {
    hops.push({ url: current, status, location });
    if (location !== null) current = normaliseUrl(location, current) ?? current;
  }
  return record(HTTP_HOME, {
    kind: "http-variant",
    status: 200,
    finalUrl: current,
    redirectChain: hops,
    ...over,
  });
}

function s301(httpVariant: FetchRecord | null, over: Partial<ScanSnapshot> = {}): MetricResult {
  return evaluate({ httpVariant, ...over })["S3.01"];
}

describe("S3.01 HTTPS enforced", () => {
  it("is PASS (20) for a permanent 301 straight to https", () => {
    const r = s301(variant([[301, HOME]]));
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(20);
    expect(ev(r).branch).toBe("permanent_redirect_to_https");
    expect(ev(r).hopsToHttps).toBe(1);
  });

  it("is PASS for a permanent 308", () => {
    expect(s301(variant([[308, HOME]])).result).toBe("PASS");
  });

  it("is PASS for two permanent hops that end on the same site (www counts as same site)", () => {
    const r = s301(variant([[301, "http://www.example.ie/"], [308, "https://www.example.ie/"]]));
    expect(r.result).toBe("PASS");
    expect(ev(r).hopsToHttps).toBe(2);
  });

  it("counts only the hops needed to reach https (later https hops do not matter)", () => {
    const r = s301(variant([[301, HOME], [302, "https://www.example.ie/"]]));
    expect(r.result).toBe("PASS");
    expect(ev(r).hopsToHttps).toBe(1);
  });

  it("is PARTIAL (10) for permanent redirects that need three hops (conservative reading)", () => {
    const r = s301(
      variant([
        [301, "http://www.example.ie/"],
        [301, "http://www.example.ie/en"],
        [301, "https://www.example.ie/en"],
      ]),
    );
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(10);
    expect(ev(r).branch).toBe("permanent_redirect_over_two_hops");
  });

  it.each([302, 307, 303])("is PARTIAL (10) for a temporary %i redirect to https", (status) => {
    const r = s301(variant([[status, HOME]]));
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(10);
    expect(ev(r).branch).toBe("temporary_redirect_to_https");
  });

  it("is PARTIAL when any hop before https is temporary", () => {
    const r = s301(variant([[301, "http://www.example.ie/"], [302, "https://www.example.ie/"]]));
    expect(r.result).toBe("PARTIAL");
  });

  it("is FAIL when http serves a 2xx page", () => {
    const r = s301(variant([], { status: 200, finalUrl: HTTP_HOME }));
    expect(r.result).toBe("FAIL");
    expect(r.points).toBe(0);
    expect(ev(r).branch).toBe("http_served_2xx");
  });

  it("is FAIL when http-only redirects end on a 2xx page", () => {
    const r = s301(variant([[301, "http://www.example.ie/"]]));
    expect(r.result).toBe("FAIL");
    expect(ev(r).branch).toBe("http_served_2xx");
  });

  it.each([404, 410])("is FAIL when http answers %i without redirecting", (status) => {
    const r = s301(variant([], { status, finalUrl: HTTP_HOME }));
    expect(r.result).toBe("FAIL");
    expect(ev(r).branch).toBe("http_no_redirect_to_https");
  });

  it("is FAIL when the redirect leaves the site", () => {
    const r = s301(variant([[301, "https://other.example/"]]));
    expect(r.result).toBe("FAIL");
    expect(ev(r).branch).toBe("redirect_leaves_site");
  });

  it("is FAIL for a cross-site redirect the scanner refused to follow", () => {
    const r = s301(
      variant([[301, "https://other.example/"]], {
        status: 301,
        finalUrl: HTTP_HOME,
        error: failure("REDIRECT_BLOCKED"),
      }),
    );
    expect(r.result).toBe("FAIL");
  });

  it("is FAIL when a redirect carries no Location", () => {
    const r = s301(variant([[301, null]], { status: 301, finalUrl: HTTP_HOME }));
    expect(r.result).toBe("FAIL");
    expect(ev(r).branch).toBe("redirect_without_target");
  });

  it("is FAIL for a redirect loop that never reaches https", () => {
    const r = s301(
      variant([[301, "http://example.ie/a"], [301, HTTP_HOME]], {
        status: 301,
        error: failure("REDIRECT_LOOP"),
      }),
    );
    expect(r.result).toBe("FAIL");
    expect(ev(r).branch).toBe("redirect_chain_never_reaches_https");
  });

  it("is FAIL for too many http-only redirects", () => {
    const r = s301(variant([[301, "http://example.ie/a"]], { status: 301, error: failure("TOO_MANY_REDIRECTS") }));
    expect(r.result).toBe("FAIL");
  });

  it("is FAIL when https redirects back to plain http", () => {
    const r = s301(variant([[301, HOME], [301, "http://example.ie/home"]]));
    expect(r.result).toBe("FAIL");
    expect(ev(r).branch).toBe("redirect_returns_to_http");
  });

  it("scores an https redirect the scanner did not follow from its Location", () => {
    const r = s301(
      variant([[301, HOME]], { status: 301, finalUrl: HTTP_HOME, error: failure("REDIRECT_BLOCKED") }),
    );
    expect(r.result).toBe("PASS");
  });

  it("is FAIL whenever the https attempt failed, whatever the http variant shows", () => {
    const attempt = record(HOME, { status: null, error: failure("CONNECT_REFUSED") });
    const r = s301(variant([[301, HOME]]), {
      httpsAttempt: attempt,
      homeUrl: HTTP_HOME,
      pages: [sampled(HTTP_HOME, "home", html())],
    });
    expect(r.result).toBe("FAIL");
    expect(ev(r).branch).toBe("https_unavailable");
    expect(ev(r).httpsErrorCode).toBe("CONNECT_REFUSED");
  });

  it("is FAIL when the homepage ends on plain http without an https attempt record", () => {
    const r = s301(variant([[301, HOME]]), {
      homeUrl: HTTP_HOME,
      pages: [sampled(HTTP_HOME, "home", html())],
    });
    expect(r.result).toBe("FAIL");
    expect(ev(r).branch).toBe("homepage_ends_on_http");
  });

  it("is NOT_OBSERVED when no http request was recorded", () => {
    const r = s301(null);
    expect(r.result).toBe("NOT_OBSERVED");
    expect(r.points).toBeNull();
    expect(r.maxPoints).toBe(20);
  });

  it.each<FetchErrorCode>(["CONNECT_REFUSED", "CONNECT_TIMEOUT", "TIMEOUT", "CONNECTION_RESET"])(
    "is NOT_OBSERVED when port 80 fails with %s",
    (code) => {
      const r = s301(variant([], { status: null, finalUrl: HTTP_HOME, error: failure(code) }));
      expect(r.result).toBe("NOT_OBSERVED");
      expect(ev(r).branch).toBe("not_observed_port_80");
    },
  );

  it("is NOT_OBSERVED when an http-only redirect then times out", () => {
    const r = s301(
      variant([[301, "http://www.example.ie/"]], { status: null, error: failure("CONNECT_TIMEOUT") }),
    );
    expect(r.result).toBe("NOT_OBSERVED");
  });

  it.each([401, 403, 429, 500, 503])("is NOT_OBSERVED when http answers %i (a refusal or fault, not a verdict)", (status) => {
    const r = s301(variant([], { status, finalUrl: HTTP_HOME }));
    expect(r.result).toBe("NOT_OBSERVED");
    expect(ev(r).branch).toBe("not_observed_http_status");
  });

  it.each<FetchErrorCode>(["DNS_FAILED", "JOB_TIMEOUT", "REQUEST_CAP_REACHED", "PROTOCOL_ERROR"])(
    "is SCAN_ERROR when the request fails on the scanner side with %s",
    (code) => {
      const r = s301(variant([], { status: null, finalUrl: HTTP_HOME, error: failure(code) }));
      expect(r.result).toBe("SCAN_ERROR");
      expect(r.maxPoints).toBe(20);
    },
  );
});

// ---------------------------------------------------------------------------
// S3.02
// ---------------------------------------------------------------------------

function s302(tls: TlsInfo | null, over: Partial<ScanSnapshot> = {}, record: Partial<FetchRecord> = {}): MetricResult {
  return evaluate({ pages: [homePage({ tls, ...record })], ...over })["S3.02"];
}

describe("S3.02 Valid TLS certificate", () => {
  it("is PASS (10) for a valid certificate with 90 days left", () => {
    const r = s302({ authorized: true, daysToExpiry: 90, validTo: "2027-01-01T00:00:00.000Z" });
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(10);
    expect(ev(r).branch).toBe("valid_certificate");
  });

  it("is PASS at exactly 14 days", () => {
    expect(s302({ authorized: true, daysToExpiry: 14 }).result).toBe("PASS");
  });

  it("is PARTIAL (5) at 13 days", () => {
    const r = s302({ authorized: true, daysToExpiry: 13 });
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(5);
    expect(ev(r).branch).toBe("valid_expires_soon");
  });

  it("is PARTIAL on the last day before expiry (0 days)", () => {
    expect(s302({ authorized: true, daysToExpiry: 0 }).result).toBe("PARTIAL");
  });

  it("is FAIL for a certificate recorded as already expired", () => {
    const r = s302({ authorized: true, daysToExpiry: -1 });
    expect(r.result).toBe("FAIL");
    expect(ev(r).branch).toBe("certificate_expired");
  });

  it.each([
    ["CERT_HAS_EXPIRED", "has expired"],
    ["HOSTNAME_MISMATCH", "does not match the host name"],
    ["ERR_TLS_CERT_ALTNAME_INVALID", "does not match the host name"],
    ["DEPTH_ZERO_SELF_SIGNED_CERT", "is self-signed"],
    ["SELF_SIGNED_CERT_IN_CHAIN", "is self-signed"],
    ["UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "incomplete or untrusted chain"],
    ["UNABLE_TO_VERIFY_LEAF_SIGNATURE", "incomplete or untrusted chain"],
    ["CERT_REVOKED", "failed verification"],
  ])("is FAIL for an unauthorised certificate (%s)", (error, phrase) => {
    const r = s302({ authorized: false, error, daysToExpiry: 200 });
    expect(r.result).toBe("FAIL");
    expect(r.points).toBe(0);
    expect(r.explanation).toContain(phrase);
    expect(ev(r).tlsError).toBe(error);
  });

  it("is FAIL when the https attempt failed (homepage only reachable over http)", () => {
    const r = evaluate({
      httpsAttempt: record(HOME, { status: null, error: failure("TLS_ERROR") }),
      homeUrl: HTTP_HOME,
      pages: [sampled(HTTP_HOME, "home", html())],
    })["S3.02"];
    expect(r.result).toBe("FAIL");
    expect(ev(r).branch).toBe("https_unavailable");
  });

  it("is NOT_OBSERVED when no certificate information was recorded", () => {
    const r = s302(null);
    expect(r.result).toBe("NOT_OBSERVED");
    expect(r.maxPoints).toBe(10);
  });

  it("is NOT_OBSERVED when the certificate verified but its expiry was not recorded", () => {
    const r = s302({ authorized: true });
    expect(r.result).toBe("NOT_OBSERVED");
    expect(ev(r).branch).toBe("not_observed_no_expiry");
  });

  it("is NOT_OBSERVED when the homepage ended on plain http without an https attempt record", () => {
    const r = evaluate({ homeUrl: HTTP_HOME, pages: [sampled(HTTP_HOME, "home", html())] })["S3.02"];
    expect(r.result).toBe("NOT_OBSERVED");
  });

  it("is NOT_OBSERVED when the homepage was not fetched at all", () => {
    expect(evaluate({ pages: [] })["S3.02"].result).toBe("NOT_OBSERVED");
  });
});

// ---------------------------------------------------------------------------
// S3.03
// ---------------------------------------------------------------------------

const page = (path: string, type: PageType, body: string | null, over: Partial<FetchRecord> = {}): SampledPage =>
  sampled(`https://example.ie${path}`, type, body, over);

const WITH_VIEWPORT = html({ head: VIEWPORT });
const NO_VIEWPORT = html();

describe("S3.03 Mobile viewport", () => {
  it("is PASS (15) when width=device-width is declared", () => {
    const r = evaluate({ pages: [homePage()] })["S3.03"];
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(15);
    expect(evList(r)[0].branch).toBe("viewport_width_device_width");
  });

  it.each([
    "width=device-width",
    "Width = Device-Width, initial-scale=1",
    "initial-scale=1, width=device-width, viewport-fit=cover",
  ])("accepts the viewport content %j", (content) => {
    const body = html({ head: `<meta name="viewport" content="${content}">` });
    expect(evaluate({ pages: [homePage({}, body)] })["S3.03"].result).toBe("PASS");
  });

  it("is FAIL (0) when there is no viewport tag", () => {
    const r = evaluate({ pages: [homePage({}, NO_VIEWPORT)] })["S3.03"];
    expect(r.result).toBe("FAIL");
    expect(r.points).toBe(0);
    expect(evList(r)[0].branch).toBe("no_viewport_tag");
  });

  it("is FAIL when the viewport has a fixed width instead", () => {
    const body = html({ head: '<meta name="viewport" content="width=1024">' });
    const r = evaluate({ pages: [homePage({}, body)] })["S3.03"];
    expect(r.result).toBe("FAIL");
    expect(evList(r)[0].branch).toBe("viewport_without_device_width");
  });

  it("passes when any one of several viewport tags declares device-width", () => {
    const body = html({
      head: '<meta name="viewport" content="width=1024"><meta name="viewport" content="width=device-width">',
    });
    expect(evaluate({ pages: [homePage({}, body)] })["S3.03"].result).toBe("PASS");
  });

  it("is the mean of page scores (3 of 4 pages = 0.75 = 11.25 points)", () => {
    const r = evaluate({
      pages: [
        homePage(),
        page("/services", "services", WITH_VIEWPORT),
        page("/about", "about", NO_VIEWPORT),
        page("/faq", "faq", WITH_VIEWPORT),
      ],
    })["S3.03"];
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(11.25);
    expect(r.explanation).toContain("3 of 4");
  });

  it("covers every page type including contact and legal", () => {
    const r = evaluate({
      pages: [homePage(), page("/contact", "contact", NO_VIEWPORT), page("/privacy", "legal", NO_VIEWPORT)],
    })["S3.03"];
    expect(evList(r)).toHaveLength(3);
    expect(r.points).toBe(5);
  });

  it("is evaluated on a render-dependent page (it reads only the head)", () => {
    const spa = html({ head: VIEWPORT, body: SPA_BODY });
    const r = evaluate({ pages: [homePage({}, spa)] })["S3.03"];
    expect(r.result).toBe("PASS");
  });

  it("scores the observed pages when only a minority failed to fetch", () => {
    const r = evaluate({
      pages: [homePage(), page("/services", "services", null, { status: 500, contentType: "text/html" })],
    })["S3.03"];
    expect(r.result).toBe("PASS");
    expect(evList(r)[1].status).toBe("scan_error");
    expect(r.explanation).toContain("1 page could not be observed");
  });

  it("is SCAN_ERROR when fewer than half of the pages could be fetched", () => {
    const failed = (path: string, type: PageType): SampledPage =>
      page(path, type, null, { status: null, error: failure("TIMEOUT") });
    const r = evaluate({
      pages: [homePage(), failed("/services", "services"), failed("/about", "about")],
    })["S3.03"];
    expect(r.result).toBe("SCAN_ERROR");
    expect(r.points).toBeNull();
    expect(r.maxPoints).toBe(15);
  });

  it("is NOT_OBSERVED when most pages are blocked for the scanner by robots.txt", () => {
    const blocked = (path: string, type: PageType): SampledPage =>
      page(path, type, null, { status: null, error: failure("ROBOTS_DISALLOWED") });
    const r = evaluate({
      pages: [homePage(), blocked("/services", "services"), blocked("/about", "about")],
    })["S3.03"];
    expect(r.result).toBe("NOT_OBSERVED");
  });

  it("treats a non-HTML page as not observed", () => {
    const r = evaluate({
      pages: [homePage(), page("/guide", "other", "%PDF", { contentType: "application/pdf" })],
    })["S3.03"];
    expect(evList(r)[1].status).toBe("not_observed");
    expect(evList(r)[1].branch).toBe("not_observed_non_html");
  });
});

// ---------------------------------------------------------------------------
// S3.04
// ---------------------------------------------------------------------------

function s304(over: Partial<FetchRecord>): MetricResult {
  return evaluate({
    pages: [homePage({ decodedBytes: 5000, wireBytes: 1200, headers: {}, ...over })],
  })["S3.04"];
}

describe("S3.04 Response compression", () => {
  it.each(["gzip", "br", "zstd", "GZIP", "gzip, br", "x-gzip"])("is PASS (10) for Content-Encoding %s", (encoding) => {
    const r = s304({ headers: { "content-encoding": encoding } });
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(10);
    expect(ev(r).branch).toBe("compressed");
  });

  it("is FAIL when the response is not compressed", () => {
    const r = s304({});
    expect(r.result).toBe("FAIL");
    expect(r.points).toBe(0);
    expect(ev(r).branch).toBe("not_compressed");
  });

  it("is FAIL for an encoding outside gzip, br and zstd", () => {
    const r = s304({ headers: { "content-encoding": "deflate" } });
    expect(r.result).toBe("FAIL");
    expect(ev(r).branch).toBe("unlisted_encoding");
  });

  it("is FAIL for identity", () => {
    expect(s304({ headers: { "content-encoding": "identity" } }).result).toBe("FAIL");
  });

  it("is NOT_APPLICABLE at 1,023 bytes and evaluated at 1,024", () => {
    const small = s304({ decodedBytes: 1023, headers: {} });
    expect(small.result).toBe("NOT_APPLICABLE");
    expect(small.points).toBeNull();
    expect(small.maxPoints).toBeNull();
    expect(s304({ decodedBytes: 1024, headers: {} }).result).toBe("FAIL");
  });

  it("measures the body when decodedBytes was not recorded", () => {
    const big = homePage({ decodedBytes: 0, headers: { "content-encoding": "br" } }, html({ head: VIEWPORT, body: `<main><p>${words(400)}</p></main>` }));
    expect(evaluate({ pages: [big] })["S3.04"].result).toBe("PASS");
    const tiny = homePage({ decodedBytes: 0 }, "<p>hi</p>");
    expect(evaluate({ pages: [tiny] })["S3.04"].result).toBe("NOT_APPLICABLE");
  });

  it("is NOT_OBSERVED when no compression request was made", () => {
    const r = s304({ requestAcceptEncoding: null });
    expect(r.result).toBe("NOT_OBSERVED");
    expect(r.maxPoints).toBe(10);
  });

  it("is NOT_OBSERVED when the homepage produced no response", () => {
    expect(s304({ status: null, error: failure("TIMEOUT") }).result).toBe("NOT_OBSERVED");
  });

  it("is NOT_OBSERVED when the homepage was not fetched", () => {
    expect(evaluate({ pages: [] })["S3.04"].result).toBe("NOT_OBSERVED");
  });
});

// ---------------------------------------------------------------------------
// S3.05
// ---------------------------------------------------------------------------

function timing(ttfbMs: number | null, over: Partial<FetchRecord> = {}): FetchRecord {
  return record(HOME, { kind: "timing", ttfbMs, ...over });
}

function s305(first: number | null, rest: (FetchRecord | number | null)[], firstOver: Partial<FetchRecord> = {}): MetricResult {
  return evaluate({
    pages: [homePage({ ttfbMs: first, ...firstOver })],
    timing: rest.map((item) => (typeof item === "object" && item !== null ? item : timing(item))),
  })["S3.05"];
}

describe("S3.05 Server response time", () => {
  it("is PASS (10) when the median is 800 ms", () => {
    const r = s305(500, [800, 900]);
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(10);
    expect(ev(r).medianMs).toBe(800);
    expect(ev(r).branch).toBe("fast");
  });

  it("is PARTIAL (5) when the median is 801 ms", () => {
    const r = s305(500, [801, 900]);
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(5);
    expect(ev(r).branch).toBe("moderate");
  });

  it("is PARTIAL at exactly 1,800 ms and FAIL at 1,801 ms", () => {
    expect(s305(1800, [1800, 1800]).result).toBe("PARTIAL");
    const slow = s305(1801, [1801, 1801]);
    expect(slow.result).toBe("FAIL");
    expect(slow.points).toBe(0);
    expect(ev(slow).branch).toBe("slow");
  });

  it("uses the median, not the mean or the first sample", () => {
    expect(s305(100, [5000, 600]).result).toBe("PASS");
    expect(s305(5000, [100, 700]).result).toBe("PASS");
    expect(s305(100, [100, 5000]).result).toBe("PASS");
  });

  it("uses the mean of the two middle values when only two samples succeeded", () => {
    expect(s305(700, [900]).result).toBe("PASS");
    const r = s305(700, [901]);
    expect(r.result).toBe("PARTIAL");
    expect(ev(r).medianMs).toBe(800.5);
  });

  it("ignores a failed or non-2xx sample but still scores with the other two", () => {
    const blocked = timing(50, { status: 429 });
    const r = s305(900, [blocked, 700]);
    expect(r.result).toBe("PASS");
    expect(ev(r).usableSamples).toBe(2);
    expect(ev(r).samplesMs).toEqual([900, null, 700]);
  });

  it("ignores a sample with an error or no first-byte time", () => {
    const errored = timing(10, { error: failure("TIMEOUT") });
    const noByte = timing(null);
    expect(s305(900, [errored, 700]).result).toBe("PASS");
    expect(s305(900, [noByte, 700]).result).toBe("PASS");
  });

  it("is NOT_OBSERVED with fewer than two successful samples", () => {
    const one = s305(900, [timing(null), timing(20, { status: 503 })]);
    expect(one.result).toBe("NOT_OBSERVED");
    expect(one.points).toBeNull();
    expect(one.maxPoints).toBe(10);
    expect(s305(900, []).result).toBe("NOT_OBSERVED");
  });

  it("uses only the first three samples", () => {
    expect(s305(100, [200, 300, 9000, 9000]).result).toBe("PASS");
  });

  it("records the scanner region when known", () => {
    const r = evaluate({
      pages: [homePage({ ttfbMs: 100 })],
      timing: [timing(100), timing(100)],
      scannerRegion: "eu-west-1",
    })["S3.05"];
    expect(ev(r).scannerRegion).toBe("eu-west-1");
  });

  it("is NOT_OBSERVED when the homepage was not fetched and timing is empty", () => {
    expect(evaluate({ pages: [] })["S3.05"].result).toBe("NOT_OBSERVED");
  });
});

// ---------------------------------------------------------------------------
// S3.06
// ---------------------------------------------------------------------------

function link(path: string, status: number | null, over: Partial<LinkCheckResult> = {}): LinkCheckResult {
  const errorCode = over.errorCode ?? null;
  return {
    url: `https://example.ie${path}`,
    sourceUrls: [HOME],
    purposes: ["S3.06"],
    method: "HEAD",
    status,
    errorCode,
    outcome: status === 404 ? "broken" : "ok",
    retried: false,
    ...over,
  };
}

const okLinks = (n: number, from = 0): LinkCheckResult[] =>
  Array.from({ length: n }, (_, i) => link(`/ok${from + i}`, 200));

function s306(linkChecks: LinkCheckResult[]): MetricResult {
  return evaluate({ linkChecks })["S3.06"];
}

describe("S3.06 Broken internal links", () => {
  it("is PASS (25) when all observed links work", () => {
    const r = s306(okLinks(10));
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(25);
    expect(ev(r).branch).toBe("no_broken_links");
  });

  it("scores 1 - broken/observed (1 of 10 broken = 0.9 = 22.5 points)", () => {
    const r = s306([...okLinks(9), link("/gone", 404)]);
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(22.5);
    expect(ev(r).broken).toBe(1);
    expect(ev(r).observed).toBe(10);
    expect(ev(r).brokenLinks).toEqual([{ url: "https://example.ie/gone", status: 404 }]);
  });

  it("is FAIL (0) when every observed link is broken", () => {
    const r = s306([link("/a", 404), link("/b", 410), link("/c", 500, { retried: true }), link("/d", 404), link("/e", 404)]);
    expect(r.result).toBe("FAIL");
    expect(r.points).toBe(0);
  });

  it("counts 404, 410 and a retried 5xx as broken", () => {
    const r = s306([
      ...okLinks(5),
      link("/a", 404),
      link("/b", 410),
      link("/c", 503, { retried: true }),
    ]);
    expect(ev(r).broken).toBe(3);
    expect(ev(r).observed).toBe(8);
  });

  it("does not count a 5xx that was never retried (unobserved, conservative)", () => {
    const r = s306([...okLinks(5), link("/a", 502, { retried: false })]);
    expect(ev(r).broken).toBe(0);
    expect(ev(r).unobserved).toBe(1);
    expect(r.result).toBe("PASS");
  });

  it("excludes 401, 403, 408, 429 and timeouts from the denominator", () => {
    const r = s306([
      ...okLinks(5),
      link("/a", 401),
      link("/b", 403),
      link("/c", 429),
      link("/d", 408),
      link("/e", null, { errorCode: "TIMEOUT" }),
      link("/f", null, { errorCode: "CONNECT_TIMEOUT" }),
    ]);
    expect(ev(r).observed).toBe(5);
    expect(ev(r).unobserved).toBe(6);
    expect(ev(r).unobservedReasons).toEqual({ "401": 1, "403": 1, "429": 1, "408": 1, TIMEOUT: 1, CONNECT_TIMEOUT: 1 });
    expect(r.result).toBe("PASS");
  });

  it("treats a redirect the scanner could not follow as unobserved", () => {
    const r = s306([...okLinks(5), link("/a", 301, { errorCode: "REDIRECT_BLOCKED" })]);
    expect(ev(r).unobserved).toBe(1);
  });

  it("treats other statuses (2xx, 3xx, 405) as working links", () => {
    const r = s306([link("/a", 200), link("/b", 301), link("/c", 405), link("/d", 204), link("/e", 400), link("/f", 404)]);
    expect(ev(r).observed).toBe(6);
    expect(ev(r).broken).toBe(1);
  });

  it("is NOT_OBSERVED with 4 observed links and scored with exactly 5", () => {
    const four = s306(okLinks(4));
    expect(four.result).toBe("NOT_OBSERVED");
    expect(four.points).toBeNull();
    expect(four.maxPoints).toBe(25);
    expect(ev(four).branch).toBe("not_observed_too_few_links");
    expect(s306(okLinks(5)).result).toBe("PASS");
  });

  it("is NOT_OBSERVED when many links are unobserved, leaving fewer than 5", () => {
    const r = s306([...okLinks(4), ...[1, 2, 3, 4, 5, 6].map((n) => link(`/x${n}`, 403))]);
    expect(r.result).toBe("NOT_OBSERVED");
  });

  it("is NOT_OBSERVED when no link checks exist", () => {
    expect(s306([]).result).toBe("NOT_OBSERVED");
  });

  it("ignores link checks made only for A4.01", () => {
    const r = s306([...okLinks(5), link("/about", 404, { purposes: ["A4.01"] })]);
    expect(ev(r).checked).toBe(5);
    expect(r.result).toBe("PASS");
  });

  it("counts a link checked for both purposes once", () => {
    const r = s306([...okLinks(5), link("/both", 404, { purposes: ["S3.06", "A4.01"] })]);
    expect(ev(r).broken).toBe(1);
  });

  it("ignores duplicate entries and cross-site targets", () => {
    const r = s306([
      ...okLinks(5),
      link("/ok0", 404),
      { ...link("/x", 404), url: "https://elsewhere.example/x" },
    ]);
    expect(ev(r).checked).toBe(5);
    expect(r.result).toBe("PASS");
  });

  it("treats the www host as the same site", () => {
    const r = s306([...okLinks(4), { ...link("/w", 404), url: "https://www.example.ie/w" }]);
    expect(ev(r).broken).toBe(1);
  });

  it("limits the broken-link list in evidence to five", () => {
    const r = s306([...okLinks(5), ...[1, 2, 3, 4, 5, 6, 7].map((n) => link(`/gone${n}`, 404))]);
    expect(ev(r).broken).toBe(7);
    expect((ev(r).brokenLinks as unknown[]).length).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// S3.07
// ---------------------------------------------------------------------------

const withResources = (resources: string, extraHead = ""): string =>
  html({ head: extraHead, body: `<main><h1>Heading</h1><p>${words(80)}</p>${resources}</main>` });

function s307(...pages: SampledPage[]): MetricResult {
  return evaluate({ pages })["S3.07"];
}

describe("S3.07 No mixed content", () => {
  it("is PASS (10) when an https page loads nothing over http", () => {
    const r = s307(homePage({}, withResources('<img src="https://example.ie/a.png"><script src="/app.js"></script>')));
    expect(r.result).toBe("PASS");
    expect(r.points).toBe(10);
    expect(evList(r)[0].branch).toBe("no_mixed_content");
  });

  it("does not treat plain http links as subresources", () => {
    expect(s307(homePage({}, withResources('<a href="http://old.example/">old site</a>'))).result).toBe("PASS");
  });

  it.each([
    ["img", '<img src="http://example.ie/a.png" alt="a">'],
    ["audio", '<audio src="http://example.ie/a.mp3"></audio>'],
    ["video", '<video src="http://example.ie/a.mp4"></video>'],
    ["source", '<video><source src="http://example.ie/a.mp4"></video>'],
  ])("is PARTIAL (5) for passive %s content only", (_tag, markup) => {
    const r = s307(homePage({}, withResources(markup)));
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(5);
    expect(evList(r)[0].branch).toBe("passive_mixed_content_only");
    expect(evList(r)[0].passive).toBe(1);
  });

  it.each([
    ["script", '<script src="http://cdn.example/app.js"></script>', ""],
    ["iframe", '<iframe src="http://widget.example/"></iframe>', ""],
    ["stylesheet", "", '<link rel="stylesheet" href="http://cdn.example/site.css">'],
  ])("is FAIL (0) for active %s content", (_tag, markup, head) => {
    const r = s307(homePage({}, withResources(markup, head)));
    expect(r.result).toBe("FAIL");
    expect(r.points).toBe(0);
    expect(evList(r)[0].branch).toBe("active_mixed_content");
    expect(evList(r)[0].active).toBe(1);
  });

  it("is FAIL when active and passive content are both present", () => {
    const r = s307(
      homePage({}, withResources('<img src="http://example.ie/a.png"><script src="http://example.ie/a.js"></script>')),
    );
    expect(r.result).toBe("FAIL");
    expect(evList(r)[0].active).toBe(1);
    expect(evList(r)[0].passive).toBe(1);
  });

  it("resolves a protocol-relative reference against the https page (not mixed)", () => {
    expect(s307(homePage({}, withResources('<img src="//cdn.example/a.png">'))).result).toBe("PASS");
  });

  it("limits the examples in evidence to three", () => {
    const imgs = [1, 2, 3, 4, 5].map((n) => `<img src="http://example.ie/${n}.png">`).join("");
    const r = s307(homePage({}, withResources(imgs)));
    expect((evList(r)[0].examples as unknown[]).length).toBe(3);
    expect(evList(r)[0].passive).toBe(5);
  });

  it("is the mean of page scores (clean, passive, active = 0.5 = 5 points)", () => {
    const r = s307(
      homePage({}, withResources("")),
      page("/services", "services", withResources('<img src="http://example.ie/a.png">')),
      page("/about", "about", withResources('<script src="http://example.ie/a.js"></script>')),
    );
    expect(r.result).toBe("PARTIAL");
    expect(r.points).toBe(5);
  });

  it("excludes pages that are not served over https", () => {
    const httpPage = sampled("http://example.ie/old", "other", withResources('<script src="http://example.ie/a.js"></script>'));
    const r = s307(homePage({}, withResources("")), httpPage);
    expect(r.result).toBe("PASS");
    expect(evList(r)[1].status).toBe("not_applicable");
    expect(evList(r)[1].branch).toBe("not_applicable_not_https");
  });

  it("is NOT_APPLICABLE when no sampled page is served over https", () => {
    const r = evaluate({
      httpsAttempt: record(HOME, { status: null, error: failure("CONNECT_REFUSED") }),
      homeUrl: HTTP_HOME,
      pages: [sampled(HTTP_HOME, "home", html())],
    })["S3.07"];
    expect(r.result).toBe("NOT_APPLICABLE");
    expect(r.points).toBeNull();
    expect(r.maxPoints).toBeNull();
  });

  it("is NOT_OBSERVED for a render-dependent page", () => {
    const spa = html({ head: VIEWPORT, body: `${SPA_BODY}<script src="http://cdn.example/app.js"></script>` });
    const r = s307(
      homePage({}, spa),
      page("/a", "other", spa),
      page("/b", "other", spa),
    );
    expect(r.result).toBe("NOT_OBSERVED");
    expect(evList(r)[0].branch).toBe("not_observed_render_dependent");
  });

  it("scores the readable pages when only a minority is render-dependent", () => {
    const spa = html({ head: VIEWPORT, body: SPA_BODY });
    const r = s307(homePage({}, withResources("")), page("/app", "other", spa));
    expect(r.result).toBe("PASS");
    expect(r.explanation).toContain("1 page could not be observed");
  });

  it("is SCAN_ERROR when most https pages failed to fetch", () => {
    const failed = (path: string, type: PageType): SampledPage =>
      page(path, type, null, { status: null, error: failure("TIMEOUT") });
    const r = s307(homePage({}, withResources("")), failed("/a", "other"), failed("/b", "other"));
    expect(r.result).toBe("SCAN_ERROR");
  });

  it("applies to contact and legal pages too", () => {
    const r = s307(
      homePage({}, withResources("")),
      page("/contact", "contact", withResources('<script src="http://x.example/a.js"></script>')),
    );
    expect(r.points).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Whole category
// ---------------------------------------------------------------------------

describe("evaluateS3", () => {
  it("returns one result per S3 metric in id order, deterministically", () => {
    const snap = snapshot({
      pages: [homePage({ tls: { authorized: true, daysToExpiry: 60 }, headers: { "content-encoding": "gzip" }, decodedBytes: 4000 })],
      httpVariant: variant([[301, HOME]]),
      timing: [timing(300), timing(400)],
      linkChecks: okLinks(6),
    });
    const first = evaluateS3(buildEvalContext(snap, NOW));
    const second = evaluateS3(buildEvalContext(snap, NOW));
    checkShape(first);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.map((r) => r.result)).toEqual(["PASS", "PASS", "PASS", "PASS", "PASS", "PASS", "PASS"]);
    expect(first.reduce((sum, r) => sum + (r.points ?? 0), 0)).toBe(100);
  });

  it("returns a result for every metric even when nothing was observed", () => {
    const results = evaluateS3(buildEvalContext(snapshot(), NOW));
    checkShape(results);
    expect(results.map((r) => r.result)).toEqual([
      "NOT_OBSERVED",
      "NOT_OBSERVED",
      "NOT_APPLICABLE",
      "NOT_OBSERVED",
      "NOT_OBSERVED",
      "NOT_OBSERVED",
      "NOT_APPLICABLE",
    ]);
  });
});
