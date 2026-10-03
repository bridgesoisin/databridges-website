import { AI_SEARCH_AGENTS } from "@/lib/visibility/lists";
import {
  notObserved,
  resultFromPageScores,
  resultFromScore,
  scanError,
} from "@/lib/visibility/scoring";
import { truncateEvidence } from "@/lib/visibility/text";
import {
  SCOPE_PAGE_TYPES,
  type EvalContext,
  type EvalPage,
  type EvidenceRecord,
  type FetchErrorCode,
  type FetchRecord,
  type MetricResult,
  type PageFacts,
  type PerPageScore,
  type PerPageScoreStatus,
} from "@/lib/visibility/types";

const SNIPPET_LIMIT_MIN = 1;
const SNIPPET_LIMIT_MAX = 49;
const MIN_MAIN_WORDS = 50;
const MAX_LISTED = 8;

// Requests that never left the scanner: the resource was not observed, which is not a failure of the site.
const NOT_ATTEMPTED: ReadonlySet<FetchErrorCode> = new Set<FetchErrorCode>([
  "URL_REJECTED",
  "HOST_NOT_ALLOWLISTED",
  "ADDRESS_BLOCKED",
  "REQUEST_CAP_REACHED",
  "ROBOTS_DISALLOWED",
  "ABORTED",
]);

const SIZE_CAPPED: ReadonlySet<FetchErrorCode> = new Set<FetchErrorCode>([
  "RESPONSE_TOO_LARGE",
  "DECOMPRESSED_TOO_LARGE",
]);

// Statuses that mean the server refused the scanner, so the file may exist (the same list S1.03 treats as unobserved).
const REFUSAL_STATUSES: ReadonlySet<number> = new Set([401, 403, 429]);

export type PageOutcome = Pick<PerPageScore, "score" | "status" | "evidence">;

export function scoredPage(score: number, evidence: EvidenceRecord): PageOutcome {
  return { score, status: "observed", evidence };
}

export function skippedPage(
  status: Exclude<PerPageScoreStatus, "observed">,
  evidence: EvidenceRecord
): PageOutcome {
  return { score: null, status, evidence };
}

// A page without facts was blocked by the scanner's own agent, was not HTML, or failed to fetch or parse.
export function unreadablePage(page: EvalPage): PageOutcome {
  const status =
    page.fetchClass === "robots_blocked" || page.fetchClass === "non_html"
      ? "not_observed"
      : "scan_error";
  return skippedPage(status, {
    branch: "page_not_readable",
    fetchClass: page.fetchClass,
    httpStatus: page.record.status,
    errorCode: page.record.error === null ? null : page.record.error.code,
  });
}

export function pageScores(
  pages: readonly EvalPage[],
  read: (page: EvalPage, facts: PageFacts) => PageOutcome
): PerPageScore[] {
  return pages.map((page) => {
    const outcome = page.facts === null ? unreadablePage(page) : read(page, page.facts);
    return { url: truncateEvidence(page.url), ...outcome };
  });
}

export function finishPageMetric(
  ctx: EvalContext,
  metricId: string,
  perPage: readonly PerPageScore[],
  explanation: string
): MetricResult {
  if (ctx.pages.length === 0) {
    return notObserved(metricId, "No page was sampled, so this metric could not be read.");
  }
  return resultFromPageScores(metricId, perPage, null, explanation);
}

export function observedScores(perPage: readonly PerPageScore[]): number[] {
  const out: number[] = [];
  for (const page of perPage) {
    if (page.status === "observed" && page.score !== null) out.push(page.score);
  }
  return out;
}

export function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function listed(values: readonly string[]): string[] {
  return values.slice(0, MAX_LISTED).map((value) => truncateEvidence(value));
}

// ---------------------------------------------------------------------------
// A1.01 AI search and answer crawlers allowed
// ---------------------------------------------------------------------------

function evaluateA101(ctx: EvalContext): MetricResult {
  let allowedPairs = 0;
  let observedPairs = 0;
  const perPage: PerPageScore[] = ctx.pages.map((page) => {
    const url = truncateEvidence(page.url);
    const answers = AI_SEARCH_AGENTS.map((token) => ({
      token,
      allowed: ctx.robots.isAllowed(token, page.url),
    }));
    const robotsState = ctx.robots.stateFor(page.url);
    const agents: Record<string, boolean | null> = {};
    for (const answer of answers) agents[answer.token] = answer.allowed;

    if (answers.some((answer) => answer.allowed === null)) {
      return {
        url,
        ...skippedPage(robotsState === "error" ? "scan_error" : "not_observed", {
          branch: "robots_unreadable",
          robotsState,
          agents,
        }),
      };
    }
    const allowed = answers.filter((answer) => answer.allowed === true).length;
    allowedPairs += allowed;
    observedPairs += answers.length;
    const branch =
      allowed === answers.length
        ? "all_allowed"
        : allowed === 0
          ? "all_blocked"
          : "partly_blocked";
    return {
      url,
      ...scoredPage(allowed / answers.length, {
        branch,
        robotsState,
        agents,
        allowed,
        of: answers.length,
      }),
    };
  });
  return finishPageMetric(
    ctx,
    "A1.01",
    perPage,
    `robots.txt allows ${allowedPairs} of ${observedPairs} combinations of AI search crawler and sampled page.`
  );
}

