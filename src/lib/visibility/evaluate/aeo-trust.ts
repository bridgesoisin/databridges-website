import {
  ABOUT_PATTERN,
  CONTACT_PATTERN,
  PRIVACY_PATTERN,
  SHARE_LINK_PATTERNS,
} from "@/lib/visibility/lists";
import { notObserved, resultFromScore } from "@/lib/visibility/scoring";
import {
  clip,
  finishPages,
  gateHome,
  isNonEmptyString,
  jsonLdNodes,
  pagesInScope,
  scorePage,
  type BodyOutcome,
} from "@/lib/visibility/evaluate/aeo-answers";
import { normaliseText } from "@/lib/visibility/text";
import type {
  EvalContext,
  EvalPage,
  EvidenceRecord,
  JsonLdNode,
  LinkFact,
  MetricResult,
  PageFacts,
} from "@/lib/visibility/types";

const DAY_MS = 86_400_000;

function pathOf(url: string): string | null {
  try {
    return new URL(url).pathname;
  } catch {
    return null;
  }
}

function matchesPath(url: string, pattern: RegExp): boolean {
  const path = pathOf(url);
  return path !== null && pattern.test(path);
}

function sameSiteLinks(facts: PageFacts): LinkFact[] {
  return facts.links.filter((link) => link.sameSite && !link.fragmentOnly && link.url !== null);
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

// ---------------------------------------------------------------------------
// A4.01 About page discoverable
// ---------------------------------------------------------------------------

type Verdict = "ok" | "failed" | "unobserved";

// 2xx loads. 401, 403, 429, redirects left unresolved and missing statuses are unobserved, never failures.
function verdictOf(status: number | null): Verdict {
  if (status === null) return "unobserved";
  if (status >= 200 && status < 300) return "ok";
  if (status === 401 || status === 403 || status === 429) return "unobserved";
  if (status >= 400) return "failed";
  return "unobserved";
}

type AboutCandidate = {
  url: string;
  status: number | null;
  source: "sampled_page" | "link_check" | "not_checked";
  verdict: Verdict;
};

function aboutEvidence(entry: AboutCandidate): EvidenceRecord {
  return { url: clip(entry.url), status: entry.status, source: entry.source, verdict: entry.verdict };
}

function evaluateA401(ctx: EvalContext): MetricResult {
  const id = "A4.01";
  const gate = gateHome(ctx, id);
  if (!gate.ok) return gate.result;
  const { page, facts } = gate;

  const urls: string[] = [];
  const seenUrls = new Set<string>();
  for (const link of sameSiteLinks(facts)) {
    const url = link.url as string;
    if (seenUrls.has(url) || !matchesPath(url, ABOUT_PATTERN)) continue;
    seenUrls.add(url);
    urls.push(url);
  }

  const lookup = (url: string): AboutCandidate => {
    const sampled = ctx.pages.find((other) => other !== page && (other.url === url || other.finalUrl === url));
    if (sampled !== undefined) {
      const status = sampled.record.status;
      return { url, status, source: "sampled_page", verdict: verdictOf(status) };
    }
    const check = ctx.snapshot.linkChecks.find((entry) => entry.url === url);
    if (check !== undefined) {
      return { url, status: check.status, source: "link_check", verdict: verdictOf(check.status) };
    }
    return { url, status: null, source: "not_checked", verdict: "unobserved" };
  };
  const candidates = urls.map(lookup);
  const listed = candidates.slice(0, 5).map(aboutEvidence);

  const working = candidates.find((entry) => entry.verdict === "ok");
  if (working !== undefined) {
    return resultFromScore(
      id,
      1,
      { url: page.url, branch: "homepage_links_to_working_about", aboutLinks: listed },
      `The homepage links to ${clip(working.url, 80)}, which returned HTTP ${working.status}.`,
    );
  }

  const unverified = candidates.filter((entry) => entry.verdict === "unobserved");
  if (unverified.length > 0) {
    const reason = "The homepage links to an About URL whose status could not be checked, so whether it loads is unknown.";
    return notObserved(id, reason, {
      url: page.url,
      branch: "about_link_unverified",
      reason,
      aboutLinks: listed,
    });
  }

  const failed = new Set(candidates.map((entry) => entry.url));
  const fromSitemap = ctx.sitemap.urls.filter((url) => !failed.has(url) && matchesPath(url, ABOUT_PATTERN));
  const fromSample = ctx.pages.filter((other) => {
    const status = other.record.status;
    return (
      other !== page &&
      status !== null &&
      status >= 200 &&
      status < 300 &&
      !failed.has(other.url) &&
      !failed.has(other.finalUrl) &&
      matchesPath(other.url, ABOUT_PATTERN)
    );
  });
  const evidence: EvidenceRecord = {
    url: page.url,
    branch: "",
    aboutLinks: listed,
    sitemapMatches: fromSitemap.slice(0, 3).map((url) => clip(url)),
    sampledMatches: fromSample.slice(0, 3).map((other: EvalPage) => clip(other.url)),
  };
  if (fromSitemap.length > 0 || fromSample.length > 0) {
    return resultFromScore(
      id,
      0.5,
      { ...evidence, branch: "about_url_only_in_sitemap_or_sample" },
      "No working About link was found on the homepage, but an About URL appears in the sitemap or among the sampled pages.",
    );
  }
  return resultFromScore(
    id,
    0,
    { ...evidence, branch: candidates.length > 0 ? "about_link_failed" : "no_about_url" },
    "No working About page was found from the homepage, the sitemap or the sampled pages.",
  );
}

// ---------------------------------------------------------------------------
// A4.02 Contact information visible
// ---------------------------------------------------------------------------

function hasContent(value: unknown, depth = 0): boolean {
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "number") return Number.isFinite(value);
  if (depth >= 4) return false;
  if (Array.isArray(value)) return value.some((item) => hasContent(item, depth + 1));
  if (typeof value === "object" && value !== null) {
    return Object.entries(value as Record<string, unknown>).some(
      ([key, item]) => !key.startsWith("@") && hasContent(item, depth + 1),
    );
  }
  return false;
}

