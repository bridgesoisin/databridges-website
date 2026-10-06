import { ARTICLE_SCHEMA_TYPES, ORG_TYPES, SERVICE_SCHEMA_TYPES } from "@/lib/visibility/lists";
import {
  finishPageMetric,
  observedScores,
  pageScores,
  plural,
  scoredPage,
  skippedPage,
  unreadablePage,
} from "@/lib/visibility/evaluate/aeo-access";
import {
  notApplicable,
  notObserved,
  resultFromScore,
  scanError,
} from "@/lib/visibility/scoring";
import { truncateEvidence } from "@/lib/visibility/text";
import type {
  EvalContext,
  EvalPage,
  EvidenceRecord,
  JsonLdNode,
  JsonLdNodeRef,
  MetricResult,
  PageFacts,
} from "@/lib/visibility/types";

type Props = Record<string, unknown>;

const MAX_LISTED = 5;
const MAX_QUESTIONS_CHECKED = 100;
const MAX_SAMEAS_READ = 1000;
const ORGANISATION_POINTS = 4;
const BREADCRUMB_MIN_ITEMS = 2;
const BREADCRUMB_MIN_DEPTH = 2;
const PERSON_TYPES: ReadonlySet<string> = new Set(["Person"]);
const ABOUT_SCHEMA_TYPES: ReadonlySet<string> = new Set(["AboutPage", "ProfilePage", "Person"]);
const CONTACT_PROPERTIES = ["telephone", "email", "address", "contactPoint"] as const;

// ---------------------------------------------------------------------------
// JSON-LD helpers
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Props {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return value === undefined || value === null ? [] : [value];
}

function textOf(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = textOf(item);
      if (text !== null) return text;
    }
    return null;
  }
  if (isRecord(value) && typeof value["@value"] === "string") return textOf(value["@value"]);
  return null;
}

function hasContent(value: unknown): boolean {
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.some(hasContent);
  if (isRecord(value)) {
    return Object.keys(value).some(
      (key) => key !== "@type" && key !== "@context" && hasContent(value[key])
    );
  }
  return false;
}

type Graph = { nodes: JsonLdNode[]; byId: Map<string, JsonLdNode> };

function graphOf(facts: PageFacts): Graph {
  const nodes: JsonLdNode[] = [];
  const byId = new Map<string, JsonLdNode>();
  for (const block of facts.jsonLd.blocks) {
    for (const node of block.nodes) {
      nodes.push(node);
      if (!node.isReference && node.id !== null && !byId.has(node.id)) byId.set(node.id, node);
    }
  }
  return { nodes, byId };
}

function hasAnyType(node: JsonLdNode, types: ReadonlySet<string>): boolean {
  return node.types.some((type) => types.has(type));
}

function shallowest(
  nodes: readonly JsonLdNode[],
  accept: (node: JsonLdNode) => boolean
): JsonLdNode | null {
  let best: JsonLdNode | null = null;
  for (const node of nodes) {
    if (node.isReference || !accept(node)) continue;
    if (best === null || node.depth < best.depth) best = node;
  }
  return best;
}

function hasName(node: JsonLdNode): boolean {
  return textOf(node.properties.name) !== null;
}

// First Organization-family node, shallowest then earliest; a Person node stands in for a sole trader.
function organisationNode(nodes: readonly JsonLdNode[], requireName: boolean): JsonLdNode | null {
  const named = (node: JsonLdNode): boolean => !requireName || hasName(node);
  return (
    shallowest(nodes, (node) => hasAnyType(node, ORG_TYPES) && named(node)) ??
    shallowest(nodes, (node) => hasAnyType(node, PERSON_TYPES) && named(node))
  );
}

function resolveObjects(value: unknown, graph: Graph): Props[] {
  const out: Props[] = [];
  for (const item of asArray(value)) {
    if (!isRecord(item)) continue;
    const keys = Object.keys(item);
    const id = item["@id"];
    if (keys.length === 1 && typeof id === "string") {
      const target = graph.byId.get(id);
      if (target !== undefined) out.push(target.properties);
      continue;
    }
    out.push(item);
  }
  return out;
}

// Blocks the scanner could not read (over a size or depth cap, or beyond the block cap) may hold what is "missing".
function unreadableJsonLd(facts: PageFacts): number {
  const capped = facts.jsonLd.blocks.filter(
    (block) => block.reason === "too_large" || block.reason === "too_deep"
  ).length;
  return capped + Math.max(0, facts.jsonLd.blocksSeen - facts.jsonLd.blocks.length);
}

