import { GENERIC_ANCHORS } from "@/lib/visibility/lists";
import { notApplicable, notObserved, resultFromScore, scanError } from "@/lib/visibility/scoring";
import { truncateEvidence } from "@/lib/visibility/text";
import type { EvalContext, EvidenceRecord, LinkLocation, MetricResult, PerPageScore } from "@/lib/visibility/types";
import {
  observedScore,
  pageEvidence,
  pageMetric,
  pageWord,
  pagesForScope,
  readPage,
  skipScore,
  tally,
  unobservedNote,
} from "./seo-technical";

const clip = (value: string): string => truncateEvidence(value);

// ---------------------------------------------------------------------------
// S4.01 Content depth
// ---------------------------------------------------------------------------

const DEPTH_FULL_WORDS = 300;
const DEPTH_HALF_WORDS = 150;

function evaluateContentDepth(ctx: EvalContext): MetricResult {
  return pageMetric(
    ctx,
    "S4.01",
    "CP",
    (page) => {
      const read = readPage(page, "body", (candidate) =>
        candidate.facts !== null && !candidate.facts.wordCountApplicable
          ? skipScore(
              candidate,
              "not_applicable",
              "not_applicable_language",
              "Word counts do not apply to this page's language (zh, ja, ko or th).",
              { lang: candidate.facts.head.htmlLang === null ? null : clip(candidate.facts.head.htmlLang) },
            )
          : null,
      );
      if (read.skip) return read.skip;
      const { main } = read.facts;
      const extra: EvidenceRecord = {
        words: main.wordCount,
        mainContentMethod: main.method,
        mainContentIsHeuristic: true,
      };
      if (main.wordCount >= DEPTH_FULL_WORDS) return observedScore(page, 1, "words_300_or_more", extra);
      if (main.wordCount >= DEPTH_HALF_WORDS) return observedScore(page, 0.5, "words_150_to_299", extra);
      return observedScore(page, 0, "words_under_150", extra);
    },
    (perPage) => {
      const t = tally(perPage);
      const full = t.scores.filter((s) => s === 1).length;
      const half = t.scores.filter((s) => s === 0.5).length;
      const thin = t.scores.filter((s) => s === 0).length;
      return `${full} of ${t.observed} observed content ${pageWord(t.observed)} have 300 or more words of main content, ${half} have 150 to 299 and ${thin} have fewer${unobservedNote(t.applicable, t.observed)}.`;
    },
  );
}

// ---------------------------------------------------------------------------
// S4.02 Internal link breadth
// ---------------------------------------------------------------------------

const BREADTH_FULL_TARGETS = 8;
const BREADTH_HALF_TARGETS = 3;

function unreadableResult(metricId: string, skip: PerPageScore): MetricResult {
  const reason = typeof skip.evidence.reason === "string" ? skip.evidence.reason : "The page could not be read.";
  const evidence: EvidenceRecord = { ...skip.evidence, url: skip.url };
  return skip.status === "scan_error"
    ? scanError(metricId, reason, evidence)
    : skip.status === "not_applicable"
      ? notApplicable(metricId, reason, evidence)
      : notObserved(metricId, reason, evidence);
}

function evaluateLinkBreadth(ctx: EvalContext): MetricResult {
  const id = "S4.02";
  const home = ctx.home;
  if (home === null) {
    return notObserved(id, "The homepage was not fetched, so its internal links could not be counted.");
  }
  const read = readPage(home, "body");
  if (read.skip) return unreadableResult(id, read.skip);

  const { helpers } = ctx;
  const own = new Set<string>();
  for (const candidate of [home.finalUrl, home.url, ctx.snapshot.homeUrl]) {
    own.add(helpers.normaliseUrl(candidate) ?? candidate);
  }
  const targets = new Map<string, LinkLocation>();
  for (const link of read.facts.links) {
    if (!link.sameSite || link.fragmentOnly || link.url === null) continue;
    if (own.has(link.url) || targets.has(link.url)) continue;
    targets.set(link.url, link.location);
  }
  const byLocation: Record<string, number> = { nav: 0, main: 0, footer: 0, other: 0 };
  for (const location of targets.values()) byLocation[location] += 1;

  const count = targets.size;
  const evidence: EvidenceRecord = {
    homeUrl: clip(home.finalUrl),
    distinctTargets: count,
    byFirstLocation: byLocation,
    sample: [...targets.keys()].slice(0, 5).map(clip),
    fullMarksAt: BREADTH_FULL_TARGETS,
    halfMarksAt: BREADTH_HALF_TARGETS,
  };
  if (count >= BREADTH_FULL_TARGETS) {
    return resultFromScore(
      id,
      1,
      { ...evidence, branch: "targets_8_or_more" },
      `The homepage links to ${count} distinct pages on the same site, which meets the ${BREADTH_FULL_TARGETS} needed for full marks.`,
    );
  }
  if (count >= BREADTH_HALF_TARGETS) {
    return resultFromScore(
      id,
      0.5,
      { ...evidence, branch: "targets_3_to_7" },
      `The homepage links to ${count} distinct pages on the same site, fewer than the ${BREADTH_FULL_TARGETS} needed for full marks.`,
    );
  }
  return resultFromScore(
    id,
    0,
    { ...evidence, branch: "targets_2_or_fewer" },
    `The homepage links to only ${count} distinct ${count === 1 ? "page" : "pages"} on the same site.`,
  );
}