function anyNodeHas(nodes: readonly JsonLdNode[], key: string): boolean {
  return nodes.some((node) => key in node.properties && hasContent(node.properties[key]));
}

const ADDRESS_MIN_CHARS = 10;

function evaluateA402(ctx: EvalContext): MetricResult {
  const id = "A4.02";
  const gate = gateHome(ctx, id);
  if (!gate.ok) return gate.result;
  const { page, facts } = gate;
  const nodes = jsonLdNodes(facts);
  const contact = facts.contact;

  const email = contact.mailto.length > 0 || contact.emailsInText > 0;
  const jsonLdPhone = anyNodeHas(nodes, "telephone");
  const phone = contact.tel.length > 0 || jsonLdPhone;
  const longestAddress = contact.addressTextLengths.reduce((max, length) => Math.max(max, length), 0);
  const jsonLdAddress = anyNodeHas(nodes, "address");
  const address = longestAddress >= ADDRESS_MIN_CHARS || jsonLdAddress;
  const contactLink = sameSiteLinks(facts).find((link) => matchesPath(link.url as string, CONTACT_PATTERN));

  const signals = [email, phone, address, contactLink !== undefined].filter(Boolean).length;
  const score = signals === 0 ? 0 : signals === 1 ? 0.5 : signals === 2 ? 0.75 : 1;
  return resultFromScore(
    id,
    score,
    {
      url: page.url,
      branch: `${signals}_signals`,
      email: { found: email, mailtoLinks: contact.mailto.length, emailsInText: contact.emailsInText },
      phone: { found: phone, telLinks: contact.tel.length, jsonLdTelephone: jsonLdPhone },
      address: { found: address, longestAddressElementChars: longestAddress, jsonLdAddress },
      contactLink: { found: contactLink !== undefined, url: contactLink === undefined ? null : clip(contactLink.url as string) },
    },
    `The homepage shows ${signals} of 4 contact signals (email, phone, address, contact-page link).`,
  );
}

// ---------------------------------------------------------------------------
// A4.03 Author attribution
// ---------------------------------------------------------------------------