function listed(values: readonly string[]): string[] {
  return values.slice(0, MAX_LISTED).map((value) => truncateEvidence(value));
}

function homeReader(
  ctx: EvalContext,
  metricId: string,
  read: (home: EvalPage, facts: PageFacts) => MetricResult
): MetricResult {
  const home = ctx.home;
  if (home === null) {
    return notObserved(metricId, "The homepage was not fetched, so its structured data could not be read.");
  }
  if (home.facts === null) {
    const outcome = unreadablePage(home);
    const reason = "The homepage could not be fetched or parsed, so its structured data could not be read.";
    const evidence = { url: truncateEvidence(home.url), ...outcome.evidence };
    return outcome.status === "scan_error"
      ? scanError(metricId, reason, evidence)
      : notObserved(metricId, reason, evidence);
  }
  return read(home, home.facts);
}

// ---------------------------------------------------------------------------
// A2.01 Valid JSON-LD
// ---------------------------------------------------------------------------

function evaluateA201(ctx: EvalContext): MetricResult {
  const perPage = pageScores(ctx.pages, (_page, facts) => {
    const blocks = facts.jsonLd.blocks;
    const isValid = (block: (typeof blocks)[number]): boolean =>
      block.parsedOk && block.schemaOrgContext && block.hasTypeOrGraph;
    const isCapped = (block: (typeof blocks)[number]): boolean =>
      block.reason === "too_large" || block.reason === "too_deep";
    const valid = blocks.filter(isValid).length;
    const invalid = blocks.filter((block) => !isValid(block) && !isCapped(block)).length;
    const unreadable = unreadableJsonLd(facts);
    const evidence = {
      blocks: blocks.length,
      blocksSeen: facts.jsonLd.blocksSeen,
      valid,
      invalid,
      unreadable,
      microdataOrRdfa: facts.microdataOrRdfa,
    };
    if (valid > 0) {
      return invalid === 0
        ? scoredPage(1, { ...evidence, branch: "all_blocks_valid" })
        : scoredPage(0.5, { ...evidence, branch: "some_blocks_invalid" });
    }
    if (facts.microdataOrRdfa) {
      return scoredPage(0.5, { ...evidence, branch: "microdata_or_rdfa_only" });
    }
    if (unreadable > 0) {
      return skippedPage("not_observed", { ...evidence, branch: "json_ld_beyond_scanner_limits" });
    }
    return scoredPage(0, {
      ...evidence,
      branch: blocks.length === 0 ? "no_json_ld" : "no_valid_block",
    });
  });
  const scores = observedScores(perPage);
  const full = scores.filter((s) => s === 1).length;
  const partial = scores.filter((s) => s === 0.5).length;
  return finishPageMetric(
    ctx,
    "A2.01",
    perPage,
    `${full} of ${scores.length} observed ${plural(scores.length, "page", "pages")} ${plural(full, "has", "have")} only valid JSON-LD, and ${partial} ${plural(partial, "has", "have")} mixed or microdata-only markup.`
  );
}

// ---------------------------------------------------------------------------
// A2.02 Organisation identity
// ---------------------------------------------------------------------------

function evaluateA202(ctx: EvalContext): MetricResult {
  return homeReader(ctx, "A2.02", (home, facts) => {
    const graph = graphOf(facts);
    const url = truncateEvidence(home.url);
    const node = organisationNode(graph.nodes, false);
    if (node === null) {
      if (unreadableJsonLd(facts) > 0) {
        return notObserved(
          "A2.02",
          "The homepage has structured data that the scanner could not read, so it could not look for an organisation node.",
          { url, branch: "json_ld_beyond_scanner_limits" }
        );
      }
      return resultFromScore(
        "A2.02",
        0,
        { url, branch: "no_organisation_node", jsonLdNodes: graph.nodes.length },
        "The homepage structured data has no Organization or Person node, so no identity details were found."
      );
    }
    const props = node.properties;
    const present = {
      name: textOf(props.name) !== null,
      url: textOf(props.url) !== null,
      logoOrImage: hasContent(props.logo) || hasContent(props.image),
      contact: CONTACT_PROPERTIES.some((key) => hasContent(props[key])),
      description: textOf(props.description) !== null,
    };
    const total = Object.values(present).filter(Boolean).length * ORGANISATION_POINTS;
    const max = Object.keys(present).length * ORGANISATION_POINTS;
    return resultFromScore(
      "A2.02",
      total / max,
      {
        url,
        branch: "organisation_node_scored",
        nodeType: truncateEvidence(node.types.join(", ")),
        nodePath: truncateEvidence(node.path),
        present,
        points: total,
        of: max,
      },
      `The homepage organisation node earns ${total} of ${max} identity points.`
    );
  });
}

