import {
  notApplicable,
  notObserved,
  resultFromPageScores,
  resultFromScore,
  scanError,
} from "@/lib/visibility/scoring";
import { median, truncateEvidence } from "@/lib/visibility/text";
import { SCOPE_PAGE_TYPES } from "@/lib/visibility/types";
import type {
  EvalContext,
  EvalPage,
  EvidenceRecord,
  FetchErrorCode,
  FetchRecord,
  LinkCheckResult,
  MetricResult,
  MetricScope,
  PageFacts,
  PageType,
  PerPageScore,
  RedirectHop,
} from "@/lib/visibility/types";

const clip = (value: string): string => truncateEvidence(value);

// ---------------------------------------------------------------------------
// Per-page helpers shared with seo-content.ts
// ---------------------------------------------------------------------------

export function pagesForScope(ctx: EvalContext, scope: MetricScope): EvalPage[] {
  const types: readonly PageType[] = SCOPE_PAGE_TYPES[scope];
  return ctx.pages.filter((page) => types.includes(page.type));
}

export function pageWord(count: number): string {
  return count === 1 ? "page" : "pages";
}

export function protocolOf(url: string): string | null {
  try {
    return new URL(url).protocol;
  } catch {
    return null;
  }
}

export function skipScore(
  page: EvalPage,
  status: "not_observed" | "scan_error" | "not_applicable",
  branch: string,
  reason: string,
  extra: EvidenceRecord = {},
): PerPageScore {
  return {
    url: page.url,
    score: null,
    status,
    evidence: {
      type: page.type,
      branch,
      reason,
      ...(page.finalUrl !== page.url ? { finalUrl: clip(page.finalUrl) } : {}),
      ...extra,
    },
  };
}

export function observedScore(
  page: EvalPage,
  score: number,
  branch: string,
  extra: EvidenceRecord = {},
): PerPageScore {
  return {
    url: page.url,
    score,
    status: "observed",
    evidence: {
      type: page.type,
      branch,
      ...(page.finalUrl !== page.url ? { finalUrl: clip(page.finalUrl) } : {}),
      ...extra,
    },
  };
}

function unfetchedScore(page: EvalPage): PerPageScore {
  const code = page.record.error?.code ?? null;
  const detail: EvidenceRecord = {
    fetchClass: page.fetchClass,
    httpStatus: page.record.status,
    errorCode: code,
  };
  switch (page.fetchClass) {
    case "robots_blocked":
      return skipScore(
        page,
        "not_observed",
        "not_observed_robots_disallowed",
        "robots.txt disallows this scanner for the page, so it was not fetched.",
        detail,
      );
    case "non_html":
      return skipScore(
        page,
        "not_observed",
        "not_observed_non_html",
        "The page is not HTML, so it cannot be read as a web page.",
        detail,
      );
    default:
      return skipScore(
        page,
        "scan_error",
        "scan_error_not_fetched",
        `The page could not be fetched or parsed (${code ?? `HTTP ${page.record.status ?? "no response"}`}).`,
        detail,
      );
  }
}

function renderDependentScore(page: EvalPage): PerPageScore {
  return skipScore(
    page,
    "not_observed",
    "not_observed_render_dependent",
    "The page is render-dependent (its content is added by JavaScript), so its body is not read.",
    { renderReasons: (page.facts?.render.reasons ?? []).slice(0, 3).map(clip) },
  );
}

export type PageRead =
  | { skip: PerPageScore; facts?: undefined }
  | { skip?: undefined; facts: PageFacts };

// `before` runs first so applicability (https only, language) outranks observability (4.3.1).
export function readPage(
  page: EvalPage,
  reads: "meta" | "body",
  before?: (page: EvalPage) => PerPageScore | null,
): PageRead {
  const early = before === undefined ? null : before(page);
  if (early !== null) return { skip: early };
  const facts = page.facts;
  if (facts === null) return { skip: unfetchedScore(page) };
  if (reads === "body" && page.renderDependent) return { skip: renderDependentScore(page) };
  return { facts };
}