function authorNameOf(value: unknown, nodes: readonly JsonLdNode[], depth: number): string | null {
  if (depth > 3) return null;
  if (isNonEmptyString(value)) return normaliseText(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const name = authorNameOf(item, nodes, depth + 1);
      if (name !== null) return name;
    }
    return null;
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    if (isNonEmptyString(record.name)) return normaliseText(record.name);
    const id = record["@id"];
    if (isNonEmptyString(id)) {
      const target = nodes.find(
        (node) => !node.isReference && node.id === id && isNonEmptyString(node.properties.name),
      );
      if (target !== undefined) return normaliseText(target.properties.name as string);
    }
  }
  return null;
}

function jsonLdAuthorName(facts: PageFacts): string | null {
  const nodes = jsonLdNodes(facts);
  for (const node of nodes) {
    if (!("author" in node.properties)) continue;
    const name = authorNameOf(node.properties.author, nodes, 0);
    if (name !== null) return name;
  }
  return null;
}

function evaluateA403(ctx: EvalContext): MetricResult {
  const articles = pagesInScope(ctx, "AP");
  const perPage = articles.map((page) =>
    scorePage(page, {
      body: (facts): BodyOutcome => {
        const byline = facts.byline;
        const signals: string[] = [];
        if (byline.relAuthor) signals.push("rel=author");
        if (byline.itempropAuthor) signals.push("itemprop=author");
        if (byline.classMatch) signals.push("byline or author class");
        if (byline.byTextInFirst400) signals.push("By in the first 400 characters");
        const author = jsonLdAuthorName(facts);
        const found = signals.length > 0 || author !== null;
        return {
          kind: "score",
          score: found ? 1 : 0,
          branch: signals.length > 0 ? "visible_byline" : author !== null ? "json_ld_author_name" : "no_author_signal",
          evidence: {
            visibleSignals: signals,
            bylineSample: byline.sample === null ? null : clip(byline.sample, 100),
            jsonLdAuthor: author === null ? null : clip(author, 80),
          },
        };
      },
    }),
  );
  return finishPages("A4.03", perPage, "author attribution", "No article page was sampled.");
}

// ---------------------------------------------------------------------------
// A4.04 Dates on articles
// ---------------------------------------------------------------------------

function itempropTokens(itemprop: string | null): string[] {
  return itemprop === null ? [] : itemprop.toLowerCase().split(/\s+/).filter((token) => token !== "");
}

function evaluateA404(ctx: EvalContext): MetricResult {
  const limit = ctx.now.getTime() + DAY_MS;
  // Plan 4.2.5: ISO 8601 or W3C datetime only, and nothing later than scan time plus one day.
  const usable = (raw: unknown): string | null => {
    if (typeof raw !== "string") return null;
    const iso = ctx.helpers.parseIsoDate(raw);
    return iso !== null && Date.parse(iso) <= limit ? iso : null;
  };
  const jsonLdDate = (nodes: readonly JsonLdNode[], key: string): string | null => {
    for (const node of nodes) {
      const value = node.properties[key];
      const values: unknown[] = Array.isArray(value) ? value : [value];
      for (const item of values) {
        const iso = usable(item);
        if (iso !== null) return iso;
      }
    }
    return null;
  };

  const perPage = pagesInScope(ctx, "AP").map((page) =>
    scorePage(page, {
      body: (facts): BodyOutcome => {
        const nodes = jsonLdNodes(facts);
        let published: { iso: string; source: string } | null = null;
        let modified: { iso: string; source: string } | null = null;

        const ldPublished = jsonLdDate(nodes, "datePublished");
        if (ldPublished !== null) published = { iso: ldPublished, source: "json-ld datePublished" };
        const ldModified = jsonLdDate(nodes, "dateModified");
        if (ldModified !== null) modified = { iso: ldModified, source: "json-ld dateModified" };

        for (const time of facts.times) {
          if (time.parsed === null || Date.parse(time.parsed) > limit) continue;
          const tokens = itempropTokens(time.itemprop);
          if (tokens.includes("datemodified")) {
            if (modified === null) modified = { iso: time.parsed, source: "time itemprop dateModified" };
          } else if (tokens.includes("datepublished") || time.location === "byline" || time.location === "header") {
            if (published === null) {
              published = {
                iso: time.parsed,
                source: tokens.includes("datepublished") ? "time itemprop datePublished" : `time in ${time.location}`,
              };
            }
          }
        }

        const score = (published !== null ? 0.5 : 0) + (modified !== null ? 0.5 : 0);
        return {
          kind: "score",
          score,
          branch:
            published !== null && modified !== null
              ? "published_and_modified"
              : published !== null
                ? "published_only"
                : modified !== null
                  ? "modified_only"
                  : "no_dates",
          evidence: {
            published: published === null ? null : { date: published.iso, source: published.source },
            modified: modified === null ? null : { date: modified.iso, source: modified.source },
          },
        };
      },
    }),
  );
  return finishPages("A4.04", perPage, "published and modified dates", "No article page was sampled.");
}

