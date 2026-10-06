import { createHash } from "node:crypto";
import { load } from "cheerio";
import { NOSCRIPT_JS_MESSAGE, SPA_ROOT_SELECTORS } from "./lists";
import { normaliseUrl, sameSite } from "./normalise";
import {
  codePointLength,
  countWordCharacters,
  countWords,
  hasWordCharacter,
  isQuestionForm,
  isSpaceDelimitedLang,
  median,
  normaliseText,
  parseIsoDate,
  splitSentences,
  takeWords,
  truncateEvidence,
} from "./text";
import type {
  BylineFacts,
  CanonicalEntry,
  ContactFacts,
  FaqFacts,
  HeadFacts,
  HeadingFact,
  ImageFact,
  JsonLdBlock,
  JsonLdFacts,
  JsonLdNode,
  LinkFact,
  LinkLocation,
  ListFact,
  MainContentFacts,
  MainContentMethod,
  MetaTagEntry,
  MixedContentRef,
  NavFact,
  PageCap,
  PageFacts,
  ParagraphFact,
  RenderFacts,
  RobotsDirective,
  RobotsDirectiveSet,
  TableFact,
  TextEntry,
  TimeFact,
  TimeLocation,
} from "./types";

export interface ExtractInput {
  finalUrl: string;
  headers: Record<string, string>;
}

const HTML_BYTE_CAP = 3 * 1024 * 1024;
const ELEMENT_CAP = 100_000;
// parse5 is quadratic in the number of distinct attributes on one element (20,000 take about 0.5 s, 80,000 about 15 s).
// The sum of squared attribute counts over all start tags is budgeted to about one second; the markup is cut where it runs out.
const ATTRIBUTE_WORK_BUDGET = 800_000_000;
// parse5 does work proportional to the open-element depth for every start tag; this bounds that work to about two seconds.
const PARSE_WORK_BUDGET = 150_000_000;
const JSONLD_BLOCK_BYTES = 256 * 1024;
const JSONLD_BLOCK_COUNT = 20;
const JSONLD_MAX_DEPTH = 32;
const RENDER_WORD_THRESHOLD = 50;
const CAPTURE_CHAR_LIMIT = 10_000;
const MAX_LIST_ENTRIES = 200;
const SLICE_BUDGET_CHARS = 30_000_000;
const NOSCRIPT_CHAR_LIMIT = 20_000;
const NOSCRIPT_SCAN_LIMIT = 50;

// ---------------------------------------------------------------------------
// DOM access (cheerio exposes domhandler nodes; this is the structural subset used here)
// ---------------------------------------------------------------------------

interface DomNode {
  type: string;
  name?: string;
  data?: string;
  attribs?: Record<string, string>;
  children?: DomNode[];
  parent?: DomNode | null;
}

function isElement(node: DomNode): boolean {
  return node.type === "tag" || node.type === "script" || node.type === "style";
}

const NO_ATTRIBS: Record<string, string> = Object.create(null) as Record<string, string>;

function attribsOf(node: DomNode): Record<string, string> {
  return node.attribs ?? NO_ATTRIBS;
}

// Iterative pre-order walk. enter returns false to skip a node's children (leave is then not called);
// leave runs after the children of every node whose enter returned true.
function walk(
  root: DomNode,
  enter: (node: DomNode) => boolean,
  leave?: (node: DomNode) => void,
  stopped?: () => boolean,
): void {
  const nodes: DomNode[] = [root];
  const exits: boolean[] = [false];
  while (nodes.length > 0) {
    const node = nodes.pop() as DomNode;
    const exiting = exits.pop() as boolean;
    if (exiting) {
      if (leave) leave(node);
      continue;
    }
    if (stopped && stopped()) return;
    if (!enter(node)) continue;
    const kids = node.children;
    const hasKids = kids !== undefined && kids.length > 0;
    if (leave) {
      if (!hasKids) {
        leave(node);
        continue;
      }
      nodes.push(node);
      exits.push(true);
    }
    if (hasKids) {
      for (let i = (kids as DomNode[]).length - 1; i >= 0; i--) {
        nodes.push((kids as DomNode[])[i]);
        exits.push(false);
      }
    }
  }
}

function truncateTreeAt(node: DomNode): void {
  const parent = node.parent;
  if (!parent || !parent.children) return;
  const at = parent.children.indexOf(node);
  if (at >= 0) parent.children.length = at;
  let current: DomNode = parent;
  while (current.parent && current.parent.children) {
    const index = current.parent.children.indexOf(current);
    if (index >= 0) current.parent.children.length = index + 1;
    current = current.parent;
  }
}

// ---------------------------------------------------------------------------
// Pre-parse guard: bound parser work on hostile markup (element count and nesting)
// ---------------------------------------------------------------------------

const VOID_TAGS: ReadonlySet<string> = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr", "keygen",
]);
const RAW_TEXT_TAGS: ReadonlySet<string> = new Set([
  "script", "style", "textarea", "title", "xmp", "iframe", "noembed", "noframes", "noscript",
]);
const PARAGRAPH_CLOSERS: ReadonlySet<string> = new Set([
  "address", "article", "aside", "blockquote", "details", "div", "dl", "fieldset", "figure", "footer", "form",
  "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "main", "menu", "nav", "ol", "p", "pre", "section", "table", "ul",
]);

function isTagDelimiter(c: number): boolean {
  return c === 32 || c === 9 || c === 10 || c === 12 || c === 13 || c === 47 || c === 62;
}

function findTagEnd(html: string, from: number): number {
  let i = from;
  let previous = 0;
  while (i < html.length) {
    const c = html.charCodeAt(i);
    if (c === 62) return i;
    if ((c === 34 || c === 39) && previous === 61) {
      const close = html.indexOf(c === 34 ? '"' : "'", i + 1);
      if (close === -1) return -1;
      i = close + 1;
      previous = c;
      continue;
    }
    if (c > 32) previous = c;
    i++;
  }
  return -1;
}

function skipAttributeValue(html: string, from: number, end: number): number {
  let i = from;
  while (i < end && html.charCodeAt(i) <= 32) i++;
  const quote = html.charCodeAt(i);
  if (quote === 34 || quote === 39) {
    const close = html.indexOf(String.fromCharCode(quote), i + 1);
    return close === -1 || close >= end ? end : close + 1;
  }
  while (i < end && html.charCodeAt(i) > 32) i++;
  return i;
}

// Counts attribute names in the start tag between from and end, in one linear pass.
function countAttributes(html: string, from: number, end: number): number {
  let count = 0;
  let inName = false;
  let i = from;
  while (i < end) {
    const c = html.charCodeAt(i);
    if (c <= 32 || c === 47) {
      inName = false;
      i++;
    } else if (c === 61) {
      i = skipAttributeValue(html, i + 1, end);
      inName = false;
    } else if (c === 34 || c === 39) {
      const close = html.indexOf(String.fromCharCode(c), i + 1);
      i = close === -1 || close >= end ? end : close + 1;
      inName = false;
    } else {
      if (!inName) {
        count++;
        inName = true;
      }
      i++;
    }
  }
  return count;
}

function findRawTextEnd(html: string, name: string, from: number): number {
  let i = from;
  while (true) {
    const k = html.indexOf("</", i);
    if (k === -1) return -1;
    let matches = true;
    for (let j = 0; j < name.length; j++) {
      if ((html.charCodeAt(k + 2 + j) | 32) !== name.charCodeAt(j)) {
        matches = false;
        break;
      }
    }
    if (matches) {
      const after = k + 2 + name.length;
      if (after >= html.length || isTagDelimiter(html.charCodeAt(after))) {
        const end = html.indexOf(">", after);
        return end === -1 ? -1 : end + 1;
      }
    }
    i = k + 2;
  }
}