export function tally(perPage: readonly PerPageScore[]): {
  applicable: number;
  observed: number;
  scores: number[];
} {
  const scores: number[] = [];
  let applicable = 0;
  for (const page of perPage) {
    if (page.status === "not_applicable") continue;
    applicable += 1;
    if (page.status === "observed" && page.score !== null) scores.push(page.score);
  }
  return { applicable, observed: scores.length, scores };
}

export function unobservedNote(applicable: number, observed: number): string {
  const missing = applicable - observed;
  return missing > 0 ? ` (${missing} ${pageWord(missing)} could not be observed)` : "";
}

export function pageEvidence(perPage: readonly PerPageScore[]): EvidenceRecord[] {
  return perPage.map((page) => ({
    ...page.evidence,
    url: page.url,
    status: page.status,
    s_p: page.score,
  }));
}

export function pageMetric(
  ctx: EvalContext,
  metricId: string,
  scope: MetricScope,
  scorer: (page: EvalPage) => PerPageScore,
  explain: (perPage: readonly PerPageScore[]) => string,
): MetricResult {
  const perPage = pagesForScope(ctx, scope).map(scorer);
  return resultFromPageScores(metricId, perPage, null, explain(perPage));
}

function headerOf(record: FetchRecord, name: string): string | null {
  for (const key of Object.keys(record.headers)) {
    if (key.toLowerCase() === name) return record.headers[key];
  }
  return null;
}

// ---------------------------------------------------------------------------
// S3.01 HTTPS enforced
// ---------------------------------------------------------------------------

const PERMANENT_REDIRECTS: ReadonlySet<number> = new Set([301, 308]);
const UNOBSERVED_HTTP_ERRORS: ReadonlySet<FetchErrorCode> = new Set<FetchErrorCode>([
  "CONNECT_REFUSED",
  "CONNECT_TIMEOUT",
  "TIMEOUT",
  "CONNECTION_RESET",
  "REDIRECT_BLOCKED",
  "ROBOTS_DISALLOWED",
]);

function httpFailureResult(metricId: string, record: FetchRecord, code: FetchErrorCode): MetricResult {
  const evidence: EvidenceRecord = {
    branch: UNOBSERVED_HTTP_ERRORS.has(code) ? "not_observed_port_80" : "scan_error_http_request",
    requestUrl: clip(record.url),
    errorCode: code,
    httpStatus: record.status,
  };
  if (UNOBSERVED_HTTP_ERRORS.has(code)) {
    return notObserved(
      metricId,
      `The http version of the site could not be reached (${code}), so redirection to https was not observed.`,
      evidence,
    );
  }
  return scanError(
    metricId,
    `The request to the http version of the site failed on the scanner side (${code}).`,
    evidence,
  );
}

function hopSummaries(hops: readonly RedirectHop[]): string[] {
  return hops.slice(0, 4).map((hop) => clip(`${hop.status} ${hop.location ?? "(no Location)"}`));
}

