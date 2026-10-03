import { METHODOLOGY, METHODOLOGY_VERSION, getMetricDefinition } from "@/lib/visibility/methodology";
import {
  computeScoreSummary,
  displayScore,
  noScoreSummary,
  notApplicable,
  notObserved,
  notObservedForAll,
  resultFromPageScores,
  resultFromScore,
  round4,
  scanError,
  scoreBand,
} from "@/lib/visibility/scoring";
import {
  CRITICAL_FINDING_IDS,
  EVIDENCE_STRING_MAX,
  PAGE_TYPES,
  type EvidenceRecord,
  type MetricResult,
  type PerPageScore,
  type PerPageScoreStatus,
  type ScoreSummary,
} from "@/lib/visibility/types";

export const SUBMISSION_OUTCOMES = ["COMPLETED", "BLOCKED_BY_ROBOTS", "UNREACHABLE", "JOB_ERROR"] as const;
export type SubmissionOutcome = (typeof SUBMISSION_OUTCOMES)[number];

export const SUBMISSION_MODES = ["manual-agent", "scanner"] as const;
export type SubmissionMode = (typeof SUBMISSION_MODES)[number];

const SITE_OUTCOMES = ["SCORED", "NOT_APPLICABLE", "NOT_OBSERVED", "SCAN_ERROR"] as const;
type SiteOutcome = (typeof SITE_OUTCOMES)[number];

const PAGE_STATUSES: readonly PerPageScoreStatus[] = [
  "observed",
  "not_observed",
  "scan_error",
  "not_applicable",
];

const PER_PAGE_SCOPES = new Set(["P", "CP", "KO", "AP"]);

export const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,62}[a-z0-9]$/i;
const MAX_EVIDENCE_ITEMS = 20;
const MAX_EXPLANATION = 500;
const MAX_NOTES = 2000;
const MAX_SAMPLED_PAGES = 5;
const AGREEMENT_TOLERANCE = 0.1;
const NEEDS_REVIEW_AGREEMENT = 0.9;
const EPSILON = 1e-9;

export type SubmissionPageScore = {
  url: string;
  status: PerPageScoreStatus;
  score: number | null;
};

export type SubmissionMetric = {
  metricId: string;
  outcome?: SiteOutcome;
  score?: number;
  pageScores?: SubmissionPageScore[];
  evidence: string[];
  explanation: string;
};

export type Submission = {
  schemaVersion: 1;
  methodologyVersion: string;
  targetId: string;
  homeUrl: string;
  runId: string;
  agentId: string;
  scannedAt: string;
  mode: SubmissionMode;
  outcome: SubmissionOutcome;
  sampledPages: { url: string; type: string; reason: string }[];
  metrics: SubmissionMetric[];
  criticalFindings: string[];
  notes?: string;
  methodologyQuestions?: { ref: string; question: string }[];
};

export type ValidationResult =
  | { ok: true; submission: Submission }
  | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isUnitNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -EPSILON && value <= 1 + EPSILON;
}