function impliedCloses(open: string, top: string): boolean {
  switch (open) {
    case "li":
      return top === "li";
    case "dt":
    case "dd":
      return top === "dt" || top === "dd";
    case "option":
      return top === "option";
    case "optgroup":
      return top === "option" || top === "optgroup";
    case "tr":
      return top === "td" || top === "th" || top === "tr";
    case "td":
    case "th":
      return top === "td" || top === "th";
    case "thead":
    case "tbody":
    case "tfoot":
      return top === "td" || top === "th" || top === "tr" || top === "thead" || top === "tbody" || top === "tfoot";
    default:
      return PARAGRAPH_CLOSERS.has(open) && top === "p";
  }
}

// Returns the index at which to cut the markup, or -1 when it is within limits.
export function findHtmlCutPoint(html: string): number {
  const stack: string[] = [];
  const open = new Map<string, number>();
  let elements = 0;
  let work = 0;
  let attributeWork = 0;
  let pos = 0;
  const popOne = (): void => {
    const name = stack.pop() as string;
    open.set(name, (open.get(name) ?? 1) - 1);
  };
  while (true) {
    const lt = html.indexOf("<", pos);
    if (lt === -1 || lt + 1 >= html.length) return -1;
    const next = html.charCodeAt(lt + 1);
    if (next === 33) {
      if (html.startsWith("<!--", lt)) {
        if (html.startsWith("<!-->", lt)) pos = lt + 5;
        else if (html.startsWith("<!--->", lt)) pos = lt + 6;
        else {
          const end = html.indexOf("-->", lt + 4);
          if (end === -1) return -1;
          pos = end + 3;
        }
      } else {
        const end = html.indexOf(">", lt + 2);
        if (end === -1) return -1;
        pos = end + 1;
      }
      continue;
    }
    if (next === 63) {
      const end = html.indexOf(">", lt + 2);
      if (end === -1) return -1;
      pos = end + 1;
      continue;
    }
    const isLetter = (next | 32) >= 97 && (next | 32) <= 122;
    if (next === 47) {
      const after = html.charCodeAt(lt + 2);
      if (!((after | 32) >= 97 && (after | 32) <= 122)) {
        pos = lt + 2;
        continue;
      }
      let j = lt + 2;
      while (j < html.length && !isTagDelimiter(html.charCodeAt(j))) j++;
      const name = html.slice(lt + 2, Math.min(j, lt + 2 + 64)).toLowerCase();
      const end = html.indexOf(">", j);
      if (end === -1) return -1;
      pos = end + 1;
      if ((open.get(name) ?? 0) > 0) {
        while (stack.length > 0) {
          const top = stack[stack.length - 1];
          popOne();
          if (top === name) break;
        }
      }
      continue;
    }
    if (!isLetter) {
      pos = lt + 1;
      continue;
    }
    let j = lt + 1;
    while (j < html.length && !isTagDelimiter(html.charCodeAt(j))) j++;
    const name = html.slice(lt + 1, Math.min(j, lt + 1 + 64)).toLowerCase();
    elements++;
    if (elements > ELEMENT_CAP) return lt;
    work += stack.length;
    if (work > PARSE_WORK_BUDGET) return lt;
    const end = findTagEnd(html, j);
    if (end === -1) return -1;
    const attributes = countAttributes(html, j, end);
    attributeWork += attributes * attributes;
    if (attributeWork > ATTRIBUTE_WORK_BUDGET) return lt;
    pos = end + 1;
    if (name === "plaintext") return -1;
    if (RAW_TEXT_TAGS.has(name)) {
      const rawEnd = findRawTextEnd(html, name, pos);
      if (rawEnd === -1) return -1;
      pos = rawEnd;
      continue;
    }
    if (VOID_TAGS.has(name)) continue;
    const foreign = (open.get("svg") ?? 0) + (open.get("math") ?? 0) > 0 || name === "svg" || name === "math";
    if (html.charCodeAt(end - 1) === 47 && foreign) continue;
    while (stack.length > 0 && impliedCloses(name, stack[stack.length - 1])) popOne();
    stack.push(name);
    open.set(name, (open.get(name) ?? 0) + 1);
  }
}

// ---------------------------------------------------------------------------
// Text buffers
// ---------------------------------------------------------------------------

// Characters that text captures may read in total. Nested captures re-read the same text, so a hostile page could
// otherwise force seconds of work; ordinary pages use a tiny fraction of this.
interface SliceBudget {
  remaining: number;
  exhausted: boolean;
}

class TextBuf {
  private chunks: string[] = [];
  private wordPrefix: number[] = [0];
  private lastWasSeparator = true;
  private readonly budget: SliceBudget;

  constructor(budget: SliceBudget) {
    this.budget = budget;
  }

  get length(): number {
    return this.chunks.length;
  }

  push(text: string): void {
    if (text === "") return;
    this.chunks.push(text);
    this.wordPrefix.push(this.wordPrefix[this.wordPrefix.length - 1] + (hasWordCharacter(text) ? 1 : 0));
    this.lastWasSeparator = false;
  }

  separate(): void {
    if (this.lastWasSeparator) return;
    this.chunks.push(" ");
    this.wordPrefix.push(this.wordPrefix[this.wordPrefix.length - 1]);
    this.lastWasSeparator = true;
  }

  hasWord(from: number, to: number): boolean {
    if (to <= from) return false;
    return this.wordPrefix[to] - this.wordPrefix[from] > 0;
  }

  slice(from: number, to: number, limit: number): string {
    if (this.budget.remaining <= 0) {
      this.budget.exhausted = true;
      return "";
    }
    let out = "";
    for (let i = from; i < to && i < this.chunks.length && out.length < limit; i++) out += this.chunks[i];
    this.budget.remaining -= out.length;
    return normaliseText(out.length > limit ? out.slice(0, limit) : out);
  }