// ---------------------------------------------------------------------------
// A4.05 Freshness
// ---------------------------------------------------------------------------

type DateCandidate = { time: number; iso: string; source: string; url: string };

const STAMP_MIN_URLS = 5;

function evaluateA405(ctx: EvalContext): MetricResult {
  const id = "A4.05";
  const limit = ctx.now.getTime() + DAY_MS;
  const candidates: DateCandidate[] = [];
  const counts = { jsonLdDateModified: 0, jsonLdDatePublished: 0, timeElements: 0, sitemapLastmod: 0 };
  let ignoredFuture = 0;
  let ignoredInvalid = 0;

  const consider = (iso: string | null, source: string, url: string): boolean => {
    if (iso === null) {
      ignoredInvalid++;
      return false;
    }
    const time = Date.parse(iso);
    if (time > limit) {
      ignoredFuture++;
      return false;
    }
    candidates.push({ time, iso, source, url });
    return true;
  };

  for (const key of ["dateModified", "datePublished"] as const) {
    for (const ref of ctx.jsonLd.nodes) {
      const value = ref.node.properties[key];
      const values: unknown[] = Array.isArray(value) ? value : [value];
      for (const item of values) {
        if (typeof item !== "string") continue;
        if (consider(ctx.helpers.parseIsoDate(item), `json-ld ${key}`, ref.pageUrl)) {
          if (key === "dateModified") counts.jsonLdDateModified++;
          else counts.jsonLdDatePublished++;
        }
      }
    }
  }
  for (const page of ctx.pages) {
    if (page.facts === null) continue;
    for (const time of page.facts.times) {
      if (consider(time.parsed, "time element", page.url)) counts.timeElements++;
    }
  }

  const rawLastmods: string[] = [];
  const sitemapEntries: { loc: string; iso: string | null; raw: string }[] = [];
  for (const document of ctx.sitemap.documents) {
    if (document.kind !== "urlset") continue;
    for (const entry of document.entries) {
      if (entry.lastmod === null || !ctx.helpers.sameSite(entry.loc, ctx.snapshot.homeUrl)) continue;
      const raw = entry.lastmod.trim();
      rawLastmods.push(raw);
      sitemapEntries.push({ loc: entry.loc, iso: entry.lastmodParsed, raw });
    }
  }
  const distinct = new Set(rawLastmods).size;
  const buildStamp = rawLastmods.length >= STAMP_MIN_URLS && distinct === 1;
  if (!buildStamp) {
    for (const entry of sitemapEntries) {
      if (consider(entry.iso, "sitemap lastmod", entry.loc)) counts.sitemapLastmod++;
    }
  }

  const sitemapEvidence: EvidenceRecord = {
    documents: ctx.sitemap.documents
      .filter((document) => document.kind === "urlset")
      .slice(0, 3)
      .map((document) => clip(document.url)),
    lastmodValues: rawLastmods.length,
    distinctValues: distinct,
    ignoredAsBuildStamp: buildStamp,
  };
  if (candidates.length === 0) {
    const reason = buildStamp
      ? "No valid date was found in structured data or time elements, and the identical sitemap lastmod values were ignored as a build-time stamp."
      : "No valid date was found in the sitemap, the structured data or the time elements.";
    return notObserved(id, reason, {
      branch: "no_valid_date",
      reason,
      sitemap: sitemapEvidence,
      ignoredInvalid,
      ignoredFuture,
    });
  }

  let latest = candidates[0];
  for (const candidate of candidates) {
    if (candidate.time > latest.time) latest = candidate;
  }
  const ageDays = Math.floor((ctx.now.getTime() - latest.time) / DAY_MS);
  const score = ageDays <= 180 ? 1 : ageDays <= 365 ? 0.5 : 0;
  return resultFromScore(
    id,
    score,
    {
      branch: score === 1 ? "age_180_days_or_less" : score === 0.5 ? "age_181_to_365_days" : "age_over_365_days",
      latest: latest.iso,
      latestSource: latest.source,
      latestUrl: clip(latest.url),
      scanTime: ctx.now.toISOString(),
      ageDays,
      validDates: counts,
      sitemap: sitemapEvidence,
      ignoredInvalid,
      ignoredFuture,
    },
    `The newest valid date is ${latest.iso.slice(0, 10)} (${latest.source}), ${ageDays} ${plural(ageDays, "day", "days")} before the scan.`,
  );
}