function evaluateHttpsEnforced(ctx: EvalContext): MetricResult {
  const id = "S3.01";
  const { snapshot, helpers } = ctx;

  const attempt = snapshot.httpsAttempt;
  if (attempt !== null) {
    return resultFromScore(
      id,
      0,
      {
        branch: "https_unavailable",
        httpsAttemptUrl: clip(attempt.url),
        httpsStatus: attempt.status,
        httpsErrorCode: attempt.error?.code ?? null,
        homeUrl: clip(snapshot.homeUrl),
      },
      "The homepage could not be fetched over https and was only reachable over http, so HTTPS is not served.",
    );
  }
  if (ctx.home !== null && protocolOf(ctx.home.finalUrl) === "http:") {
    return resultFromScore(
      id,
      0,
      { branch: "homepage_ends_on_http", homeUrl: clip(ctx.home.finalUrl) },
      "The homepage ends on plain http after redirects, so HTTPS is not enforced.",
    );
  }

  const record = snapshot.httpVariant;
  if (record === null) {
    return notObserved(
      id,
      "No request to the http version of the site was recorded, so redirection to https was not observed.",
    );
  }

  const hops = record.redirectChain;
  const base: EvidenceRecord = {
    requestUrl: clip(record.url),
    httpStatus: record.status,
    hops: hopSummaries(hops),
  };
  const code = record.error?.code ?? null;

  const resolveTarget = (hop: RedirectHop): string | null =>
    hop.location === null || hop.location.trim() === ""
      ? null
      : helpers.normaliseUrl(hop.location.trim(), hop.url);

  let httpsIndex = -1;
  let stop: "none" | "cross_site" | "no_location" = "none";
  for (let i = 0; i < hops.length; i += 1) {
    const target = resolveTarget(hops[i]);
    if (target === null) {
      stop = "no_location";
      break;
    }
    if (!helpers.sameSite(target, record.url)) {
      stop = "cross_site";
      break;
    }
    if (protocolOf(target) === "https:") {
      httpsIndex = i;
      break;
    }
  }

  if (httpsIndex === -1) {
    if (stop === "cross_site") {
      return resultFromScore(
        id,
        0,
        { ...base, branch: "redirect_leaves_site" },
        "The http version redirects to another site instead of to https on the same site.",
      );
    }
    if (stop === "no_location") {
      return resultFromScore(
        id,
        0,
        { ...base, branch: "redirect_without_target" },
        "The http version sends a redirect that does not lead to https.",
      );
    }
    if (code === "REDIRECT_LOOP" || code === "TOO_MANY_REDIRECTS") {
      return resultFromScore(
        id,
        0,
        { ...base, branch: "redirect_chain_never_reaches_https", errorCode: code },
        "The http version redirects without ever reaching https.",
      );
    }
    if (code !== null) return httpFailureResult(id, record, code);
    const status = record.status;
    if (status === null || status === 401 || status === 403 || status === 429 || status >= 500) {
      return notObserved(
        id,
        "The http version of the site did not give a usable answer, so redirection to https was not observed.",
        { ...base, branch: "not_observed_http_status" },
      );
    }
    const served = status >= 200 && status < 300;
    return resultFromScore(
      id,
      0,
      { ...base, branch: served ? "http_served_2xx" : "http_no_redirect_to_https" },
      served
        ? "The http version of the site serves content (HTTP 2xx) instead of redirecting to https."
        : "The http version of the site does not redirect to https.",
    );
  }

  const last = hops[hops.length - 1];
  const lastUnfollowed = last.url === record.finalUrl;
  const destination = lastUnfollowed ? (resolveTarget(last) ?? record.finalUrl) : record.finalUrl;
  if (protocolOf(destination) !== "https:") {
    return resultFromScore(
      id,
      0,
      { ...base, branch: "redirect_returns_to_http", destination: clip(destination) },
      "The http version reaches https but is then redirected back to plain http.",
    );
  }

  const hopCount = httpsIndex + 1;
  const statuses = hops.slice(0, hopCount).map((hop) => hop.status);
  const permanent = statuses.every((status) => PERMANENT_REDIRECTS.has(status));
  const evidence: EvidenceRecord = {
    ...base,
    hopsToHttps: hopCount,
    statusesToHttps: statuses,
    destination: clip(destination),
  };
  if (permanent && hopCount <= 2) {
    return resultFromScore(
      id,
      1,
      { ...evidence, branch: "permanent_redirect_to_https" },
      `Plain http redirects permanently (HTTP ${statuses.join(", ")}) to https within ${hopCount} ${hopCount === 1 ? "hop" : "hops"}.`,
    );
  }
  if (permanent) {
    return resultFromScore(
      id,
      0.5,
      { ...evidence, branch: "permanent_redirect_over_two_hops" },
      `Plain http redirects permanently to https but only after ${hopCount} hops, more than the 2 allowed for full marks.`,
    );
  }
  return resultFromScore(
    id,
    0.5,
    { ...evidence, branch: "temporary_redirect_to_https" },
    `Plain http reaches https through a temporary redirect (HTTP ${statuses.join(", ")}) rather than a permanent 301 or 308.`,
  );
}

