import {
  METHODOLOGY,
  THRESHOLDS,
  getMetricDefinition,
} from "@/lib/visibility/methodology";
import {
  CATEGORY_IDS,
  EVIDENCE_STRING_MAX,
  type CategoryDefinition,
  type CategoryId,
  type CategoryScore,
  type EvidenceRecord,
  type EvidenceValue,
  type MetricDefinitionExt,
  type MetricEvidence,
  type MetricResult,
  type MetricResultCode,
  type PerPageScore,
  type Pillar,
  type ScoreSummary,
  type WithheldReason,
} from "@/lib/visibility/types";

export const TOLERANCE = 1e-9;

export type ScoredResultCode = "PASS" | "PARTIAL" | "FAIL";

type Thresholds = {
  readonly categoryMinCoverage: number;
  readonly pillarMinShownWeight: number;
  readonly overallMinShownWeight: number;
};

// Half up for non-negative values; the tolerance absorbs binary representation error (1.005 * 100).
export function roundHalfUp(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  const rounded = Math.floor(value * factor + 0.5 + TOLERANCE) / factor;
  return rounded === 0 ? 0 : rounded;
}

export function round2(value: number): number {
  return roundHalfUp(value, 2);
}

export function round4(value: number): number {
  return roundHalfUp(value, 4);
}

export function displayScore(score: number | null): number | null {
  return score === null ? null : roundHalfUp(score, 0);
}

export const SCORE_BANDS = [
  { min: 85, label: "Strong signals detected" },
  { min: 70, label: "Good foundations" },
  { min: 50, label: "Some gaps" },
  { min: 0, label: "Many gaps" },
] as const;

// Bands apply to the displayed whole number, so the label never contradicts the figure beside it (4.7).
export function scoreBand(score: number | null): string | null {
  const shown = displayScore(score);
  if (shown === null || !Number.isFinite(shown)) return null;
  return (SCORE_BANDS.find((band) => shown >= band.min) ?? SCORE_BANDS[SCORE_BANDS.length - 1]).label;
}

function normaliseScore(s: number): number {
  if (!Number.isFinite(s) || s < -TOLERANCE || s > 1 + TOLERANCE) {
    throw new RangeError(`Metric score must be a number in [0, 1], received ${s}`);
  }
  if (s <= TOLERANCE) return 0;
  if (s >= 1 - TOLERANCE) return 1;
  return s;
}

export function deriveResultCode(s: number): ScoredResultCode {
  const score = normaliseScore(s);
  if (score === 1) return "PASS";
  if (score === 0) return "FAIL";
  return "PARTIAL";
}

export function pointsFor(maxPoints: number, s: number): number {
  return round2(maxPoints * normaliseScore(s));
}

export function isScoredCode(code: MetricResultCode): code is ScoredResultCode {
  return code === "PASS" || code === "PARTIAL" || code === "FAIL";
}

export type PageAggregateOutcome = "scored" | "not_applicable" | "not_observed" | "scan_error";

export type PageAggregate = {
  outcome: PageAggregateOutcome;
  applicable: number;
  observed: number;
  notObserved: number;
  scanErrors: number;
  mean: number | null;
};

// Fewer than half observed is SCAN_ERROR when any missing page is a scan error, else NOT_OBSERVED (render-dependent pages).
export function aggregatePageScores(perPage: readonly PerPageScore[]): PageAggregate {
  let applicable = 0;
  let observed = 0;
  let notObserved = 0;
  let scanErrors = 0;
  let sum = 0;
  for (const page of perPage) {
    if (page.status === "not_applicable") continue;
    applicable += 1;
    if (page.status === "observed") {
      if (page.score === null || !Number.isFinite(page.score)) {
        throw new TypeError(`Observed page ${page.url} has no numeric score`);
      }
      sum += normaliseScore(page.score);
      observed += 1;
    } else if (page.status === "scan_error") {
      scanErrors += 1;
    } else {
      notObserved += 1;
    }
  }
  const base = { applicable, observed, notObserved, scanErrors };
  if (applicable === 0) return { ...base, outcome: "not_applicable", mean: null };
  if (observed * 2 < applicable) {
    return { ...base, outcome: scanErrors > 0 ? "scan_error" : "not_observed", mean: null };
  }
  return { ...base, outcome: "scored", mean: sum / observed };
}

