import {
  ev,
  evaluatePages,
  guard,
  hasFacts,
  observedPage,
  notApplicablePage,
  unfetchedPage,
  type FactsPage,
} from "@/lib/visibility/evaluate/seo-crawl";
import {
  aggregatePageScores,
  notApplicable,
  notObserved,
  resultFromPageScores,
  resultFromScore,
} from "@/lib/visibility/scoring";
import type {
  EvalContext,
  EvidenceRecord,
  MetricResult,
  PageFacts,
  PerPageScore,
  TextEntry,
} from "@/lib/visibility/types";

// ---------------------------------------------------------------------------
// Length-banded text tags (S2.01 title, S2.03 meta description)
// ---------------------------------------------------------------------------

type Band = readonly [min: number, max: number];

type TagBands = {
  good: Band;
  shortPartial: Band;
  longPartial: Band;
  goodBranch: string;
  shortBranch: string;
  longBranch: string;
  underBranch: string;
  overBranch: string;
};

function within(value: number, [min, max]: Band): boolean {
  return value >= min && value <= max;
}

function scoreTextTag(
  page: FactsPage,
  entries: readonly TextEntry[],
  bands: TagBands,
  extra: EvidenceRecord = {},
): PerPageScore {
  const nonEmpty = entries.filter((entry) => entry.chars > 0);
  const evidence: EvidenceRecord = {
    ...extra,
    tagCount: entries.length,
    nonEmptyCount: nonEmpty.length,
  };
  if (entries.length === 0) return observedPage(page, 0, { ...evidence, branch: "missing" });
  if (nonEmpty.length === 0) return observedPage(page, 0, { ...evidence, branch: "empty" });
  if (nonEmpty.length > 1) return observedPage(page, 0, { ...evidence, branch: "multiple" });
  const { chars, text } = nonEmpty[0];
  const withText = { ...evidence, chars, text: ev(text) };
  if (within(chars, bands.good)) return observedPage(page, 1, { ...withText, branch: bands.goodBranch });
  if (within(chars, bands.shortPartial)) return observedPage(page, 0.5, { ...withText, branch: bands.shortBranch });
  if (within(chars, bands.longPartial)) return observedPage(page, 0.5, { ...withText, branch: bands.longBranch });
  return observedPage(page, 0, { ...withText, branch: chars < bands.good[0] ? bands.underBranch : bands.overBranch });
}

const TITLE_BANDS: TagBands = {
  good: [20, 65],
  shortPartial: [10, 19],
  longPartial: [66, 90],
  goodBranch: "within_20_65",
  shortBranch: "short_10_19",
  longBranch: "long_66_90",
  underBranch: "under_10",
  overBranch: "over_90",
};

const DESCRIPTION_BANDS: TagBands = {
  good: [70, 160],
  shortPartial: [30, 69],
  longPartial: [161, 220],
  goodBranch: "within_70_160",
  shortBranch: "short_30_69",
  longBranch: "long_161_220",
  underBranch: "under_30",
  overBranch: "over_220",
};

function s201(ctx: EvalContext): MetricResult {
  return evaluatePages(ctx, {
    metricId: "S2.01",
    reads: "meta",
    phrases: [
      ["within_20_65", "has a title of 20 to 65 characters", "have a title of 20 to 65 characters"],
      ["short_10_19", "has a title of 10 to 19 characters", "have a title of 10 to 19 characters"],
      ["long_66_90", "has a title of 66 to 90 characters", "have a title of 66 to 90 characters"],
      ["under_10", "has a title under 10 characters", "have a title under 10 characters"],
      ["over_90", "has a title over 90 characters", "have a title over 90 characters"],
      ["multiple", "has more than one title", "have more than one title"],
      ["empty", "has an empty title", "have an empty title"],
      ["missing", "has no title", "have no title"],
    ],
    score: (page) =>
      scoreTextTag(
        page,
        page.facts.head.titles,
        TITLE_BANDS,
        page.renderDependent
          ? { note: "The page is render-dependent, so JavaScript may replace this raw-HTML title." }
          : {},
      ),
  });
}