// ---------------------------------------------------------------------------
// S4.03 Descriptive anchor text
// ---------------------------------------------------------------------------

function evaluateAnchorText(ctx: EvalContext): MetricResult {
  return pageMetric(
    ctx,
    "S4.03",
    "P",
    (page) => {
      const read = readPage(page, "body");
      if (read.skip) return read.skip;
      const links = read.facts.links.filter((link) => link.sameSite && !link.fragmentOnly && link.url !== null);
      if (links.length === 0) {
        return skipScore(
          page,
          "not_applicable",
          "not_applicable_no_internal_links",
          "The page has no same-site links to assess.",
        );
      }
      let descriptive = 0;
      let generic = 0;
      let unnamed = 0;
      const genericExamples: string[] = [];
      for (const link of links) {
        const name = ctx.helpers.normaliseText(link.name).toLowerCase();
        if (name === "") unnamed += 1;
        else if (GENERIC_ANCHORS.has(name)) {
          generic += 1;
          if (genericExamples.length < 3 && !genericExamples.includes(name)) genericExamples.push(clip(name));
        } else descriptive += 1;
      }
      return observedScore(page, descriptive / links.length, "descriptive_share", {
        sameSiteLinks: links.length,
        descriptive,
        generic,
        unnamed,
        genericExamples,
      });
    },
    (perPage) => {
      const t = tally(perPage);
      const mean = t.observed === 0 ? 0 : t.scores.reduce((sum, s) => sum + s, 0) / t.observed;
      return `On average ${Math.round(mean * 100)}% of internal links on the ${t.observed} observed ${pageWord(t.observed)} use descriptive anchor text${unobservedNote(t.applicable, t.observed)}.`;
    },
  );
}

// ---------------------------------------------------------------------------
// S4.04 Distinct content
// ---------------------------------------------------------------------------

function evaluateDistinctContent(ctx: EvalContext): MetricResult {
  const id = "S4.04";
  const contentPages = pagesForScope(ctx, "CP");
  if (contentPages.length < 2) {
    return notApplicable(
      id,
      `Only ${contentPages.length} content ${pageWord(contentPages.length)} ${contentPages.length === 1 ? "was" : "were"} sampled, so duplicate content cannot be compared.`,
      { branch: "not_applicable_under_two_content_pages", contentPages: contentPages.length },
    );
  }

  const groups = new Map<string, string[]>();
  const skipped: PerPageScore[] = [];
  let compared = 0;
  for (const page of contentPages) {
    const read = readPage(page, "body");
    if (read.skip) {
      skipped.push(read.skip);
      continue;
    }
    const { main } = read.facts;
    if (main.text === "") {
      skipped.push(
        skipScore(page, "not_observed", "not_observed_no_main_text", "The page has no main text to compare."),
      );
      continue;
    }
    compared += 1;
    const group = groups.get(main.textHash);
    if (group === undefined) groups.set(main.textHash, [page.url]);
    else group.push(page.url);
  }

  const skippedEvidence = pageEvidence(skipped);
  if (compared < 2) {
    const reason = `Only ${compared} of ${contentPages.length} content pages could be read, and at least 2 are needed to compare their text.`;
    const evidence: EvidenceRecord[] = [
      { branch: "too_few_readable_pages", contentPages: contentPages.length, compared },
      ...skippedEvidence,
    ];
    return skipped.some((page) => page.status === "scan_error")
      ? scanError(id, reason, evidence)
      : notObserved(id, reason, evidence);
  }

  const duplicateSets = [...groups.values()].filter((urls) => urls.length >= 2);
  const duplicatePages = duplicateSets.reduce((sum, urls) => sum + urls.length, 0);
  const evidence: EvidenceRecord = {
    branch: duplicatePages === 0 ? "all_distinct" : "identical_text_found",
    contentPages: contentPages.length,
    compared,
    duplicatePages,
    duplicateSets: duplicateSets.slice(0, 3).map((urls) => urls.slice(0, 4).map(clip)),
    notCompared: skippedEvidence.length,
  };
  return resultFromScore(
    id,
    1 - duplicatePages / compared,
    evidence,
    duplicatePages === 0
      ? `All ${compared} compared content pages have different main text.`
      : `${duplicatePages} of ${compared} compared content pages share identical main text with another page.`,
  );
}