// ---------------------------------------------------------------------------
// S3.02 Valid TLS certificate
// ---------------------------------------------------------------------------

const TLS_MIN_DAYS = 14;

function describeTlsFailure(code: string | undefined): string {
  switch (code) {
    case "CERT_HAS_EXPIRED":
      return "has expired";
    case "HOSTNAME_MISMATCH":
    case "ERR_TLS_CERT_ALTNAME_INVALID":
      return "does not match the host name";
    case "DEPTH_ZERO_SELF_SIGNED_CERT":
    case "SELF_SIGNED_CERT_IN_CHAIN":
      return "is self-signed";
    case "UNABLE_TO_GET_ISSUER_CERT":
    case "UNABLE_TO_GET_ISSUER_CERT_LOCALLY":
    case "UNABLE_TO_VERIFY_LEAF_SIGNATURE":
      return "has an incomplete or untrusted chain";
    default:
      return "failed verification";
  }
}

function evaluateTlsCertificate(ctx: EvalContext): MetricResult {
  const id = "S3.02";
  const attempt = ctx.snapshot.httpsAttempt;
  if (attempt !== null) {
    return resultFromScore(
      id,
      0,
      {
        branch: "https_unavailable",
        httpsAttemptUrl: clip(attempt.url),
        httpsErrorCode: attempt.error?.code ?? null,
        tlsError: attempt.tls?.error ?? null,
      },
      "The homepage could not be fetched over https, so there is no valid certificate.",
    );
  }
  const home = ctx.home;
  if (home === null) {
    return notObserved(id, "The homepage was not fetched, so its certificate was not observed.");
  }
  if (protocolOf(home.finalUrl) === "http:") {
    return notObserved(
      id,
      "The homepage ended on plain http, so no certificate was observed for the final connection.",
      { branch: "not_observed_final_connection_is_http", homeUrl: clip(home.finalUrl) },
    );
  }
  const tls = home.record.tls;
  if (tls === null) {
    return notObserved(id, "No certificate information was recorded for the homepage connection.", {
      branch: "not_observed_no_tls_info",
      homeUrl: clip(home.finalUrl),
      errorCode: home.record.error?.code ?? null,
    });
  }
  const base: EvidenceRecord = {
    homeUrl: clip(home.finalUrl),
    authorized: tls.authorized,
    tlsError: tls.error === undefined ? null : clip(tls.error),
    validTo: tls.validTo ?? null,
    daysToExpiry: tls.daysToExpiry ?? null,
  };
  if (!tls.authorized) {
    return resultFromScore(
      id,
      0,
      { ...base, branch: "certificate_not_valid" },
      `The homepage certificate ${describeTlsFailure(tls.error)}, so it is not valid.`,
    );
  }
  const days = tls.daysToExpiry;
  if (days === undefined) {
    return notObserved(id, "The certificate verified but its expiry date was not recorded.", {
      ...base,
      branch: "not_observed_no_expiry",
    });
  }
  if (days < 0) {
    return resultFromScore(
      id,
      0,
      { ...base, branch: "certificate_expired" },
      `The homepage certificate expired ${-days} ${-days === 1 ? "day" : "days"} before the scan.`,
    );
  }
  if (days < TLS_MIN_DAYS) {
    return resultFromScore(
      id,
      0.5,
      { ...base, branch: "valid_expires_soon", minDays: TLS_MIN_DAYS },
      `The homepage certificate is valid but expires in ${days} ${days === 1 ? "day" : "days"}, under the ${TLS_MIN_DAYS} days needed for full marks.`,
    );
  }
  return resultFromScore(
    id,
    1,
    { ...base, branch: "valid_certificate", minDays: TLS_MIN_DAYS },
    `The homepage certificate is valid for this host and has ${days} days left.`,
  );
}