function s203(ctx: EvalContext): MetricResult {
  return evaluatePages(ctx, {
    metricId: "S2.03",
    reads: "meta",
    phrases: [
      ["within_70_160", "has a meta description of 70 to 160 characters", "have a meta description of 70 to 160 characters"],
      ["short_30_69", "has a meta description of 30 to 69 characters", "have a meta description of 30 to 69 characters"],
      ["long_161_220", "has a meta description of 161 to 220 characters", "have a meta description of 161 to 220 characters"],
      ["under_30", "has a meta description under 30 characters", "have a meta description under 30 characters"],
      ["over_220", "has a meta description over 220 characters", "have a meta description over 220 characters"],
      ["multiple", "has more than one meta description", "have more than one meta description"],
      ["empty", "has an empty meta description", "have an empty meta description"],
      ["missing", "has no meta description", "have no meta description"],
    ],
    score: (page) => scoreTextTag(page, page.facts.head.metaDescriptions, DESCRIPTION_BANDS),
  });
}

// ---------------------------------------------------------------------------
// Uniqueness across the sample (S2.02 titles, S2.04 descriptions)
// ---------------------------------------------------------------------------

function uniqueness(
  ctx: EvalContext,
  metricId: string,
  noun: "title" | "description",
  pick: (facts: PageFacts) => readonly TextEntry[],
): MetricResult {
  if (ctx.pages.length === 0) {
    return notObserved(metricId, "No pages were sampled, so there was nothing to compare.");
  }
  const readable = ctx.pages.map((page) => (hasFacts(page) ? observedPage(page, 1, {}) : unfetchedPage(page)));
  const coverage = aggregatePageScores(readable);
  const unread = ctx.pages.length - coverage.observed;
  const base: EvidenceRecord = { pagesSampled: ctx.pages.length, pagesUnread: unread };
  if (coverage.outcome !== "scored") {
    return resultFromPageScores(metricId, readable, { ...base, branch: "unobserved" }, "");
  }

  const groups = new Map<string, { text: string; urls: string[] }>();
  let withValue = 0;
  for (const page of ctx.pages) {
    if (!hasFacts(page)) continue;
    const entry = pick(page.facts).find((item) => item.text !== "");
    if (entry === undefined) continue;
    withValue += 1;
    const key = ctx.helpers.normaliseText(entry.text).toLowerCase();
    const group = groups.get(key);
    if (group === undefined) groups.set(key, { text: entry.text, urls: [page.url] });
    else group.urls.push(page.url);
  }

  if (withValue < 2) {
    const evidence = { ...base, pagesWithValue: withValue };
    return unread > 0
      ? notObserved(
          metricId,
          `Fewer than two pages with a ${noun} could be compared because ${unread} ${unread === 1 ? "page" : "pages"} could not be read.`,
          { ...evidence, branch: "NOT_OBSERVED" },
        )
      : notApplicable(
          metricId,
          `Fewer than two sampled pages have a ${noun}, so uniqueness cannot be compared.`,
          { ...evidence, branch: "NOT_APPLICABLE" },
        );
  }

  const distinct = groups.size;
  const duplicates = [...groups.values()].filter((group) => group.urls.length > 1);
  const evidence: EvidenceRecord = {
    ...base,
    branch: duplicates.length === 0 ? "all_unique" : "duplicates_found",
    pagesWithValue: withValue,
    distinct,
    duplicateGroups: duplicates.slice(0, 5).map((group) => ({
      text: ev(group.text),
      pages: group.urls.slice(0, 5).map(ev),
    })),
  };
  const explanation =
    duplicates.length === 0
      ? `All ${withValue} pages with a ${noun} carry a distinct ${noun}.`
      : `The ${withValue} pages with a ${noun} carry ${distinct} distinct ${distinct === 1 ? noun : `${noun}s`}.`;
  return resultFromScore(metricId, distinct / withValue, evidence, explanation);
}

function s202(ctx: EvalContext): MetricResult {
  return uniqueness(ctx, "S2.02", "title", (facts) => facts.head.titles);
}

function s204(ctx: EvalContext): MetricResult {
  return uniqueness(ctx, "S2.04", "description", (facts) => facts.head.metaDescriptions);
}

