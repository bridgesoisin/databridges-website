import { ORG_TYPES } from "@/lib/visibility/lists";
import {
  notApplicable,
  notObserved,
  resultFromPageScores,
  resultFromScore,
  scanError,
} from "@/lib/visibility/scoring";
import { isQuestionForm, normaliseText, truncateEvidence } from "@/lib/visibility/text";
import {
  SCOPE_PAGE_TYPES,
  type EvalContext,
  type EvalPage,
  type EvidenceRecord,
  type JsonLdNode,
  type MetricResult,
  type PageFacts,
  type PageType,
  type PerPageScore,
} from "@/lib/visibility/types";

// ---------------------------------------------------------------------------
// Shared helpers (also imported by aeo-trust.ts)
// ---------------------------------------------------------------------------

export type PageGate =
  | { readable: true; facts: PageFacts }
  | { readable: false; status: "not_observed" | "scan_error"; branch: string; reason: string };

// Body metrics read the raw HTML only. A render-dependent page is NOT_OBSERVED (4.2.6); a page that was
// not fetched as HTML is unobserved too, as a scan error when the fetch itself failed.
export function gatePage(page: EvalPage): PageGate {
  switch (page.fetchClass) {
    case "robots_blocked":
      return {
        readable: false,
        status: "not_observed",
        branch: "robots_blocked",
        reason: "The scanner's own robots.txt group disallows this page, so it was not fetched.",
      };
    case "non_html":
      return {
        readable: false,
        status: "not_observed",
        branch: "non_html",
        reason: "The page was not served as HTML, so its content was not read.",
      };
    case "http_error":
      return {
        readable: false,
        status: "scan_error",
        branch: "http_error",
        reason: `The page returned HTTP ${page.record.status ?? "no status"}, so its content was not read.`,
      };
    case "fetch_error":
      return {
        readable: false,
        status: "scan_error",
        branch: "fetch_error",
        reason: `The page could not be fetched (${page.record.error?.code ?? "no response"}).`,
      };
    default:
      break;
  }
  if (page.facts === null) {
    return {
      readable: false,
      status: "scan_error",
      branch: "parse_failed",
      reason: "The page was fetched but its HTML could not be parsed.",
    };
  }
  if (page.renderDependent) {
    return {
      readable: false,
      status: "not_observed",
      branch: "render_dependent",
      reason:
        "The main content is not in the initial HTML (render-dependent), so the page body was not read.",
    };
  }
  return { readable: true, facts: page.facts };
}

export type BodyOutcome =
  | { kind: "score"; score: number; branch: string; evidence: EvidenceRecord }
  | { kind: "na"; reason: string; branch: string; evidence: EvidenceRecord }
  | { kind: "unobserved"; reason: string; branch: string; evidence: EvidenceRecord };

export interface PageRule {
  // Applicability that follows from the head (language), checked before render-dependence.
  headNotApplicable?: (facts: PageFacts) => string | null;
  body: (facts: PageFacts) => BodyOutcome;
}

export function clip(text: string, max = 200): string {
  return truncateEvidence(text, max);
}

export function scorePage(page: EvalPage, rule: PageRule): PerPageScore {
  const base: EvidenceRecord = { type: page.type };
  if (page.finalUrl !== page.url) base.finalUrl = clip(page.finalUrl);
  if (page.facts !== null && rule.headNotApplicable !== undefined) {
    const reason = rule.headNotApplicable(page.facts);
    if (reason !== null) {
      return {
        url: page.url,
        score: null,
        status: "not_applicable",
        evidence: { ...base, branch: "not_applicable_language", reason },
      };
    }
  }
  const gate = gatePage(page);
  if (!gate.readable) {
    return {
      url: page.url,
      score: null,
      status: gate.status,
      evidence: { ...base, branch: gate.branch, reason: gate.reason },
    };
  }
  const outcome = rule.body(gate.facts);
  if (outcome.kind === "score") {
    return {
      url: page.url,
      score: outcome.score,
      status: "observed",
      evidence: { ...base, branch: outcome.branch, ...outcome.evidence },
    };
  }
  return {
    url: page.url,
    score: null,
    status: outcome.kind === "na" ? "not_applicable" : "not_observed",
    evidence: { ...base, branch: outcome.branch, reason: outcome.reason, ...outcome.evidence },
  };
}