const MAX_EVIDENCE_DEPTH = 8;

function isControlCode(code: number): boolean {
  return code <= 0x1f || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029;
}

function isInvisibleFormatCode(code: number): boolean {
  return (
    code === 0x00ad ||
    code === 0x061c ||
    code === 0x180e ||
    (code >= 0x200b && code <= 0x200f) ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2060 && code <= 0x2064) ||
    (code >= 0x2066 && code <= 0x2069) ||
    code === 0xfeff ||
    (code >= 0xfff9 && code <= 0xfffb) ||
    (code >= 0xe0000 && code <= 0xe007f) ||
    (code >= 0xd800 && code <= 0xdfff)
  );
}

// The cap is on UTF-16 length, so it holds whether a reader counts code units or code points; a cut never splits a pair.
function cleanString(value: string): string {
  const kept: string[] = [];
  let length = 0;
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    let piece: string;
    if (isControlCode(code)) piece = " ";
    else if (isInvisibleFormatCode(code)) continue;
    else piece = char;
    kept.push(piece);
    length += piece.length;
    if (length > EVIDENCE_STRING_MAX) {
      let room = EVIDENCE_STRING_MAX - 1;
      const head: string[] = [];
      for (const item of kept) {
        if (item.length > room) break;
        head.push(item);
        room -= item.length;
      }
      return `${head.join("")}…`;
    }
  }
  return kept.join("");
}

function cleanValue(value: unknown, depth: number): EvidenceValue {
  if (typeof value === "string") return cleanString(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean" || value === null) return value;
  if (depth >= MAX_EVIDENCE_DEPTH) return null;
  if (Array.isArray(value)) return value.map((item) => cleanValue(item, depth + 1));
  if (typeof value === "object") {
    const out: { [key: string]: EvidenceValue } = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (key === "__proto__" || item === undefined) continue;
      out[cleanString(key)] = cleanValue(item, depth + 1);
    }
    return out;
  }
  return null;
}

function cleanEvidence(evidence: MetricEvidence): MetricEvidence {
  return cleanValue(evidence, 0) as MetricEvidence;
}

function build(
  def: MetricDefinitionExt,
  result: MetricResultCode,
  points: number | null,
  maxPoints: number | null,
  evidence: MetricEvidence,
  explanation: string
): MetricResult {
  return {
    metricId: def.id,
    metricVersion: def.version,
    result,
    points,
    maxPoints,
    evidence: cleanEvidence(evidence),
    explanation: cleanString(explanation),
    reviewedBy: null,
  };
}

export function resultFromScore(
  metricId: string,
  s: number,
  evidence: MetricEvidence,
  explanation: string
): MetricResult {
  const def = getMetricDefinition(metricId);
  return build(
    def,
    deriveResultCode(s),
    pointsFor(def.maxPoints, s),
    def.maxPoints,
    evidence,
    explanation
  );
}

export function notApplicable(
  metricId: string,
  reason: string,
  evidence?: MetricEvidence
): MetricResult {
  const def = getMetricDefinition(metricId);
  return build(
    def,
    "NOT_APPLICABLE",
    null,
    null,
    evidence ?? { branch: "NOT_APPLICABLE", reason },
    reason
  );
}

export function notObserved(
  metricId: string,
  reason: string,
  evidence?: MetricEvidence
): MetricResult {
  const def = getMetricDefinition(metricId);
  return build(
    def,
    "NOT_OBSERVED",
    null,
    def.maxPoints,
    evidence ?? { branch: "NOT_OBSERVED", reason },
    reason
  );
}

