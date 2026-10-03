import { extractPageFacts } from "./extract";
import { METHODOLOGY } from "./methodology";
import { normaliseUrl, sameSite, siteHost } from "./normalise";
import { declaredSitemaps, isAllowed as robotsAllows, robotsFromRecord } from "./robots";
import { parseSitemap } from "./sitemap-parse";
import { normaliseText, parseIsoDate } from "./text";
import type {
  ChallengeInfo,
  EvalContext,
  EvalHelpers,
  EvalPage,
  FetchErrorCode,
  FetchRecord,
  JsonLdIndex,
  JsonLdNodeRef,
  PageFetchClass,
  RobotsContext,
  RobotsRules,
  RobotsState,
  SampledPage,
  ScanSnapshot,
  SitemapDocInfo,
  SitemapEntry,
  SitemapInfo,
  SitemapKind,
  SitemapRecord,
} from "./types";

const HTML_MIME_TYPES: ReadonlySet<string> = new Set(["text/html", "application/xhtml+xml"]);

const SIZE_CAP_CODES: ReadonlySet<FetchErrorCode> = new Set<FetchErrorCode>([
  "RESPONSE_TOO_LARGE",
  "DECOMPRESSED_TOO_LARGE",
]);

// No request left the scanner for these, so the resource was never observed (as opposed to failing).
const NOT_ATTEMPTED_CODES: ReadonlySet<FetchErrorCode> = new Set<FetchErrorCode>([
  "URL_REJECTED",
  "HOST_NOT_ALLOWLISTED",
  "ADDRESS_BLOCKED",
  "REQUEST_CAP_REACHED",
  "ROBOTS_DISALLOWED",
  "ABORTED",
]);

// The statuses 4.5 S3.06 already treats as "scanner was refused", so a sitemap behind them is unobserved, not absent.
const REFUSAL_STATUSES: ReadonlySet<number> = new Set([401, 403, 429]);

// Provisional CF-07 rule (methodology question Q-18): 4.6 names the statuses but Appendix B has no marker list.
export const CHALLENGE_STATUSES: ReadonlySet<number> = new Set([403, 429, 503]);
export const CHALLENGE_HEADER = { name: "cf-mitigated", value: "challenge" } as const;
export const CHALLENGE_BODY_MARKERS: readonly string[] = [
  "just a moment",
  "attention required",
  "verify you are human",
  "captcha",
];

function mimeOf(record: FetchRecord): string {
  const raw = record.contentType ?? record.headers["content-type"] ?? "";
  return raw.split(";", 1)[0].trim().toLowerCase();
}

export function classifyPageFetch(record: FetchRecord): PageFetchClass {
  const { status, error } = record;
  if (error !== null && error.code === "ROBOTS_DISALLOWED") return "robots_blocked";
  const success = status !== null && status >= 200 && status < 300;
  if (success && error !== null && error.code === "CONTENT_TYPE_REJECTED") return "non_html";
  if (error !== null || status === null || status < 200) return "fetch_error";
  if (status >= 300) return "http_error";
  if (!HTML_MIME_TYPES.has(mimeOf(record))) return "non_html";
  return record.body === null ? "fetch_error" : "ok";
}

function toEvalPage(page: SampledPage): EvalPage {
  const { record } = page;
  const fetchClass = classifyPageFetch(record);
  const facts =
    fetchClass === "ok" && record.body !== null
      ? extractPageFacts(record.body, { finalUrl: record.finalUrl, headers: record.headers })
      : null;
  return {
    url: page.url,
    finalUrl: record.finalUrl,
    type: page.type,
    reason: page.reason,
    depth: page.depth,
    record,
    fetchClass,
    facts,
    observed: facts !== null,
    renderDependent: facts !== null && facts.render.renderDependent,
  };
}

function originOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.origin : null;
  } catch {
    return null;
  }
}

function originKey(origin: string): string {
  return originOf(origin) ?? origin.trim().toLowerCase().replace(/\/+$/, "");
}

