// Contracts for the Visibility Index prototype (plan 4.1-4.7, 5.2, 5.3, Appendix D).
// Types and as-const enumerations only. Everything in ScanSnapshot is plain JSON.

// ---------------------------------------------------------------------------
// 07_VISIBILITY_INDEX.md methodology contract (verbatim)
// ---------------------------------------------------------------------------

export type MetricResultCode =
  | "PASS"
  | "PARTIAL"
  | "FAIL"
  | "NOT_APPLICABLE"
  | "NOT_OBSERVED"
  | "SCAN_ERROR";

export type EvidenceType = "OBSERVED" | "DERIVED" | "MODEL_ASSISTED";

export type MetricDefinition = {
  id: string;
  version: number;
  categoryId: string;
  description: string;
  applicabilityRule: string;
  evaluationRule: string;
  maxPoints: number;
  evidenceType: EvidenceType;
  limitations: string[];
  humanReviewWhen: string[];
};

export type MetricResult = {
  metricId: string;
  metricVersion: number;
  result: MetricResultCode;
  points: number | null;
  maxPoints: number | null;
  evidence: unknown;
  explanation: string;
  reviewedBy: string | null;
};

// ---------------------------------------------------------------------------
// As-const enumerations
// ---------------------------------------------------------------------------

export const METRIC_RESULT_CODES = [
  "PASS",
  "PARTIAL",
  "FAIL",
  "NOT_APPLICABLE",
  "NOT_OBSERVED",
  "SCAN_ERROR",
] as const satisfies readonly MetricResultCode[];

export const EVIDENCE_TYPES = [
  "OBSERVED",
  "DERIVED",
  "MODEL_ASSISTED",
] as const satisfies readonly EvidenceType[];

export const PILLARS = ["SEO", "AEO"] as const;
export type Pillar = (typeof PILLARS)[number];

export const CATEGORY_IDS = ["S1", "S2", "S3", "S4", "A1", "A2", "A3", "A4"] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export const METRIC_BASES = ["STD", "VENDOR", "HEUR"] as const;
export type MetricBasis = (typeof METRIC_BASES)[number];

export const METRIC_SCOPES = ["P", "CP", "KO", "AP", "H", "S"] as const;
export type MetricScope = (typeof METRIC_SCOPES)[number];

// "meta" and "site" metrics run on render-dependent pages; "body" metrics are NOT_OBSERVED for them (4.2.6).
// A1.04 has no suffix in 4.5: it is the metric that carries the render-dependence penalty, so it is
// evaluated on render-dependent pages (declare it "meta"). S4.04 and A3.03 are scope S but read page text,
// so declare them "body" (no double penalty, principle 7).
export const METRIC_READS = ["meta", "body", "site"] as const;
export type MetricReads = (typeof METRIC_READS)[number];

export const METRIC_IDS = [
  "S1.01", "S1.02", "S1.03", "S1.04", "S1.05",
  "S2.01", "S2.02", "S2.03", "S2.04", "S2.05", "S2.06", "S2.07", "S2.08", "S2.09",
  "S3.01", "S3.02", "S3.03", "S3.04", "S3.05", "S3.06", "S3.07",
  "S4.01", "S4.02", "S4.03", "S4.04", "S4.05", "S4.06",
  "A1.01", "A1.02", "A1.03", "A1.04",
  "A2.01", "A2.02", "A2.03", "A2.04", "A2.05", "A2.06", "A2.07", "A2.08",
  "A3.01", "A3.02", "A3.03", "A3.04", "A3.05", "A3.06",
  "A4.01", "A4.02", "A4.03", "A4.04", "A4.05", "A4.06", "A4.07",
] as const;

export const PAGE_TYPES = [
  "home",
  "services",
  "about",
  "faq",
  "article",
  "contact",
  "legal",
  "other",
] as const;
export type PageType = (typeof PAGE_TYPES)[number];

// Plan 4.2.4. Site-level scope S has no page types.
export const SCOPE_PAGE_TYPES = {
  P: ["home", "services", "about", "faq", "article", "contact", "legal", "other"],
  CP: ["home", "about", "services", "faq", "article", "other"],
  KO: ["services", "faq", "article", "other"],
  AP: ["article"],
  H: ["home"],
  S: [],
} as const satisfies Record<MetricScope, readonly PageType[]>;