// ---------------------------------------------------------------------------
// A1.02 Snippet and preview eligibility
// ---------------------------------------------------------------------------

type SnippetRead = {
  nosnippet: boolean;
  none: boolean;
  limits: number[];
  seen: string[];
};

function readSnippetDirectives(facts: PageFacts): SnippetRead {
  const read: SnippetRead = { nosnippet: false, none: false, limits: [], seen: [] };
  const sets = [...facts.head.metaRobots, ...facts.head.xRobotsTag];
  for (const set of sets) {
    if (set.agent !== null) continue;
    for (const directive of set.directives) {
      if (directive.name === "nosnippet") {
        read.nosnippet = true;
        read.seen.push(`${set.source}: nosnippet`);
      } else if (directive.name === "none") {
        read.none = true;
        read.seen.push(`${set.source}: none`);
      } else if (directive.name === "max-snippet" && directive.value !== null) {
        if (/^-?\d{1,9}$/.test(directive.value)) {
          read.limits.push(Number(directive.value));
          read.seen.push(`${set.source}: max-snippet:${directive.value}`);
        }
      }
    }
  }
  return read;
}

function evaluateA102(ctx: EvalContext): MetricResult {
  const perPage = pageScores(ctx.pages, (_page, facts) => {
    const read = readSnippetDirectives(facts);
    const zero = read.limits.some((limit) => limit === 0);
    const limited = read.limits.some(
      (limit) => limit >= SNIPPET_LIMIT_MIN && limit <= SNIPPET_LIMIT_MAX
    );
    const evidence = { directives: listed(read.seen) };
    if (read.nosnippet || read.none || zero) {
      return scoredPage(0, { ...evidence, branch: "snippet_blocked" });
    }
    if (limited) {
      return scoredPage(0.5, {
        ...evidence,
        branch: "snippet_length_limited",
        smallestLimit: Math.min(
          ...read.limits.filter((l) => l >= SNIPPET_LIMIT_MIN && l <= SNIPPET_LIMIT_MAX)
        ),
      });
    }
    return scoredPage(1, { ...evidence, branch: "no_snippet_restriction" });
  });
  const scores = observedScores(perPage);
  const open = scores.filter((s) => s === 1).length;
  const limited = scores.filter((s) => s === 0.5).length;
  const blocked = scores.filter((s) => s === 0).length;
  return finishPageMetric(
    ctx,
    "A1.02",
    perPage,
    `Of ${scores.length} observed ${plural(scores.length, "page", "pages")}, ${open} ${plural(open, "allows", "allow")} full snippets, ${limited} ${plural(limited, "limits", "limit")} the snippet length and ${blocked} ${plural(blocked, "blocks", "block")} snippets.`
  );
}

// ---------------------------------------------------------------------------
// A1.03 llms.txt present
// ---------------------------------------------------------------------------

const LLMS_HEADING = /^ {0,3}# +\S/m;
const BARE_URL = /https?:\/\/[^\s)]/i;

function isInlineSpace(code: number): boolean {
  return code === 32 || code === 9;
}

// A single pass, so a hostile file cannot make the scan quadratic.
function hasMarkdownLink(text: string): boolean {
  let open = false;
  const n = text.length;
  for (let i = 0; i < n; i++) {
    const c = text.charCodeAt(i);
    if (c === 10) open = false;
    else if (c === 91) open = true;
    else if (c === 93) {
      if (open && text.charCodeAt(i + 1) === 40) {
        let j = i + 2;
        while (j < n && isInlineSpace(text.charCodeAt(j))) j++;
        if (j < n) {
          const d = text.charCodeAt(j);
          if (d !== 41 && d !== 10 && d !== 13) return true;
        }
      }
      open = false;
    }
  }
  return false;
}

function llmsRecordEvidence(record: FetchRecord): EvidenceRecord {
  return {
    url: truncateEvidence(record.finalUrl),
    httpStatus: record.status,
    errorCode: record.error === null ? null : record.error.code,
  };
}