export function pagesInScope(ctx: EvalContext, scope: "KO" | "AP"): EvalPage[] {
  const types: readonly PageType[] = SCOPE_PAGE_TYPES[scope];
  return ctx.pages.filter((page) => types.includes(page.type));
}

export function pageEvidence(perPage: readonly PerPageScore[]): EvidenceRecord[] {
  return perPage.map((page) => ({
    ...page.evidence,
    url: page.url,
    status: page.status,
    s_p: page.score,
  }));
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

export function summarisePages(perPage: readonly PerPageScore[], what: string): string {
  const scored = perPage.filter((page) => page.status === "observed" && page.score !== null);
  const full = scored.filter((page) => page.score === 1).length;
  const zero = scored.filter((page) => page.score === 0).length;
  const partial = scored.length - full - zero;
  return `Of ${scored.length} assessed ${plural(scored.length, "page", "pages")}, ${full} scored full marks, ${partial} partial and ${zero} zero for ${what}.`;
}

export function finishPages(
  metricId: string,
  perPage: readonly PerPageScore[],
  what: string,
  emptyReason: string,
): MetricResult {
  if (perPage.length === 0) {
    return notApplicable(metricId, emptyReason, { branch: "no_pages_in_scope", reason: emptyReason });
  }
  return resultFromPageScores(metricId, perPage, null, summarisePages(perPage, what));
}

export type HomeGate =
  | { ok: true; page: EvalPage; facts: PageFacts }
  | { ok: false; result: MetricResult };

export function gateHome(ctx: EvalContext, metricId: string): HomeGate {
  const page = ctx.home;
  if (page === null) {
    const reason = "The homepage was not fetched, so it could not be read.";
    return {
      ok: false,
      result: notObserved(metricId, reason, { branch: "homepage_missing", reason }),
    };
  }
  const gate = gatePage(page);
  if (!gate.readable) {
    const evidence: EvidenceRecord = {
      url: page.url,
      branch: gate.branch,
      reason: gate.reason,
    };
    return {
      ok: false,
      result:
        gate.status === "scan_error"
          ? scanError(metricId, gate.reason, evidence)
          : notObserved(metricId, gate.reason, evidence),
    };
  }
  return { ok: true, page, facts: gate.facts };
}

export function jsonLdNodes(facts: PageFacts): JsonLdNode[] {
  const nodes: JsonLdNode[] = [];
  for (const block of facts.jsonLd.blocks) {
    if (block.parsedOk) nodes.push(...block.nodes);
  }
  return nodes;
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

// ---------------------------------------------------------------------------
// A3 shared pieces
// ---------------------------------------------------------------------------

const MIN_SUBHEADINGS = 3;

type Subheading = { level: number; text: string };

// 4.5 A3.01: subheadings are h2 and h3 in main content. A heading with no text is not a subheading.
function subheadingsOf(facts: PageFacts): Subheading[] {
  const out: Subheading[] = [];
  for (const heading of facts.headings) {
    if (!heading.inMain || (heading.level !== 2 && heading.level !== 3)) continue;
    const text = normaliseText(heading.text);
    if (text !== "") out.push({ level: heading.level, text });
  }
  return out;
}

function englishOnly(facts: PageFacts): string | null {
  if (facts.head.langPrimary === "en") return null;
  const lang = facts.head.htmlLang;
  return lang === null || lang === ""
    ? "No html lang is declared, and this metric applies to English pages only."
    : `The page language is ${clip(lang, 40)}, and this metric applies to English pages only.`;
}

function wordCountsApply(facts: PageFacts): string | null {
  return facts.wordCountApplicable
    ? null
    : "Word-count rules do not apply to Chinese, Japanese, Korean or Thai pages.";
}

function percent(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10;
}

// ---------------------------------------------------------------------------
// A3.01 Question-style headings
// ---------------------------------------------------------------------------

function evaluateA301(ctx: EvalContext): MetricResult {
  const perPage = pagesInScope(ctx, "KO").map((page) =>
    scorePage(page, {
      headNotApplicable: englishOnly,
      body: (facts): BodyOutcome => {
        const subheadings = subheadingsOf(facts);
        if (subheadings.length < MIN_SUBHEADINGS) {
          return {
            kind: "na",
            branch: "fewer_than_3_subheadings",
            reason: `The page has ${subheadings.length} h2 or h3 subheadings in its main content and 3 are needed.`,
            evidence: { subheadings: subheadings.length },
          };
        }
        const questions = subheadings.filter((heading) => isQuestionForm(heading.text));
        const total = subheadings.length;
        const scaled = questions.length * 100;
        const score = scaled >= 25 * total ? 1 : scaled >= 10 * total ? 0.5 : 0;
        const branch = score === 1 ? "questions_25_percent_or_more" : score === 0.5 ? "questions_10_to_24_percent" : "questions_under_10_percent";
        return {
          kind: "score",
          score,
          branch,
          evidence: {
            subheadings: total,
            questions: questions.length,
            questionShare: percent(questions.length, total),
            examples: questions.slice(0, 3).map((heading) => clip(heading.text, 80)),
          },
        };
      },
    }),
  );
  return finishPages(
    "A3.01",
    perPage,
    "question-style subheadings",
    "No services, FAQ, article or other knowledge page was sampled.",
  );
}

// ---------------------------------------------------------------------------
// A3.02 Answer-first sections
// ---------------------------------------------------------------------------

type SequenceItem =
  | { kind: "h"; level: number; text: string }
  | { kind: "p"; words: number; sentences: number };

// Rebuilds document order inside main from the headings and the nearest preceding heading of each paragraph.
function sequenceOf(facts: PageFacts): SequenceItem[] {
  const lead: SequenceItem[] = [];
  const byHeading = new Map<number, SequenceItem[]>();
  for (const paragraph of facts.main.paragraphs) {
    const item: SequenceItem = {
      kind: "p",
      words: paragraph.wordCount,
      sentences: paragraph.sentenceCount,
    };
    if (paragraph.precedingHeadingIndex === null) {
      lead.push(item);
    } else {
      const list = byHeading.get(paragraph.precedingHeadingIndex);
      if (list === undefined) byHeading.set(paragraph.precedingHeadingIndex, [item]);
      else list.push(item);
    }
  }
  const items: SequenceItem[] = [...lead];
  for (const heading of facts.headings) {
    if (!heading.inMain) continue;
    items.push({ kind: "h", level: heading.level, text: normaliseText(heading.text) });
    const following = byHeading.get(heading.index);
    if (following !== undefined) items.push(...following);
  }
  return items;
}

const ANSWER_MIN_WORDS = 15;
const ANSWER_MAX_WORDS = 70;
const ANSWER_MAX_SENTENCES = 3;

function answerMiss(first: { words: number; sentences: number } | null): string | null {
  if (first === null) return "no paragraph before the next heading of the same or higher level";
  if (first.words < ANSWER_MIN_WORDS) return `first paragraph has ${first.words} words (under ${ANSWER_MIN_WORDS})`;
  if (first.words > ANSWER_MAX_WORDS) return `first paragraph has ${first.words} words (over ${ANSWER_MAX_WORDS})`;
  if (first.sentences > ANSWER_MAX_SENTENCES) return `first paragraph has ${first.sentences} sentences (over ${ANSWER_MAX_SENTENCES})`;
  return null;
}

function evaluateA302(ctx: EvalContext): MetricResult {
  const perPage = pagesInScope(ctx, "KO").map((page) =>
    scorePage(page, {
      headNotApplicable: wordCountsApply,
      body: (facts): BodyOutcome => {
        const items = sequenceOf(facts);
        let total = 0;
        let qualifying = 0;
        const misses: string[] = [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.kind !== "h" || (item.level !== 2 && item.level !== 3) || item.text === "") continue;
          total++;
          let first: { words: number; sentences: number } | null = null;
          for (let j = i + 1; j < items.length; j++) {
            const next = items[j];
            if (next.kind === "h") {
              if (next.text !== "" && next.level <= item.level) break;
              continue;
            }
            first = next;
            break;
          }
          const miss = answerMiss(first);
          if (miss === null) qualifying++;
          else if (misses.length < 3) misses.push(`${clip(item.text, 60)}: ${miss}`);
        }
        if (total < MIN_SUBHEADINGS) {
          return {
            kind: "na",
            branch: "fewer_than_3_subheadings",
            reason: `The page has ${total} h2 or h3 subheadings in its main content and 3 are needed.`,
            evidence: { subheadings: total },
          };
        }
        const scaled = qualifying * 100;
        const score = scaled >= 60 * total ? 1 : scaled >= 30 * total ? 0.5 : 0;
        return {
          kind: "score",
          score,
          branch: score === 1 ? "answer_first_60_percent_or_more" : score === 0.5 ? "answer_first_30_to_59_percent" : "answer_first_under_30_percent",
          evidence: {
            subheadings: total,
            answerFirst: qualifying,
            answerFirstShare: percent(qualifying, total),
            misses,
          },
        };
      },
    }),
  );
  return finishPages(
    "A3.02",
    perPage,
    "answer-first sections",
    "No services, FAQ, article or other knowledge page was sampled.",
  );
}

// ---------------------------------------------------------------------------
// A3.03 FAQ block present
// ---------------------------------------------------------------------------

function evaluateA303(ctx: EvalContext): MetricResult {
  const id = "A3.03";
  const perPage = ctx.pages.map((page) =>
    scorePage(page, {
      body: (facts): BodyOutcome => {
        const details = facts.faq.detailsSummary.pairs;
        const definitions = facts.faq.definitionList.pairs;
        const headings = facts.faq.headingParagraph.questionPairs;
        const total = details + definitions + headings;
        const score = total >= 3 ? 1 : total >= 1 ? 0.5 : 0;
        return {
          kind: "score",
          score,
          branch: total >= 3 ? "pairs_3_or_more" : total >= 1 ? "pairs_1_or_2" : "no_pairs",
          evidence: {
            pairs: total,
            detailsSummary: details,
            definitionList: definitions,
            questionHeadingWithParagraph: headings,
          },
        };
      },
    }),
  );

  const observed = perPage.filter((page) => page.status === "observed" && page.score !== null);
  if (observed.length === 0 && perPage.length === 0) {
    const reason = "No sampled page was available to read.";
    return notObserved(id, reason, { branch: "no_pages", reason });
  }
  const best = observed.reduce<PerPageScore | null>(
    (top, page) => (top === null || (page.score ?? 0) > (top.score ?? 0) ? page : top),
    null,
  );
  const bestScore = best?.score ?? 0;
  const evidence = pageEvidence(perPage);
  const bestPairs = best === null ? 0 : Number(best.evidence.pairs);

  // One page with 3 or more pairs is enough. Anything lower needs at least half of the pages read,
  // because an unread page could hold the FAQ.
  if (bestScore === 1) {
    return resultFromScore(
      id,
      1,
      evidence,
      `${clip(best?.url ?? "", 80)} has ${bestPairs} question and answer pairs, which meets the 3-pair threshold.`,
    );
  }
  if (observed.length * 2 < perPage.length) {
    return resultFromPageScores(id, perPage, evidence, "");
  }
  if (bestScore === 0.5) {
    return resultFromScore(
      id,
      0.5,
      evidence,
      `The best page has ${bestPairs} question and answer ${plural(bestPairs, "pair", "pairs")}, below the 3 needed for full marks.`,
    );
  }
  return resultFromScore(
    id,
    0,
    evidence,
    "No sampled page has a detectable question and answer block.",
  );
}

// ---------------------------------------------------------------------------
// A3.04 Scannable structure
// ---------------------------------------------------------------------------

const SCANNABLE_MIN_WORDS = 300;

function evaluateA304(ctx: EvalContext): MetricResult {
  const perPage = pagesInScope(ctx, "KO").map((page) =>
    scorePage(page, {
      headNotApplicable: wordCountsApply,
      body: (facts): BodyOutcome => {
        const words = facts.main.wordCount;
        if (words < SCANNABLE_MIN_WORDS) {
          return {
            kind: "na",
            branch: "under_300_words",
            reason: `The main content has ${words} words and this metric applies from ${SCANNABLE_MIN_WORDS}.`,
            evidence: { mainWords: words },
          };
        }
        const longestList = facts.lists.reduce((max, list) => Math.max(max, list.items), 0);
        const qualifyingTables = facts.tables.filter((table) => table.headerCells >= 1 && table.rows >= 2).length;
        const hasList = longestList >= 3;
        const hasTable = qualifyingTables > 0;
        return {
          kind: "score",
          score: hasList || hasTable ? 1 : 0,
          branch: hasList ? "list_of_3_or_more" : hasTable ? "table_with_header_and_2_rows" : "no_list_or_table",
          evidence: {
            mainWords: words,
            longestListItems: longestList,
            qualifyingTables,
          },
        };
      },
    }),
  );
  return finishPages(
    "A3.04",
    perPage,
    "scannable structure",
    "No services, FAQ, article or other knowledge page was sampled.",
  );
}

// ---------------------------------------------------------------------------
// A3.05 Sentence and paragraph length
// ---------------------------------------------------------------------------

const MAX_MEDIAN_SENTENCE_WORDS = 24;
const MAX_MEDIAN_PARAGRAPH_WORDS = 100;

function evaluateA305(ctx: EvalContext): MetricResult {
  const perPage = pagesInScope(ctx, "KO").map((page) =>
    scorePage(page, {
      headNotApplicable: englishOnly,
      body: (facts): BodyOutcome => {
        const sentenceMedian = facts.main.sentences.medianWords;
        const paragraphMedian = facts.main.paragraphStats.medianWords;
        if (sentenceMedian === null || paragraphMedian === null) {
          return {
            kind: "unobserved",
            branch: "no_paragraphs",
            reason: "The main content has no paragraph (p) elements, so medians cannot be calculated.",
            evidence: { paragraphs: facts.main.paragraphStats.count },
          };
        }
        const sentenceTooLong = sentenceMedian > MAX_MEDIAN_SENTENCE_WORDS;
        const paragraphTooLong = paragraphMedian > MAX_MEDIAN_PARAGRAPH_WORDS;
        const exceeded = (sentenceTooLong ? 1 : 0) + (paragraphTooLong ? 1 : 0);
        return {
          kind: "score",
          score: exceeded === 0 ? 1 : exceeded === 1 ? 0.5 : 0,
          branch:
            exceeded === 0
              ? "both_within_limits"
              : exceeded === 2
                ? "both_limits_exceeded"
                : sentenceTooLong
                  ? "sentence_limit_exceeded"
                  : "paragraph_limit_exceeded",
          evidence: {
            medianSentenceWords: sentenceMedian,
            medianParagraphWords: paragraphMedian,
            sentences: facts.main.sentences.count,
            paragraphs: facts.main.paragraphStats.count,
          },
        };
      },
    }),
  );
  return finishPages(
    "A3.05",
    perPage,
    "sentence and paragraph length",
    "No services, FAQ, article or other knowledge page was sampled.",
  );
}

// ---------------------------------------------------------------------------
// A3.06 Entity statement near the top
// ---------------------------------------------------------------------------

const MAX_REFERENCE_TERMS = 50;

function bestOrganisation(nodes: readonly JsonLdNode[], needName: boolean): JsonLdNode | null {
  const pick = (accepts: (node: JsonLdNode) => boolean): JsonLdNode | null => {
    let best: JsonLdNode | null = null;
    for (const node of nodes) {
      if (!accepts(node)) continue;
      if (needName && !isNonEmptyString(node.properties.name)) continue;
      if (best === null || node.depth < best.depth) best = node;
    }
    return best;
  };
  return pick((node) => node.types.some((type) => ORG_TYPES.has(type))) ?? pick((node) => node.types.includes("Person"));
}

function splitTerms(text: string): string[] {
  return text
    .split(/[,;]/)
    .map((part) => normaliseText(part))
    .filter((part) => part !== "");
}

function placeStrings(value: unknown, depth: number, out: string[]): void {
  if (depth > 4 || out.length >= MAX_REFERENCE_TERMS) return;
  if (typeof value === "string") {
    out.push(...splitTerms(value));
  } else if (Array.isArray(value)) {
    for (const item of value) placeStrings(item, depth + 1, out);
  } else if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    for (const key of ["addressLocality", "addressRegion", "name"]) {
      const part = record[key];
      if (isNonEmptyString(part)) out.push(normaliseText(part));
    }
  }
}