export const FETCH_KINDS = [
  "page",
  "robots",
  "sitemap",
  "llms",
  "http-variant",
  "link-check",
  "timing",
] as const;
export type FetchKind = (typeof FETCH_KINDS)[number];

export const FETCH_METHODS = ["GET", "HEAD"] as const;
export type FetchMethod = (typeof FETCH_METHODS)[number];

export const FETCH_ERROR_CODES = [
  "URL_REJECTED",
  "HOST_NOT_ALLOWLISTED",
  "DNS_FAILED",
  "ADDRESS_BLOCKED",
  "CONNECT_REFUSED",
  "CONNECT_TIMEOUT",
  "TIMEOUT",
  "JOB_TIMEOUT",
  "REQUEST_CAP_REACHED",
  "TLS_ERROR",
  "CONNECTION_RESET",
  "PROTOCOL_ERROR",
  "TOO_MANY_REDIRECTS",
  "REDIRECT_LOOP",
  "REDIRECT_BLOCKED",
  "RESPONSE_TOO_LARGE",
  "DECOMPRESSED_TOO_LARGE",
  "HEADERS_TOO_LARGE",
  "DECODE_ERROR",
  "CONTENT_TYPE_REJECTED",
  "ROBOTS_DISALLOWED",
  "ABORTED",
  "UNKNOWN",
] as const;
export type FetchErrorCode = (typeof FETCH_ERROR_CODES)[number];

// Lowercase names; the only response headers a FetchRecord may keep.
export const ALLOWED_RESPONSE_HEADERS = [
  "content-type",
  "content-encoding",
  "content-length",
  "content-language",
  "location",
  "link",
  "x-robots-tag",
  "server",
  "retry-after",
  "cache-control",
  "last-modified",
  "date",
  "cf-mitigated",
] as const;

export const SCAN_OUTCOMES = [
  "COMPLETED",
  "BLOCKED_BY_ROBOTS",
  "UNREACHABLE",
  "JOB_ERROR",
] as const;
export type ScanOutcome = (typeof SCAN_OUTCOMES)[number];

export const CRITICAL_FINDING_IDS = [
  "CF-01",
  "CF-02",
  "CF-03",
  "CF-04",
  "CF-05",
  "CF-06",
  "CF-07",
] as const;
export type CriticalFindingId = (typeof CRITICAL_FINDING_IDS)[number];

export const CANDIDATE_EXCLUSIONS = [
  "other_site",
  "non_http",
  "non_html_extension",
  "utility_path",
  "duplicate",
  "homepage",
] as const;
export type CandidateExclusion = (typeof CANDIDATE_EXCLUSIONS)[number];

export const PAGE_CAPS = [
  "html_bytes",
  "element_count",
  "jsonld_block_bytes",
  "jsonld_block_count",
  "jsonld_depth",
] as const;
export type PageCap = (typeof PAGE_CAPS)[number];

export const EVIDENCE_STRING_MAX = 200;

// ---------------------------------------------------------------------------
// Appendix D: methodology definition
// ---------------------------------------------------------------------------

export type MetricDefinitionExt = MetricDefinition & {
  name: string;
  basis: MetricBasis;
  scope: MetricScope;
  reads: MetricReads;
  fixGuidance: string;
};

export type CategoryDefinition = {
  id: CategoryId;
  pillar: Pillar;
  name: string;
  weight: number;
  metricIds: string[];
};

export type MethodologyDefinition = {
  version: string;
  categories: CategoryDefinition[];
  metrics: MetricDefinitionExt[];
  thresholds: {
    categoryMinCoverage: number;
    pillarMinShownWeight: number;
    overallMinShownWeight: number;
  };
  listVersions: { aiAgents: string; patterns: string };
};

// ---------------------------------------------------------------------------
// Fetch layer contract
// ---------------------------------------------------------------------------

export interface FetchRequest {
  url: string;
  kind: FetchKind;
  method: FetchMethod;
}

export interface Fetcher {
  fetch(req: FetchRequest): Promise<FetchRecord>;
}

export type RedirectHop = {
  // Normalised absolute URL that returned the redirect.
  url: string;
  status: number;
  // Location header exactly as received (may be relative); null when absent.
  location: string | null;
};

export type FetchError = { code: FetchErrorCode; message: string };

