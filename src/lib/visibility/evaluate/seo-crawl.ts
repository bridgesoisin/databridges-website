import { CLASSIC_SEARCH_AGENTS } from "@/lib/visibility/lists";
import {
  notObserved,
  resultFromPageScores,
  resultFromScore,
  scanError,
} from "@/lib/visibility/scoring";
import { truncateEvidence } from "@/lib/visibility/text";
import type {
  EvalContext,
  EvalPage,
  EvidenceRecord,
  MetricResult,
  PageFacts,
  PerPageScore,
  RobotsDirectiveSet,
  SitemapDocInfo,
} from "@/lib/visibility/types";

export type FactsPage = EvalPage & { facts: PageFacts };
export type PageReads = "meta" | "body";
export type BranchPhrase = readonly [branch: string, one: string, many: string];

export function ev(text: string): string {
  return truncateEvidence(text);
}

export function hasFacts(page: EvalPage): page is FactsPage {
  return page.facts !== null;
}

export function observedPage(page: EvalPage, score: number, evidence: EvidenceRecord): PerPageScore {
  return { url: page.url, score, status: "observed", evidence };
}

export function notApplicablePage(page: EvalPage, branch: string, reason: string): PerPageScore {
  return { url: page.url, score: null, status: "not_applicable", evidence: { branch, reason } };
}

export function unreadPage(
  page: EvalPage,
  status: "not_observed" | "scan_error",
  reason: string,
  extra: EvidenceRecord = {},
): PerPageScore {
  return {
    url: page.url,
    score: null,
    status,
    evidence: {
      ...extra,
      branch: status === "scan_error" ? "SCAN_ERROR" : "NOT_OBSERVED",
      reason: ev(reason),
    },
  };
}

// Pages without facts: a robots block or a non-HTML reply is simply not observable; an HTTP or fetch failure is a scan error.
export function unfetchedPage(page: EvalPage): PerPageScore {
  const { record } = page;
  switch (page.fetchClass) {
    case "robots_blocked":
      return unreadPage(page, "not_observed", "The scanner's own robots.txt rules blocked this page, so it was not fetched.");
    case "non_html":
      return unreadPage(page, "not_observed", `The page did not return HTML (${record.contentType ?? "no content type"}).`);
    case "http_error":
      return unreadPage(page, "scan_error", `The page returned HTTP ${record.status}, so its HTML could not be read.`);
    default:
      return unreadPage(
        page,
        "scan_error",
        `The page could not be fetched${record.error === null ? "" : ` (${record.error.code})`}.`,
      );
  }
}