function evaluateA103(ctx: EvalContext): MetricResult {
  const record = ctx.snapshot.llms;
  if (record === null) {
    return notObserved("A1.03", "The llms.txt file was not requested during this scan, so its presence is unknown.", {
      branch: "not_requested",
    });
  }
  const evidence = llmsRecordEvidence(record);
  const { status, error } = record;

  if (status === null) {
    const code = error === null ? null : error.code;
    if (code !== null && NOT_ATTEMPTED.has(code)) {
      return notObserved("A1.03", "The scanner did not request llms.txt, so its presence is unknown.", {
        ...evidence,
        branch: "not_attempted",
      });
    }
    return scanError("A1.03", "The request for llms.txt failed on the scanner side, so its presence is unknown.", {
      ...evidence,
      branch: "request_failed",
    });
  }
  if (status >= 500) {
    return scanError("A1.03", "The server answered the llms.txt request with a server error, so its presence is unknown.", {
      ...evidence,
      branch: "server_error",
    });
  }
  if (status >= 400) {
    if (REFUSAL_STATUSES.has(status)) {
      return notObserved("A1.03", "The server refused the llms.txt request, so the scanner could not tell whether the file exists.", {
        ...evidence,
        branch: "refused",
      });
    }
    return resultFromScore("A1.03", 0, { ...evidence, branch: "not_found" }, "No llms.txt file was found at the site root.");
  }
  if (status < 200 || status >= 300) {
    return notObserved("A1.03", "The llms.txt request did not end in a readable response, so its presence is unknown.", {
      ...evidence,
      branch: "unresolved_response",
    });
  }
  if (error !== null && error.code === "CONTENT_TYPE_REJECTED") {
    return notObserved("A1.03", "The server answered with something other than a text file at the llms.txt address, so the scanner did not read it.", {
      ...evidence,
      contentType: record.contentType === null ? null : truncateEvidence(record.contentType),
      branch: "not_text",
    });
  }
  if ((error !== null && !SIZE_CAPPED.has(error.code)) || record.body === null) {
    return scanError("A1.03", "The llms.txt response could not be read completely, so its structure is unknown.", {
      ...evidence,
      branch: "body_unreadable",
    });
  }

  const body = record.body.charCodeAt(0) === 0xfeff ? record.body.slice(1) : record.body;
  const hasHeading = LLMS_HEADING.test(body);
  const hasLink = BARE_URL.test(body) || hasMarkdownLink(body);
  const found = {
    ...evidence,
    bytes: record.decodedBytes,
    truncated: record.truncated,
    hasHeading,
    hasLink,
  };
  if (hasHeading && hasLink) {
    return resultFromScore("A1.03", 1, { ...found, branch: "structured" }, "An llms.txt file with a heading and at least one link is published.");
  }
  return resultFromScore(
    "A1.03",
    0.5,
    { ...found, branch: "no_recognisable_structure" },
    "An llms.txt file exists but it has no heading line and link that the scanner recognises."
  );
}

// ---------------------------------------------------------------------------
// A1.04 Primary content in the initial HTML
// ---------------------------------------------------------------------------

function evaluateA104(ctx: EvalContext): MetricResult {
  const contentTypes: readonly string[] = SCOPE_PAGE_TYPES.CP;
  const inScope = ctx.pages.filter((page) => contentTypes.includes(page.type));
  const perPage = pageScores(inScope, (page, facts) => {
    const words = facts.main.wordCount;
    const evidence = {
      pageType: page.type,
      mainWords: words,
      threshold: MIN_MAIN_WORDS,
      mainContentMethod: facts.main.method,
      renderDependent: facts.render.renderDependent,
      markers: listed([...facts.render.spaRootMarkers, ...facts.render.noscriptJsMessages]),
    };
    if (!facts.wordCountApplicable) {
      return skippedPage("not_applicable", {
        ...evidence,
        branch: "word_count_not_applicable",
        lang: truncateEvidence(facts.head.htmlLang ?? ""),
      });
    }
    return words >= MIN_MAIN_WORDS
      ? scoredPage(1, { ...evidence, branch: "content_in_initial_html" })
      : scoredPage(0, {
          ...evidence,
          branch: facts.render.renderDependent ? "render_dependent" : "thin_content",
        });
  });
  const scores = observedScores(perPage);
  const present = scores.filter((s) => s === 1).length;
  return finishPageMetric(
    ctx,
    "A1.04",
    perPage,
    `${present} of ${scores.length} observed content ${plural(scores.length, "page", "pages")} ${plural(present, "has", "have")} ${MIN_MAIN_WORDS} or more words of main content in the raw HTML.`
  );
}

export function evaluateA1(ctx: EvalContext): MetricResult[] {
  return [evaluateA101(ctx), evaluateA102(ctx), evaluateA103(ctx), evaluateA104(ctx)];
}

