import { createHash } from "node:crypto";
import { buildEvalContext, classifyPageFetch } from "@/lib/visibility/context";
import { evaluateA1 } from "@/lib/visibility/evaluate/aeo-access";
import { evaluateA3 } from "@/lib/visibility/evaluate/aeo-answers";
import { evaluateA2 } from "@/lib/visibility/evaluate/aeo-structured";
import { evaluateA4 } from "@/lib/visibility/evaluate/aeo-trust";
import { evaluateS4 } from "@/lib/visibility/evaluate/seo-content";
import { evaluateS1 } from "@/lib/visibility/evaluate/seo-crawl";
import { evaluateS2 } from "@/lib/visibility/evaluate/seo-onpage";
import { evaluateS3 } from "@/lib/visibility/evaluate/seo-technical";
import {
  AI_AGENTS,
  AI_SEARCH_AGENTS,
  OWN_AGENT_TOKEN,
  isListStale,
  type AgentTreatment,
} from "@/lib/visibility/lists";
import { METHODOLOGY } from "@/lib/visibility/methodology";
import {
  computeScoreSummary,
  isScoredCode,
  noScoreSummary,
  notObservedForAll,
  scanError,
  scoreBand,
} from "@/lib/visibility/scoring";
import { truncateEvidence } from "@/lib/visibility/text";
import {
  CATEGORY_IDS,
  METRIC_RESULT_CODES,
  type AgentPolicy,
  type CategoryDefinition,
  type CategoryEvaluators,
  type CategoryId,
  type CriticalFinding,
  type CriticalFindingId,
  type EvalContext,
  type InformationalSignals,
  type MetricResult,
  type ReportPageSummary,
  type ScanReport,
  type ScanSnapshot,
  type ScoreSummary,
} from "@/lib/visibility/types";

export const CORRECTION_ROUTE = "oisin@databridges.ie";

export const CATEGORY_EVALUATORS: CategoryEvaluators = Object.freeze({
  S1: evaluateS1,
  S2: evaluateS2,
  S3: evaluateS3,
  S4: evaluateS4,
  A1: evaluateA1,
  A2: evaluateA2,
  A3: evaluateA3,
  A4: evaluateA4,
});

const MAX_DETAIL_CHARS = 300;
const MAX_JSONLD_TYPES = 50;
const POINTS_TOLERANCE = 1e-9;
// lists.ts records review dates for the crawler list only; the pattern lists have none yet.
const PATTERN_LISTS_REVIEW_DUE_AT: string | null = null;
const ROOT_BLOCK_TOKENS = ["*", "Googlebot"] as const;

type Rec = Record<string, unknown>;

function isRec(value: unknown): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// Snapshot hash: SHA-256 of a canonical JSON form (sorted keys, no whitespace)
// ---------------------------------------------------------------------------

function canonicalise(value: unknown, ancestors: Set<object>): string | undefined {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "number":
      return Number.isFinite(value) ? JSON.stringify(value) : "null";
    case "boolean":
      return value ? "true" : "false";
    case "bigint":
      throw new TypeError("canonicalJson: a bigint has no JSON form");
    case "undefined":
    case "function":
    case "symbol":
      return undefined;
    default:
      break;
  }
  const obj = value as Rec;
  const toJson = (obj as { toJSON?: unknown }).toJSON;
  if (typeof toJson === "function") return canonicalise(toJson.call(obj), ancestors);
  if (ancestors.has(obj)) throw new TypeError("canonicalJson: circular structure");
  ancestors.add(obj);
  try {
    if (Array.isArray(obj)) {
      return `[${obj.map((item) => canonicalise(item, ancestors) ?? "null").join(",")}]`;
    }
    const parts: string[] = [];
    for (const key of Object.keys(obj).sort()) {
      const out = canonicalise(obj[key], ancestors);
      if (out !== undefined) parts.push(`${JSON.stringify(key)}:${out}`);
    }
    return `{${parts.join(",")}}`;
  } finally {
    ancestors.delete(obj);
  }
}

export function canonicalJson(value: unknown): string {
  return canonicalise(value, new Set()) ?? "null";
}

export function computeSnapshotHash(snapshot: ScanSnapshot): string {
  return createHash("sha256").update(canonicalJson(snapshot), "utf8").digest("hex");
}

// ---------------------------------------------------------------------------
// Bands (4.7): presentation only, never part of the stored report
// ---------------------------------------------------------------------------

export type ScoreBands = { overall: string | null; seo: string | null; aeo: string | null };