function topicStrings(value: unknown, depth: number, out: string[]): void {
  if (depth > 4 || out.length >= MAX_REFERENCE_TERMS) return;
  if (typeof value === "string") {
    out.push(...splitTerms(value));
  } else if (Array.isArray(value)) {
    for (const item of value) topicStrings(item, depth + 1, out);
  } else if (typeof value === "object" && value !== null) {
    const name = (value as Record<string, unknown>).name;
    if (isNonEmptyString(name)) out.push(normaliseText(name));
  }
}

function dedupe(terms: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const term of terms) {
    const key = term.toLowerCase();
    if (key === "" || seen.has(key)) continue;
    seen.add(key);
    out.push(term);
    if (out.length >= MAX_REFERENCE_TERMS) break;
  }
  return out;
}

type EntityCheck = { applies: boolean; passed: boolean; matched: string | null; terms: string[] };

function runCheck(lead: string, terms: readonly string[]): EntityCheck {
  const unique = dedupe(terms);
  if (unique.length === 0) return { applies: false, passed: false, matched: null, terms: [] };
  const matched = unique.find((term) => lead.includes(term.toLowerCase())) ?? null;
  return { applies: true, passed: matched !== null, matched, terms: unique.slice(0, 5) };
}

function checkEvidence(check: EntityCheck, extra: EvidenceRecord = {}): EvidenceRecord {
  return {
    applies: check.applies,
    passed: check.applies ? check.passed : null,
    matched: check.matched === null ? null : clip(check.matched, 80),
    terms: check.terms.map((term) => clip(term, 80)),
    ...extra,
  };
}