export function scanError(
  metricId: string,
  reason: string,
  evidence?: MetricEvidence
): MetricResult {
  const def = getMetricDefinition(metricId);
  return build(
    def,
    "SCAN_ERROR",
    null,
    def.maxPoints,
    evidence ?? { branch: "SCAN_ERROR", reason },
    reason
  );
}

function perPageEvidence(perPage: readonly PerPageScore[]): EvidenceRecord[] {
  return perPage.map((page) => ({
    ...page.evidence,
    url: page.url,
    status: page.status,
    s_p: page.score,
  }));
}

function pagePlural(count: number): string {
  return count === 1 ? "page" : "pages";
}

// The explanation is used only when scored; unscored outcomes explain themselves.
export function resultFromPageScores(
  metricId: string,
  perPage: readonly PerPageScore[],
  evidence: MetricEvidence | null | undefined,
  explanation: string
): MetricResult {
  const aggregate = aggregatePageScores(perPage);
  const resolvedEvidence = evidence ?? perPageEvidence(perPage);
  switch (aggregate.outcome) {
    case "not_applicable":
      return notApplicable(
        metricId,
        "No sampled page is applicable to this metric.",
        resolvedEvidence
      );
    case "not_observed":
      return notObserved(
        metricId,
        `Only ${aggregate.observed} of ${aggregate.applicable} applicable ${pagePlural(aggregate.applicable)} could be observed (fewer than half), so this metric is not scored.`,
        resolvedEvidence
      );
    case "scan_error":
      return scanError(
        metricId,
        `Only ${aggregate.observed} of ${aggregate.applicable} applicable ${pagePlural(aggregate.applicable)} could be read because of fetch or parse errors (fewer than half), so this metric is not scored.`,
        resolvedEvidence
      );
    default: {
      const mean = aggregate.mean ?? 0;
      const text =
        explanation.trim() === ""
          ? `Mean page score ${round4(mean)} over ${aggregate.observed} observed ${pagePlural(aggregate.observed)}.`
          : explanation;
      return resultFromScore(metricId, mean, resolvedEvidence, text);
    }
  }
}

export function notObservedForAll(reason: string): MetricResult[] {
  return METHODOLOGY.metrics.map((metric) => notObserved(metric.id, reason));
}

function indexResults(results: readonly MetricResult[]): Map<string, MetricResult> {
  const byId = new Map<string, MetricResult>();
  for (const result of results) {
    if (byId.has(result.metricId)) {
      throw new RangeError(`Duplicate result for metric ${result.metricId}`);
    }
    byId.set(result.metricId, result);
  }
  return byId;
}

// A metric with no result counts as NOT_OBSERVED: it stays in possibleMax and lowers coverage.
export function scoreCategory(
  category: CategoryDefinition,
  results: readonly MetricResult[],
  thresholds: Thresholds = THRESHOLDS
): CategoryScore {
  const byId = indexResults(results);
  let appliedMax = 0;
  let possibleMax = 0;
  let pointsCents = 0;
  for (const metricId of category.metricIds) {
    const maxPoints = getMetricDefinition(metricId).maxPoints;
    const result = byId.get(metricId);
    const code: MetricResultCode = result ? result.result : "NOT_OBSERVED";
    if (code === "NOT_APPLICABLE") continue;
    possibleMax += maxPoints;
    if (!result || !isScoredCode(code)) continue;
    const points = result.points;
    if (
      points === null ||
      !Number.isFinite(points) ||
      points < -TOLERANCE ||
      points > maxPoints + TOLERANCE
    ) {
      throw new RangeError(
        `Metric ${metricId} is ${code} but its points (${points}) are not within 0 to ${maxPoints}`
      );
    }
    appliedMax += maxPoints;
    pointsCents += Math.round(points * 100);
  }
  const ratio = possibleMax > 0 ? appliedMax / possibleMax : null;
  return {
    id: category.id,
    pillar: category.pillar,
    weight: category.weight,
    points: pointsCents / 100,
    appliedMax,
    possibleMax,
    coverage: ratio === null ? null : round4(ratio),
    score: appliedMax > 0 ? round4(pointsCents / (appliedMax * 100)) : null,
    shown: ratio !== null && ratio >= thresholds.categoryMinCoverage - TOLERANCE,
  };
}

