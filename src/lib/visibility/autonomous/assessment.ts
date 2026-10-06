import { buildEvalContext } from "@/lib/visibility/context";
import { evaluateSnapshot } from "@/lib/visibility/evaluate/index";
import { METHODOLOGY, METHODOLOGY_VERSION } from "@/lib/visibility/methodology";
import { computeScoreSummary, noScoreSummary } from "@/lib/visibility/scoring";
import { METRIC_RESULT_CODES, type MetricResult, type MetricResultCode, type ScanSnapshot, type ScoreSummary } from "@/lib/visibility/types";
import { COHORT, hasCompanyMarker, LIMITS, POLICY_VERSION } from "./policy";

export type SafeMetric = { metricId: string; result: MetricResultCode; points: number | null; maxPoints: number | null };
export type Review = { verdict: "CONFIRMED" | "WITHHOLD"; strengthMetricId: string | null; improvementMetricId: string | null };
export type Assessment = {
  methodologyVersion: string;
  policyVersion: string;
  cohort: string;
  scannedAt: string;
  snapshotHash: string;
  outcome: ScanSnapshot["outcome"];
  companyMarkerObserved: boolean;
  scores: ScoreSummary;
  criticalFindingIds: string[];
  metrics: SafeMetric[];
  sampledPages: number;
  observedPages: number;
  requestCount: number;
};

export function assess(snapshot: ScanSnapshot): Assessment {
  const report = evaluateSnapshot(snapshot);
  const ctx = buildEvalContext(snapshot, new Date(snapshot.scannedAt));
  // Whitelist projection: never persist raw HTML, text, schema values, names,
  // contacts, page paths, error details, evaluator evidence or free-form prose.
  const projected: Assessment = {
    methodologyVersion: report.methodologyVersion, policyVersion: POLICY_VERSION, cohort: COHORT,
    scannedAt: report.scannedAt, snapshotHash: report.snapshotHash, outcome: report.outcome,
    companyMarkerObserved: hasCompanyMarker(ctx.homeFacts?.visibleText ?? ""),
    scores: report.outcome === "COMPLETED" ? computeScoreSummary(report.metrics) : noScoreSummary(),
    criticalFindingIds: report.criticalFindings.map(f => f.id),
    metrics: report.metrics.map(m => ({ metricId: m.metricId, result: m.result, points: m.points, maxPoints: m.maxPoints })),
    sampledPages: ctx.pages.length, observedPages: ctx.pages.filter(p => p.observed).length,
    requestCount: snapshot.stats.requestCount,
  };
  const validated = validateAssessment(projected);
  if (!validated) throw new Error("INVALID_SCANNER_RESULTS");
  return validated;
}

export function validateAssessment(value: unknown): Assessment | null {
  if (!value || typeof value !== "object") return null;
  const a = value as Assessment;
  if (a.methodologyVersion !== METHODOLOGY_VERSION || a.policyVersion !== POLICY_VERSION || a.cohort !== COHORT ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(a.scannedAt) || !Number.isFinite(Date.parse(a.scannedAt)) ||
    new Date(a.scannedAt).toISOString() !== a.scannedAt || !/^[a-f0-9]{64}$/.test(a.snapshotHash) ||
    !["COMPLETED", "BLOCKED_BY_ROBOTS", "UNREACHABLE", "JOB_ERROR"].includes(a.outcome) ||
    typeof a.companyMarkerObserved !== "boolean" || !Array.isArray(a.metrics) || a.metrics.length !== 52 ||
    !Array.isArray(a.criticalFindingIds) || a.criticalFindingIds.some(id => !/^CF-0[1-7]$/.test(id)) ||
    ![a.sampledPages, a.observedPages, a.requestCount].every(n => Number.isInteger(n) && n >= 0) ||
    a.sampledPages > 5 || a.observedPages > a.sampledPages || a.requestCount > 60) return null;
  const metrics: SafeMetric[] = [];
  const results: MetricResult[] = [];
  for (const [index, def] of METHODOLOGY.metrics.entries()) {
    const m = a.metrics[index];
    if (!m || m.metricId !== def.id || !METRIC_RESULT_CODES.includes(m.result)) return null;
    const scored = ["PASS", "PARTIAL", "FAIL"].includes(m.result);
    if (scored ? (typeof m.points !== "number" || !Number.isFinite(m.points) || m.points < 0 || m.points > def.maxPoints ||
      m.maxPoints !== def.maxPoints || (m.result === "PASS" && m.points !== def.maxPoints) ||
      (m.result === "FAIL" && m.points !== 0)) :
      (m.points !== null || m.maxPoints !== (m.result === "NOT_APPLICABLE" ? null : def.maxPoints))) return null;
    metrics.push({ metricId: def.id, result: m.result, points: m.points, maxPoints: m.maxPoints });
    results.push({ ...metrics[index], metricVersion: def.version, evidence: {}, explanation: "", reviewedBy: null });
  }
  if (a.outcome !== "COMPLETED" && metrics.some(m => m.result !== "NOT_OBSERVED")) return null;
  return { methodologyVersion: METHODOLOGY_VERSION, policyVersion: POLICY_VERSION, cohort: COHORT,
    scannedAt: a.scannedAt, snapshotHash: a.snapshotHash, outcome: a.outcome, companyMarkerObserved: a.companyMarkerObserved,
    scores: a.outcome === "COMPLETED" ? computeScoreSummary(results) : noScoreSummary(),
    metrics, criticalFindingIds: [...new Set(a.criticalFindingIds)], sampledPages: a.sampledPages,
    observedPages: a.observedPages, requestCount: a.requestCount };
}