export type TlsInfo = {
  authorized: boolean;
  error?: string;
  validTo?: string;
  // Whole days from FetchRecord.fetchedAt to validTo (floor; negative once expired). Set whenever a
  // certificate was presented. S3.02 reads this field and never the clock.
  daysToExpiry?: number;
};

export type FetchRecord = {
  // url and finalUrl are normalised absolute URLs (normalise.ts); evaluators compare them as-is.
  url: string;
  finalUrl: string;
  kind: FetchKind;
  method: FetchMethod;
  // Final response status; may be set together with `error` (for example RESPONSE_TOO_LARGE).
  // ROBOTS_DISALLOWED means no request was made: status null, empty chain, body null.
  status: number | null;
  // One entry per redirect response, in order; hop i leads to hop i+1 (or finalUrl for the last).
  // Filled even when `error` is TOO_MANY_REDIRECTS, REDIRECT_LOOP or REDIRECT_BLOCKED, so S1.05 and S3.01 can count hops.
  redirectChain: RedirectHop[];
  // ALLOWED_RESPONSE_HEADERS only; repeated headers are joined with ", ".
  headers: Record<string, string>;
  contentType: string | null;
  wireBytes: number;
  decodedBytes: number;
  // Hex SHA-256 of the retained decoded body; null when body is null.
  bodyHash: string | null;
  // Text within caps only. For robots, sitemap and llms a capped prefix is kept with truncated=true.
  // Kept for any status when the content type is text (CF-07 needs challenge markup on 403/429/503);
  // null for the headers-only kinds (http-variant, link-check, timing).
  body: string | null;
  truncated: boolean;
  error: FetchError | null;
  requestAcceptEncoding: string | null;
  fetchedAt: string;
  durationMs: number;
  // Connection established to first byte; excludes DNS and TLS.
  ttfbMs: number | null;
  // The connection that served the final response; null for plain http or no connection.
  tls: TlsInfo | null;
};

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

// origin is lowercase scheme://host[:port] with no trailing slash; the same form keys RobotsContext.byOrigin.
export type RobotsRecord = { origin: string; record: FetchRecord };

export type SitemapRole = "declared" | "default" | "index-child";

export type SitemapRecord = {
  url: string;
  role: SitemapRole;
  parentUrl: string | null;
  record: FetchRecord;
};

export type SampledPage = {
  url: string;
  type: PageType;
  reason: string;
  depth: number;
  record: FetchRecord;
};

export type LinkCheckOutcome = "ok" | "broken" | "unobserved";
export type LinkCheckPurpose = "S3.06" | "A4.01";

// One entry per distinct URL; a URL checked for both purposes appears once with both. A4.01 entries are the
// homepage's same-site links whose path matches ABOUT_PATTERN (an evaluator accepts any 2xx among them).
// status is the final status after redirects. Evaluators derive broken or unobserved from status and
// errorCode (S3.06); `outcome` mirrors that for readers of the snapshot.
export type LinkCheckResult = {
  url: string;
  sourceUrls: string[];
  purposes: LinkCheckPurpose[];
  method: FetchMethod;
  status: number | null;
  errorCode: FetchErrorCode | null;
  outcome: LinkCheckOutcome;
  retried: boolean;
};

export type CandidateSummary = {
  fromSitemap: number;
  fromHomepageLinks: number;
  considered: number;
  excluded: Record<CandidateExclusion, number>;
  byType: Record<PageType, number>;
  capped: boolean;
};

export type ScanStats = {
  requestCount: number;
  requestCapReached: boolean;
  jobTimedOut: boolean;
  jobDurationMs: number;
};

export type ScanSnapshot = {
  snapshotVersion: 1;
  scannerVersion: string;
  inputUrl: string;
  // Final homepage URL after redirects, or the normalised input URL when it was never fetched.
  homeUrl: string;
  scannedAt: string;
  outcome: ScanOutcome;
  outcomeDetail: string | null;
  scannerRegion: string | null;
  // The failed https attempt, present when the homepage fell back to http (plan 4.2.1) and when outcome is
  // UNREACHABLE. S3.01 and S3.02 are FAIL whenever it is set and outcome is COMPLETED.
  httpsAttempt: FetchRecord | null;
  robots: RobotsRecord[];
  sitemaps: SitemapRecord[];
  llms: FetchRecord | null;
  // GET http://host/ (headers only). On UNREACHABLE it holds the failed http attempt and pages is empty.
  httpVariant: FetchRecord | null;
  // The two extra homepage requests for S3.05; the first sample is pages[0].record.
  timing: FetchRecord[];
  linkChecks: LinkCheckResult[];
  // pages[0] is the homepage (type "home") when it was fetched.
  pages: SampledPage[];
  candidates: CandidateSummary;
  stats: ScanStats;
};

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