// ---------------------------------------------------------------------------
// S3.03 Mobile viewport
// ---------------------------------------------------------------------------

const VIEWPORT_WIDTH = /width\s*=\s*device-width/i;

function evaluateViewport(ctx: EvalContext): MetricResult {
  return pageMetric(
    ctx,
    "S3.03",
    "P",
    (page) => {
      const read = readPage(page, "meta");
      if (read.skip) return read.skip;
      const viewports = read.facts.head.viewports;
      const match = viewports.find((content) => VIEWPORT_WIDTH.test(content));
      if (match !== undefined) {
        return observedScore(page, 1, "viewport_width_device_width", { viewport: clip(match) });
      }
      return observedScore(
        page,
        0,
        viewports.length === 0 ? "no_viewport_tag" : "viewport_without_device_width",
        { viewport: viewports.length === 0 ? null : clip(viewports[0]) },
      );
    },
    (perPage) => {
      const t = tally(perPage);
      const pass = t.scores.filter((s) => s === 1).length;
      return `${pass} of ${t.observed} observed ${pageWord(t.observed)} declare a viewport with width=device-width${unobservedNote(t.applicable, t.observed)}.`;
    },
  );
}

// ---------------------------------------------------------------------------
// S3.04 Response compression
// ---------------------------------------------------------------------------

const COMPRESSION_ENCODINGS: ReadonlySet<string> = new Set(["gzip", "x-gzip", "br", "zstd"]);
const COMPRESSION_MIN_BYTES = 1024;

function evaluateCompression(ctx: EvalContext): MetricResult {
  const id = "S3.04";
  const home = ctx.home;
  if (home === null) {
    return notObserved(id, "The homepage was not fetched, so response compression was not observed.");
  }
  const record = home.record;
  if (record.status === null || record.requestAcceptEncoding === null) {
    return notObserved(
      id,
      "The homepage was not requested with compression enabled, so response compression was not observed.",
      {
        branch: "not_observed_no_compression_request",
        httpStatus: record.status,
        requestAcceptEncoding: record.requestAcceptEncoding,
        errorCode: record.error?.code ?? null,
      },
    );
  }
  const size =
    record.decodedBytes > 0
      ? record.decodedBytes
      : record.body === null
        ? 0
        : Buffer.byteLength(record.body, "utf8");
  const encoding = headerOf(record, "content-encoding");
  const base: EvidenceRecord = {
    homeUrl: clip(home.finalUrl),
    requestAcceptEncoding: record.requestAcceptEncoding,
    contentEncoding: encoding === null ? null : clip(encoding),
    decodedBytes: size,
    wireBytes: record.wireBytes,
  };
  if (size < COMPRESSION_MIN_BYTES) {
    return notApplicable(
      id,
      `The homepage HTML is ${size} bytes, under 1 KB, so compression does not apply.`,
      { ...base, branch: "not_applicable_under_1kb", minBytes: COMPRESSION_MIN_BYTES },
    );
  }
  const tokens =
    encoding === null
      ? []
      : encoding
          .toLowerCase()
          .split(",")
          .map((token) => token.trim());
  const compressed = tokens.some((token) => COMPRESSION_ENCODINGS.has(token));
  if (compressed) {
    return resultFromScore(
      id,
      1,
      { ...base, branch: "compressed" },
      `The homepage HTML is served compressed (Content-Encoding: ${clip(encoding ?? "")}).`,
    );
  }
  return resultFromScore(
    id,
    0,
    { ...base, branch: encoding === null ? "not_compressed" : "unlisted_encoding" },
    encoding === null
      ? "The homepage HTML is served without gzip, Brotli or zstd compression."
      : `The homepage HTML uses Content-Encoding ${clip(encoding)}, which is not gzip, Brotli or zstd.`,
  );
}