// ---------------------------------------------------------------------------
// A2.03 Profile links (sameAs)
// ---------------------------------------------------------------------------

function evaluateA203(ctx: EvalContext): MetricResult {
  return homeReader(ctx, "A2.03", (home, facts) => {
    const graph = graphOf(facts);
    const url = truncateEvidence(home.url);
    const raw: string[] = [];
    for (const node of graph.nodes) {
      for (const value of asArray(node.properties.sameAs)) {
        if (typeof value === "string" && raw.length < MAX_SAMEAS_READ) raw.push(value.trim());
      }
    }
    const seen = new Set<string>();
    const hosts: string[] = [];
    const ignored = { notAbsolute: 0, notHttps: 0, sameSite: 0, duplicate: 0 };
    for (const value of raw) {
      const normalised = ctx.helpers.normaliseUrl(value);
      if (normalised === null) ignored.notAbsolute++;
      else if (!normalised.startsWith("https://")) ignored.notHttps++;
      else if (ctx.helpers.sameSite(normalised, home.finalUrl)) ignored.sameSite++;
      else if (seen.has(normalised)) ignored.duplicate++;
      else {
        seen.add(normalised);
        hosts.push(ctx.helpers.siteHost(normalised));
      }
    }
    const count = seen.size;
    const evidence = { url, distinctProfiles: count, hosts: listed(hosts), ignored };
    if (count >= 2) {
      return resultFromScore("A2.03", 1, { ...evidence, branch: "two_or_more_profiles" }, `The homepage structured data links to ${count} profiles on other sites.`);
    }
    if (count === 1) {
      return resultFromScore("A2.03", 0.5, { ...evidence, branch: "one_profile" }, "The homepage structured data links to one profile on another site.");
    }
    if (unreadableJsonLd(facts) > 0) {
      return notObserved(
        "A2.03",
        "The homepage has structured data that the scanner could not read, so it could not look for sameAs links.",
        { ...evidence, branch: "json_ld_beyond_scanner_limits" }
      );
    }
    return resultFromScore("A2.03", 0, { ...evidence, branch: "no_profiles" }, "The homepage structured data has no sameAs link to a profile on another site.");
  });
}

// ---------------------------------------------------------------------------
// A2.04 Identity graph coherence
// ---------------------------------------------------------------------------

function evaluateA204(ctx: EvalContext): MetricResult {
  if (!ctx.pages.some((page) => page.facts !== null)) {
    return notObserved("A2.04", "No sampled page could be read, so its structured data references could not be checked.");
  }
  const references = ctx.jsonLd.references;
  if (references.length === 0) {
    return notApplicable(
      "A2.04",
      "No structured data on the sampled pages refers to another node by @id, so there is nothing to resolve.",
      { branch: "no_references" }
    );
  }
  const homeUrl = ctx.home === null ? null : ctx.home.url;
  // Blank-node ids have no IRI, so they are matched on the raw id instead.
  const blankDefinitions = new Map<string, JsonLdNodeRef[]>();
  for (const candidate of ctx.jsonLd.nodes) {
    const { id, iri, isReference } = candidate.node;
    if (isReference || iri !== null || id === null) continue;
    const existing = blankDefinitions.get(id);
    if (existing === undefined) blankDefinitions.set(id, [candidate]);
    else existing.push(candidate);
  }
  let resolved = 0;
  const unresolved: EvidenceRecord[] = [];
  for (const reference of references) {
    const { iri, id } = reference.node;
    const definitions =
      iri !== null
        ? (ctx.jsonLd.definitions.get(iri) ?? [])
        : (blankDefinitions.get(id ?? "") ?? []);
    const found = definitions.some(
      (definition) => definition.pageUrl === reference.pageUrl || definition.pageUrl === homeUrl
    );
    if (found) resolved++;
    else if (unresolved.length < MAX_LISTED) {
      unresolved.push({ url: truncateEvidence(reference.pageUrl), id: truncateEvidence(id ?? "") });
    }
  }
  return resultFromScore(
    "A2.04",
    resolved / references.length,
    {
      branch: resolved === references.length ? "all_references_resolve" : "some_references_dangling",
      references: references.length,
      resolved,
      unresolved,
      pages: listed([...new Set(references.map((reference) => reference.pageUrl))]),
    },
    `${resolved} of ${references.length} @id ${plural(references.length, "reference", "references")} ${plural(resolved, "points", "point")} to a node defined on the same page or the homepage.`
  );
}