export function renderDependentPage(page: FactsPage): PerPageScore {
  return unreadPage(
    page,
    "not_observed",
    "The page is built by JavaScript, so its body content is not in the raw HTML and is not read here.",
    {
      mainWordCount: page.facts.render.mainWordCount,
      spaRootMarkers: page.facts.render.spaRootMarkers.slice(0, 4).map(ev),
    },
  );
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function joinAnd(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

export function summarisePages(perPage: readonly PerPageScore[], phrases: readonly BranchPhrase[]): string {
  const counts = new Map<string, number>();
  let observed = 0;
  let unread = 0;
  for (const page of perPage) {
    if (page.status === "observed") {
      observed += 1;
      const branch = typeof page.evidence.branch === "string" ? page.evidence.branch : "";
      counts.set(branch, (counts.get(branch) ?? 0) + 1);
    } else if (page.status === "not_observed" || page.status === "scan_error") {
      unread += 1;
    }
  }
  const total = observed + unread;
  if (total === 0) return "No sampled page could be read for this metric.";
  if (unread === 0 && counts.size === 1) {
    const [only] = [...counts.keys()];
    const phrase = phrases.find(([branch]) => branch === only);
    if (phrase !== undefined) return total === 1 ? `The page ${phrase[1]}.` : `All ${total} pages ${phrase[2]}.`;
  }
  const parts: string[] = [];
  for (const [branch, one, many] of phrases) {
    const count = counts.get(branch) ?? 0;
    if (count > 0) parts.push(plural(count, one, many));
  }
  if (unread > 0) parts.push(`${unread} could not be read`);
  return `Of ${total} ${total === 1 ? "page" : "pages"}, ${joinAnd(parts)}.`;
}

export type PageRule = {
  metricId: string;
  reads: PageReads;
  phrases: readonly BranchPhrase[];
  notApplicableReason?: string;
  score: (page: FactsPage) => PerPageScore;
};

export function evaluatePages(ctx: EvalContext, rule: PageRule): MetricResult {
  if (ctx.pages.length === 0) {
    return notObserved(rule.metricId, "No pages were sampled, so there was nothing to read.");
  }
  const perPage = ctx.pages.map((page) => {
    if (!hasFacts(page)) return unfetchedPage(page);
    if (rule.reads === "body" && page.renderDependent) return renderDependentPage(page);
    return rule.score(page);
  });
  const result = resultFromPageScores(rule.metricId, perPage, null, summarisePages(perPage, rule.phrases));
  if (result.result === "NOT_APPLICABLE" && rule.notApplicableReason !== undefined) {
    return { ...result, explanation: rule.notApplicableReason };
  }
  return result;
}

export function guard(metricId: string, evaluate: () => MetricResult): MetricResult {
  try {
    return evaluate();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return scanError(metricId, "This metric could not be evaluated because of an internal error.", {
      branch: "SCAN_ERROR",
      reason: "internal_error",
      error: ev(message),
    });
  }
}

// ---------------------------------------------------------------------------
// S1.01 Pages are indexable
// ---------------------------------------------------------------------------

const NOINDEX_DIRECTIVES: ReadonlySet<string> = new Set(["noindex", "none"]);
const INDEXING_AGENTS: ReadonlySet<string> = new Set(["googlebot", "bingbot"]);

function noindexSources(facts: PageFacts): string[] {
  const sources: string[] = [];
  const check = (set: RobotsDirectiveSet, label: string): void => {
    if (set.agent !== null && !INDEXING_AGENTS.has(set.agent)) return;
    if (!set.directives.some((directive) => NOINDEX_DIRECTIVES.has(directive.name))) return;
    sources.push(ev(`${label}${set.agent === null ? "" : ` [${set.agent}]`}: ${set.raw}`));
  };
  for (const set of facts.head.metaRobots) check(set, set.agent === null ? "meta robots" : "meta");
  for (const set of facts.head.xRobotsTag) check(set, "X-Robots-Tag");
  return sources;
}

function s101(ctx: EvalContext): MetricResult {
  return evaluatePages(ctx, {
    metricId: "S1.01",
    reads: "meta",
    phrases: [
      ["indexable", "can be indexed", "can be indexed"],
      ["noindex_directive", "carries a noindex or none directive", "carry a noindex or none directive"],
    ],
    score: (page) => {
      const sources = noindexSources(page.facts);
      return sources.length === 0
        ? observedPage(page, 1, { branch: "indexable", noindexSources: [] })
        : observedPage(page, 0, { branch: "noindex_directive", noindexSources: sources.slice(0, 4) });
    },
  });
}

// ---------------------------------------------------------------------------
// S1.02 Crawlable by Googlebot and bingbot
// ---------------------------------------------------------------------------

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function robotsPage(ctx: EvalContext, page: EvalPage): PerPageScore {
  const url = page.finalUrl;
  const origin = originOf(url);
  const rules = origin === null ? undefined : ctx.robots.byOrigin.get(origin);
  const state = ctx.robots.stateFor(url);
  const common: EvidenceRecord = {
    checkedUrl: ev(url),
    robotsState: state,
    robotsHttpStatus: rules?.status ?? null,
  };
  if (state === "error") {
    return unreadPage(
      page,
      "scan_error",
      "robots.txt could not be read (a server error, timeout or unreadable reply), so crawl access is not judged.",
      common,
    );
  }
  if (state === "not_fetched") {
    return unreadPage(page, "not_observed", "robots.txt was not fetched for this page's origin, so crawl access is not judged.", common);
  }
  const verdicts = CLASSIC_SEARCH_AGENTS.map((agent) => ({ agent, allowed: ctx.robots.isAllowed(agent, url) }));
  if (verdicts.some((verdict) => verdict.allowed === null)) {
    return unreadPage(page, "not_observed", "robots.txt could not be matched against this page.", common);
  }
  const agents: EvidenceRecord = {};
  for (const verdict of verdicts) agents[verdict.agent] = verdict.allowed === true;
  const blocked = verdicts.filter((verdict) => verdict.allowed === false).map((verdict) => verdict.agent);
  const score = (verdicts.length - blocked.length) / verdicts.length;
  const branch =
    blocked.length === 0
      ? "allowed_for_both"
      : blocked.length === verdicts.length
        ? "blocked_for_both"
        : `blocked_for_${blocked[0].toLowerCase()}`;
  return observedPage(page, score, { ...common, branch, agents });
}

function s102(ctx: EvalContext): MetricResult {
  if (ctx.pages.length === 0) {
    return notObserved("S1.02", "No pages were sampled, so there was nothing to check against robots.txt.");
  }
  const perPage = ctx.pages.map((page) => robotsPage(ctx, page));
  const phrases: BranchPhrase[] = [
    ["allowed_for_both", "is open to Googlebot and bingbot", "are open to Googlebot and bingbot"],
    ["blocked_for_googlebot", "is blocked for Googlebot only", "are blocked for Googlebot only"],
    ["blocked_for_bingbot", "is blocked for bingbot only", "are blocked for bingbot only"],
    ["blocked_for_both", "is blocked for both", "are blocked for both"],
  ];
  return resultFromPageScores("S1.02", perPage, null, summarisePages(perPage, phrases));
}

// ---------------------------------------------------------------------------
// S1.03 Valid XML sitemap discoverable
// ---------------------------------------------------------------------------

const REFUSAL_STATUSES: ReadonlySet<number> = new Set([401, 403, 429]);

function sitemapStatus(ctx: EvalContext, doc: SitemapDocInfo): number | null {
  const found = ctx.snapshot.sitemaps.find((item) => item.url === doc.url && item.role === doc.role);
  return found === undefined ? null : found.record.status;
}

function s103(ctx: EvalContext): MetricResult {
  const all = ctx.sitemap.documents;
  const top = all.filter((doc) => doc.role !== "index-child");
  const docs = top.length > 0 ? top : all;
  const summary = docs.slice(0, 6).map((doc) => ({
    url: ev(doc.url),
    role: doc.role,
    kind: doc.kind,
    httpStatus: sitemapStatus(ctx, doc),
    sameSiteLocs: doc.sameSiteLocCount,
  }));
  const base = {
    declaredInRobots: ctx.sitemap.declaredInRobots,
    documents: summary,
    childSitemapsRead: all.length - top.length,
  };

  const valid = docs.filter(
    (doc) => (doc.kind === "urlset" || doc.kind === "sitemapindex") && doc.sameSiteLocCount >= 1,
  );
  if (valid.length > 0) {
    return resultFromScore(
      "S1.03",
      1,
      { ...base, branch: "valid_sitemap" },
      `A valid ${valid[0].kind === "urlset" ? "URL sitemap" : "sitemap index"} with ${valid[0].sameSiteLocCount} same-site address${valid[0].sameSiteLocCount === 1 ? "" : "es"} was found.`,
    );
  }
  const noSameSite = docs.filter((doc) => doc.kind === "urlset" || doc.kind === "sitemapindex");
  if (noSameSite.length > 0) {
    return resultFromScore(
      "S1.03",
      0.5,
      { ...base, branch: "no_same_site_url" },
      "A sitemap was found but it lists no addresses on this site.",
    );
  }
  if (docs.some((doc) => doc.kind === "malformed")) {
    return resultFromScore(
      "S1.03",
      0.5,
      { ...base, branch: "malformed" },
      "A sitemap was found but it is not valid XML sitemap content.",
    );
  }
  if (docs.some((doc) => doc.kind === "error")) {
    const refused = docs
      .filter((doc) => doc.kind === "error")
      .every((doc) => {
        const status = sitemapStatus(ctx, doc);
        return status !== null && REFUSAL_STATUSES.has(status);
      });
    const evidence = { ...base, branch: refused ? "NOT_OBSERVED" : "SCAN_ERROR" };
    return refused
      ? notObserved("S1.03", "The sitemap request was refused, so its presence is not judged.", evidence)
      : scanError("S1.03", "The sitemap could not be fetched because of a server error or timeout, so its presence is not judged.", evidence);
  }
  if (docs.length === 0) {
    return notObserved("S1.03", "No sitemap request was recorded, so its presence is not judged.", {
      ...base,
      branch: "NOT_OBSERVED",
    });
  }
  const robotsState = ctx.robots.stateFor(ctx.snapshot.homeUrl);
  if (robotsState === "error" || robotsState === "not_fetched") {
    return notObserved(
      "S1.03",
      "No sitemap was found at the default address, but robots.txt could not be read to check for a declared one.",
      { ...base, branch: "NOT_OBSERVED", robotsState },
    );
  }
  return resultFromScore(
    "S1.03",
    0,
    { ...base, branch: "not_found" },
    "No sitemap was found in robots.txt or at /sitemap.xml.",
  );
}

// ---------------------------------------------------------------------------
// S1.04 Canonical URL is consistent
// ---------------------------------------------------------------------------

function s104(ctx: EvalContext): MetricResult {
  return evaluatePages(ctx, {
    metricId: "S1.04",
    reads: "meta",
    phrases: [
      ["self_canonical", "points to its own address", "point to their own address"],
      ["other_same_site", "points to a different page on the same site", "point to a different page on the same site"],
      ["cross_site", "points to another site", "point to another site"],
      ["conflicting", "declares conflicting canonicals", "declare conflicting canonicals"],
      ["unusable", "has an empty or non-HTTP canonical", "have an empty or non-HTTP canonical"],
      ["missing", "has no canonical", "have no canonical"],
    ],
    score: (page) => {
      const entries = page.facts.head.canonicals;
      const own = ctx.helpers.normaliseUrl(page.finalUrl) ?? page.finalUrl;
      const usable = entries.filter((entry) => entry.url !== null);
      const distinct = [...new Set(usable.map((entry) => entry.url as string))];
      const evidence: EvidenceRecord = {
        ownUrl: ev(own),
        canonicalCount: entries.length,
        canonicals: entries.slice(0, 4).map((entry) => ev(`${entry.source}: ${entry.url ?? entry.href}`)),
      };
      if (entries.length === 0) return observedPage(page, 0, { ...evidence, branch: "missing" });
      if (distinct.length === 0) return observedPage(page, 0, { ...evidence, branch: "unusable" });
      if (distinct.length > 1) return observedPage(page, 0, { ...evidence, branch: "conflicting" });
      const target = distinct[0];
      const withTarget = { ...evidence, canonical: ev(target), ignoredUnusable: entries.length - usable.length };
      if (target === own) return observedPage(page, 1, { ...withTarget, branch: "self_canonical" });
      if (ctx.helpers.sameSite(target, own)) {
        return observedPage(page, 0.5, { ...withTarget, branch: "other_same_site" });
      }
      return observedPage(page, 0, { ...withTarget, branch: "cross_site" });
    },
  });
}

// ---------------------------------------------------------------------------
// S1.05 Page returns success directly
// ---------------------------------------------------------------------------

const MAX_FULL_CREDIT_HOPS = 1;
const MAX_PARTIAL_CREDIT_HOPS = 3;

function s105Page(ctx: EvalContext, page: EvalPage): PerPageScore {
  const { record } = page;
  const hops = record.redirectChain.length;
  const status = record.status;
  const code = record.error === null ? null : record.error.code;
  const base: EvidenceRecord = {
    httpStatus: status,
    redirectHops: hops,
    redirectStatuses: record.redirectChain.slice(0, 6).map((hop) => hop.status),
    finalUrl: ev(record.finalUrl),
  };
  if (code === "ROBOTS_DISALLOWED") {
    return unreadPage(page, "not_observed", "The scanner's own robots.txt rules blocked this page, so it was not fetched.", base);
  }
  if (code === "TOO_MANY_REDIRECTS") {
    return observedPage(page, 0, { ...base, branch: "too_many_redirects", errorCode: code });
  }
  if (code === "REDIRECT_LOOP" || code === "REDIRECT_BLOCKED") {
    return unreadPage(page, "scan_error", `The redirect could not be followed to a final response (${code}).`, base);
  }
  if (status === null) {
    return unreadPage(
      page,
      "scan_error",
      `No HTTP response was received${code === null ? "" : ` (${code})`}.`,
      base,
    );
  }
  if (status >= 400) {
    const challenged = ctx.challenge.sources.some((source) => source.url === record.finalUrl && source.status === status);
    if (challenged) {
      return unreadPage(page, "not_observed", `The scanner was challenged with HTTP ${status}, so this page's status is not judged.`, base);
    }
    return observedPage(page, 0, { ...base, branch: "error_status" });
  }
  if (status >= 200 && status < 300) {
    if (hops > MAX_PARTIAL_CREDIT_HOPS) return observedPage(page, 0, { ...base, branch: "too_many_redirects" });
    if (hops > MAX_FULL_CREDIT_HOPS) return observedPage(page, 0.5, { ...base, branch: "two_or_three_redirects" });
    return observedPage(page, 1, { ...base, branch: hops === 0 ? "direct" : "one_redirect" });
  }
  return unreadPage(page, "scan_error", `The final response (HTTP ${status}) was neither a success nor an error status.`, base);
}

function s105(ctx: EvalContext): MetricResult {
  if (ctx.pages.length === 0) {
    return notObserved("S1.05", "No pages were sampled, so there was nothing to read.");
  }
  const perPage = ctx.pages.map((page) => s105Page(ctx, page));
  const phrases: BranchPhrase[] = [
    ["direct", "responds directly", "respond directly"],
    ["one_redirect", "responds after one redirect", "respond after one redirect"],
    ["two_or_three_redirects", "needs two or three redirects", "need two or three redirects"],
    ["too_many_redirects", "needs more than three redirects", "need more than three redirects"],
    ["error_status", "ends in an error status", "end in an error status"],
  ];
  return resultFromPageScores("S1.05", perPage, null, summarisePages(perPage, phrases));
}

export function evaluateS1(ctx: EvalContext): MetricResult[] {
  return [
    guard("S1.01", () => s101(ctx)),
    guard("S1.02", () => s102(ctx)),
    guard("S1.03", () => s103(ctx)),
    guard("S1.04", () => s104(ctx)),
    guard("S1.05", () => s105(ctx)),
  ];
}

