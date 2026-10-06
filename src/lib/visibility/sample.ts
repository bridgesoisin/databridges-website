import { NON_HTML_EXT, PAGE_TYPE_PATTERNS, UTILITY_EXCLUDE } from "./lists";
import { normaliseUrl, sameSite } from "./normalise";
import { CANDIDATE_EXCLUSIONS, PAGE_TYPES } from "./types";
import type { CandidateExclusion, CandidateSummary, PageType } from "./types";

export const MAX_SAMPLED_PAGES = 4;

export const SAMPLE_TYPE_ORDER = ["services", "about", "faq", "article", "other"] as const;

const NEVER_SAMPLED: ReadonlySet<PageType> = new Set<PageType>(["contact", "legal"]);

export type SampleInput = {
  homeUrl: string;
  sitemapLocs: readonly string[];
  homepageLinks: readonly string[];
  // Set by the caller when a candidate source was cut short upstream (for example the 5,000 loc cap).
  sourcesCapped?: boolean;
};

export type SelectedPage = {
  url: string;
  type: PageType;
  depth: number;
  reason: string;
};

export type SampleResult = {
  pages: SelectedPage[];
  candidates: CandidateSummary;
};

type Candidate = { url: string; path: string; depth: number; type: PageType };

function stripQueryAndFragment(path: string): string {
  const cut = path.search(/[?#]/);
  return cut === -1 ? path : path.slice(0, cut);
}

export function pathDepth(path: string): number {
  let depth = 0;
  for (const segment of stripQueryAndFragment(path).split("/")) {
    if (segment !== "") depth += 1;
  }
  return depth;
}

export function classifyPath(path: string): PageType {
  const clean = stripQueryAndFragment(path);
  if (clean === "" || clean === "/") return "home";
  for (const { type, pattern } of PAGE_TYPE_PATTERNS) {
    if (!pattern.test(clean)) continue;
    return type === "article" && pathDepth(clean) < 2 ? "other" : type;
  }
  return "other";
}

function pathOfNormalised(url: string): string {
  const match = /^https?:\/\/[^/?#]*([^?#]*)/.exec(url);
  return match === null || match[1] === "" ? "/" : match[1];
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// The URL is the last tie-break so URLs sharing a path (different query, scheme or www) order stably.
function compareCandidates(a: Candidate, b: Candidate): number {
  return a.depth - b.depth || compareText(a.path, b.path) || compareText(a.url, b.url);
}

function zeroed<K extends string>(keys: readonly K[]): Record<K, number> {
  const out = {} as Record<K, number>;
  for (const key of keys) out[key] = 0;
  return out;
}

export function selectSample(input: SampleInput): SampleResult {
  const sitemapLocs = Array.isArray(input.sitemapLocs) ? input.sitemapLocs : [];
  const homepageLinks = Array.isArray(input.homepageLinks) ? input.homepageLinks : [];
  const home = typeof input.homeUrl === "string" ? normaliseUrl(input.homeUrl) : null;

  const excluded = zeroed<CandidateExclusion>(CANDIDATE_EXCLUSIONS);
  const byType = zeroed<PageType>(PAGE_TYPES);
  const seen = new Set<string>();
  const pool: Candidate[] = [];

  const consider = (raw: unknown, base: string | undefined): void => {
    const url = typeof raw === "string" ? normaliseUrl(raw, base) : null;
    if (url === null) {
      excluded.non_http += 1;
      return;
    }
    if (home === null || !sameSite(url, home)) {
      excluded.other_site += 1;
      return;
    }
    const path = pathOfNormalised(url);
    const lowerPath = path.toLowerCase();
    if (NON_HTML_EXT.some((ext) => lowerPath.endsWith(ext))) {
      excluded.non_html_extension += 1;
      return;
    }
    if (UTILITY_EXCLUDE.some((pattern) => pattern.test(path))) {
      excluded.utility_path += 1;
      return;
    }
    const type = classifyPath(path);
    if (url === home || type === "home") {
      excluded.homepage += 1;
      return;
    }
    if (seen.has(url)) {
      excluded.duplicate += 1;
      return;
    }
    seen.add(url);
    pool.push({ url, path, depth: pathDepth(path), type });
    byType[type] += 1;
  };

  for (const loc of sitemapLocs) consider(loc, undefined);
  for (const href of homepageLinks) consider(href, input.homeUrl);

  const eligible = pool.filter((c) => !NEVER_SAMPLED.has(c.type)).sort(compareCandidates);
  const pages: SelectedPage[] = [];
  const taken = new Set<string>();

  for (const type of SAMPLE_TYPE_ORDER) {
    if (pages.length >= MAX_SAMPLED_PAGES) break;
    const ofType = eligible.filter((c) => c.type === type);
    const best = ofType[0];
    if (best === undefined) continue;
    taken.add(best.url);
    pages.push({
      url: best.url,
      type,
      depth: best.depth,
      reason: `Best of ${ofType.length} ${type} candidate${ofType.length === 1 ? "" : "s"} by depth, then path`,
    });
  }

  for (const candidate of eligible) {
    if (pages.length >= MAX_SAMPLED_PAGES) break;
    if (taken.has(candidate.url)) continue;
    taken.add(candidate.url);
    pages.push({
      url: candidate.url,
      type: candidate.type,
      depth: candidate.depth,
      reason: "Fill slot: best unselected candidate by depth, then path",
    });
  }

  return {
    pages,
    candidates: {
      fromSitemap: sitemapLocs.length,
      fromHomepageLinks: homepageLinks.length,
      considered: pool.length,
      excluded,
      byType,
      capped: input.sourcesCapped === true,
    },
  };
}