// ---------------------------------------------------------------------------
// A2.05 Page-type schema
// ---------------------------------------------------------------------------

type Check = { name: string; passed: boolean };

function authorNamed(node: JsonLdNode, graph: Graph): boolean {
  const author = node.properties.author;
  if (textOf(author) !== null) return true;
  return resolveObjects(author, graph).some((item) => textOf(item.name) !== null);
}

// The candidate that passes most probes is used, so one weak node does not hide a good one.
function nodeChecks(
  candidates: readonly JsonLdNode[],
  nodeName: string,
  probes: readonly { name: string; test: (node: JsonLdNode) => boolean }[]
): Check[] {
  let best: Check[] | null = null;
  let bestPassed = -1;
  for (const candidate of candidates) {
    const checks = probes.map((probe) => ({ name: probe.name, passed: probe.test(candidate) }));
    const passed = checks.filter((check) => check.passed).length;
    if (passed > bestPassed) {
      best = checks;
      bestPassed = passed;
    }
  }
  const found = candidates.length > 0;
  return [
    { name: nodeName, passed: found },
    ...(best ?? probes.map((probe) => ({ name: probe.name, passed: false }))),
  ];
}

function checksFor(type: string, graph: Graph): Check[] | null {
  const nodes = graph.nodes.filter((node) => !node.isReference);
  switch (type) {
    case "article":
      return nodeChecks(
        nodes.filter((node) => hasAnyType(node, ARTICLE_SCHEMA_TYPES)),
        "articleNode",
        [
          { name: "headline", test: (node) => textOf(node.properties.headline) !== null },
          { name: "datePublished", test: (node) => textOf(node.properties.datePublished) !== null },
          { name: "authorName", test: (node) => authorNamed(node, graph) },
        ]
      );
    case "faq": {
      const questions = nodes.filter((node) => node.types.includes("Question"));
      const answered =
        questions.length > 0 &&
        questions.every((question) =>
          resolveObjects(question.properties.acceptedAnswer, graph).some(
            (answer) => textOf(answer.text) !== null
          )
        );
      return [
        { name: "faqPageNode", passed: nodes.some((node) => node.types.includes("FAQPage")) },
        { name: "twoOrMoreQuestions", passed: questions.length >= 2 },
        { name: "everyQuestionHasAnswerText", passed: answered },
      ];
    }
    case "services":
      return nodeChecks(
        nodes.filter((node) => hasAnyType(node, SERVICE_SCHEMA_TYPES)),
        "serviceNode",
        [
          { name: "name", test: hasName },
          { name: "description", test: (node) => textOf(node.properties.description) !== null },
        ]
      );
    case "about":
      return [{ name: "aboutNode", passed: nodes.some((node) => hasAnyType(node, ABOUT_SCHEMA_TYPES)) }];
    default:
      return null;
  }
}

function evaluateA205(ctx: EvalContext): MetricResult {
  const expecting = ctx.pages.filter((page) =>
    page.type === "article" || page.type === "faq" || page.type === "services" || page.type === "about"
  );
  const perPage = pageScores(expecting, (page, facts) => {
    const checks = checksFor(page.type, graphOf(facts));
    if (checks === null) return skippedPage("not_applicable", { branch: "no_expectation" });
    const passed = checks.filter((check) => check.passed).length;
    const evidence = {
      pageType: page.type,
      checks: Object.fromEntries(checks.map((check) => [check.name, check.passed])),
      passed,
      of: checks.length,
    };
    if (passed === 0 && unreadableJsonLd(facts) > 0) {
      return skippedPage("not_observed", { ...evidence, branch: "json_ld_beyond_scanner_limits" });
    }
    return scoredPage(passed / checks.length, {
      ...evidence,
      branch: passed === checks.length ? "all_checks_passed" : passed === 0 ? "no_checks_passed" : "some_checks_passed",
    });
  });
  const scores = observedScores(perPage);
  const full = scores.filter((s) => s === 1).length;
  return finishPageMetric(
    ctx,
    "A2.05",
    perPage,
    `The structured data expected for the page type is complete on ${full} of ${scores.length} observed ${plural(scores.length, "page", "pages")}.`
  );
}