// ---------------------------------------------------------------------------
// S2.05 Single H1, S2.06 Heading hierarchy
// ---------------------------------------------------------------------------

function s205(ctx: EvalContext): MetricResult {
  return evaluatePages(ctx, {
    metricId: "S2.05",
    reads: "body",
    phrases: [
      ["single_h1", "has exactly one h1", "have exactly one h1"],
      ["multiple_h1", "has more than one h1", "have more than one h1"],
      ["no_h1", "has no h1", "have no h1"],
    ],
    score: (page) => {
      const h1s = page.facts.headings.filter((heading) => heading.level === 1);
      const filled = h1s.filter((heading) => heading.text.trim() !== "");
      const evidence: EvidenceRecord = {
        h1Count: filled.length,
        emptyH1Count: h1s.length - filled.length,
        firstH1: filled.length > 0 ? ev(filled[0].text) : null,
      };
      if (filled.length === 1) return observedPage(page, 1, { ...evidence, branch: "single_h1" });
      if (filled.length > 1) return observedPage(page, 0.5, { ...evidence, branch: "multiple_h1" });
      return observedPage(page, 0, { ...evidence, branch: "no_h1" });
    },
  });
}

const LONG_PAGE_WORDS = 300;
const MAX_LEVELS_SHOWN = 40;
const MAX_SKIP_EXAMPLES = 6;

function s206(ctx: EvalContext): MetricResult {
  return evaluatePages(ctx, {
    metricId: "S2.06",
    reads: "body",
    notApplicableReason: "Every sampled page uses a language where word counts do not apply, so heading depth is not judged.",
    phrases: [
      ["ordered", "has headings in order", "have headings in order"],
      ["skips_1_2", "skips one or two heading levels", "skip one or two heading levels"],
      ["skips_3_plus", "skips three or more heading levels", "skip three or more heading levels"],
      ["no_h2_long_page", "runs past 300 words without an h2", "run past 300 words without an h2"],
    ],
    score: (page) => {
      const { facts } = page;
      if (!facts.wordCountApplicable) {
        return notApplicablePage(
          page,
          "NOT_APPLICABLE",
          "The page language does not use space-separated words, so the 300-word clause cannot be applied.",
        );
      }
      const levels = facts.headings.filter((heading) => heading.inMain).map((heading) => heading.level);
      const skipExamples: string[] = [];
      let skipCount = 0;
      for (let i = 1; i < levels.length; i++) {
        if (levels[i] - levels[i - 1] <= 1) continue;
        skipCount += 1;
        if (skipExamples.length < MAX_SKIP_EXAMPLES) skipExamples.push(`h${levels[i - 1]}>h${levels[i]}`);
      }
      const hasH2 = facts.headings.some((heading) => heading.level === 2);
      const words = facts.main.wordCount;
      const evidence: EvidenceRecord = {
        skipCount,
        skips: skipExamples,
        levels: levels.slice(0, MAX_LEVELS_SHOWN).map((level) => `h${level}`).join(" "),
        headingCount: levels.length,
        mainWordCount: words,
        hasH2,
      };
      if (skipCount >= 3) return observedPage(page, 0, { ...evidence, branch: "skips_3_plus" });
      if (skipCount >= 1) return observedPage(page, 0.5, { ...evidence, branch: "skips_1_2" });
      if (words >= LONG_PAGE_WORDS && !hasH2) return observedPage(page, 0, { ...evidence, branch: "no_h2_long_page" });
      return observedPage(page, 1, { ...evidence, branch: "ordered" });
    },
  });
}

// ---------------------------------------------------------------------------
// S2.07 Image alt attributes
// ---------------------------------------------------------------------------