// ---------------------------------------------------------------------------
// S4.05 Clean URLs
// ---------------------------------------------------------------------------

const SESSION_PARAMETERS: ReadonlySet<string> = new Set(["sid", "phpsessid", "jsessionid", "sessionid"]);
const MAX_PATH_CHARACTERS = 100;
const PERCENT_ESCAPE = /%[0-9a-f]{2}/gi;

function decodedLength(path: string): number {
  try {
    return [...decodeURIComponent(path)].length;
  } catch {
    return [...path].length;
  }
}

function urlViolations(rawUrl: string): { violations: string[]; pathLength: number } | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  const path = url.pathname;
  const pathLength = decodedLength(path);
  const violations: string[] = [];
  if (/\p{Lu}/u.test(path.replace(PERCENT_ESCAPE, ""))) violations.push("uppercase_in_path");
  if (/%20/i.test(path) || /\s/.test(path)) violations.push("space_in_path");
  if (path.includes("_")) violations.push("underscore_in_path");
  if (pathLength > MAX_PATH_CHARACTERS) violations.push("path_over_100_characters");
  if (url.search !== "") violations.push("query_string");
  for (const name of url.searchParams.keys()) {
    if (SESSION_PARAMETERS.has(name.toLowerCase())) {
      violations.push("session_parameter");
      break;
    }
  }
  return { violations, pathLength };
}

function evaluateCleanUrls(ctx: EvalContext): MetricResult {
  return pageMetric(
    ctx,
    "S4.05",
    "P",
    (page) => {
      const checked = urlViolations(page.finalUrl);
      if (checked === null) {
        return skipScore(page, "scan_error", "scan_error_unparsable_url", "The page address could not be parsed.");
      }
      const { violations, pathLength } = checked;
      const extra: EvidenceRecord = { checkedUrl: clip(page.finalUrl), violations, pathLength };
      if (violations.length === 0) return observedScore(page, 1, "no_violations", extra);
      if (violations.length === 1) return observedScore(page, 0.5, "one_violation", extra);
      return observedScore(page, 0, "two_or_more_violations", extra);
    },
    (perPage) => {
      const t = tally(perPage);
      const clean = t.scores.filter((s) => s === 1).length;
      const one = t.scores.filter((s) => s === 0.5).length;
      const many = t.scores.filter((s) => s === 0).length;
      return `${clean} of ${t.observed} sampled page ${t.observed === 1 ? "address is" : "addresses are"} clean, ${one} ${one === 1 ? "has" : "have"} one violation and ${many} ${many === 1 ? "has" : "have"} two or more${unobservedNote(t.applicable, t.observed)}.`;
    },
  );
}

// ---------------------------------------------------------------------------
// S4.06 Site navigation
// ---------------------------------------------------------------------------

const NAV_FULL_LINKS = 3;

function evaluateNavigation(ctx: EvalContext): MetricResult {
  return pageMetric(
    ctx,
    "S4.06",
    "P",
    (page) => {
      const read = readPage(page, "body");
      if (read.skip) return read.skip;
      const counts = read.facts.navigations.map((nav) => nav.sameSiteLinkCount);
      const most = counts.length === 0 ? 0 : Math.max(...counts);
      const extra: EvidenceRecord = { navBlocks: counts.length, mostSameSiteLinks: most };
      if (most >= NAV_FULL_LINKS) return observedScore(page, 1, "nav_with_3_or_more_links", extra);
      if (most >= 1) return observedScore(page, 0.5, "nav_with_1_or_2_links", extra);
      return observedScore(page, 0, counts.length === 0 ? "no_nav" : "nav_without_internal_links", extra);
    },
    (perPage) => {
      const t = tally(perPage);
      const full = t.scores.filter((s) => s === 1).length;
      const half = t.scores.filter((s) => s === 0.5).length;
      const none = t.scores.filter((s) => s === 0).length;
      return `${full} of ${t.observed} observed ${pageWord(t.observed)} have a navigation block with 3 or more internal links, ${half} have one with 1 or 2 and ${none} have none${unobservedNote(t.applicable, t.observed)}.`;
    },
  );
}

// ---------------------------------------------------------------------------

export function evaluateS4(ctx: EvalContext): MetricResult[] {
  return [
    evaluateContentDepth(ctx),
    evaluateLinkBreadth(ctx),
    evaluateAnchorText(ctx),
    evaluateDistinctContent(ctx),
    evaluateCleanUrls(ctx),
    evaluateNavigation(ctx),
  ];
}