// ---------------------------------------------------------------------------
// S3.05 Server response time
// ---------------------------------------------------------------------------

const TTFB_FULL_MS = 800;
const TTFB_HALF_MS = 1800;

function isTimingSample(record: FetchRecord): boolean {
  return (
    record.error === null &&
    record.ttfbMs !== null &&
    record.status !== null &&
    record.status >= 200 &&
    record.status < 300
  );
}

function evaluateResponseTime(ctx: EvalContext): MetricResult {
  const id = "S3.05";
  const records: FetchRecord[] = [
    ...(ctx.home === null ? [] : [ctx.home.record]),
    ...ctx.snapshot.timing,
  ].slice(0, 3);
  const samples = records.map((record) => (isTimingSample(record) ? (record.ttfbMs as number) : null));
  const usable = samples.filter((value): value is number => value !== null);
  const base: EvidenceRecord = {
    homeUrl: clip(ctx.snapshot.homeUrl),
    samplesMs: samples,
    usableSamples: usable.length,
    scannerRegion: ctx.snapshot.scannerRegion,
  };
  if (usable.length < 2) {
    return notObserved(
      id,
      `Only ${usable.length} of ${records.length} homepage timing samples succeeded (at least 2 are needed), so response time is not scored.`,
      { ...base, branch: "not_observed_too_few_samples" },
    );
  }
  const medianMs = median(usable) as number;
  const evidence: EvidenceRecord = { ...base, medianMs, fullMarksMs: TTFB_FULL_MS, halfMarksMs: TTFB_HALF_MS };
  if (medianMs <= TTFB_FULL_MS) {
    return resultFromScore(
      id,
      1,
      { ...evidence, branch: "fast" },
      `The median time to first byte is ${medianMs} ms, within the ${TTFB_FULL_MS} ms for full marks.`,
    );
  }
  if (medianMs <= TTFB_HALF_MS) {
    return resultFromScore(
      id,
      0.5,
      { ...evidence, branch: "moderate" },
      `The median time to first byte is ${medianMs} ms, above ${TTFB_FULL_MS} ms but within ${TTFB_HALF_MS} ms.`,
    );
  }
  return resultFromScore(
    id,
    0,
    { ...evidence, branch: "slow" },
    `The median time to first byte is ${medianMs} ms, above ${TTFB_HALF_MS} ms.`,
  );
}

// ---------------------------------------------------------------------------
// S3.06 Broken internal links
// ---------------------------------------------------------------------------

const MIN_OBSERVED_LINKS = 5;
const UNOBSERVED_STATUSES: ReadonlySet<number> = new Set([401, 403, 408, 429]);

type LinkVerdict = "ok" | "broken" | "unobserved";

function classifyLink(entry: LinkCheckResult): LinkVerdict {
  const { status, errorCode } = entry;
  if (errorCode !== null || status === null) return "unobserved";
  if (UNOBSERVED_STATUSES.has(status)) return "unobserved";
  if (status === 404 || status === 410) return "broken";
  if (status >= 500 && status <= 599) return entry.retried ? "broken" : "unobserved";
  return "ok";
}