export function scoreBands(scores: Pick<ScoreSummary, "overall" | "seo" | "aeo">): ScoreBands {
  return {
    overall: scoreBand(scores.overall),
    seo: scoreBand(scores.seo),
    aeo: scoreBand(scores.aeo),
  };
}

// ---------------------------------------------------------------------------
// Category evaluation with containment of evaluator faults
// ---------------------------------------------------------------------------

function validResult(result: unknown, metricId: string): result is MetricResult {
  if (!isRec(result) || result.metricId !== metricId) return false;
  const { result: code, points } = result as { result?: unknown; points?: unknown };
  if (typeof code !== "string" || !(METRIC_RESULT_CODES as readonly string[]).includes(code)) return false;
  if (!isScoredCode(code as MetricResult["result"])) return true;
  const maxPoints = METHODOLOGY.metrics.find((metric) => metric.id === metricId)?.maxPoints ?? 0;
  return (
    typeof points === "number" &&
    Number.isFinite(points) &&
    points >= -POINTS_TOLERANCE &&
    points <= maxPoints + POINTS_TOLERANCE
  );
}

function acceptable(category: CategoryDefinition, results: unknown): results is MetricResult[] {
  return (
    Array.isArray(results) &&
    results.length === category.metricIds.length &&
    results.every((result, index) => validResult(result, category.metricIds[index]))
  );
}

function failedCategory(category: CategoryDefinition, detail: string): MetricResult[] {
  return category.metricIds.map((metricId) =>
    scanError(metricId, "This metric could not be evaluated because of an internal error.", {
      branch: "SCAN_ERROR",
      reason: "evaluator_failed",
      detail: truncateEvidence(detail),
    }),
  );
}

type CategoryRun = { results: MetricResult[]; failed: boolean };

function runCategory(
  category: CategoryDefinition,
  ctx: EvalContext,
  evaluators: CategoryEvaluators,
): CategoryRun {
  let output: unknown;
  try {
    output = evaluators[category.id](ctx);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { results: failedCategory(category, message), failed: true };
  }
  if (!acceptable(category, output)) {
    return {
      results: failedCategory(category, "The evaluator returned an unexpected set of results."),
      failed: true,
    };
  }
  return { results: output, failed: false };
}

// ---------------------------------------------------------------------------
// Critical findings (4.6): derived from metric evidence and facts, never from the score
// ---------------------------------------------------------------------------

function originOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.origin : null;
  } catch {
    return null;
  }
}

function branchOf(record: Rec | null): string | null {
  return record !== null && typeof record.branch === "string" ? record.branch : null;
}

// Page-level evidence is one record per sampled page in snapshot order.
function homeEvidence(ctx: EvalContext, result: MetricResult | undefined): Rec | null {
  if (result === undefined || ctx.home === null) return null;
  const { evidence } = result;
  if (!Array.isArray(evidence)) return null;
  const index = ctx.pages.indexOf(ctx.home);
  if (evidence.length === ctx.pages.length && index >= 0 && isRec(evidence[index])) {
    return evidence[index];
  }
  const found = evidence.find((record) => isRec(record) && record.url === ctx.home?.url);
  return isRec(found) ? found : null;
}

function siteEvidence(result: MetricResult | undefined): Rec | null {
  return result !== undefined && isRec(result.evidence) ? result.evidence : null;
}

function rootDisallowedTokens(ctx: EvalContext): string[] {
  const home = ctx.snapshot.homeUrl;
  const origin = originOf(home);
  if (origin === null) return [];
  const urls = [...new Set([`${origin}/`, home])];
  return ROOT_BLOCK_TOKENS.filter((token) => urls.every((url) => ctx.robots.isAllowed(token, url) === false));
}

function robotsFinding(tokens: readonly string[]): string {
  const both = tokens.includes("*") && tokens.includes("Googlebot");
  if (both) {
    return "Detected: robots.txt disallows the site root (/) for all crawlers (the * group) and for Googlebot.";
  }
  return tokens.includes("*")
    ? "Detected: robots.txt disallows the site root (/) for all crawlers (the * group)."
    : "Detected: robots.txt disallows the site root (/) for Googlebot.";
}