export type EvidenceValue =
  | string
  | number
  | boolean
  | null
  | EvidenceValue[]
  | { [key: string]: EvidenceValue };

// Strings capped at EVIDENCE_STRING_MAX characters by the producer.
export type EvidenceRecord = { [key: string]: EvidenceValue };

// Convention for MetricResult.evidence: one record, or one record per page (Appendix E).
export type MetricEvidence = EvidenceRecord | EvidenceRecord[];

// ---------------------------------------------------------------------------
// PageFacts: everything extracted from ONE HTML page (plan 4.2.5, 4.2.6)
// ---------------------------------------------------------------------------

export type RobotsDirective = {
  // Lowercase, for example "noindex" or "max-snippet".
  name: string;
  // Text after the first ":" trimmed ("0" for max-snippet:0); null when the directive has no colon.
  value: string | null;
};

export type RobotsDirectiveSet = {
  source: "meta" | "header";
  // Lowercase agent token; null means all robots (meta name=robots, or no header prefix).
  agent: string | null;
  raw: string;
  directives: RobotsDirective[];
};

export type TextEntry = {
  // Normalised text (4.2.5) without lowercasing; compare with toLowerCase().
  text: string;
  // Code-point length of text.
  chars: number;
};

export type CanonicalEntry = {
  source: "head" | "header";
  href: string;
  // Normalised absolute http(s) URL; null when empty, unparsable or non-HTTP.
  url: string | null;
};

export type MetaTagEntry = {
  // Lowercase property or name, for example "og:title".
  key: string;
  content: string;
};

export type HeadFacts = {
  htmlLang: string | null;
  // Lowercase subtag before the first "-"; null when htmlLang is absent or empty.
  // English-only metrics (A3.01, A3.05) apply when this is "en".
  langPrimary: string | null;
  // Every <title> in the head (SVG titles excluded), empty ones included (chars 0).
  titles: TextEntry[];
  // Every meta name=description, empty content included.
  metaDescriptions: TextEntry[];
  canonicals: CanonicalEntry[];
  // Only meta name=robots, googlebot and bingbot.
  metaRobots: RobotsDirectiveSet[];
  xRobotsTag: RobotsDirectiveSet[];
  viewports: string[];
  openGraph: MetaTagEntry[];
  twitter: MetaTagEntry[];
};

export type JsonLdFailureReason =
  | "invalid_json"
  | "too_large"
  | "too_deep"
  | "empty"
  | "not_object_or_array";

export type JsonLdNode = {
  id: string | null;
  // id resolved against PageFacts.baseUrl; nodes match across pages on iri.
  iri: string | null;
  // Local names with any schema.org prefix stripped, for example "Organization".
  types: string[];
  // For example "@graph[2].author".
  path: string;
  depth: number;
  // An object holding only @id.
  isReference: boolean;
  // JSON nesting depth of the object; the top-level object is 0.
  // All own keys of the object, @id and @type included; nested objects stay inline (children are also separate nodes).
  properties: Record<string, unknown>;
};

export type JsonLdBlock = {
  index: number;
  rawLength: number;
  parsedOk: boolean;
  reason: JsonLdFailureReason | null;
  value: unknown;
  // True when @context (string, array element or @vocab) is a schema.org URL.
  schemaOrgContext: boolean;
  hasTypeOrGraph: boolean;
  // Every object with @type or @id, depth-first with parent before children; empty when not parsedOk.
  nodes: JsonLdNode[];
};

export type JsonLdFacts = {
  blocks: JsonLdBlock[];
  // Script blocks seen, including any beyond the 20-block cap.
  blocksSeen: number;
};

export type HeadingFact = {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  // Position among all headings in the document.
  index: number;
  inMain: boolean;
};

export type ParagraphFact = {
  index: number;
  wordCount: number;
  sentenceCount: number;
  // HeadingFact.index of the nearest heading before this paragraph; null when none.
  precedingHeadingIndex: number | null;
};

export type MainContentMethod = "main" | "role-main" | "single-article" | "body-fallback";