const EXCLUDED_TIPS = new Set(["A4.02", "A4.03", "A1.02"]);
export function tipChoices(a: Assessment): { strengths: string[]; improvements: string[] } {
  const weight = (m: SafeMetric) => {
    const def = METHODOLOGY.metrics.find(d => d.id === m.metricId)!;
    return METHODOLOGY.categories.find(c => c.id === def.categoryId)!.weight * (m.maxPoints ?? 0) / 100;
  };
  const order = (x: SafeMetric, y: SafeMetric) => weight(y) - weight(x) || x.metricId.localeCompare(y.metricId);
  const tips = a.metrics.filter(m => !EXCLUDED_TIPS.has(m.metricId));
  return {
    strengths: tips.filter(m => m.result === "PASS").sort(order).map(m => m.metricId),
    improvements: tips.filter(m => m.result === "FAIL" || m.result === "PARTIAL").sort(order).map(m => m.metricId),
  };
}

export function reviewPayload(a: Assessment) {
  const choices = tipChoices(a);
  return { methodologyVersion: a.methodologyVersion, coverage: a.scores.coverage,
    metrics: a.metrics, choices,
    rules: METHODOLOGY.metrics.map(m => ({ metricId: m.id, name: m.name, rule: m.evaluationRule })),
    instructions: "Check numerical consistency and choose only an allowed metric ID. This is commentary review, not independent verification of page observations." };
}

export function validateReview(value: unknown, a: Assessment): Review | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).sort().join(",") !== "improvementMetricId,strengthMetricId,verdict") return null;
  if (row.verdict !== "CONFIRMED" && row.verdict !== "WITHHOLD") return null;
  const choices = tipChoices(a);
  for (const [key, permitted] of [["strengthMetricId", choices.strengths], ["improvementMetricId", choices.improvements]] as const) {
    const id = row[key];
    if (id !== null && (typeof id !== "string" || !permitted.includes(id))) return null;
    if (row.verdict === "CONFIRMED" && permitted.length > 0 && id === null) return null;
  }
  return { verdict: row.verdict, strengthMetricId: row.strengthMetricId as string | null,
    improvementMetricId: row.improvementMetricId as string | null };
}

export function rankEligible(a: Assessment, reviews: Partial<Record<"codex" | "claude", Review>>): boolean {
  return a.outcome === "COMPLETED" && a.companyMarkerObserved && a.scores.overall !== null &&
    a.scores.seo !== null && a.scores.aeo !== null && a.scores.coverage >= LIMITS.minCoverage &&
    Object.values(a.scores.categories).every(c => c.shown) &&
    !a.criticalFindingIds.some(id => ["CF-04", "CF-07"].includes(id)) &&
    reviews.codex?.verdict === "CONFIRMED" && reviews.claude?.verdict === "CONFIRMED";
}

export function technicalTip(metricId: string | null, kind: "strength" | "improvement") {
  const m = METHODOLOGY.metrics.find(d => d.id === metricId);
  if (!m || EXCLUDED_TIPS.has(m.id)) return null;
  return { metricId: m.id, title: m.name, text: kind === "improvement" ? m.fixGuidance : m.description, basis: m.basis };
}
