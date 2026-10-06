import { METHODOLOGY } from "@/lib/visibility/methodology";
import { displayScore, roundHalfUp, scoreBand } from "@/lib/visibility/scoring";
import { truncateEvidence } from "@/lib/visibility/text";
import {
  CATEGORY_IDS,
  type AgentPolicy,
  type CategoryScore,
  type MetricResult,
  type MetricResultCode,
  type PageFetchClass,
  type ReportPageSummary,
  type ScanOutcome,
  type ScanReport,
  type WithheldReason,
} from "@/lib/visibility/types";

const MAX_TEXT = 400;
const MAX_URL = 2048;
const MAX_DIGEST_BRANCHES = 4;

const MARKDOWN_ENTITIES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };

// Escapes report text for Markdown. Evidence and page-derived strings are data, never markup.
export function escapeMarkdown(text: string, max: number = MAX_TEXT): string {
  return truncateEvidence(text, max)
    .replace(/[\u{200B}-\u{200D}\u{2060}\u{FEFF}]/gu, "")
    .replace(/ {2,}/g, " ")
    .trim()
    .replace(/[&<>\\`*_[\]|~]/g, (char) => MARKDOWN_ENTITIES[char] ?? `\\${char}`);
}

const esc = escapeMarkdown;

function formatNumber(value: number, decimals: number): string {
  return String(roundHalfUp(value, decimals));
}

function formatUtc(iso: string): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return esc(iso, 64);
  return new Date(time).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

function formatCoverage(coverage: number): string {
  return `${formatNumber(coverage * 100, 1)}%`;
}

const RESULT_LABELS: Readonly<Record<MetricResultCode, string>> = {
  PASS: "Pass",
  PARTIAL: "Partial",
  FAIL: "Fail",
  NOT_APPLICABLE: "Not applicable",
  NOT_OBSERVED: "Not observed",
  SCAN_ERROR: "Scan error",
};

const FETCH_LABELS: Readonly<Record<PageFetchClass, string>> = {
  ok: "Read",
  http_error: "HTTP error",
  fetch_error: "Could not be fetched",
  robots_blocked: "Not fetched (robots.txt)",
  non_html: "Not HTML",
};

const OUTCOME_LABELS: Readonly<Record<ScanOutcome, string>> = {
  COMPLETED: "Completed",
  BLOCKED_BY_ROBOTS: "Not scanned: robots.txt disallows the scanner from the homepage",
  UNREACHABLE: "Not scanned: the homepage could not be fetched",
  JOB_ERROR: "Not scanned: the scan stopped on an error",
};

const LIST_LABELS: Readonly<Record<string, string>> = {
  aiAgents: "AI crawler list",
  patterns: "page-type and wording pattern lists",
};

const PILLAR_NAMES = { seo: "SEO", aeo: "AEO" } as const;

function pillarWeight(pillar: "SEO" | "AEO"): number {
  return METHODOLOGY.categories
    .filter((category) => category.pillar === pillar)
    .reduce((sum, category) => sum + category.weight, 0);
}

function withheldText(reason: WithheldReason, pillar: "SEO" | "AEO" | null): string {
  const { thresholds } = METHODOLOGY;
  switch (reason) {
    case "NO_SCORE_OUTCOME":
      return "No score is given for this outcome.";
    case "PILLAR_WEIGHT_BELOW_MINIMUM":
      return `Too little of this pillar could be observed: at least ${thresholds.pillarMinShownWeight} of its ${pillar === null ? "" : pillarWeight(pillar)} weight points must come from categories with enough data.`;
    case "OVERALL_WEIGHT_BELOW_MINIMUM":
      return `Too little of the site could be observed: at least ${thresholds.overallMinShownWeight} of the ${pillarWeight("SEO") + pillarWeight("AEO")} weight points must come from categories with enough data.`;
    case "PILLAR_NOT_PUBLISHED":
      return "The overall score needs both the SEO and the AEO score to be published first.";
    default:
      return "Withheld.";
  }
}

function cell(text: string, max: number = MAX_TEXT): string {
  return esc(text, max);
}

function pointsText(result: MetricResult): string {
  if (result.points === null) return "-";
  const max = result.maxPoints === null ? "" : ` / ${formatNumber(result.maxPoints, 2)}`;
  return `${formatNumber(result.points, 2)}${max}`;
}

function isRec(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Counts the rule branch recorded in each evidence record, so the table says what was seen without dumping evidence.
function evidenceDigest(evidence: unknown): string {
  const records: unknown[] = Array.isArray(evidence) ? evidence : [evidence];
  const counts = new Map<string, number>();
  for (const record of records) {
    if (isRec(record) && typeof record.branch === "string") {
      counts.set(record.branch, (counts.get(record.branch) ?? 0) + 1);
    }
  }
  return [...counts]
    .slice(0, MAX_DIGEST_BRANCHES)
    .map(([branch, count]) => `${branch.replace(/_/g, " ")}${count > 1 ? ` (x${count})` : ""}`)
    .join(", ");
}

function metricName(metricId: string): string {
  return METHODOLOGY.metrics.find((metric) => metric.id === metricId)?.name ?? metricId;
}

function fixGuidance(metricId: string): string | null {
  return METHODOLOGY.metrics.find((metric) => metric.id === metricId)?.fixGuidance ?? null;
}

function categoryHeadline(score: CategoryScore): string {
  const coverage = score.coverage === null ? "no applicable metrics" : formatCoverage(score.coverage);
  if (score.shown && score.score !== null) {
    return `Score ${formatNumber(score.score * 100, 2)} out of 100 | Coverage ${coverage} | Weight ${score.weight}`;
  }
  const minimum = formatCoverage(METHODOLOGY.thresholds.categoryMinCoverage);
  return `Not enough data to show a score (coverage ${coverage}, minimum ${minimum}); left out of the aggregate scores | Weight ${score.weight}`;
}

function renderFindings(report: ScanReport): string[] {
  const lines = ["## Critical findings", ""];
  if (report.outcome !== "COMPLETED") {
    lines.push("Critical findings were not assessed because the scan produced no score.", "");
    return lines;
  }
  if (report.criticalFindings.length === 0) {
    lines.push("None of the seven critical-finding checks was triggered by what the scanner could observe.", "");
    return lines;
  }
  lines.push("These are shown beside the scores. They do not change the scores.", "");
  for (const finding of report.criticalFindings) {
    lines.push(`- **${esc(finding.id, 16)}**: ${esc(finding.summary)}`);
  }
  lines.push("");
  return lines;
}

function renderScores(report: ScanReport): string[] {
  const lines = ["## Scores", ""];
  if (report.outcome !== "COMPLETED") {
    lines.push(`Outcome: ${esc(OUTCOME_LABELS[report.outcome] ?? report.outcome, 160)}.`, "");
    lines.push("No score is given for this outcome.");
    if (report.outcomeDetail !== null) lines.push("", esc(report.outcomeDetail, 300));
    lines.push("");
    return lines;
  }
  const { scores } = report;
  const rows: Array<[string, number | null, WithheldReason | null, "SEO" | "AEO" | null]> = [
    ["Overall", scores.overall, scores.withheld.overall, null],
    [PILLAR_NAMES.seo, scores.seo, scores.withheld.seo, "SEO"],
    [PILLAR_NAMES.aeo, scores.aeo, scores.withheld.aeo, "AEO"],
  ];
  lines.push("| Score | Value | Exact | Band |", "|---|---|---|---|");
  for (const [label, value] of rows) {
    if (value === null) {
      lines.push(`| ${label} | Withheld | - | - |`);
    } else {
      const shown = displayScore(value);
      lines.push(`| ${label} | ${shown} out of 100 | ${value.toFixed(2)} | ${esc(scoreBand(value) ?? "", 80)} |`);
    }
  }
  lines.push("");
  for (const [label, value, reason, pillar] of rows) {
    if (value === null && reason !== null) lines.push(`- ${label} score withheld. ${withheldText(reason, pillar)}`);
  }
  if (rows.some(([, value]) => value === null)) lines.push("");
  lines.push(
    `Coverage: ${formatCoverage(report.coverage)} of the available metric weight could be observed. Bands are labels for the displayed whole-number score and describe detected signals only.`,
    "",
  );
  return lines;
}

function renderCategory(report: ScanReport, id: (typeof CATEGORY_IDS)[number]): string[] {
  const category = METHODOLOGY.categories.find((candidate) => candidate.id === id);
  const score = report.scores.categories[id];
  if (category === undefined || score === undefined) return [];
  const lines = [`### ${esc(id, 8)} ${esc(category.name, 120)} (${esc(category.pillar, 8)})`, "", categoryHeadline(score), ""];
  const metrics = report.metrics.filter((metric) => category.metricIds.includes(metric.metricId));
  lines.push("| Metric | Result | Points | What was seen | Evidence |", "|---|---|---|---|---|");
  for (const metric of metrics) {
    lines.push(
      `| ${esc(metric.metricId, 16)} ${cell(metricName(metric.metricId), 120)} | ${RESULT_LABELS[metric.result] ?? esc(metric.result, 32)} | ${pointsText(metric)} | ${cell(metric.explanation, 300)} | ${cell(evidenceDigest(metric.evidence), 200)} |`,
    );
  }
  lines.push("");
  const guidance = metrics.filter((metric) => metric.result === "PARTIAL" || metric.result === "FAIL");
  if (guidance.length > 0) {
    lines.push("Guidance:", "");
    for (const metric of guidance) {
      const text = fixGuidance(metric.metricId);
      if (text !== null) lines.push(`- ${esc(metric.metricId, 16)}: ${esc(text, 400)}`);
    }
    lines.push("");
  }
  return lines;
}

function policyText(policy: AgentPolicy): string {
  if (policy.allowed === null) return "unknown (robots.txt could not be read)";
  return policy.allowed ? "allowed" : "disallowed";
}

function renderInformational(report: ScanReport): string[] {
  const info = report.informational;
  const lines = [
    "## Informational signals",
    "",
    "These are reported and not scored. Opting out of model training is a legitimate choice.",
    "",
  ];
  const table = (title: string, policies: readonly AgentPolicy[]): void => {
    lines.push(`${title}:`, "", "| Agent | robots.txt policy for the homepage |", "|---|---|");
    for (const policy of policies) lines.push(`| ${esc(policy.token, 64)} | ${policyText(policy)} |`);
    lines.push("");
  };
  table("Training and data-collection crawlers", info.trainingCrawlerPolicy);
  table("User-initiated agents (vendors may not apply robots.txt to these)", info.userAgentPolicy);
  lines.push(
    `- Scanner challenged or blocked: ${info.challengeDetected ? "yes" : "no"}`,
    `- Scanner region: ${info.scannerRegion === null ? "not recorded" : esc(info.scannerRegion, 64)}`,
    `- JSON-LD types detected: ${info.jsonLdTypes.length === 0 ? "none" : info.jsonLdTypes.map((type) => esc(type, 64)).join(", ")}`,
    `- Homepage HTML size: ${info.homepageHtmlBytes === null ? "not available" : `${info.homepageHtmlBytes} bytes`}`,
    `- Homepage redirects: ${info.homepageRedirects === null ? "not available" : info.homepageRedirects}`,
    "",
  );
  return lines;
}

function pageNote(page: ReportPageSummary): string {
  return page.renderDependent ? "Built by JavaScript; body content not read" : "";
}

function renderPages(pages: readonly ReportPageSummary[]): string[] {
  if (pages.length === 0) return ["No pages were sampled.", ""];
  const lines = ["| Page | Type | Fetch result | Note |", "|---|---|---|---|"];
  for (const page of pages) {
    lines.push(
      `| ${cell(page.url, MAX_URL)} | ${esc(page.type, 16)} | ${FETCH_LABELS[page.fetchClass] ?? esc(page.fetchClass, 32)} | ${pageNote(page)} |`,
    );
  }
  lines.push("");
  return lines;
}

function renderFacts(report: ScanReport): string[] {
  const staleNames = report.staleLists.map((name) => LIST_LABELS[name] ?? esc(name, 64));
  const lines = [
    "## Scan facts",
    "",
    `- Scan date and time (UTC): ${formatUtc(report.scannedAt)}`,
    `- Methodology version: ${esc(report.methodologyVersion, 64)}`,
    `- Scanner version: ${esc(report.scannerVersion, 64)}`,
    `- Report version: ${report.reportVersion}`,
    `- Outcome: ${esc(OUTCOME_LABELS[report.outcome] ?? report.outcome, 160)}`,
    `- Coverage: ${formatCoverage(report.coverage)}`,
    `- Pages sampled: ${report.pagesSampled.length}`,
    `- Snapshot hash (SHA-256): ${esc(report.snapshotHash, 80)}`,
    `- List versions: AI crawler list ${esc(report.listVersions.aiAgents, 32)}, pattern lists ${esc(report.listVersions.patterns, 32)}`,
    `- Lists unverified or past their review date: ${staleNames.length === 0 ? "none" : staleNames.join(", ")}`,
    "",
    "Pages sampled:",
    "",
    ...renderPages(report.pagesSampled),
    "## Limitations",
    "",
  ];
  for (const limitation of report.limitations) lines.push(`- ${esc(limitation, 400)}`);
  lines.push(
    "",
    "## Correction route",
    "",
    `To report an error or ask for a correction, contact ${esc(report.correctionRoute, 120)} and quote the snapshot hash above.`,
    "",
  );
  return lines;
}

export function renderMarkdown(report: ScanReport): string {
  const lines = [
    "# SEO and AEO readiness report",
    "",
    `Site: ${esc(report.homeUrl, MAX_URL)}`,
    `Scanned: ${formatUtc(report.scannedAt)}`,
    `Methodology ${esc(report.methodologyVersion, 64)}, scanner ${esc(report.scannerVersion, 64)}, coverage ${formatCoverage(report.coverage)}, ${report.pagesSampled.length} ${report.pagesSampled.length === 1 ? "page" : "pages"} sampled.`,
  ];
  if (/draft/i.test(report.methodologyVersion)) {
    lines.push("", "This uses a draft methodology. Results are engineering calibration results, not published claims.");
  }
  lines.push("", ...renderFindings(report), ...renderScores(report));
  if (report.outcome === "COMPLETED") {
    lines.push("## Categories", "");
    for (const id of CATEGORY_IDS) lines.push(...renderCategory(report, id));
  }
  lines.push(...renderInformational(report), ...renderFacts(report));
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

export function renderJson(report: ScanReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