function httpsFinding(ctx: EvalContext, byId: ReadonlyMap<string, MetricResult>): string | null {
  const s301 = branchOf(siteEvidence(byId.get("S3.01")));
  const s302 = branchOf(siteEvidence(byId.get("S3.02")));
  if (s301 === "https_unavailable" || s302 === "https_unavailable") {
    return "Detected: the homepage could not be loaded over https, so HTTPS is not served for it.";
  }
  if (s301 === "homepage_ends_on_http") {
    return "Detected: the homepage ends on plain http after redirects, so HTTPS is not served for it.";
  }
  if (s302 === "certificate_expired") {
    return "Detected: the TLS certificate presented for the homepage has expired.";
  }
  if (s302 === "certificate_not_valid") {
    return "Detected: the TLS certificate presented for the homepage did not pass validation.";
  }
  return ctx.snapshot.httpsAttempt !== null
    ? "Detected: the homepage could not be loaded over https, so HTTPS is not served for it."
    : null;
}

export function deriveCriticalFindings(
  ctx: EvalContext,
  results: readonly MetricResult[],
): CriticalFinding[] {
  const byId = new Map(results.map((result) => [result.metricId, result]));
  const found: CriticalFinding[] = [];
  const add = (id: CriticalFindingId, summary: string): void => {
    found.push({ id, summary });
  };

  const blockedTokens = rootDisallowedTokens(ctx);
  if (blockedTokens.length > 0) add("CF-01", robotsFinding(blockedTokens));

  if (branchOf(homeEvidence(ctx, byId.get("S1.01"))) === "noindex_directive") {
    add("CF-02", "Detected: the homepage carries a noindex directive (robots meta tag or X-Robots-Tag header).");
  }

  if (branchOf(homeEvidence(ctx, byId.get("A1.01"))) === "all_blocked") {
    add(
      "CF-03",
      `Detected: robots.txt disallows the homepage for all three AI search and answer crawlers checked (${AI_SEARCH_AGENTS.join(", ")}).`,
    );
  }

  if (ctx.home !== null && ctx.home.renderDependent) {
    add(
      "CF-04",
      "Detected: the homepage looks built by JavaScript, so its content is not in the raw HTML this scan reads; its body content was not scored.",
    );
  }

  const https = httpsFinding(ctx, byId);
  if (https !== null) add("CF-05", https);

  if (branchOf(homeEvidence(ctx, byId.get("S1.04"))) === "cross_site") {
    add("CF-06", "Detected: the homepage canonical URL points to a different site.");
  }

  if (ctx.challenge.detected) {
    add(
      "CF-07",
      "Detected: the scanner was challenged or blocked (HTTP 403, 429 or 503 with challenge markup); results may be incomplete and AI crawlers may face similar rules.",
    );
  }
  return found;
}

// ---------------------------------------------------------------------------
// Informational signals (4.8)
// ---------------------------------------------------------------------------

function agentPolicies(
  ctx: EvalContext | null,
  treatment: AgentTreatment,
  url: string,
): AgentPolicy[] {
  return AI_AGENTS.filter((agent) => agent.treatment === treatment).map((agent) => ({
    token: agent.token,
    allowed: ctx === null ? null : ctx.robots.isAllowed(agent.token, url),
  }));
}

function jsonLdTypes(ctx: EvalContext | null): string[] {
  if (ctx === null) return [];
  const types = new Set<string>();
  for (const ref of ctx.jsonLd.nodes) {
    for (const type of ref.node.types) {
      if (typeof type === "string" && type !== "") types.add(truncateEvidence(type));
    }
  }
  return [...types].sort().slice(0, MAX_JSONLD_TYPES);
}

export function deriveInformational(
  snapshot: ScanSnapshot,
  ctx: EvalContext | null,
): InformationalSignals {
  const home = ctx === null ? null : ctx.home;
  return {
    trainingCrawlerPolicy: agentPolicies(ctx, "informational-training", snapshot.homeUrl),
    userAgentPolicy: agentPolicies(ctx, "informational-user-initiated", snapshot.homeUrl),
    challengeDetected: ctx !== null && ctx.challenge.detected,
    scannerRegion: snapshot.scannerRegion === null ? null : truncateEvidence(snapshot.scannerRegion),
    jsonLdTypes: jsonLdTypes(ctx),
    homepageHtmlBytes: home !== null && home.facts !== null ? home.record.decodedBytes : null,
    homepageRedirects: home === null ? null : home.record.redirectChain.length,
  };
}

// ---------------------------------------------------------------------------
// Limitations and list staleness
// ---------------------------------------------------------------------------

const NOT_MEASURED =
  "Does not measure search positions, traffic, backlinks, domain authority, Core Web Vitals, whether any AI system cites the site, content accuracy or quality, accessibility conformance, legal compliance or off-site reputation.";