// ---------------------------------------------------------------------------
// A4.06 Privacy policy linked
// ---------------------------------------------------------------------------

function evaluateA406(ctx: EvalContext): MetricResult {
  const id = "A4.06";
  const gate = gateHome(ctx, id);
  if (!gate.ok) return gate.result;
  const { page, facts } = gate;
  const link = sameSiteLinks(facts).find((entry) => matchesPath(entry.url as string, PRIVACY_PATTERN));
  if (link === undefined) {
    return resultFromScore(
      id,
      0,
      { url: page.url, branch: "no_privacy_link", sameSiteLinks: sameSiteLinks(facts).length },
      "The homepage has no link to a page whose address looks like a privacy policy.",
    );
  }
  return resultFromScore(
    id,
    1,
    { url: page.url, branch: "privacy_link_found", link: clip(link.url as string), location: link.location },
    `The homepage links to ${clip(link.url as string, 80)}, which looks like a privacy policy address.`,
  );
}

// ---------------------------------------------------------------------------
// A4.07 External references
// ---------------------------------------------------------------------------

function evaluateA407(ctx: EvalContext): MetricResult {
  const perPage = pagesInScope(ctx, "KO").map((page) =>
    scorePage(page, {
      body: (facts): BodyOutcome => {
        const mainLinks = facts.links.filter((link) => link.location === "main");
        let excludedRel = 0;
        let excludedShare = 0;
        const outbound: LinkFact[] = [];
        for (const link of mainLinks) {
          if (link.url === null || link.sameSite) continue;
          if (link.rel.includes("sponsored") || link.rel.includes("ugc")) {
            excludedRel++;
            continue;
          }
          if (SHARE_LINK_PATTERNS.some((pattern) => pattern.test(link.url as string))) {
            excludedShare++;
            continue;
          }
          outbound.push(link);
        }
        return {
          kind: "score",
          score: outbound.length > 0 ? 1 : 0,
          branch: outbound.length > 0 ? "outbound_link_in_main" : "no_outbound_link_in_main",
          evidence: {
            mainLinks: mainLinks.length,
            outboundLinks: outbound.length,
            firstOutbound: outbound.length > 0 ? clip(outbound[0].url as string) : null,
            excludedSponsoredOrUgc: excludedRel,
            excludedShare,
          },
        };
      },
    }),
  );
  return finishPages(
    "A4.07",
    perPage,
    "outbound references",
    "No services, FAQ, article or other knowledge page was sampled.",
  );
}

// ---------------------------------------------------------------------------
// Category entry point
// ---------------------------------------------------------------------------

export function evaluateA4(ctx: EvalContext): MetricResult[] {
  return [
    evaluateA401(ctx),
    evaluateA402(ctx),
    evaluateA403(ctx),
    evaluateA404(ctx),
    evaluateA405(ctx),
    evaluateA406(ctx),
    evaluateA407(ctx),
  ];
}