  text(): string {
    return normaliseText(this.chunks.join(""));
  }
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const SKIP_TEXT_TAGS: ReadonlySet<string> = new Set([
  "script", "style", "noscript", "template", "svg", "head", "iframe", "noembed", "noframes",
]);

const BLOCK_TAGS: ReadonlySet<string> = new Set([
  "address", "article", "aside", "blockquote", "body", "br", "button", "caption", "center", "dd", "details",
  "dialog", "dir", "div", "dl", "dt", "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3",
  "h4", "h5", "h6", "header", "hgroup", "hr", "html", "legend", "li", "main", "menu", "nav", "ol", "optgroup",
  "option", "p", "pre", "search", "section", "select", "summary", "table", "tbody", "td", "textarea", "tfoot",
  "th", "thead", "tr", "ul",
]);

const EXCLUDED_FALLBACK_TAGS: ReadonlySet<string> = new Set(["header", "nav", "footer", "aside"]);
const EXCLUDED_FALLBACK_ROLES: ReadonlySet<string> = new Set(["banner", "navigation", "contentinfo", "complementary"]);
const EXCLUDED_FALLBACK_ID_CLASS = /cookie|consent|banner|popup|modal/i;
const HEADING_TAGS: ReadonlyMap<string, 1 | 2 | 3 | 4 | 5 | 6> = new Map([
  ["h1", 1], ["h2", 2], ["h3", 3], ["h4", 4], ["h5", 5], ["h6", 6],
]);
const BYLINE_CLASS_SEGMENT = /(?:^|[-_])(?:byline|author)(?:$|[-_])/i;
const BY_TEXT = /(?:^|[^\p{L}\p{N}])by\s/iu;
const DIMENSION = /^(\d{1,6})(?:\.\d+)?(?:px)?$/i;
const SCHEMA_ORG_URL = /^https?:\/\/(?:www\.)?schema\.org(?:[/#?]|$)/i;
const SCHEMA_ORG_TYPE_PREFIX = /^(?:https?:\/\/(?:www\.)?schema\.org\/|schema:)/i;
const LD_JSON_TYPE = "application/ld+json";
const EMAIL_LOCAL_MAX = 64;
const EMAIL_DOMAIN_MAX = 255;
const EMAIL_DOMAIN = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;
const EMAIL_TLD = /[a-z]{2,}$/i;
const EMPTY_STRINGS: readonly string[] = [];

function tokens(value: string | undefined): string[] {
  if (value === undefined) return EMPTY_STRINGS as string[];
  const out: string[] = [];
  for (const part of value.toLowerCase().split(/\s+/)) if (part !== "") out.push(part);
  return out;
}

function lowerKeys(headers: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = Object.create(null) as Record<string, string>;
  if (!headers || typeof headers !== "object") return out;
  for (const key of Object.keys(headers)) {
    const value = headers[key];
    if (typeof value === "string") out[key.toLowerCase()] = value;
  }
  return out;
}

function textEntry(raw: string): TextEntry {
  const text = normaliseText(raw);
  return { text, chars: codePointLength(text) };
}

function styleHides(style: string): boolean {
  let display = "";
  let visibility = "";
  for (const declaration of style.split(";")) {
    const colon = declaration.indexOf(":");
    if (colon < 0) continue;
    const property = declaration.slice(0, colon).trim().toLowerCase();
    if (property !== "display" && property !== "visibility") continue;
    let value = declaration.slice(colon + 1).trim().toLowerCase();
    const bang = value.indexOf("!");
    if (bang >= 0) value = value.slice(0, bang).trim();
    if (property === "display") display = value;
    else visibility = value;
  }
  return display === "none" || visibility === "hidden";
}

function isHiddenSelf(at: Record<string, string>): boolean {
  if ("hidden" in at) return true;
  const style = at.style;
  return style !== undefined && styleHides(style);
}

function directText(node: DomNode, limit: number): string {
  let out = "";
  const kids = node.children;
  if (!kids) return out;
  for (let i = 0; i < kids.length && out.length < limit; i++) {
    const kid = kids[i];
    if (kid.type === "text" && kid.data) out += kid.data;
  }
  return out.length > limit ? out.slice(0, limit) : out;
}

function stripTags(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const lt = text.indexOf("<", i);
    if (lt === -1) {
      out += text.slice(i);
      break;
    }
    const gt = text.indexOf(">", lt + 1);
    if (gt === -1) {
      out += text.slice(i);
      break;
    }
    out += text.slice(i, lt) + " ";
    i = gt + 1;
  }
  return out;
}

// With scripting enabled the parser keeps noscript content as raw text, so entities arrive undecoded.
function noscriptPlainText(node: DomNode): string {
  const stripped = stripTags(directText(node, NOSCRIPT_CHAR_LIMIT));
  if (!stripped.includes("&")) return stripped;
  const parts: string[] = [];
  walk(load(stripped, null, false).root().get(0) as unknown as DomNode, (child) => {
    if (child.type === "text") parts.push(child.data ?? "");
    return child.type === "root";
  });
  return parts.join("");
}

function parseDimension(value: string | undefined): number | null {
  if (value === undefined) return null;
  const m = DIMENSION.exec(value.trim());
  return m === null ? null : Number(m[1]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(object: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function isEmailLocalChar(c: number): boolean {
  return (
    (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 46 || c === 95 || c === 37 || c === 43 || c === 45
  );
}

function isEmailDomainChar(c: number): boolean {
  return (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 46 || c === 45;
}

function countEmails(text: string): number {
  const seen = new Set<string>();
  let at = text.indexOf("@");
  while (at !== -1 && seen.size < 1000) {
    let start = at;
    while (start > 0 && at - start < EMAIL_LOCAL_MAX && isEmailLocalChar(text.charCodeAt(start - 1))) start--;
    let end = at + 1;
    while (end < text.length && end - at <= EMAIL_DOMAIN_MAX && isEmailDomainChar(text.charCodeAt(end))) end++;
    let domain = text.slice(at + 1, end);
    let trim = domain.length;
    while (trim > 0 && (domain.charCodeAt(trim - 1) === 46 || domain.charCodeAt(trim - 1) === 45)) trim--;
    domain = domain.slice(0, trim);
    if (start < at && EMAIL_DOMAIN.test(domain) && EMAIL_TLD.test(domain)) {
      seen.add(`${text.slice(start, at)}@${domain}`.toLowerCase());
    }
    at = text.indexOf("@", at + 1);
  }
  return seen.size;
}

function parseMailto(href: string): string[] {
  const rest = href.slice(7);
  const query = rest.indexOf("?");
  let part = query === -1 ? rest : rest.slice(0, query);
  try {
    part = decodeURIComponent(part);
  } catch {
    // keep the raw text
  }
  const out: string[] = [];
  for (const address of part.split(",")) {
    const trimmed = address.trim().toLowerCase();
    if (trimmed !== "") out.push(trimmed);
  }
  return out;
}

function parseTel(href: string): string | null {
  const rest = href.slice(4);
  const query = rest.indexOf("?");
  let part = query === -1 ? rest : rest.slice(0, query);
  try {
    part = decodeURIComponent(part);
  } catch {
    // keep the raw text
  }
  const trimmed = part.trim();
  return trimmed === "" ? null : trimmed;
}

function pushUnique(list: string[], value: string): void {
  if (list.length < MAX_LIST_ENTRIES && !list.includes(value)) list.push(value);
}

// ---------------------------------------------------------------------------
// Robots directives
// ---------------------------------------------------------------------------

const VALUE_DIRECTIVES: ReadonlySet<string> = new Set([
  "max-snippet", "max-image-preview", "max-video-preview", "unavailable_after",
]);
const AGENT_TOKEN = /^[a-z0-9._-]+$/;

function parseDirective(token: string): RobotsDirective | null {
  const colon = token.indexOf(":");
  if (colon === -1) {
    const name = token.trim().toLowerCase();
    return name === "" ? null : { name, value: null };
  }
  const name = token.slice(0, colon).trim().toLowerCase();
  if (name === "") return null;
  return { name, value: token.slice(colon + 1).trim() };
}

function parseMetaRobots(agent: string | null, content: string): RobotsDirectiveSet {
  const directives: RobotsDirective[] = [];
  for (const part of content.split(",")) {
    const directive = parseDirective(part);
    if (directive) directives.push(directive);
  }
  return { source: "meta", agent, raw: content.trim(), directives };
}

function parseXRobotsTag(value: string): RobotsDirectiveSet[] {
  const sets: RobotsDirectiveSet[] = [];
  let agent: string | null = null;
  let parts: string[] = [];
  let directives: RobotsDirective[] = [];
  const flush = (): void => {
    if (directives.length > 0) sets.push({ source: "header", agent, raw: parts.join(", "), directives });
    parts = [];
    directives = [];
  };
  for (const piece of value.split(",")) {
    const token = piece.trim();
    if (token === "") continue;
    const colon = token.indexOf(":");
    if (colon > 0) {
      const head = token.slice(0, colon).trim().toLowerCase();
      if (!VALUE_DIRECTIVES.has(head) && AGENT_TOKEN.test(head)) {
        flush();
        agent = head;
        const rest = token.slice(colon + 1).trim();
        if (rest !== "") {
          const directive = parseDirective(rest);
          if (directive) {
            directives.push(directive);
            parts.push(rest);
          }
        }
        continue;
      }
    }
    const directive = parseDirective(token);
    if (directive) {
      directives.push(directive);
      parts.push(token);
    }
  }
  flush();
  return sets;
}

function parseLinkHeader(value: string): { href: string; rel: string[] }[] {
  const out: { href: string; rel: string[] }[] = [];
  const n = value.length;
  let i = 0;
  while (i < n) {
    while (i < n && (value[i] === "," || value[i] === " " || value[i] === "\t")) i++;
    if (i >= n) break;
    if (value[i] !== "<") {
      const comma = value.indexOf(",", i);
      if (comma === -1) break;
      i = comma + 1;
      continue;
    }
    const close = value.indexOf(">", i + 1);
    if (close === -1) break;
    const href = value.slice(i + 1, close);
    i = close + 1;
    let rel: string[] = [];
    while (i < n && value[i] !== ",") {
      if (value[i] !== ";") {
        i++;
        continue;
      }
      i++;
      while (i < n && (value[i] === " " || value[i] === "\t")) i++;
      let nameEnd = i;
      while (nameEnd < n && value[nameEnd] !== "=" && value[nameEnd] !== ";" && value[nameEnd] !== ",") nameEnd++;
      const paramName = value.slice(i, nameEnd).trim().toLowerCase();
      i = nameEnd;
      let paramValue = "";
      if (i < n && value[i] === "=") {
        i++;
        if (value[i] === '"') {
          i++;
          const startQuoted = i;
          while (i < n && value[i] !== '"') i += value[i] === "\\" ? 2 : 1;
          paramValue = value.slice(startQuoted, Math.min(i, n));
          i++;
        } else {
          const startBare = i;
          while (i < n && value[i] !== ";" && value[i] !== ",") i++;
          paramValue = value.slice(startBare, i).trim();
        }
      }
      if (paramName === "rel") rel = tokens(paramValue);
    }
    out.push({ href, rel });
  }
  return out;
}

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

function maxBracketDepth(text: string, stopAbove: number): number {
  let depth = 0;
  let max = 0;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (inString) {
      if (escaped) escaped = false;
      else if (c === 92) escaped = true;
      else if (c === 34) inString = false;
      continue;
    }
    if (c === 34) inString = true;
    else if (c === 123 || c === 91) {
      depth++;
      if (depth > max) {
        max = depth;
        if (max > stopAbove) return max;
      }
    } else if ((c === 125 || c === 93) && depth > 0) depth--;
  }
  return max;
}

function contextIsSchemaOrg(context: unknown): boolean {
  if (typeof context === "string") return SCHEMA_ORG_URL.test(context.trim());
  if (Array.isArray(context)) return context.some((item) => contextIsSchemaOrg(item));
  if (isRecord(context)) {
    const vocab = context["@vocab"];
    return typeof vocab === "string" && SCHEMA_ORG_URL.test(vocab.trim());
  }
  return false;
}

function typeNames(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : [raw];
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (trimmed === "") continue;
    out.push(trimmed.replace(SCHEMA_ORG_TYPE_PREFIX, ""));
    if (out.length >= 50) break;
  }
  return out;
}

function childPath(parent: string, segment: string): string {
  const seg = segment.length > 80 ? segment.slice(0, 80) : segment;
  const path = parent === "" ? seg : `${parent}.${seg}`;
  return path.length > 200 ? path.slice(0, 200) : path;
}

function collectJsonLdNodes(value: unknown, resolveIri: (id: string) => string | null): JsonLdNode[] {
  const nodes: JsonLdNode[] = [];
  const stack: { value: unknown; path: string; depth: number }[] = [{ value, path: "", depth: 0 }];
  while (stack.length > 0) {
    const { value: current, path, depth } = stack.pop() as { value: unknown; path: string; depth: number };
    if (Array.isArray(current)) {
      for (let i = current.length - 1; i >= 0; i--) {
        const item: unknown = current[i];
        if (typeof item === "object" && item !== null) {
          const indexed = `${path}[${i}]`;
          stack.push({ value: item, path: indexed.length > 200 ? indexed.slice(0, 200) : indexed, depth: depth + 1 });
        }
      }
      continue;
    }
    if (!isRecord(current)) continue;
    const keys = Object.keys(current);
    if (hasOwn(current, "@type") || hasOwn(current, "@id")) {
      const rawId = current["@id"];
      const id = typeof rawId === "string" ? rawId : null;
      nodes.push({
        id,
        iri: id === null ? null : resolveIri(id),
        types: hasOwn(current, "@type") ? typeNames(current["@type"]) : [],
        path,
        depth,
        isReference: id !== null && keys.length === 1,
        properties: current,
      });
    }
    for (let k = keys.length - 1; k >= 0; k--) {
      const key = keys[k];
      if (key === "@context") continue;
      const child = current[key];
      if (typeof child === "object" && child !== null) {
        stack.push({ value: child, path: childPath(path, key), depth: depth + 1 });
      }
    }
  }
  return nodes;
}

function invalidBlock(index: number, rawLength: number, reason: JsonLdBlock["reason"]): JsonLdBlock {
  return {
    index,
    rawLength,
    parsedOk: false,
    reason,
    value: null,
    schemaOrgContext: false,
    hasTypeOrGraph: false,
    nodes: [],
  };
}

function textLength(node: DomNode): number {
  let total = 0;
  for (const kid of node.children ?? []) if (kid.type === "text" && kid.data) total += kid.data.length;
  return total;
}

function buildJsonLdBlock(index: number, script: DomNode, resolveIri: (id: string) => string | null): JsonLdBlock {
  const rawLength = textLength(script);
  if (rawLength > JSONLD_BLOCK_BYTES) return invalidBlock(index, rawLength, "too_large");
  const text = directText(script, rawLength);
  if (rawLength * 3 > JSONLD_BLOCK_BYTES && Buffer.byteLength(text, "utf8") > JSONLD_BLOCK_BYTES) {
    return invalidBlock(index, rawLength, "too_large");
  }
  if (text.trim() === "") return invalidBlock(index, rawLength, "empty");
  // The top-level object has depth 0, so JSONLD_MAX_DEPTH levels of nesting need JSONLD_MAX_DEPTH + 1 brackets.
  if (maxBracketDepth(text, JSONLD_MAX_DEPTH + 1) > JSONLD_MAX_DEPTH + 1) return invalidBlock(index, rawLength, "too_deep");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return invalidBlock(index, rawLength, "invalid_json");
  }
  if (typeof value !== "object" || value === null) return invalidBlock(index, rawLength, "not_object_or_array");
  let schemaOrgContext = false;
  let hasTypeOrGraph = false;
  const tops: unknown[] = Array.isArray(value) ? value : [value];
  for (const top of tops) {
    if (!isRecord(top)) continue;
    if (contextIsSchemaOrg(top["@context"])) schemaOrgContext = true;
    if (hasOwn(top, "@type") || hasOwn(top, "@graph")) hasTypeOrGraph = true;
  }
  return {
    index,
    rawLength,
    parsedOk: true,
    reason: null,
    value,
    schemaOrgContext,
    hasTypeOrGraph,
    nodes: collectJsonLdNodes(value, resolveIri),
  };
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

interface Capture {
  kind: "heading" | "paragraph" | "link" | "summary" | "dt" | "dd" | "address" | "marker" | "byline";
  node: DomNode;
  startD: number;
  startM: number;
  heading?: HeadingFact;
  link?: { fact: LinkFact; ariaLabel: string; imgAlt: string | null };
  selectors?: string[];
}

interface DetailsContext {
  node: DomNode;
  startM: number;
  summaryText: string | null;
  summaryStart: number;
  summaryEnd: number;
}

interface DlContext {
  node: DomNode;
  pending: string | null;
}

const F_MAIN = 1;
const F_EXCLUDED = 2;
const F_NAV = 4;
const F_FOOTER = 8;
const F_HEADER = 16;
const F_BYLINE = 32;

function safeUrl(input: string): URL | null {
  try {
    return new URL(input);
  } catch {
    return null;
  }
}

function withoutHash(url: URL): string {
  const copy = new URL(url.href);
  copy.hash = "";
  return copy.href;
}

function emptyFacts(url: string): PageFacts {
  return {
    url,
    baseUrl: url,
    head: {
      htmlLang: null,
      langPrimary: null,
      titles: [],
      metaDescriptions: [],
      canonicals: [],
      metaRobots: [],
      xRobotsTag: [],
      viewports: [],
      openGraph: [],
      twitter: [],
    },
    jsonLd: { blocks: [], blocksSeen: 0 },
    microdataOrRdfa: false,
    headings: [],
    main: {
      method: "body-fallback",
      text: "",
      textHash: createHash("sha256").update("", "utf8").digest("hex"),
      wordCount: 0,
      lead200: "",
      paragraphs: [],
      sentences: { count: 0, medianWords: null },
      paragraphStats: { count: 0, medianWords: null },
    },
    visibleText: "",
    wordCountApplicable: true,
    links: [],
    navigations: [],
    images: [],
    lists: [],
    tables: [],
    faq: {
      detailsSummary: { pairs: 0, questionPairs: 0 },
      definitionList: { pairs: 0, questionPairs: 0 },
      headingParagraph: { pairs: 0, questionPairs: 0 },
    },
    byline: { relAuthor: false, itempropAuthor: false, classMatch: false, byTextInFirst400: false, sample: null },
    times: [],
    contact: { mailto: [], tel: [], emailsInText: 0, addressTextLengths: [] },
    mixedContent: [],
    render: {
      renderDependent: false,
      mainWordCount: 0,
      spaRootMarkers: [],
      noscriptJsMessages: [],
      reasons: ["extraction failed; no facts were produced"],
    },
    truncated: true,
    capsHit: [],
  };
}

export function extractPageFacts(html: string, input: ExtractInput): PageFacts {
  const finalUrl = typeof input?.finalUrl === "string" ? input.finalUrl : "";
  try {
    return extractUnsafe(typeof html === "string" ? html : "", finalUrl, lowerKeys(input?.headers));
  } catch {
    return emptyFacts(normaliseUrl(finalUrl) ?? finalUrl);
  }
}

function extractUnsafe(rawHtml: string, finalUrl: string, headers: Record<string, string>): PageFacts {
  const caps = new Set<PageCap>();
  const pageUrl = normaliseUrl(finalUrl) ?? finalUrl;

  let source = rawHtml;
  if (Buffer.byteLength(source, "utf8") > HTML_BYTE_CAP) {
    source = Buffer.from(source, "utf8").subarray(0, HTML_BYTE_CAP).toString("utf8");
    if (source.endsWith("\uFFFD")) source = source.slice(0, -1);
    caps.add("html_bytes");
  }
  const cut = findHtmlCutPoint(source);
  if (cut !== -1) {
    source = source.slice(0, cut);
    caps.add("element_count");
  }

  const root = load(source).root().get(0) as unknown as DomNode;
  let htmlEl: DomNode | null = null;
  let headEl: DomNode | null = null;
  let bodyEl: DomNode | null = null;
  for (const child of root.children ?? []) {
    if (isElement(child) && child.name === "html") {
      htmlEl = child;
      break;
    }
  }
  for (const child of htmlEl?.children ?? []) {
    if (!isElement(child)) continue;
    if (child.name === "head" && headEl === null) headEl = child;
    else if (child.name === "body" && bodyEl === null) bodyEl = child;
  }

  // -------------------------------------------------------------------------
  // Pass 1: whole-document scan (caps, visibility, main candidates, scripts, markup flags)
  // -------------------------------------------------------------------------
  const invisible = new Set<DomNode>();
  const jsonLdScripts: DomNode[] = [];
  const noscripts: DomNode[] = [];
  const mixedCandidates: { tag: string; kind: "active" | "passive"; ref: string }[] = [];
  let jsonLdSeen = 0;
  let baseHref: string | null = null;
  let microdataOrRdfa = false;
  let elementCount = 0;
  let cutNode: DomNode | null = null;
  let skipDepth = 0;
  let templateDepth = 0;
  let bodyDepth = 0;
  let firstMain: DomNode | null = null;
  let firstRoleMain: DomNode | null = null;
  let firstArticle: DomNode | null = null;
  let articleCount = 0;

  walk(
    root,
    (node) => {
      if (!isElement(node)) return node.type === "root";
      elementCount++;
      if (elementCount > ELEMENT_CAP) {
        cutNode = node;
        return false;
      }
      const name = node.name ?? "";
      const at = attribsOf(node);
      if (name === "template") templateDepth++;
      if (node === bodyEl) bodyDepth++;
      if (SKIP_TEXT_TAGS.has(name) || isHiddenSelf(at)) {
        invisible.add(node);
        skipDepth++;
      }
      if (templateDepth === 0) {
        if ("itemscope" in at || "typeof" in at || "vocab" in at) microdataOrRdfa = true;
        switch (name) {
          case "script": {
            const type = (at.type ?? "").split(";")[0].trim().toLowerCase();
            if (type === LD_JSON_TYPE) {
              jsonLdSeen++;
              if (jsonLdScripts.length < JSONLD_BLOCK_COUNT) jsonLdScripts.push(node);
            }
            if (at.src !== undefined) mixedCandidates.push({ tag: "script", kind: "active", ref: at.src });
            break;
          }
          case "noscript":
            noscripts.push(node);
            break;
          case "base":
            if (baseHref === null && at.href !== undefined) baseHref = at.href;
            break;
          case "link":
            if (at.href !== undefined && tokens(at.rel).includes("stylesheet")) {
              mixedCandidates.push({ tag: "link", kind: "active", ref: at.href });
            }
            break;
          case "iframe":
            if (at.src !== undefined) mixedCandidates.push({ tag: "iframe", kind: "active", ref: at.src });
            break;
          case "img":
          case "audio":
          case "video":
          case "source":
            if (at.src !== undefined) mixedCandidates.push({ tag: name, kind: "passive", ref: at.src });
            break;
          default:
            break;
        }
      }
      if (skipDepth === 0 && bodyDepth > 0) {
        if (name === "main" && firstMain === null) firstMain = node;
        if (firstRoleMain === null && at.role !== undefined && tokens(at.role).includes("main")) firstRoleMain = node;
        if (name === "article") {
          articleCount++;
          if (firstArticle === null) firstArticle = node;
        }
      }
      return true;
    },
    (node) => {
      if (!isElement(node)) return;
      if (node.name === "template") templateDepth--;
      if (node === bodyEl) bodyDepth--;
      if (invisible.has(node)) skipDepth--;
    },
    () => cutNode !== null,
  );
  if (cutNode !== null) {
    truncateTreeAt(cutNode);
    caps.add("element_count");
  }

  // -------------------------------------------------------------------------
  // Document base and URL helpers
  // -------------------------------------------------------------------------
  const finalParsed = safeUrl(finalUrl);
  let baseOk: string | null = finalParsed ? withoutHash(finalParsed) : null;
  if (baseHref !== null && baseOk !== null) {
    try {
      const candidate = new URL((baseHref as string).trim(), baseOk);
      if (candidate.protocol === "http:" || candidate.protocol === "https:") baseOk = withoutHash(candidate);
    } catch {
      // keep the document URL as the base
    }
  }
  const baseUrl = baseOk ?? finalUrl;
  const resolveHref = (href: string): string | null => normaliseUrl(href.trim(), baseOk ?? undefined);
  const resolveIri = (id: string): string | null => {
    if (id.startsWith("_:")) return null;
    try {
      return baseOk === null ? new URL(id).href : new URL(id, baseOk).href;
    } catch {
      return null;
    }
  };

  // -------------------------------------------------------------------------
  // Head facts
  // -------------------------------------------------------------------------
  const htmlLangRaw = htmlEl ? attribsOf(htmlEl).lang : undefined;
  const htmlLang = htmlLangRaw === undefined ? null : htmlLangRaw.trim();
  let langPrimary: string | null = null;
  if (htmlLang !== null && htmlLang !== "") {
    const dash = htmlLang.indexOf("-");
    langPrimary = (dash === -1 ? htmlLang : htmlLang.slice(0, dash)).toLowerCase();
    if (langPrimary === "") langPrimary = null;
  }
  const spaceDelimited = isSpaceDelimitedLang(langPrimary);

  const titles: TextEntry[] = [];
  const metaDescriptions: TextEntry[] = [];
  const canonicals: CanonicalEntry[] = [];
  const metaRobots: RobotsDirectiveSet[] = [];
  const viewports: string[] = [];
  const openGraph: MetaTagEntry[] = [];
  const twitter: MetaTagEntry[] = [];
  if (headEl !== null) {
    walk(headEl, (node) => {
      if (!isElement(node)) return node.type === "root";
      const name = node.name ?? "";
      const at = attribsOf(node);
      if (name === "svg") return false;
      if (name === "title") {
        titles.push(textEntry(directText(node, CAPTURE_CHAR_LIMIT * 10)));
        return false;
      }
      if (name === "meta") {
        const metaName = (at.name ?? "").trim().toLowerCase();
        const property = (at.property ?? "").trim().toLowerCase();
        const content = at.content ?? "";
        if (metaName === "description") metaDescriptions.push(textEntry(content));
        else if (metaName === "viewport") viewports.push(normaliseText(content));
        else if (metaName === "robots" || metaName === "googlebot" || metaName === "bingbot") {
          metaRobots.push(parseMetaRobots(metaName === "robots" ? null : metaName, content));
        }
        for (const key of [property, metaName]) {
          if (key.startsWith("og:")) {
            openGraph.push({ key, content: normaliseText(content) });
            break;
          }
          if (key.startsWith("twitter:")) {
            twitter.push({ key, content: normaliseText(content) });
            break;
          }
        }
        return false;
      }
      if (name === "link" && at.href !== undefined && tokens(at.rel).includes("canonical")) {
        const href = at.href.trim();
        canonicals.push({ source: "head", href, url: href === "" ? null : resolveHref(href) });
      }
      return true;
    });
  }
  const linkHeader = headers["link"];
  if (linkHeader !== undefined) {
    for (const entry of parseLinkHeader(linkHeader)) {
      if (!entry.rel.includes("canonical")) continue;
      const href = entry.href.trim();
      canonicals.push({
        source: "header",
        href,
        url: href === "" ? null : normaliseUrl(href, finalParsed ? finalParsed.href : undefined),
      });
    }
  }
  const xRobotsHeader = headers["x-robots-tag"];
  const xRobotsTag = xRobotsHeader === undefined ? [] : parseXRobotsTag(xRobotsHeader);
  const head: HeadFacts = {
    htmlLang,
    langPrimary,
    titles,
    metaDescriptions,
    canonicals,
    metaRobots,
    xRobotsTag,
    viewports,
    openGraph,
    twitter,
  };

  // -------------------------------------------------------------------------
  // JSON-LD
  // -------------------------------------------------------------------------
  const blocks: JsonLdBlock[] = jsonLdScripts.map((script, index) => buildJsonLdBlock(index, script, resolveIri));
  if (jsonLdSeen > JSONLD_BLOCK_COUNT) caps.add("jsonld_block_count");
  for (const block of blocks) {
    if (block.reason === "too_large") caps.add("jsonld_block_bytes");
    if (block.reason === "too_deep") caps.add("jsonld_depth");
  }
  const jsonLd: JsonLdFacts = { blocks, blocksSeen: jsonLdSeen };

  // -------------------------------------------------------------------------
  // Main content scope
  // -------------------------------------------------------------------------
  let mainRoot: DomNode | null;
  let method: MainContentMethod;
  if (firstMain !== null) {
    mainRoot = firstMain;
    method = "main";
  } else if (firstRoleMain !== null) {
    mainRoot = firstRoleMain;
    method = "role-main";
  } else if (articleCount === 1 && firstArticle !== null) {
    mainRoot = firstArticle;
    method = "single-article";
  } else {
    mainRoot = bodyEl ?? htmlEl;
    method = "body-fallback";
  }
  const fallback = method === "body-fallback";

  // -------------------------------------------------------------------------
  // Pass 2: visible content
  // -------------------------------------------------------------------------
  const sliceBudget: SliceBudget = { remaining: SLICE_BUDGET_CHARS, exhausted: false };
  const D = new TextBuf(sliceBudget);
  const M = new TextBuf(sliceBudget);
  let mainDepth = 0;
  let excludedDepth = 0;
  let navDepth = 0;
  let footerDepth = 0;
  let headerDepth = 0;
  let bylineDepth = 0;
  const flagsOf = new Map<DomNode, number>();
  const captures: Capture[] = [];
  const detailsStack: DetailsContext[] = [];
  const dlStack: DlContext[] = [];
  const tableStack: { node: DomNode; fact: TableFact }[] = [];
  const navStack: { node: DomNode; fact: NavFact; start: number }[] = [];
  let sameSiteLinkTotal = 0;

  const headings: HeadingFact[] = [];
  let lastMainHeadingIndex: number | null = null;
  const paragraphs: ParagraphFact[] = [];
  const sentenceWordCounts: number[] = [];
  const paragraphWordCounts: number[] = [];
  const links: LinkFact[] = [];
  const navigations: NavFact[] = [];
  const images: ImageFact[] = [];
  const lists: ListFact[] = [];
  const tables: TableFact[] = [];
  const times: TimeFact[] = [];
  const mailto: string[] = [];
  const tel: string[] = [];
  const addressTextLengths: number[] = [];
  const faq: FaqFacts = {
    detailsSummary: { pairs: 0, questionPairs: 0 },
    definitionList: { pairs: 0, questionPairs: 0 },
    headingParagraph: { pairs: 0, questionPairs: 0 },
  };
  let relAuthor = false;
  let itempropAuthor = false;
  let classMatch = false;
  let bylineSample: string | null = null;
  let bylineSampleOpen = false;
  const markerResults: { selector: string; empty: boolean }[] = [];

  const markerIds = new Set<string>();
  const markerAttributes: string[] = [];
  for (const selector of SPA_ROOT_SELECTORS) {
    if (selector.startsWith("#")) markerIds.add(selector.slice(1));
    else if (selector.startsWith("[") && selector.endsWith("]")) markerAttributes.push(selector.slice(1, -1));
  }
  const markerSelectorsFor = (at: Record<string, string>): string[] => {
    const out: string[] = [];
    const id = at.id;
    if (id !== undefined && markerIds.has(id)) out.push(`#${id}`);
    for (const attribute of markerAttributes) if (attribute in at) out.push(`[${attribute}]`);
    return out;
  };

  const inMain = (): boolean => mainDepth > 0 && excludedDepth === 0;
  const addText = (data: string): void => {
    if (data === "") return;
    if (data.trim() === "") {
      D.separate();
      if (inMain()) M.separate();
      return;
    }
    D.push(data);
    if (inMain()) M.push(data);
  };

  const enter = (node: DomNode): boolean => {
    if (node.type === "text") {
      addText(node.data ?? "");
      return false;
    }
    if (!isElement(node)) return node.type === "root";
    if (invisible.has(node)) return false;
    const name = node.name ?? "";
    const at = attribsOf(node);
    const roles = at.role === undefined ? (EMPTY_STRINGS as string[]) : tokens(at.role);
    let flags = 0;

    if (node === mainRoot) {
      mainDepth++;
      flags |= F_MAIN;
    }
    if (fallback && node !== bodyEl && node !== htmlEl) {
      let excluded = EXCLUDED_FALLBACK_TAGS.has(name) || roles.some((role) => EXCLUDED_FALLBACK_ROLES.has(role));
      if (!excluded) {
        excluded =
          (at.id !== undefined && EXCLUDED_FALLBACK_ID_CLASS.test(at.id)) ||
          (at.class !== undefined && EXCLUDED_FALLBACK_ID_CLASS.test(at.class));
      }
      if (excluded) {
        excludedDepth++;
        flags |= F_EXCLUDED;
      }
    }
    if (name === "nav" || roles.includes("navigation")) {
      navDepth++;
      flags |= F_NAV;
      const fact: NavFact = { source: name === "nav" ? "nav" : "role", sameSiteLinkCount: 0 };
      navigations.push(fact);
      navStack.push({ node, fact, start: sameSiteLinkTotal });
    }
    if (name === "footer" || roles.includes("contentinfo")) {
      footerDepth++;
      flags |= F_FOOTER;
    }
    if (name === "header" || roles.includes("banner")) {
      headerDepth++;
      flags |= F_HEADER;
    }
    const itemprops = at.itemprop === undefined ? (EMPTY_STRINGS as string[]) : tokens(at.itemprop);
    const isAuthorRel = name === "a" && tokens(at.rel).includes("author");
    const isAuthorItemprop = name !== "meta" && name !== "link" && itemprops.includes("author");
    const isAuthorClass = at.class !== undefined && tokens(at.class).some((token) => BYLINE_CLASS_SEGMENT.test(token));
    if (isAuthorRel) relAuthor = true;
    if (isAuthorItemprop) itempropAuthor = true;
    if (isAuthorClass) classMatch = true;
    if (isAuthorRel || isAuthorItemprop || isAuthorClass) {
      bylineDepth++;
      flags |= F_BYLINE;
      if (bylineSample === null && !bylineSampleOpen) {
        bylineSampleOpen = true;
        captures.push({ kind: "byline", node, startD: D.length, startM: M.length });
      }
    }
    if (flags !== 0) flagsOf.set(node, flags);

    const markers = markerSelectorsFor(at);
    if (markers.length > 0) captures.push({ kind: "marker", node, startD: D.length, startM: M.length, selectors: markers });

    if (BLOCK_TAGS.has(name)) {
      D.separate();
      if (inMain()) M.separate();
    }

    const level = HEADING_TAGS.get(name);
    if (level !== undefined) {
      const heading: HeadingFact = { level, text: "", index: headings.length, inMain: inMain() };
      headings.push(heading);
      if (heading.inMain) lastMainHeadingIndex = heading.index;
      captures.push({ kind: "heading", node, startD: D.length, startM: M.length, heading });
      return true;
    }

    switch (name) {
      case "p":
        if (inMain()) captures.push({ kind: "paragraph", node, startD: D.length, startM: M.length });
        break;
      case "a": {
        const hrefAttr = at.href;
        if (hrefAttr === undefined) break;
        const href = hrefAttr.trim();
        const lowerHref = href.slice(0, 7).toLowerCase();
        if (lowerHref === "mailto:") for (const address of parseMailto(href)) pushUnique(mailto, address);
        else if (lowerHref.startsWith("tel:")) {
          const number = parseTel(href);
          if (number !== null) pushUnique(tel, number);
        }
        const url = resolveHref(href);
        const fragmentOnly = href.startsWith("#");
        const isSameSite = url !== null && sameSite(url, pageUrl);
        if (isSameSite && !fragmentOnly) sameSiteLinkTotal++;
        const location: LinkLocation = navDepth > 0 ? "nav" : footerDepth > 0 ? "footer" : inMain() ? "main" : "other";
        const fact: LinkFact = {
          index: links.length,
          href,
          url,
          fragmentOnly,
          sameSite: isSameSite,
          name: "",
          nameSource: "none",
          location,
          rel: tokens(at.rel),
        };
        links.push(fact);
        captures.push({
          kind: "link",
          node,
          startD: D.length,
          startM: M.length,
          link: { fact, ariaLabel: normaliseText(at["aria-label"] ?? ""), imgAlt: null },
        });
        break;
      }
      case "img": {
        const width = parseDimension(at.width);
        const height = parseDimension(at.height);
        const role = at.role === undefined ? null : at.role.trim().toLowerCase();
        const ariaHidden = (at["aria-hidden"] ?? "").trim().toLowerCase() === "true";
        const alt = at.alt === undefined ? null : normaliseText(at.alt);
        images.push({
          index: images.length,
          src: (at.src ?? "").trim(),
          hasAlt: at.alt !== undefined,
          alt,
          role,
          ariaHidden,
          width,
          height,
          isContent: !roles.includes("presentation") && !ariaHidden && !(width !== null && width <= 2) && !(height !== null && height <= 2),
        });
        for (let i = captures.length - 1; i >= 0; i--) {
          const open = captures[i];
          if (open.kind !== "link" || !open.link) continue;
          if (open.link.imgAlt === null && alt !== null && alt !== "") open.link.imgAlt = alt;
          break;
        }
        break;
      }
      case "ul":
      case "ol":
        if (inMain()) {
          let items = 0;
          for (const kid of node.children ?? []) {
            if (isElement(kid) && kid.name === "li" && !invisible.has(kid)) items++;
          }
          lists.push({ ordered: name === "ol", items });
        }
        break;
      case "table":
        if (inMain()) {
          const fact: TableFact = { headerCells: 0, rows: 0 };
          tables.push(fact);
          tableStack.push({ node, fact });
        }
        break;
      case "th":
        if (tableStack.length > 0 && inMain()) tableStack[tableStack.length - 1].fact.headerCells++;
        break;
      case "tr":
        if (tableStack.length > 0 && inMain()) tableStack[tableStack.length - 1].fact.rows++;
        break;
      case "details":
        if (inMain()) detailsStack.push({ node, startM: M.length, summaryText: null, summaryStart: -1, summaryEnd: -1 });
        break;
      case "summary":
        if (inMain() && detailsStack.length > 0 && node.parent === detailsStack[detailsStack.length - 1].node) {
          captures.push({ kind: "summary", node, startD: D.length, startM: M.length });
        }
        break;
      case "dl":
        if (inMain()) dlStack.push({ node, pending: null });
        break;
      case "dt":
      case "dd":
        if (inMain() && dlStack.length > 0) captures.push({ kind: name, node, startD: D.length, startM: M.length });
        break;
      case "address":
        captures.push({ kind: "address", node, startD: D.length, startM: M.length });
        break;
      case "time": {
        const datetime = at.datetime;
        if (datetime === undefined) break;
        const value = datetime.trim();
        const location: TimeLocation = bylineDepth > 0 ? "byline" : headerDepth > 0 ? "header" : inMain() ? "main" : "other";
        times.push({
          datetime: value,
          parsed: parseIsoDate(value),
          location,
          itemprop: at.itemprop === undefined ? null : at.itemprop.trim() || null,
        });
        break;
      }
      default:
        break;
    }
    return true;
  };

  const leave = (node: DomNode): void => {
    if (!isElement(node)) return;
    const name = node.name ?? "";

    while (captures.length > 0 && captures[captures.length - 1].node === node) {
      const capture = captures.pop() as Capture;
      switch (capture.kind) {
        case "heading": {
          if (capture.heading) capture.heading.text = D.slice(capture.startD, D.length, CAPTURE_CHAR_LIMIT);
          break;
        }
        case "paragraph": {
          const text = M.slice(capture.startM, M.length, Number.MAX_SAFE_INTEGER);
          const wordCount = countWords(text);
          if (wordCount >= 1) {
            const sentences = splitSentences(text);
            for (const sentence of sentences) sentenceWordCounts.push(countWords(sentence));
            paragraphWordCounts.push(wordCount);
            paragraphs.push({
              index: paragraphs.length,
              wordCount,
              sentenceCount: sentences.length,
              precedingHeadingIndex: lastMainHeadingIndexAtParagraph.get(node) ?? null,
            });
          }
          break;
        }
        case "link": {
          const link = capture.link;
          if (!link) break;
          const text = D.slice(capture.startD, D.length, CAPTURE_CHAR_LIMIT);
          if (text !== "") {
            link.fact.name = text;
            link.fact.nameSource = "text";
          } else if (link.ariaLabel !== "") {
            link.fact.name = link.ariaLabel;
            link.fact.nameSource = "aria-label";
          } else if (link.imgAlt !== null) {
            link.fact.name = link.imgAlt;
            link.fact.nameSource = "img-alt";
          }
          break;
        }
        case "summary": {
          const context = detailsStack[detailsStack.length - 1];
          if (context && context.summaryText === null && node.parent === context.node) {
            context.summaryText = M.slice(capture.startM, M.length, CAPTURE_CHAR_LIMIT);
            context.summaryStart = capture.startM;
            context.summaryEnd = M.length;
          }
          break;
        }
        case "dt": {
          const context = dlStack[dlStack.length - 1];
          const text = M.slice(capture.startM, M.length, CAPTURE_CHAR_LIMIT);
          if (context && hasWordCharacter(text)) context.pending = text;
          break;
        }
        case "dd": {
          const context = dlStack[dlStack.length - 1];
          if (context && context.pending !== null && M.hasWord(capture.startM, M.length)) {
            faq.definitionList.pairs++;
            if (isQuestionForm(context.pending)) faq.definitionList.questionPairs++;
            context.pending = null;
          }
          break;
        }
        case "address": {
          addressTextLengths.push(codePointLength(D.slice(capture.startD, D.length, CAPTURE_CHAR_LIMIT)));
          break;
        }
        case "marker": {
          const text = D.slice(capture.startD, D.length, CAPTURE_CHAR_LIMIT);
          const units = spaceDelimited ? countWords(text) : countWordCharacters(text, RENDER_WORD_THRESHOLD);
          for (const selector of capture.selectors ?? []) markerResults.push({ selector, empty: units < RENDER_WORD_THRESHOLD });
          break;
        }
        case "byline": {
          const text = D.slice(capture.startD, D.length, CAPTURE_CHAR_LIMIT);
          bylineSampleOpen = false;
          if (text !== "" && bylineSample === null) bylineSample = truncateEvidence(text);
          break;
        }
        default:
          break;
      }
    }

    if (name === "table" && tableStack.length > 0 && tableStack[tableStack.length - 1].node === node) tableStack.pop();
    if (name === "dl" && dlStack.length > 0 && dlStack[dlStack.length - 1].node === node) {
      dlStack.pop();
    }
    if (name === "details" && detailsStack.length > 0 && detailsStack[detailsStack.length - 1].node === node) {
      const context = detailsStack.pop() as DetailsContext;
      if (context.summaryText !== null && hasWordCharacter(context.summaryText)) {
        const hasAnswer = M.hasWord(context.startM, context.summaryStart) || M.hasWord(context.summaryEnd, M.length);
        if (hasAnswer) {
          faq.detailsSummary.pairs++;
          if (isQuestionForm(context.summaryText)) faq.detailsSummary.questionPairs++;
        }
      }
    }
    if (navStack.length > 0 && navStack[navStack.length - 1].node === node) {
      const entry = navStack.pop() as { node: DomNode; fact: NavFact; start: number };
      entry.fact.sameSiteLinkCount = sameSiteLinkTotal - entry.start;
    }

    if (BLOCK_TAGS.has(name)) {
      D.separate();
      if (inMain()) M.separate();
    }

    const flags = flagsOf.get(node);
    if (flags !== undefined) {
      if (flags & F_MAIN) mainDepth--;
      if (flags & F_EXCLUDED) excludedDepth--;
      if (flags & F_NAV) navDepth--;
      if (flags & F_FOOTER) footerDepth--;
      if (flags & F_HEADER) headerDepth--;
      if (flags & F_BYLINE) bylineDepth--;
      flagsOf.delete(node);
    }
  };

  // Paragraph to nearest preceding in-main heading, recorded when the paragraph opens.
  const lastMainHeadingIndexAtParagraph = new Map<DomNode, number | null>();
  const enterWithParagraphs = (node: DomNode): boolean => {
    const descend = enter(node);
    if (descend && isElement(node) && node.name === "p" && captures.length > 0 && captures[captures.length - 1].node === node) {
      lastMainHeadingIndexAtParagraph.set(node, lastMainHeadingIndex);
    }
    return descend;
  };

  walk(htmlEl ?? root, enterWithParagraphs, leave);
  if (sliceBudget.exhausted) caps.add("element_count");

  // -------------------------------------------------------------------------
  // Assemble
  // -------------------------------------------------------------------------
  const visibleText = D.text();
  const mainText = M.text();
  const mainWordCount = countWords(mainText);

  const paragraphIndexByHeading = new Set<number>();
  for (const paragraph of paragraphs) {
    if (paragraph.precedingHeadingIndex !== null) paragraphIndexByHeading.add(paragraph.precedingHeadingIndex);
  }
  for (const heading of headings) {
    if (!heading.inMain || !paragraphIndexByHeading.has(heading.index)) continue;
    faq.headingParagraph.pairs++;
    if (isQuestionForm(heading.text)) faq.headingParagraph.questionPairs++;
  }

  const first400 = mainText.slice(0, 400);
  const byMatch = BY_TEXT.exec(first400);
  const byTextInFirst400 = byMatch !== null;
  let sample: string | null = bylineSample;
  if (sample === null && byMatch !== null) {
    const from = byMatch[0].toLowerCase().startsWith("by") ? byMatch.index : byMatch.index + 1;
    sample = truncateEvidence(first400.slice(from, from + 80).trim());
  }
  const byline: BylineFacts = { relAuthor, itempropAuthor, classMatch, byTextInFirst400, sample };

  const mixedContent: MixedContentRef[] = [];
  if (finalParsed !== null && finalParsed.protocol === "https:") {
    for (const candidate of mixedCandidates) {
      if (mixedContent.length >= MAX_LIST_ENTRIES * 5) break;
      const reference = candidate.ref.trim();
      if (reference === "") continue;
      let resolved: URL;
      try {
        resolved = baseOk === null ? new URL(reference) : new URL(reference, baseOk);
      } catch {
        continue;
      }
      if (resolved.protocol === "http:") {
        mixedContent.push({ url: resolved.href, tag: candidate.tag, kind: candidate.kind });
      }
    }
  }

  const noscriptJsMessages: string[] = [];
  for (const node of noscripts.slice(0, NOSCRIPT_SCAN_LIMIT)) {
    if (noscriptJsMessages.length >= 5) break;
    const text = normaliseText(truncateEvidence(noscriptPlainText(node), NOSCRIPT_CHAR_LIMIT));
    if (text !== "" && NOSCRIPT_JS_MESSAGE.test(text)) {
      const message = truncateEvidence(text);
      if (!noscriptJsMessages.includes(message)) noscriptJsMessages.push(message);
    }
  }
  const spaRootMarkers: string[] = [];
  const populatedRoots: string[] = [];
  for (const selector of SPA_ROOT_SELECTORS) {
    const results = markerResults.filter((entry) => entry.selector === selector);
    if (results.length === 0) continue;
    if (results.some((entry) => entry.empty)) spaRootMarkers.push(selector);
    else populatedRoots.push(selector);
  }
  const reasons: string[] = [];
  const thin = spaceDelimited ? mainWordCount < RENDER_WORD_THRESHOLD : true;
  if (spaceDelimited) {
    reasons.push(
      mainWordCount < RENDER_WORD_THRESHOLD
        ? `main content has ${mainWordCount} words in the raw HTML (below ${RENDER_WORD_THRESHOLD})`
        : `main content has ${mainWordCount} words in the raw HTML`,
    );
  } else {
    reasons.push("word counts do not apply to this language; the verdict rests on markers alone");
  }
  for (const selector of spaRootMarkers) reasons.push(`empty framework root ${selector}`);
  for (const selector of populatedRoots) reasons.push(`framework root ${selector} holds server-rendered content`);
  for (const message of noscriptJsMessages) reasons.push(`noscript message: ${message}`);
  const render: RenderFacts = {
    renderDependent: thin && (spaRootMarkers.length > 0 || noscriptJsMessages.length > 0),
    mainWordCount,
    spaRootMarkers,
    noscriptJsMessages,
    reasons,
  };

  const sentenceMedian = median(sentenceWordCounts);
  const paragraphMedian = median(paragraphWordCounts);
  const main: MainContentFacts = {
    method,
    text: mainText,
    textHash: createHash("sha256").update(mainText, "utf8").digest("hex"),
    wordCount: mainWordCount,
    lead200: takeWords(mainText, 200),
    paragraphs,
    sentences: { count: sentenceWordCounts.length, medianWords: sentenceMedian },
    paragraphStats: { count: paragraphWordCounts.length, medianWords: paragraphMedian },
  };

  const contact: ContactFacts = {
    mailto,
    tel,
    emailsInText: countEmails(visibleText),
    addressTextLengths,
  };

  const capOrder: PageCap[] = ["html_bytes", "element_count", "jsonld_block_bytes", "jsonld_block_count", "jsonld_depth"];
  const capsHit = capOrder.filter((cap) => caps.has(cap));

  return {
    url: pageUrl,
    baseUrl,
    head,
    jsonLd,
    microdataOrRdfa,
    headings,
    main,
    visibleText,
    wordCountApplicable: spaceDelimited,
    links,
    navigations,
    images,
    lists,
    tables,
    faq,
    byline,
    times,
    contact,
    mixedContent,
    render,
    truncated: caps.has("html_bytes") || caps.has("element_count"),
    capsHit,
  };
}