export type MainContentFacts = {
  method: MainContentMethod;
  text: string;
  // Hex SHA-256 of text.
  textHash: string;
  wordCount: number;
  // Text up to and including the 200th counted word.
  lead200: string;
  // Only <p> elements inside main with at least one word, in document order.
  paragraphs: ParagraphFact[];
  // Sentences of the <p> text above.
  sentences: { count: number; medianWords: number | null };
  paragraphStats: { count: number; medianWords: number | null };
};

export type LinkLocation = "main" | "nav" | "footer" | "other";
export type LinkNameSource = "text" | "aria-label" | "img-alt" | "none";

export type LinkFact = {
  // DOM order.
  index: number;
  href: string;
  // Normalised absolute http(s) URL; null for mailto, tel, javascript or unparsable hrefs.
  url: string | null;
  fragmentOnly: boolean;
  sameSite: boolean;
  // Accessible name: visible text, else aria-label, else image alt; normalised, "" when none.
  name: string;
  nameSource: LinkNameSource;
  // Precedence when nested: nav, footer, main, other. "main" means inside the main content scope of PageFacts.main.
  location: LinkLocation;
  // Lowercase rel tokens.
  rel: string[];
};

export type NavFact = {
  source: "nav" | "role";
  // Anchors in the block whose url is same-site and not fragment-only.
  sameSiteLinkCount: number;
};

export type ImageFact = {
  index: number;
  src: string;
  hasAlt: boolean;
  alt: string | null;
  role: string | null;
  ariaHidden: boolean;
  width: number | null;
  height: number | null;
  // Not role=presentation, not aria-hidden=true, no width or height attribute of 2 or less.
  isContent: boolean;
};

export type ListFact = { ordered: boolean; items: number };
export type TableFact = { headerCells: number; rows: number };

// pairs counts every question and answer pair the mechanism finds; questionPairs counts those whose question is in
// question form (4.5 A3.01). A3.03 reads pairs for detailsSummary and definitionList, and questionPairs only for
// headingParagraph (4.5 names a "question-form heading" for that mechanism alone); headingParagraph.pairs is every
// heading followed by a paragraph and must not be used for A3.03.
export type FaqPairCount = { pairs: number; questionPairs: number };

export type FaqFacts = {
  detailsSummary: FaqPairCount;
  definitionList: FaqPairCount;
  headingParagraph: FaqPairCount;
};

export type BylineFacts = {
  relAuthor: boolean;
  itempropAuthor: boolean;
  classMatch: boolean;
  // "By " within the first 400 characters of PageFacts.main.text.
  byTextInFirst400: boolean;
  sample: string | null;
};

export type TimeLocation = "byline" | "header" | "main" | "other";

export type TimeFact = {
  datetime: string;
  // ISO 8601 UTC when datetime is valid ISO 8601 or W3C datetime; null otherwise.
  parsed: string | null;
  location: TimeLocation;
  itemprop: string | null;
};

export type ContactFacts = {
  mailto: string[];
  tel: string[];
  emailsInText: number;
  addressTextLengths: number[];
};

// http:// subresource references (script, stylesheet, iframe, img, audio, video, source), never plain links.
// Empty when the page itself is not https.
export type MixedContentRef = {
  url: string;
  tag: string;
  kind: "active" | "passive";
};

export type RenderFacts = {
  // Verdict per 4.2.6. When word counts do not apply (zh, ja, ko, th) the verdict rests on markers alone.
  renderDependent: boolean;
  mainWordCount: number;
  spaRootMarkers: string[];
  noscriptJsMessages: string[];
  reasons: string[];
};

export type PageFacts = {
  // Final URL the facts were extracted from.
  url: string;
  // Document base used to resolve relative URLs.
  baseUrl: string;
  head: HeadFacts;
  jsonLd: JsonLdFacts;
  // itemscope or RDFa attributes seen.
  microdataOrRdfa: boolean;
  headings: HeadingFact[];
  main: MainContentFacts;
  // Whole-document visible text (4.2.5), normalised.
  visibleText: string;
  // False when langPrimary is zh, ja, ko or th: every word-count metric is NOT_APPLICABLE.
  wordCountApplicable: boolean;
  links: LinkFact[];
  navigations: NavFact[];
  images: ImageFact[];
  // Inside main only.
  lists: ListFact[];
  tables: TableFact[];
  faq: FaqFacts;
  byline: BylineFacts;
  times: TimeFact[];
  contact: ContactFacts;
  mixedContent: MixedContentRef[];
  render: RenderFacts;
  truncated: boolean;
  capsHit: PageCap[];
};