const SIGNALS_ONLY =
  "Scores are signals of readiness only. They do not compare this site with others and do not predict search results or whether any AI system will mention the site.";

function staleListNames(now: Date): string[] {
  const stale: string[] = [];
  if (AI_AGENTS.some((agent) => isListStale(agent.reviewDueAt, now))) stale.push("aiAgents");
  if (isListStale(PATTERN_LISTS_REVIEW_DUE_AT, now)) stale.push("patterns");
  return stale;
}

function staleListLimitations(stale: readonly string[]): string[] {
  const out: string[] = [];
  if (stale.includes("aiAgents")) {
    out.push(
      "The AI crawler list is unverified against vendor documentation or past its review date, so crawler treatment may be out of date.",
    );
  }
  if (stale.includes("patterns")) {
    out.push("The page-type and wording pattern lists have no recorded review date.");
  }
  return out;
}

function draftLimitation(): string[] {
  return /draft/i.test(METHODOLOGY.version)
    ? [
        `Methodology ${METHODOLOGY.version} is a draft that the methodology owner has not signed off, so results are engineering calibration results and not published claims.`,
      ]
    : [];
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function completedLimitations(
  snapshot: ScanSnapshot,
  pages: readonly ReportPageSummary[],
  scores: ScoreSummary,
  challengeDetected: boolean,
  failedCategories: readonly CategoryId[],
  stale: readonly string[],
): string[] {
  const out = [
    "Reads the raw HTML only; content added by JavaScript is not seen or scored.",
    "Samples the homepage and up to four other pages chosen by a fixed rule, so results describe those pages and not every page on the site.",
    SIGNALS_ONLY,
    NOT_MEASURED,
    "Several thresholds are DataBridges judgements (heuristics) and may change in a later methodology version.",
    "Server response time is measured from one scanner location at one moment and varies with region and time of day.",
    ...draftLimitation(),
    ...staleListLimitations(stale),
  ];
  const renderDependent = pages.filter((page) => page.renderDependent).length;
  if (renderDependent > 0) {
    out.push(
      `${renderDependent} sampled ${plural(renderDependent, "page is", "pages are")} built by JavaScript, so ${plural(renderDependent, "its", "their")} body content was not read.`,
    );
  }
  const unread = pages.filter((page) => page.fetchClass !== "ok").length;
  if (unread > 0) {
    out.push(
      `${unread} sampled ${plural(unread, "page", "pages")} could not be read as HTML (blocked, failed or not HTML); unread pages lower coverage but not the score.`,
    );
  }
  if (challengeDetected) {
    out.push(
      "The scanner was challenged or blocked on at least one request, so results may be incomplete and AI crawlers may face similar rules.",
    );
  }
  if (snapshot.stats.jobTimedOut) {
    out.push("The scan stopped at its time limit, so some resources were not fetched.");
  }
  if (snapshot.stats.requestCapReached) {
    out.push("The scan reached its request limit, so some resources were not fetched.");
  }
  if (failedCategories.length > 0) {
    out.push(
      `An internal error stopped ${failedCategories.join(", ")} from being evaluated; those metrics lower coverage but not the score.`,
    );
  }
  if (scores.overall === null || scores.seo === null || scores.aeo === null) {
    out.push(
      "One or more scores are withheld because too little of the site could be observed; the observed metrics are still shown.",
    );
  }
  return out;
}

const NO_SCORE_REASONS: Record<string, { reason: string; limitation: string }> = {
  BLOCKED_BY_ROBOTS: {
    reason: `robots.txt disallows ${OWN_AGENT_TOKEN} from the homepage, so nothing else was requested and no metric was evaluated.`,
    limitation: `robots.txt disallows the scanner (${OWN_AGENT_TOKEN}) from the homepage. Nothing else was requested and the scanner does not retry under another identity.`,
  },
  UNREACHABLE: {
    reason: "The homepage could not be fetched over https or http, so no metric was evaluated.",
    limitation: "The homepage could not be fetched over https or http.",
  },
  JOB_ERROR: {
    reason: "The scan stopped on an error before any metric was evaluated.",
    limitation: "The scan stopped on an error before it could finish.",
  },
};

function noScoreReasons(outcome: string): { reason: string; limitation: string } {
  return NO_SCORE_REASONS[outcome] ?? NO_SCORE_REASONS.JOB_ERROR;
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

function contextOrNull(snapshot: ScanSnapshot, now: Date): EvalContext | null {
  try {
    return buildEvalContext(snapshot, now);
  } catch {
    return null;
  }
}

function pageSummaries(snapshot: ScanSnapshot, ctx: EvalContext | null): ReportPageSummary[] {
  if (snapshot.outcome === "COMPLETED" && ctx !== null) {
    return ctx.pages.map((page) => ({
      url: page.url,
      type: page.type,
      reason: truncateEvidence(page.reason),
      fetchClass: page.fetchClass,
      observed: page.observed,
      renderDependent: page.renderDependent,
    }));
  }
  return snapshot.pages.map((page) => ({
    url: page.url,
    type: page.type,
    reason: truncateEvidence(page.reason),
    fetchClass: classifyPageFetch(page.record),
    observed: false,
    renderDependent: false,
  }));
}

function assertValidNow(now: Date): void {
  if (typeof now?.getTime !== "function" || Number.isNaN(now.getTime())) {
    throw new RangeError("evaluateSnapshot: now must be a valid Date");
  }
}

type ReportParts = {
  snapshot: ScanSnapshot;
  snapshotHash: string;
  scores: ScoreSummary;
  pagesSampled: ReportPageSummary[];
  criticalFindings: CriticalFinding[];
  metrics: MetricResult[];
  informational: InformationalSignals;
  staleLists: string[];
  limitations: string[];
};

function assemble(parts: ReportParts): ScanReport {
  const { snapshot } = parts;
  return {
    reportVersion: 1,
    methodologyVersion: METHODOLOGY.version,
    scannerVersion: snapshot.scannerVersion,
    scannedAt: snapshot.scannedAt,
    snapshotHash: parts.snapshotHash,
    homeUrl: snapshot.homeUrl,
    outcome: snapshot.outcome,
    outcomeDetail:
      snapshot.outcomeDetail === null
        ? null
        : truncateEvidence(snapshot.outcomeDetail, MAX_DETAIL_CHARS),
    coverage: parts.scores.coverage,
    scores: parts.scores,
    pagesSampled: parts.pagesSampled,
    criticalFindings: parts.criticalFindings,
    metrics: parts.metrics,
    informational: parts.informational,
    listVersions: { ...METHODOLOGY.listVersions },
    staleLists: parts.staleLists,
    limitations: parts.limitations,
    correctionRoute: CORRECTION_ROUTE,
  };
}

function noScoreReport(snapshot: ScanSnapshot, now: Date, snapshotHash: string): ScanReport {
  const ctx = contextOrNull(snapshot, now);
  const { reason, limitation } = noScoreReasons(snapshot.outcome);
  const staleLists = staleListNames(now);
  return assemble({
    snapshot,
    snapshotHash,
    scores: noScoreSummary(),
    pagesSampled: pageSummaries(snapshot, ctx),
    criticalFindings: [],
    metrics: notObservedForAll(reason),
    informational: deriveInformational(snapshot, ctx),
    staleLists,
    limitations: [
      limitation,
      "No metric was evaluated, so this report carries no score, no critical findings and no coverage.",
      ...draftLimitation(),
    ],
  });
}

// `evaluators` is a test seam; production callers use the default.
export function evaluateSnapshot(
  snapshot: ScanSnapshot,
  now: Date = new Date(snapshot.scannedAt),
  evaluators: CategoryEvaluators = CATEGORY_EVALUATORS,
): ScanReport {
  assertValidNow(now);
  const snapshotHash = computeSnapshotHash(snapshot);
  if (snapshot.outcome !== "COMPLETED") return noScoreReport(snapshot, now, snapshotHash);

  const ctx = buildEvalContext(snapshot, now);
  const metrics: MetricResult[] = [];
  const failedCategories: CategoryId[] = [];
  for (const id of CATEGORY_IDS) {
    const category = METHODOLOGY.categories.find((candidate) => candidate.id === id);
    if (category === undefined) throw new RangeError(`Methodology has no category ${id}`);
    const run = runCategory(category, ctx, evaluators);
    if (run.failed) failedCategories.push(id);
    metrics.push(...run.results);
  }

  const scores = computeScoreSummary(metrics);
  const pagesSampled = pageSummaries(snapshot, ctx);
  const informational = deriveInformational(snapshot, ctx);
  const staleLists = staleListNames(now);
  return assemble({
    snapshot,
    snapshotHash,
    scores,
    pagesSampled,
    criticalFindings: deriveCriticalFindings(ctx, metrics),
    metrics,
    informational,
    staleLists,
    limitations: completedLimitations(
      snapshot,
      pagesSampled,
      scores,
      informational.challengeDetected,
      failedCategories,
      staleLists,
    ),
  });
}