function evaluateA306(ctx: EvalContext): MetricResult {
  const id = "A3.06";
  const early = ctx.home?.facts ?? null;
  if (ctx.home !== null && early !== null && !early.wordCountApplicable) {
    const reason = "Word-count rules do not apply to Chinese, Japanese, Korean or Thai pages.";
    return notApplicable(id, reason, {
      url: ctx.home.url,
      branch: "not_applicable_language",
      reason,
      lang: clip(early.head.htmlLang ?? "", 40),
    });
  }
  const gate = gateHome(ctx, id);
  if (!gate.ok) return gate.result;
  const { page, facts } = gate;

  const nodes = jsonLdNodes(facts);
  const named = bestOrganisation(nodes, true);
  const anyOrganisation = bestOrganisation(nodes, false);
  const ogSiteName = facts.head.openGraph.find((entry) => entry.key === "og:site_name")?.content ?? "";
  let nameTerms: string[] = [];
  let nameSource: string | null = null;
  if (named !== null) {
    nameTerms = [normaliseText(named.properties.name as string)];
    nameSource = "json-ld organisation name";
  } else if (anyOrganisation !== null && ogSiteName.trim() !== "") {
    nameTerms = [normaliseText(ogSiteName)];
    nameSource = "og:site_name";
  }

  const placeTerms: string[] = [];
  const topicTerms: string[] = [];
  for (const node of nodes) {
    if ("address" in node.properties) placeStrings(node.properties.address, 0, placeTerms);
    if ("areaServed" in node.properties) placeStrings(node.properties.areaServed, 0, placeTerms);
    if ("knowsAbout" in node.properties) topicStrings(node.properties.knowsAbout, 0, topicTerms);
    if ("serviceType" in node.properties) topicStrings(node.properties.serviceType, 0, topicTerms);
  }

  const lead = normaliseText(facts.main.lead200).toLowerCase();
  const checks = {
    name: runCheck(lead, nameTerms),
    locality: runCheck(lead, placeTerms),
    topic: runCheck(lead, topicTerms),
  };
  const applicable = [checks.name, checks.locality, checks.topic].filter((check) => check.applies);
  if (applicable.length === 0) {
    const reason =
      "The homepage structured data holds no business name, locality or topic term to look for.";
    return notApplicable(id, reason, { url: page.url, branch: "no_reference_data", reason });
  }
  const passed = applicable.filter((check) => check.passed).length;
  const score = passed / applicable.length;
  const evidence: EvidenceRecord = {
    url: page.url,
    branch: `${passed}_of_${applicable.length}_checks_passed`,
    leadWords: Math.min(200, facts.main.wordCount),
    name: checkEvidence(checks.name, { source: nameSource }),
    locality: checkEvidence(checks.locality),
    topic: checkEvidence(checks.topic),
  };
  return resultFromScore(
    id,
    score,
    evidence,
    `${passed} of ${applicable.length} applicable entity checks (name, locality, topic) were found in the first 200 words of the homepage.`,
  );
}

// ---------------------------------------------------------------------------
// Category entry point
// ---------------------------------------------------------------------------

export function evaluateA3(ctx: EvalContext): MetricResult[] {
  return [
    evaluateA301(ctx),
    evaluateA302(ctx),
    evaluateA303(ctx),
    evaluateA304(ctx),
    evaluateA305(ctx),
    evaluateA306(ctx),
  ];
}