function evaluateBrokenLinks(ctx: EvalContext): MetricResult {
  const id = "S3.06";
  const seen = new Set<string>();
  const entries: LinkCheckResult[] = [];
  for (const entry of ctx.snapshot.linkChecks) {
    if (!entry.purposes.includes("S3.06") || seen.has(entry.url)) continue;
    if (!ctx.helpers.sameSite(entry.url, ctx.snapshot.homeUrl)) continue;
    seen.add(entry.url);
    entries.push(entry);
  }

  let ok = 0;
  const broken: LinkCheckResult[] = [];
  const unobservedReasons: Record<string, number> = {};
  let unobserved = 0;
  for (const entry of entries) {
    const verdict = classifyLink(entry);
    if (verdict === "ok") ok += 1;
    else if (verdict === "broken") broken.push(entry);
    else {
      unobserved += 1;
      const reason = entry.errorCode ?? (entry.status === null ? "no response" : String(entry.status));
      unobservedReasons[reason] = (unobservedReasons[reason] ?? 0) + 1;
    }
  }
  const observed = ok + broken.length;
  const evidence: EvidenceRecord = {
    checked: entries.length,
    observed,
    ok,
    broken: broken.length,
    unobserved,
    brokenLinks: broken.slice(0, 5).map((entry) => ({ url: clip(entry.url), status: entry.status })),
    unobservedReasons,
    minObserved: MIN_OBSERVED_LINKS,
  };
  if (observed < MIN_OBSERVED_LINKS) {
    return notObserved(
      id,
      `Only ${observed} internal link ${observed === 1 ? "target" : "targets"} could be observed (at least ${MIN_OBSERVED_LINKS} are needed), so broken links are not scored.`,
      { ...evidence, branch: "not_observed_too_few_links" },
    );
  }
  const s = 1 - broken.length / observed;
  return resultFromScore(
    id,
    s,
    { ...evidence, branch: broken.length === 0 ? "no_broken_links" : "broken_links_found" },
    `${broken.length} of ${observed} observed internal link ${observed === 1 ? "target" : "targets"} returned 404, 410 or a server error.`,
  );
}

// ---------------------------------------------------------------------------
// S3.07 No mixed content
// ---------------------------------------------------------------------------

function evaluateMixedContent(ctx: EvalContext): MetricResult {
  const id = "S3.07";
  const perPage = pagesForScope(ctx, "P").map((page): PerPageScore => {
    const read = readPage(page, "body", (candidate) =>
      protocolOf(candidate.finalUrl) === "https:"
        ? null
        : skipScore(
            candidate,
            "not_applicable",
            "not_applicable_not_https",
            "The page is not served over https, so mixed content does not apply.",
          ),
    );
    if (read.skip) return read.skip;
    const refs = read.facts.mixedContent;
    const active = refs.filter((ref) => ref.kind === "active");
    const passive = refs.filter((ref) => ref.kind === "passive");
    const extra: EvidenceRecord = {
      active: active.length,
      passive: passive.length,
      examples: refs.slice(0, 3).map((ref) => ({ tag: ref.tag, url: clip(ref.url) })),
    };
    if (active.length > 0) return observedScore(page, 0, "active_mixed_content", extra);
    if (passive.length > 0) return observedScore(page, 0.5, "passive_mixed_content_only", extra);
    return observedScore(page, 1, "no_mixed_content", extra);
  });
  if (perPage.length > 0 && perPage.every((page) => page.status === "not_applicable")) {
    return notApplicable(id, "No sampled page was served over https, so mixed content does not apply.", pageEvidence(perPage));
  }
  const t = tally(perPage);
  const clean = t.scores.filter((s) => s === 1).length;
  const passiveOnly = t.scores.filter((s) => s === 0.5).length;
  const active = t.scores.filter((s) => s === 0).length;
  return resultFromPageScores(
    id,
    perPage,
    null,
    `${clean} of ${t.observed} observed https ${pageWord(t.observed)} load no http resources, ${passiveOnly} load only passive ones and ${active} load active ones${unobservedNote(t.applicable, t.observed)}.`,
  );
}

// ---------------------------------------------------------------------------

export function evaluateS3(ctx: EvalContext): MetricResult[] {
  return [
    evaluateHttpsEnforced(ctx),
    evaluateTlsCertificate(ctx),
    evaluateViewport(ctx),
    evaluateCompression(ctx),
    evaluateResponseTime(ctx),
    evaluateBrokenLinks(ctx),
    evaluateMixedContent(ctx),
  ];
}