// ---------------------------------------------------------------------------
// Evaluation context (evaluation is a pure function of snapshot and now)
// ---------------------------------------------------------------------------

// ok: final 2xx, HTML content type, body present, no error.
// http_error: final status 400 or above, or a 3xx left unresolved without an error code.
// fetch_error: record.error is set (other than ROBOTS_DISALLOWED); a status may still be present.
// robots_blocked: record.error.code is ROBOTS_DISALLOWED (the scanner's own agent; nothing was fetched).
// non_html: final 2xx with a non-HTML content type.
export type PageFetchClass =
  | "ok"
  | "http_error"
  | "fetch_error"
  | "robots_blocked"
  | "non_html";

export type EvalPage = {
  url: string;
  finalUrl: string;
  type: PageType;
  reason: string;
  depth: number;
  record: FetchRecord;
  fetchClass: PageFetchClass;
  // Present only when fetchClass is "ok".
  facts: PageFacts | null;
  // True exactly when facts is present. Metrics that read only the URL, the record or robots.txt
  // (S1.02, S1.05, S4.05, A1.01) do not need it and apply to every sampled page.
  observed: boolean;
  // facts.render.renderDependent, false when facts is null.
  renderDependent: boolean;
};

export type RobotsState = "found" | "not_found" | "error" | "not_fetched";

// Token "*" evaluates the wildcard group only; any other token its own group, else the wildcard group.
// Returns null when the origin's robots.txt could not be read (state "error" or "not_fetched").
export type RobotsIsAllowed = (agentToken: string, url: string) => boolean | null;

export type RobotsRules = {
  origin: string;
  state: RobotsState;
  status: number | null;
  // Sitemap: lines, absolute.
  sitemaps: string[];
  isAllowed: RobotsIsAllowed;
};

export type RobotsContext = {
  // Keyed by RobotsRecord.origin form.
  byOrigin: ReadonlyMap<string, RobotsRules>;
  stateFor: (url: string) => RobotsState;
  isAllowed: RobotsIsAllowed;
};

export type SitemapKind = "urlset" | "sitemapindex" | "malformed" | "not_found" | "error";

export type SitemapEntry = {
  loc: string;
  lastmod: string | null;
  // ISO 8601 UTC when lastmod is valid ISO 8601 or W3C datetime; null otherwise.
  lastmodParsed: string | null;
};

export type SitemapDocInfo = {
  url: string;
  role: SitemapRole;
  parentUrl: string | null;
  kind: SitemapKind;
  // Urlset URLs, or child sitemaps for a sitemapindex; at most 5,000.
  entries: SitemapEntry[];
  sameSiteLocCount: number;
  locCapHit: boolean;
};

export type SitemapInfo = {
  documents: SitemapDocInfo[];
  declaredInRobots: boolean;
  // Deduplicated normalised same-site URLs from urlset documents, in document order.
  urls: string[];
};

export type JsonLdNodeRef = {
  pageUrl: string;
  pageType: PageType;
  blockIndex: number;
  node: JsonLdNode;
};

// Built from every page that has facts, render-dependent pages included.
export type JsonLdIndex = {
  nodes: JsonLdNodeRef[];
  references: JsonLdNodeRef[];
  // iri -> non-reference nodes defining it.
  definitions: ReadonlyMap<string, JsonLdNodeRef[]>;
};

export type ChallengeInfo = {
  detected: boolean;
  sources: { url: string; status: number; marker: string }[];
};

export type EvalHelpers = {
  sameSite: (a: string, b: string) => boolean;
  siteHost: (urlOrHost: string) => string;
  normaliseUrl: (input: string, base?: string) => string | null;
  normaliseText: (input: string) => string;
  isHomeSite: (url: string) => boolean;
  // ISO 8601 or W3C datetime to ISO 8601 UTC; null for anything else. The single implementation behind
  // TimeFact.parsed, SitemapEntry.lastmodParsed and the JSON-LD dates read by A4.04 and A4.05.
  parseIsoDate: (input: string) => string | null;
};