// ---------------------------------------------------------------------------
// A2.06 Breadcrumbs
// ---------------------------------------------------------------------------

function itemHasPositionOrTarget(item: Props): boolean {
  if (hasContent(item.item)) return true;
  const position = item.position;
  return (
    (typeof position === "number" && Number.isFinite(position)) ||
    (typeof position === "string" && /^\d{1,6}$/.test(position.trim()))
  );
}

function itemHasName(item: Props, graph: Graph): boolean {
  if (textOf(item.name) !== null) return true;
  return resolveObjects(item.item, graph).some((target) => textOf(target.name) !== null);
}

function evaluateA206(ctx: EvalContext): MetricResult {
  const deep = ctx.pages.filter((page) => page.depth >= BREADCRUMB_MIN_DEPTH);
  const perPage = pageScores(deep, (page, facts) => {
    const graph = graphOf(facts);
    const lists = graph.nodes.filter((node) => !node.isReference && node.types.includes("BreadcrumbList"));
    let items = 0;
    let qualifying = 0;
    for (const list of lists) {
      const entries = resolveObjects(list.properties.itemListElement, graph);
      items += entries.length;
      const good = entries.filter(
        (entry) => itemHasName(entry, graph) && itemHasPositionOrTarget(entry)
      ).length;
      qualifying = Math.max(qualifying, good);
    }
    const evidence = { depth: page.depth, breadcrumbLists: lists.length, items, qualifyingItems: qualifying };
    if (qualifying >= BREADCRUMB_MIN_ITEMS) return scoredPage(1, { ...evidence, branch: "breadcrumb_complete" });
    if (lists.length === 0 && unreadableJsonLd(facts) > 0) {
      return skippedPage("not_observed", { ...evidence, branch: "json_ld_beyond_scanner_limits" });
    }
    return scoredPage(0, {
      ...evidence,
      branch: lists.length === 0 ? "no_breadcrumb_list" : "too_few_complete_items",
    });
  });
  const scores = observedScores(perPage);
  const full = scores.filter((s) => s === 1).length;
  return finishPageMetric(
    ctx,
    "A2.06",
    perPage,
    `${full} of ${scores.length} observed ${plural(scores.length, "page", "pages")} below the top level ${plural(full, "has", "have")} a complete BreadcrumbList.`
  );
}

// ---------------------------------------------------------------------------
// A2.07 Schema matches visible content
// ---------------------------------------------------------------------------