export function validateSubmission(input: unknown): ValidationResult {
  const errors: string[] = [];
  const fail = (message: string) => {
    if (errors.length < 60) errors.push(message);
  };

  if (!isRecord(input)) return { ok: false, errors: ["Submission must be a JSON object."] };

  if (input.schemaVersion !== 1) fail("schemaVersion must be 1.");
  if (input.methodologyVersion !== METHODOLOGY_VERSION) {
    fail(`methodologyVersion must be "${METHODOLOGY_VERSION}" (found ${JSON.stringify(input.methodologyVersion)}).`);
  }
  for (const key of ["targetId", "runId", "agentId"] as const) {
    const value = input[key];
    if (typeof value !== "string" || !ID_PATTERN.test(value)) {
      fail(`${key} must be 2-64 letters, digits, dots, hyphens or underscores, starting and ending with a letter or digit.`);
    }
  }
  if (!isHttpUrl(input.homeUrl)) fail("homeUrl must be an absolute http or https URL.");
  if (!isIsoDate(input.scannedAt)) fail("scannedAt must be an ISO 8601 date-time.");
  if (!SUBMISSION_MODES.includes(input.mode as SubmissionMode)) {
    fail(`mode must be one of ${SUBMISSION_MODES.join(", ")}.`);
  }
  const outcome = input.outcome as SubmissionOutcome;
  if (!SUBMISSION_OUTCOMES.includes(outcome)) {
    fail(`outcome must be one of ${SUBMISSION_OUTCOMES.join(", ")}.`);
  }

  if (!Array.isArray(input.sampledPages)) {
    fail("sampledPages must be an array.");
  } else {
    if (input.sampledPages.length > MAX_SAMPLED_PAGES) {
      fail(`sampledPages may hold at most ${MAX_SAMPLED_PAGES} pages (the homepage plus 4).`);
    }
    input.sampledPages.forEach((page, i) => {
      if (!isRecord(page) || !isHttpUrl(page.url)) {
        fail(`sampledPages[${i}].url must be an absolute http or https URL.`);
        return;
      }
      if (!PAGE_TYPES.includes(page.type as (typeof PAGE_TYPES)[number])) {
        fail(`sampledPages[${i}].type must be one of ${PAGE_TYPES.join(", ")}.`);
      }
      if (typeof page.reason !== "string" || page.reason.length === 0 || page.reason.length > 300) {
        fail(`sampledPages[${i}].reason must be a short string.`);
      }
    });
    if (outcome === "COMPLETED" && input.sampledPages.length === 0) {
      fail("A COMPLETED submission must list at least the homepage in sampledPages.");
    }
  }

  if (!Array.isArray(input.criticalFindings)) {
    fail("criticalFindings must be an array (use [] for none).");
  } else {
    for (const id of input.criticalFindings) {
      if (!CRITICAL_FINDING_IDS.includes(id as (typeof CRITICAL_FINDING_IDS)[number])) {
        fail(`criticalFindings contains an unknown id ${JSON.stringify(id)}.`);
      }
    }
  }

  if (input.notes !== undefined && (typeof input.notes !== "string" || input.notes.length > MAX_NOTES)) {
    fail(`notes must be a string of at most ${MAX_NOTES} characters.`);
  }
  if (input.methodologyQuestions !== undefined) {
    if (!Array.isArray(input.methodologyQuestions) || input.methodologyQuestions.length > 50) {
      fail("methodologyQuestions must be an array of at most 50 items.");
    } else {
      input.methodologyQuestions.forEach((q, i) => {
        if (!isRecord(q) || typeof q.ref !== "string" || typeof q.question !== "string") {
          fail(`methodologyQuestions[${i}] needs string ref and question.`);
        }
      });
    }
  }

  if (!Array.isArray(input.metrics)) {
    fail("metrics must be an array.");
  } else if (outcome !== "COMPLETED") {
    if (input.metrics.length > 0) fail(`metrics must be empty when outcome is ${String(outcome)}.`);
  } else {
    const seen = new Set<string>();
    input.metrics.forEach((raw, i) => {
      if (!isRecord(raw)) {
        fail(`metrics[${i}] must be an object.`);
        return;
      }
      const id = raw.metricId;
      const known = METHODOLOGY.metrics.find((m) => m.id === id);
      if (typeof id !== "string" || !known) {
        fail(`metrics[${i}].metricId ${JSON.stringify(id)} is not a known metric.`);
        return;
      }
      if (seen.has(id)) fail(`metric ${id} appears more than once.`);
      seen.add(id);
      const where = `metric ${id}`;

      if (!Array.isArray(raw.evidence) || raw.evidence.length > MAX_EVIDENCE_ITEMS) {
        fail(`${where}: evidence must be an array of at most ${MAX_EVIDENCE_ITEMS} strings.`);
      } else {
        for (const item of raw.evidence) {
          if (typeof item !== "string" || item.length > EVIDENCE_STRING_MAX) {
            fail(`${where}: each evidence entry must be a string of at most ${EVIDENCE_STRING_MAX} characters.`);
            break;
          }
        }
      }
      if (typeof raw.explanation !== "string" || raw.explanation.trim() === "" || raw.explanation.length > MAX_EXPLANATION) {
        fail(`${where}: explanation must be a non-empty string of at most ${MAX_EXPLANATION} characters.`);
      } else if (/^\s*todo\b/i.test(raw.explanation)) {
        fail(`${where}: explanation is still the TODO placeholder; record what you observed.`);
      }

      if (PER_PAGE_SCOPES.has(known.scope)) {
        if (raw.score !== undefined || raw.outcome !== undefined) {
          fail(`${where}: a per-page metric (scope ${known.scope}) takes pageScores only, not score or outcome.`);
        }
        if (!Array.isArray(raw.pageScores) || raw.pageScores.length === 0 || raw.pageScores.length > MAX_SAMPLED_PAGES * 3) {
          fail(`${where}: pageScores must list one entry per page (or per page and agent) the rule applies to.`);
        } else {
          raw.pageScores.forEach((p, j) => {
            if (!isRecord(p) || !isHttpUrl(p.url)) {
              fail(`${where}: pageScores[${j}].url must be an absolute http or https URL.`);
            } else if (!PAGE_STATUSES.includes(p.status as PerPageScoreStatus)) {
              fail(`${where}: pageScores[${j}].status must be one of ${PAGE_STATUSES.join(", ")}.`);
            } else if (p.status === "observed" && !isUnitNumber(p.score)) {
              fail(`${where}: pageScores[${j}].score must be a number from 0 to 1 when status is observed.`);
            } else if (p.status !== "observed" && p.score !== null && p.score !== undefined) {
              fail(`${where}: pageScores[${j}].score must be null unless status is observed.`);
            }
          });
        }
      } else {
        if (raw.pageScores !== undefined) {
          fail(`${where}: a site-level metric (scope ${known.scope}) takes score and outcome, not pageScores.`);
        }
        if (!SITE_OUTCOMES.includes(raw.outcome as SiteOutcome)) {
          fail(`${where}: outcome must be one of ${SITE_OUTCOMES.join(", ")}.`);
        } else if (raw.outcome === "SCORED") {
          if (!isUnitNumber(raw.score)) fail(`${where}: score must be a number from 0 to 1 when outcome is SCORED.`);
        } else if (raw.score !== undefined) {
          fail(`${where}: score must be omitted unless outcome is SCORED.`);
        }
      }
    });
    for (const metric of METHODOLOGY.metrics) {
      if (!seen.has(metric.id)) fail(`metric ${metric.id} is missing; a COMPLETED submission needs all ${METHODOLOGY.metrics.length}.`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, submission: input as unknown as Submission };
}

function toResult(sub: Submission, metric: SubmissionMetric): MetricResult {
  const def = getMetricDefinition(metric.metricId);
  const base: EvidenceRecord = { observed: metric.evidence, source: sub.agentId };

  if (PER_PAGE_SCOPES.has(def.scope)) {
    const pages = metric.pageScores ?? [];
    const perPage: PerPageScore[] = pages.map((p) => ({
      url: p.url,
      status: p.status,
      score: p.status === "observed" ? p.score : null,
      evidence: {},
    }));
    const pageEvidence = pages.map((p) => ({ url: p.url, status: p.status, s_p: p.score }));
    return resultFromPageScores(def.id, perPage, { ...base, pages: pageEvidence }, metric.explanation);
  }

  switch (metric.outcome) {
    case "SCORED":
      return resultFromScore(def.id, metric.score ?? 0, base, metric.explanation);
    case "NOT_APPLICABLE":
      return notApplicable(def.id, metric.explanation, base);
    case "NOT_OBSERVED":
      return notObserved(def.id, metric.explanation, base);
    default:
      return scanError(def.id, metric.explanation, base);
  }
}

export function submissionToResults(sub: Submission): MetricResult[] {
  if (sub.outcome !== "COMPLETED") {
    return notObservedForAll(`The run ended as ${sub.outcome}, so no metric was evaluated.`);
  }
  const byId = new Map(sub.metrics.map((m) => [m.metricId, m]));
  return METHODOLOGY.metrics.map((def) => {
    const metric = byId.get(def.id);
    if (!metric) throw new RangeError(`Submission is missing metric ${def.id}; validate it first.`);
    return toResult(sub, metric);
  });
}

export type ScoredSubmission = {
  results: MetricResult[];
  summary: ScoreSummary;
  band: string | null;
};

export function scoreSubmission(sub: Submission): ScoredSubmission {
  if (sub.outcome !== "COMPLETED") {
    const summary = noScoreSummary();
    return { results: submissionToResults(sub), summary, band: null };
  }
  const results = submissionToResults(sub);
  const summary = computeScoreSummary(results);
  return { results, summary, band: scoreBand(summary.overall) };
}

export type Dispute = {
  metricId: string;
  perAgent: { agentId: string; result: string; points: number | null }[];
};

export type AgentScoreLine = {
  agentId: string;
  overall: number | null;
  seo: number | null;
  aeo: number | null;
  coverage: number;
};

export type ConsensusReport = {
  methodologyVersion: string;
  targetId: string;
  homeUrl: string;
  runId: string;
  scannedAt: string;
  outcome: SubmissionOutcome | "NO_SUBMISSION";
  raters: number;
  agentIds: string[];
  confidence: "no-score" | "single-rater" | "agreed" | "needs-review";
  agreementRate: number | null;
  disputes: Dispute[];
  criticalFindings: string[];
  contestedFindings: string[];
  results: MetricResult[];
  summary: ScoreSummary;
  band: string | null;
  perAgent: AgentScoreLine[];
};

function normalised(result: MetricResult): number | null {
  if (result.points === null || result.maxPoints === null || result.maxPoints === 0) return null;
  if (result.result !== "PASS" && result.result !== "PARTIAL" && result.result !== "FAIL") return null;
  return result.points / result.maxPoints;
}

function agreeOn(results: MetricResult[]): boolean {
  const scores = results.map(normalised);
  const scoredCount = scores.filter((s) => s !== null).length;
  if (scoredCount === results.length) {
    const values = scores as number[];
    return Math.max(...values) - Math.min(...values) <= AGREEMENT_TOLERANCE + EPSILON;
  }
  if (scoredCount > 0) return false;
  return results.every((r) => r.result === results[0].result);
}

export function buildConsensus(submissions: readonly Submission[]): ConsensusReport {
  if (submissions.length === 0) throw new RangeError("buildConsensus needs at least one submission.");
  const first = submissions[0];
  const completed = submissions.filter((s) => s.outcome === "COMPLETED");
  const scannedAt = submissions.map((s) => s.scannedAt).sort().at(-1) ?? first.scannedAt;
  const common = {
    methodologyVersion: METHODOLOGY_VERSION,
    targetId: first.targetId,
    homeUrl: first.homeUrl,
    runId: first.runId,
    scannedAt,
  };

  const perAgent: AgentScoreLine[] = submissions.map((s) => {
    const scored = scoreSubmission(s);
    return {
      agentId: s.agentId,
      overall: scored.summary.overall,
      seo: scored.summary.seo,
      aeo: scored.summary.aeo,
      coverage: scored.summary.coverage,
    };
  });

  if (completed.length === 0) {
    return {
      ...common,
      outcome: first.outcome,
      raters: submissions.length,
      agentIds: submissions.map((s) => s.agentId),
      confidence: "no-score",
      agreementRate: null,
      disputes: [],
      criticalFindings: [],
      contestedFindings: [],
      results: notObservedForAll(`The run ended as ${first.outcome}, so no metric was evaluated.`),
      summary: noScoreSummary(),
      band: null,
      perAgent,
    };
  }

  const perAgentResults = completed.map((s) => ({ agentId: s.agentId, results: submissionToResults(s) }));
  const raters = completed.length;
  const disputes: Dispute[] = [];
  let agreed = 0;

  const results = METHODOLOGY.metrics.map((def, index) => {
    const rows = perAgentResults.map((p) => ({ agentId: p.agentId, result: p.results[index] }));
    if (raters === 1) return rows[0].result;
    const all = rows.map((r) => r.result);
    if (!agreeOn(all)) {
      disputes.push({
        metricId: def.id,
        perAgent: rows.map((r) => ({ agentId: r.agentId, result: r.result.result, points: r.result.points })),
      });
      return notObserved(def.id, "The agents disagreed on this metric, so it is not scored until a person reviews it.", {
        disagreement: rows.map((r) => ({ agent: r.agentId, result: r.result.result, points: r.result.points })),
      });
    }
    agreed += 1;
    const values = all.map(normalised);
    if (values.every((v) => v !== null)) {
      const mean = (values as number[]).reduce((a, b) => a + b, 0) / values.length;
      return resultFromScore(def.id, mean, { agreedBy: rows.map((r) => r.agentId) }, `Agreed by ${raters} agents.`);
    }
    return all[0];
  });

  const counts = new Map<string, number>();
  for (const s of completed) for (const id of new Set(s.criticalFindings)) counts.set(id, (counts.get(id) ?? 0) + 1);
  const criticalFindings: string[] = [];
  const contestedFindings: string[] = [];
  for (const id of CRITICAL_FINDING_IDS) {
    const count = counts.get(id) ?? 0;
    if (count === 0) continue;
    if (count * 2 > raters) criticalFindings.push(id);
    else contestedFindings.push(id);
  }

  const summary = computeScoreSummary(results);
  const agreementRate = raters === 1 ? null : round4(agreed / METHODOLOGY.metrics.length);
  let confidence: ConsensusReport["confidence"] = "single-rater";
  if (raters > 1) {
    const needsReview =
      disputes.length > 0 ||
      contestedFindings.length > 0 ||
      (agreementRate ?? 0) < NEEDS_REVIEW_AGREEMENT - EPSILON;
    confidence = needsReview ? "needs-review" : "agreed";
  }

  return {
    ...common,
    outcome: "COMPLETED",
    raters,
    agentIds: completed.map((s) => s.agentId),
    confidence,
    agreementRate,
    disputes,
    criticalFindings,
    contestedFindings,
    results,
    summary,
    band: scoreBand(summary.overall),
    perAgent,
  };
}

export const INDEX_COLUMNS = [
  "targetId",
  "homeUrl",
  "runId",
  "scannedAt",
  "methodologyVersion",
  "outcome",
  "overall",
  "seo",
  "aeo",
  "coverage",
  "band",
  "raters",
  "agreementRate",
  "confidence",
  "disputes",
  "criticalFindings",
] as const;

function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function indexRow(report: ConsensusReport): string[] {
  const cells: Record<(typeof INDEX_COLUMNS)[number], unknown> = {
    targetId: report.targetId,
    homeUrl: report.homeUrl,
    runId: report.runId,
    scannedAt: report.scannedAt,
    methodologyVersion: report.methodologyVersion,
    outcome: report.outcome,
    overall: displayScore(report.summary.overall),
    seo: displayScore(report.summary.seo),
    aeo: displayScore(report.summary.aeo),
    coverage: report.summary.coverage,
    band: report.band,
    raters: report.raters,
    agreementRate: report.agreementRate,
    confidence: report.confidence,
    disputes: report.disputes.length,
    criticalFindings: report.criticalFindings.join(" "),
  };
  return INDEX_COLUMNS.map((column) => csvCell(cells[column]));
}

export function toCsv(reports: readonly ConsensusReport[]): string {
  const lines = [INDEX_COLUMNS.join(","), ...reports.map((r) => indexRow(r).join(","))];
  return `${lines.join("\n")}\n`;
}