function buildRobotsRules(origin: string, record: FetchRecord): RobotsRules {
  const base = { origin, status: record.status };
  if (
    record.status === null &&
    record.error !== null &&
    NOT_ATTEMPTED_CODES.has(record.error.code)
  ) {
    return { ...base, state: "not_fetched", sitemaps: [], isAllowed: () => null };
  }
  const access = robotsFromRecord(record);
  if (access.kind === "rules") {
    const { rules } = access;
    return {
      ...base,
      state: "found",
      sitemaps: declaredSitemaps(rules),
      isAllowed: (agentToken, url) =>
        originOf(url) === origin ? robotsAllows(rules, agentToken, url) : null,
    };
  }
  if (access.kind === "allow-all") {
    return {
      ...base,
      state: "not_found",
      sitemaps: [],
      isAllowed: (_agentToken, url) => (originOf(url) === origin ? true : null),
    };
  }
  return { ...base, state: "error", sitemaps: [], isAllowed: () => null };
}

function buildRobotsContext(snapshot: ScanSnapshot): RobotsContext {
  const byOrigin = new Map<string, RobotsRules>();
  for (const { origin, record } of snapshot.robots) {
    const key = originKey(origin);
    if (!byOrigin.has(key)) byOrigin.set(key, buildRobotsRules(key, record));
  }
  const rulesFor = (url: string): RobotsRules | undefined => {
    const origin = originOf(url);
    return origin === null ? undefined : byOrigin.get(origin);
  };
  return {
    byOrigin,
    stateFor: (url): RobotsState => rulesFor(url)?.state ?? "not_fetched",
    isAllowed: (agentToken, url) => rulesFor(url)?.isAllowed(agentToken, url) ?? null,
  };
}

function buildSitemapDoc(rec: SitemapRecord, homeHost: string): SitemapDocInfo {
  const { record } = rec;
  const doc = (kind: SitemapKind, entries: SitemapEntry[] = [], locCapHit = false): SitemapDocInfo => ({
    url: rec.url,
    role: rec.role,
    parentUrl: rec.parentUrl,
    kind,
    entries,
    sameSiteLocCount: entries.filter((entry) => siteHost(entry.loc) === homeHost).length,
    locCapHit,
  });

  const { status, error } = record;
  if (status === null) return doc("error");
  if (status >= 400 && status <= 499) return doc(REFUSAL_STATUSES.has(status) ? "error" : "not_found");
  if (status < 200 || status > 299) return doc("error");
  if (error !== null && error.code === "CONTENT_TYPE_REJECTED") return doc("malformed");
  const sizeCapped = error !== null && SIZE_CAP_CODES.has(error.code);
  if ((error !== null && !sizeCapped) || record.body === null) return doc("error");

  const parsed = parseSitemap(record.body);
  const capHit = parsed.truncated || record.truncated || sizeCapped;
  if (parsed.kind === "invalid") return doc("malformed", [], capHit);
  const entries = parsed.locs.map((loc, i): SitemapEntry => {
    const lastmod = parsed.lastmods[i] ?? null;
    return { loc, lastmod, lastmodParsed: lastmod === null ? null : parseIsoDate(lastmod) };
  });
  return doc(parsed.kind, entries, capHit);
}

function buildSitemapInfo(
  snapshot: ScanSnapshot,
  robots: RobotsContext,
  homeHost: string,
): SitemapInfo {
  const documents = snapshot.sitemaps.map((rec) => buildSitemapDoc(rec, homeHost));
  const declaredInRobots = [...robots.byOrigin.values()].some(
    (rules) =>
      rules.state === "found" && rules.sitemaps.length > 0 && siteHost(rules.origin) === homeHost,
  );
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const document of documents) {
    if (document.kind !== "urlset") continue;
    for (const entry of document.entries) {
      const url = normaliseUrl(entry.loc);
      if (url === null || siteHost(url) !== homeHost || seen.has(url)) continue;
      seen.add(url);
      urls.push(url);
    }
  }
  return { documents, declaredInRobots, urls };
}