export type EvalContext = {
  // The scan time: callers pass new Date(snapshot.scannedAt) so a re-score of a stored snapshot is identical.
  // Every age rule and "later than scan time plus one day" rule uses this.
  now: Date;
  snapshot: ScanSnapshot;
  methodology: MethodologyDefinition;
  home: EvalPage | null;
  homeFacts: PageFacts | null;
  // Sampled pages in snapshot order; home first when fetched.
  pages: EvalPage[];
  robots: RobotsContext;
  sitemap: SitemapInfo;
  jsonLd: JsonLdIndex;
  challenge: ChallengeInfo;
  helpers: EvalHelpers;
};

// Evaluator output convention (07 leaves null handling open). An evaluator returns one MetricResult for every
// metric of its category, in methodology order. points is non-null only for PASS, PARTIAL and FAIL (round2,
// half up). maxPoints is the metric's maxPoints for every code except NOT_APPLICABLE, where it is null:
// NOT_OBSERVED and SCAN_ERROR stay in possibleMax (4.3.3), so scoring needs their maximum.
export type CategoryEvaluator = (ctx: EvalContext) => MetricResult[];

export type CategoryEvaluators = Readonly<Record<CategoryId, CategoryEvaluator>>;

// ---------------------------------------------------------------------------
// Scoring and report
// ---------------------------------------------------------------------------

export type PerPageScoreStatus = "observed" | "not_observed" | "scan_error" | "not_applicable";

export type PerPageScore = {
  url: string;
  // s_p in [0, 1]; null unless status is "observed".
  score: number | null;
  status: PerPageScoreStatus;
  evidence: EvidenceRecord;
};

export type CategoryScore = {
  id: CategoryId;
  pillar: Pillar;
  weight: number;
  points: number;
  appliedMax: number;
  possibleMax: number;
  // appliedMax / possibleMax in [0, 1], four decimals; null when possibleMax is 0.
  coverage: number | null;
  // 0 to 1, four decimals; null when appliedMax is 0.
  score: number | null;
  shown: boolean;
};

export type WithheldReason =
  | "NO_SCORE_OUTCOME"
  | "PILLAR_WEIGHT_BELOW_MINIMUM"
  | "OVERALL_WEIGHT_BELOW_MINIMUM"
  | "PILLAR_NOT_PUBLISHED";

export type ScoreSummary = {
  // 0 to 100, two decimals (same for seo and aeo); null when withheld.
  overall: number | null;
  seo: number | null;
  aeo: number | null;
  // 0 to 1, four decimals: sum of w x coverage(c) over categories with possibleMax > 0, divided by their summed
  // weight. Built from the exact appliedMax / possibleMax ratios and rounded once.
  coverage: number;
  categories: Record<CategoryId, CategoryScore>;
  shownWeight: { seo: number; aeo: number; overall: number };
  withheld: {
    seo: WithheldReason | null;
    aeo: WithheldReason | null;
    overall: WithheldReason | null;
  };
};

export type CriticalFinding = {
  id: CriticalFindingId;
  summary: string;
};

export type AgentPolicy = {
  token: string;
  // null when robots.txt could not be read.
  allowed: boolean | null;
};

export type InformationalSignals = {
  trainingCrawlerPolicy: AgentPolicy[];
  userAgentPolicy: AgentPolicy[];
  challengeDetected: boolean;
  scannerRegion: string | null;
  jsonLdTypes: string[];
  homepageHtmlBytes: number | null;
  homepageRedirects: number | null;
};

export type ReportPageSummary = {
  url: string;
  type: PageType;
  reason: string;
  fetchClass: PageFetchClass;
  observed: boolean;
  renderDependent: boolean;
};

// When outcome is not COMPLETED no evaluator runs: metrics holds one NOT_OBSERVED result per metric (maxPoints set),
// criticalFindings is empty, every category has score null, coverage 0 and shown false, scores.coverage is 0 and
// scores.withheld.* is "NO_SCORE_OUTCOME".
export type ScanReport = {
  reportVersion: 1;
  methodologyVersion: string;
  scannerVersion: string;
  scannedAt: string;
  snapshotHash: string;
  homeUrl: string;
  outcome: ScanOutcome;
  outcomeDetail: string | null;
  coverage: number;
  scores: ScoreSummary;
  pagesSampled: ReportPageSummary[];
  criticalFindings: CriticalFinding[];
  metrics: MetricResult[];
  informational: InformationalSignals;
  listVersions: { aiAgents: string; patterns: string };
  staleLists: string[];
  limitations: string[];
  correctionRoute: string;
};