function evaluateA207(ctx: EvalContext): MetricResult {
  const norm = (text: string): string => ctx.helpers.normaliseText(text).toLowerCase();
  const perPage = pageScores(ctx.pages, (_page, facts) => {
    if (facts.render.renderDependent) {
      return skippedPage("not_observed", {
        branch: "render_dependent",
        markers: listed([...facts.render.spaRootMarkers, ...facts.render.noscriptJsMessages]),
      });
    }
    const graph = graphOf(facts);
    const visible = facts.visibleText.toLowerCase();
    const titles = facts.head.titles.map((title) => norm(title.text));
    const results: boolean[] = [];
    const evidence: EvidenceRecord = {};

    const org = organisationNode(graph.nodes.filter((node) => hasAnyType(node, ORG_TYPES)), true);
    const orgName = org === null ? null : norm(textOf(org.properties.name) ?? "");
    if (orgName !== null && orgName !== "") {
      const ok = visible.includes(orgName) || titles.some((title) => title.includes(orgName));
      results.push(ok);
      evidence.organisationName = { value: truncateEvidence(orgName), found: ok };
    }

    const questions = graph.nodes.filter((node) => !node.isReference && node.types.includes("Question"));
    const checked: { text: string; found: boolean }[] = [];
    for (const question of questions) {
      if (checked.length >= MAX_QUESTIONS_CHECKED) break;
      const text = norm(textOf(question.properties.name) ?? "");
      if (text === "") continue;
      checked.push({ text, found: visible.includes(text) });
    }
    if (checked.length > 0) {
      for (const entry of checked) results.push(entry.found);
      evidence.questions = {
        found: questions.length,
        checked: checked.length,
        missing: listed(checked.filter((entry) => !entry.found).map((entry) => entry.text)),
      };
    }

    const article = shallowest(
      graph.nodes.filter((node) => hasAnyType(node, ARTICLE_SCHEMA_TYPES) && textOf(node.properties.headline) !== null),
      () => true
    );
    const headline = article === null ? null : norm(textOf(article.properties.headline) ?? "");
    if (headline !== null && headline !== "") {
      const h1s = facts.headings.filter((heading) => heading.level === 1).map((heading) => norm(heading.text));
      const ok = h1s.some((h1) => h1.includes(headline)) || titles.some((title) => title.includes(headline));
      results.push(ok);
      evidence.articleHeadline = { value: truncateEvidence(headline), found: ok };
    }

    if (results.length === 0) return skippedPage("not_applicable", { branch: "no_applicable_checks" });
    const passed = results.filter(Boolean).length;
    return scoredPage(passed / results.length, {
      ...evidence,
      passed,
      applicable: results.length,
      branch: passed === results.length ? "all_checks_passed" : passed === 0 ? "no_checks_passed" : "some_checks_passed",
    });
  });
  const scores = observedScores(perPage);
  const full = scores.filter((s) => s === 1).length;
  return finishPageMetric(
    ctx,
    "A2.07",
    perPage,
    `Names, questions and headlines from the structured data all appear in the visible text on ${full} of ${scores.length} observed ${plural(scores.length, "page", "pages")}.`
  );
}

// ---------------------------------------------------------------------------
// A2.08 Name consistency
// ---------------------------------------------------------------------------

function evaluateA208(ctx: EvalContext): MetricResult {
  return homeReader(ctx, "A2.08", (home, facts) => {
    const graph = graphOf(facts);
    const url = truncateEvidence(home.url);
    const node = organisationNode(graph.nodes, true);
    const rawName = node === null ? null : textOf(node.properties.name);
    if (rawName === null) {
      if (unreadableJsonLd(facts) > 0) {
        return notObserved(
          "A2.08",
          "The homepage has structured data that the scanner could not read, so it could not look for an organisation name.",
          { url, branch: "json_ld_beyond_scanner_limits" }
        );
      }
      return notApplicable(
        "A2.08",
        "The homepage structured data has no organisation name to compare.",
        { url, branch: "no_organisation_name" }
      );
    }
    const norm = (text: string): string => ctx.helpers.normaliseText(text).toLowerCase();
    const name = norm(rawName);
    const siteNames = facts.head.openGraph
      .filter((entry) => entry.key === "og:site_name")
      .map((entry) => norm(entry.content));
    const titles = facts.head.titles.map((title) => norm(title.text));
    const equalsSiteName = name !== "" && siteNames.some((siteName) => siteName === name);
    const inTitle = name !== "" && titles.some((title) => title.includes(name));
    const held = (equalsSiteName ? 1 : 0) + (inTitle ? 1 : 0);
    const evidence = {
      url,
      organisationName: truncateEvidence(rawName),
      ogSiteName: listed(facts.head.openGraph.filter((entry) => entry.key === "og:site_name").map((entry) => entry.content)),
      title: listed(facts.head.titles.map((title) => title.text)),
      equalsSiteName,
      inTitle,
    };
    return resultFromScore(
      "A2.08",
      held / 2,
      { ...evidence, branch: held === 2 ? "name_consistent" : held === 1 ? "one_match" : "no_match" },
      held === 2
        ? "The organisation name matches og:site_name and appears in the title."
        : held === 1
          ? "The organisation name matches only one of og:site_name and the title."
          : "The organisation name matches neither og:site_name nor the title."
    );
  });
}

export function evaluateA2(ctx: EvalContext): MetricResult[] {
  return [
    evaluateA201(ctx),
    evaluateA202(ctx),
    evaluateA203(ctx),
    evaluateA204(ctx),
    evaluateA205(ctx),
    evaluateA206(ctx),
    evaluateA207(ctx),
    evaluateA208(ctx),
  ];
}