function buildJsonLdIndex(pages: readonly EvalPage[]): JsonLdIndex {
  const nodes: JsonLdNodeRef[] = [];
  const references: JsonLdNodeRef[] = [];
  const definitions = new Map<string, JsonLdNodeRef[]>();
  for (const page of pages) {
    if (page.facts === null) continue;
    for (const block of page.facts.jsonLd.blocks) {
      for (const node of block.nodes) {
        const ref: JsonLdNodeRef = {
          pageUrl: page.url,
          pageType: page.type,
          blockIndex: block.index,
          node,
        };
        nodes.push(ref);
        if (node.isReference) {
          references.push(ref);
        } else if (node.iri !== null) {
          const existing = definitions.get(node.iri);
          if (existing === undefined) definitions.set(node.iri, [ref]);
          else existing.push(ref);
        }
      }
    }
  }
  return { nodes, references, definitions };
}

function headerValue(headers: Record<string, string>, name: string): string | undefined {
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === name) return headers[key];
  }
  return undefined;
}

function challengeMarker(record: FetchRecord): string | null {
  const header = headerValue(record.headers, CHALLENGE_HEADER.name);
  if (
    header !== undefined &&
    header
      .toLowerCase()
      .split(",")
      .some((token) => token.trim() === CHALLENGE_HEADER.value)
  ) {
    return `${CHALLENGE_HEADER.name}: ${CHALLENGE_HEADER.value}`;
  }
  if (record.body === null) return null;
  const body = record.body.toLowerCase();
  return CHALLENGE_BODY_MARKERS.find((marker) => body.includes(marker)) ?? null;
}

function detectChallenge(snapshot: ScanSnapshot): ChallengeInfo {
  const records: FetchRecord[] = [];
  if (snapshot.httpsAttempt !== null) records.push(snapshot.httpsAttempt);
  for (const robots of snapshot.robots) records.push(robots.record);
  for (const page of snapshot.pages) records.push(page.record);
  for (const sitemap of snapshot.sitemaps) records.push(sitemap.record);
  if (snapshot.llms !== null) records.push(snapshot.llms);
  if (snapshot.httpVariant !== null) records.push(snapshot.httpVariant);
  records.push(...snapshot.timing);

  const sources: ChallengeInfo["sources"] = [];
  const seen = new Set<string>();
  for (const record of records) {
    const { status } = record;
    if (status === null || !CHALLENGE_STATUSES.has(status)) continue;
    const marker = challengeMarker(record);
    if (marker === null) continue;
    const key = `${record.finalUrl}\n${status}\n${marker}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push({ url: record.finalUrl, status, marker });
  }
  return { detected: sources.length > 0, sources };
}

function buildHelpers(homeUrl: string): EvalHelpers {
  return {
    sameSite,
    siteHost,
    normaliseUrl,
    normaliseText,
    isHomeSite: (url) => sameSite(url, homeUrl),
    parseIsoDate,
  };
}

export function buildEvalContext(snapshot: ScanSnapshot, now: Date): EvalContext {
  if (typeof now?.getTime !== "function" || Number.isNaN(now.getTime())) {
    throw new RangeError("buildEvalContext: now must be a valid Date");
  }
  const homeHost = siteHost(snapshot.homeUrl);
  const pages = snapshot.pages.map(toEvalPage);
  const home = pages.find((page) => page.type === "home") ?? null;
  const robots = buildRobotsContext(snapshot);
  return {
    now,
    snapshot,
    methodology: METHODOLOGY,
    home,
    homeFacts: home === null ? null : home.facts,
    pages,
    robots,
    sitemap: buildSitemapInfo(snapshot, robots, homeHost),
    jsonLd: buildJsonLdIndex(pages),
    challenge: detectChallenge(snapshot),
    helpers: buildHelpers(snapshot.homeUrl),
  };
}