function s207(ctx: EvalContext): MetricResult {
  return evaluatePages(ctx, {
    metricId: "S2.07",
    reads: "body",
    notApplicableReason: "The sampled pages contain no content images, so alt attributes are not judged.",
    phrases: [
      ["all_have_alt", "gives every content image an alt attribute", "give every content image an alt attribute"],
      ["some_missing_alt", "leaves some content images without an alt attribute", "leave some content images without an alt attribute"],
      ["none_have_alt", "gives no content image an alt attribute", "give no content image an alt attribute"],
    ],
    score: (page) => {
      const content = page.facts.images.filter((image) => image.isContent);
      if (content.length === 0) {
        return notApplicablePage(page, "NOT_APPLICABLE", "The page has no content images.");
      }
      const missing = content.filter((image) => !image.hasAlt);
      const withAlt = content.length - missing.length;
      const evidence: EvidenceRecord = {
        contentImages: content.length,
        withAlt,
        missingAlt: missing.slice(0, 3).map((image) => ev(image.src)),
        decorativeEmptyAlt: content.filter((image) => image.hasAlt && image.alt === "").length,
      };
      const branch = withAlt === content.length ? "all_have_alt" : withAlt === 0 ? "none_have_alt" : "some_missing_alt";
      return observedPage(page, withAlt / content.length, { ...evidence, branch });
    },
  });
}

// ---------------------------------------------------------------------------
// S2.08 Language declared
// ---------------------------------------------------------------------------

const LANG_PATTERN = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

function s208(ctx: EvalContext): MetricResult {
  return evaluatePages(ctx, {
    metricId: "S2.08",
    reads: "meta",
    phrases: [
      ["valid_lang", "declares a valid language", "declare a valid language"],
      ["invalid_lang", "declares an invalid language code", "declare an invalid language code"],
      ["missing_lang", "declares no language", "declare no language"],
    ],
    score: (page) => {
      const lang = page.facts.head.htmlLang;
      if (lang === null || lang === "") return observedPage(page, 0, { lang, branch: "missing_lang" });
      return LANG_PATTERN.test(lang)
        ? observedPage(page, 1, { lang: ev(lang), branch: "valid_lang" })
        : observedPage(page, 0, { lang: ev(lang), branch: "invalid_lang" });
    },
  });
}

// ---------------------------------------------------------------------------
// S2.09 Share-preview tags
// ---------------------------------------------------------------------------

function isAbsoluteHttps(value: string): boolean {
  if (!/^https:\/\//i.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname !== "";
  } catch {
    return false;
  }
}

function s209(ctx: EvalContext): MetricResult {
  return evaluatePages(ctx, {
    metricId: "S2.09",
    reads: "meta",
    phrases: [
      ["all_three", "has all three share-preview tags", "have all three share-preview tags"],
      ["two_of_three", "has two of the three share-preview tags", "have two of the three share-preview tags"],
      ["one_of_three", "has one of the three share-preview tags", "have one of the three share-preview tags"],
      ["none", "has none of the share-preview tags", "have none of the share-preview tags"],
    ],
    score: (page) => {
      const tags = page.facts.head.openGraph;
      const filled = (key: string): boolean => tags.some((tag) => tag.key === key && tag.content !== "");
      const images = tags.filter((tag) => tag.key === "og:image" && tag.content !== "");
      const present: string[] = [];
      const missing: string[] = [];
      for (const key of ["og:title", "og:description"]) (filled(key) ? present : missing).push(key);
      const imageOk = images.some((tag) => isAbsoluteHttps(tag.content));
      (imageOk ? present : missing).push("og:image");
      const evidence: EvidenceRecord = {
        present,
        missing,
        imageIssue:
          imageOk || images.length === 0 ? null : "og:image is present but is not an absolute https address",
        imageValue: images.length > 0 ? ev(images[0].content) : null,
      };
      const branch =
        present.length === 3 ? "all_three" : present.length === 2 ? "two_of_three" : present.length === 1 ? "one_of_three" : "none";
      return observedPage(page, present.length / 3, { ...evidence, branch });
    },
  });
}

export function evaluateS2(ctx: EvalContext): MetricResult[] {
  return [
    guard("S2.01", () => s201(ctx)),
    guard("S2.02", () => s202(ctx)),
    guard("S2.03", () => s203(ctx)),
    guard("S2.04", () => s204(ctx)),
    guard("S2.05", () => s205(ctx)),
    guard("S2.06", () => s206(ctx)),
    guard("S2.07", () => s207(ctx)),
    guard("S2.08", () => s208(ctx)),
    guard("S2.09", () => s209(ctx)),
  ];
}