type PillarTotals = { weight: number; weightedScore: number };

export function summariseScores(
  categories: Record<CategoryId, CategoryScore>,
  thresholds: Thresholds = THRESHOLDS
): ScoreSummary {
  const totals: Record<Pillar, PillarTotals> = {
    SEO: { weight: 0, weightedScore: 0 },
    AEO: { weight: 0, weightedScore: 0 },
  };
  let coverageNumerator = 0;
  let coverageDenominator = 0;
  for (const id of CATEGORY_IDS) {
    const category = categories[id];
    if (category.possibleMax > 0) {
      coverageNumerator += category.weight * (category.appliedMax / category.possibleMax);
      coverageDenominator += category.weight;
    }
    if (category.shown && category.score !== null) {
      const pillar = totals[category.pillar];
      pillar.weight += category.weight;
      pillar.weightedScore += category.weight * Math.round(category.score * 10000);
    }
  }

  const seoWeight = totals.SEO.weight;
  const aeoWeight = totals.AEO.weight;
  const overallWeight = seoWeight + aeoWeight;

  const seoPublished = seoWeight >= thresholds.pillarMinShownWeight - TOLERANCE && seoWeight > 0;
  const aeoPublished = aeoWeight >= thresholds.pillarMinShownWeight - TOLERANCE && aeoWeight > 0;
  const overallPublished =
    seoPublished &&
    aeoPublished &&
    overallWeight >= thresholds.overallMinShownWeight - TOLERANCE;

  // weightedScore is in ten-thousandths of a score point; dividing by 100 gives the 0 to 100 scale.
  const scale = (weightedScore: number, weight: number): number =>
    round2(weightedScore / weight / 100);

  const overallReason = (): WithheldReason | null => {
    if (overallPublished) return null;
    if (!seoPublished || !aeoPublished) return "PILLAR_NOT_PUBLISHED";
    return "OVERALL_WEIGHT_BELOW_MINIMUM";
  };

  return {
    overall: overallPublished
      ? scale(totals.SEO.weightedScore + totals.AEO.weightedScore, overallWeight)
      : null,
    seo: seoPublished ? scale(totals.SEO.weightedScore, seoWeight) : null,
    aeo: aeoPublished ? scale(totals.AEO.weightedScore, aeoWeight) : null,
    coverage: coverageDenominator > 0 ? round4(coverageNumerator / coverageDenominator) : 0,
    categories,
    shownWeight: { seo: seoWeight, aeo: aeoWeight, overall: overallWeight },
    withheld: {
      seo: seoPublished ? null : "PILLAR_WEIGHT_BELOW_MINIMUM",
      aeo: aeoPublished ? null : "PILLAR_WEIGHT_BELOW_MINIMUM",
      overall: overallReason(),
    },
  };
}

export function computeScoreSummary(results: readonly MetricResult[]): ScoreSummary {
  const known = new Set(METHODOLOGY.metrics.map((metric) => metric.id));
  for (const result of results) {
    if (!known.has(result.metricId)) {
      throw new RangeError(`Result for unknown metric ${result.metricId}`);
    }
  }
  const categories = {} as Record<CategoryId, CategoryScore>;
  for (const category of METHODOLOGY.categories) {
    categories[category.id] = scoreCategory(category, results);
  }
  return summariseScores(categories);
}

export function noScoreSummary(): ScoreSummary {
  const summary = computeScoreSummary(
    notObservedForAll("No evaluation was run because the scan produced no score.")
  );
  return {
    ...summary,
    overall: null,
    seo: null,
    aeo: null,
    withheld: {
      seo: "NO_SCORE_OUTCOME",
      aeo: "NO_SCORE_OUTCOME",
      overall: "NO_SCORE_OUTCOME",
    },
  };
}
