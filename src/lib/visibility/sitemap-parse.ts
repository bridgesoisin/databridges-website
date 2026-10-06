export const SITEMAP_MAX_BYTES = 2 * 1024 * 1024;
export const SITEMAP_MAX_LOCS = 5000;

export type ParsedSitemapKind = "urlset" | "sitemapindex" | "invalid";

export type ParsedSitemap = {
  kind: ParsedSitemapKind;
  locs: string[];
  lastmods: (string | null)[];
  truncated: boolean;
};

type Tag = {
  end: number;
  closing: boolean;
  selfClosing: boolean;
  name: string;
  prefix: string;
  local: string;
};

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decodeEntities(text: string): string {
  if (text.indexOf("&") === -1) return text;
  return text.replace(/&(amp|lt|gt|quot|apos);/g, (_, name: string) => ENTITIES[name]);
}

function capText(text: string): { text: string; truncated: boolean } {
  if (text.length * 3 <= SITEMAP_MAX_BYTES) return { text, truncated: false };
  const buf = Buffer.from(text, "utf8");
  if (buf.length <= SITEMAP_MAX_BYTES) return { text, truncated: false };
  let end = SITEMAP_MAX_BYTES;
  while (end > 0 && (buf[end] & 0xc0) === 0x80) end--;
  return { text: buf.subarray(0, end).toString("utf8"), truncated: true };
}

function readTag(xml: string, lt: number): Tag | null {
  const closing = xml.charCodeAt(lt + 1) === 0x2f;
  const nameStart = lt + (closing ? 2 : 1);
  let i = nameStart;
  while (i < xml.length) {
    const c = xml.charCodeAt(i);
    if (c === 0x3e || c === 0x2f || c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) break;
    i++;
  }
  const name = xml.slice(nameStart, i);
  let quote = 0;
  for (; i < xml.length; i++) {
    const c = xml.charCodeAt(i);
    if (quote !== 0) {
      if (c === quote) quote = 0;
      continue;
    }
    if (c === 0x22 || c === 0x27) quote = c;
    else if (c === 0x3e) break;
  }
  if (i >= xml.length) return null;
  const colon = name.indexOf(":");
  return {
    end: i,
    closing,
    selfClosing: !closing && xml.charCodeAt(i - 1) === 0x2f,
    name,
    prefix: colon === -1 ? "" : name.slice(0, colon),
    local: colon === -1 ? name : name.slice(colon + 1),
  };
}

function skipDoctype(xml: string, start: number): number {
  let depth = 0;
  let quote = 0;
  for (let i = start; i < xml.length; i++) {
    const c = xml.charCodeAt(i);
    if (quote !== 0) {
      if (c === quote) quote = 0;
      continue;
    }
    if (c === 0x3c && xml.startsWith("<!--", i)) {
      const end = xml.indexOf("-->", i + 4);
      if (end === -1) return -1;
      i = end + 2;
      continue;
    }
    if (c === 0x22 || c === 0x27) quote = c;
    else if (c === 0x5b) depth++;
    else if (c === 0x5d) depth = Math.max(0, depth - 1);
    else if (c === 0x3e && depth === 0) return i + 1;
  }
  return -1;
}

// Returns the index after a comment, PI, CDATA section or DOCTYPE starting at lt, -1 when unterminated, or null for an element.
function skipMarkup(xml: string, lt: number): number | null {
  if (xml.startsWith("<!--", lt)) {
    const end = xml.indexOf("-->", lt + 4);
    return end === -1 ? -1 : end + 3;
  }
  if (xml.startsWith("<![CDATA[", lt)) {
    const end = xml.indexOf("]]>", lt + 9);
    return end === -1 ? -1 : end + 3;
  }
  if (xml.startsWith("<?", lt)) {
    const end = xml.indexOf("?>", lt + 2);
    return end === -1 ? -1 : end + 2;
  }
  if (xml.startsWith("<!", lt)) return skipDoctype(xml, lt + 2);
  return null;
}

function readText(xml: string, start: number, tag: Tag): { text: string; next: number } | null {
  let text = "";
  let i = start;
  for (;;) {
    const lt = xml.indexOf("<", i);
    if (lt === -1) return null;
    text += decodeEntities(xml.slice(i, lt));
    if (xml.startsWith("<![CDATA[", lt)) {
      const end = xml.indexOf("]]>", lt + 9);
      if (end === -1) return null;
      text += xml.slice(lt + 9, end);
      i = end + 3;
      continue;
    }
    if (xml.startsWith("<!--", lt)) {
      const end = xml.indexOf("-->", lt + 4);
      if (end === -1) return null;
      i = end + 3;
      continue;
    }
    const close = readTag(xml, lt);
    if (close !== null && close.closing && close.name === tag.name) {
      return { text, next: close.end + 1 };
    }
    return null;
  }
}

function hasWhitespaceOrControl(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c <= 0x20 || c === 0x7f) return true;
  }
  return /\s/.test(value);
}

function acceptLoc(text: string): string | null {
  const value = text.trim();
  if (value === "" || hasWhitespaceOrControl(value) || !/^https?:\/\/[^/?#\\]/i.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

function invalid(truncated: boolean): ParsedSitemap {
  return { kind: "invalid", locs: [], lastmods: [], truncated };
}

function parse(input: string): ParsedSitemap {
  const capped = capText(input);
  let xml = capped.text;
  let truncated = capped.truncated;
  if (xml.charCodeAt(0) === 0xfeff) xml = xml.slice(1);

  const locs: string[] = [];
  const lastmods: (string | null)[] = [];
  let kind: ParsedSitemapKind | null = null;
  let rootName = "";
  let rootPrefix = "";
  let entryName = "";
  let entry: { loc: string | null; lastmod: string | null } | null = null;
  let stop = false;

  const add = (rawLoc: string, rawLastmod: string | null): void => {
    const loc = acceptLoc(rawLoc);
    if (loc === null) return;
    if (locs.length >= SITEMAP_MAX_LOCS) {
      truncated = true;
      stop = true;
      return;
    }
    const lastmod = rawLastmod === null ? null : rawLastmod.trim();
    locs.push(loc);
    lastmods.push(lastmod === null || lastmod === "" ? null : lastmod);
  };

  const flush = (): void => {
    if (entry !== null && entry.loc !== null) add(entry.loc, entry.lastmod);
    entry = null;
  };

  let pos = 0;
  while (!stop) {
    const lt = xml.indexOf("<", pos);
    if (lt === -1) break;
    const skipped = skipMarkup(xml, lt);
    if (skipped !== null) {
      if (skipped === -1) break;
      pos = skipped;
      continue;
    }
    const tag = readTag(xml, lt);
    if (tag === null) break;
    pos = tag.end + 1;

    if (kind === null) {
      if (tag.closing) continue;
      if (tag.local === "urlset") {
        kind = "urlset";
        entryName = "url";
      } else if (tag.local === "sitemapindex") {
        kind = "sitemapindex";
        entryName = "sitemap";
      } else {
        return invalid(truncated);
      }
      rootName = tag.name;
      rootPrefix = tag.prefix;
      if (tag.selfClosing) break;
      continue;
    }

    if (tag.closing && tag.name === rootName) break;
    if (tag.prefix !== rootPrefix) continue;

    if (tag.closing) {
      if (tag.local === entryName) flush();
      continue;
    }
    if (tag.local === entryName) {
      flush();
      if (!tag.selfClosing) entry = { loc: null, lastmod: null };
    } else if ((tag.local === "loc" || tag.local === "lastmod") && !tag.selfClosing) {
      const read = readText(xml, pos, tag);
      if (read === null) continue;
      pos = read.next;
      if (tag.local === "loc") {
        if (entry === null) add(read.text, null);
        else if (entry.loc === null) entry.loc = read.text;
      } else if (entry !== null && entry.lastmod === null) {
        entry.lastmod = read.text;
      }
    }
  }
  if (!stop) flush();

  if (kind === null) return invalid(truncated);
  return { kind, locs, lastmods, truncated };
}

export function parseSitemap(xml: string): ParsedSitemap {
  if (typeof xml !== "string") return invalid(false);
  try {
    return parse(xml);
  } catch {
    return invalid(false);
  }
}

const W3C_DATE =
  /^(\d{4})(?:-(\d{2})(?:-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-](\d{2}):(\d{2})))?)?)?$/;

function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

// W3C Datetime profile of ISO 8601: a time of day requires a timezone designator.
export function isValidW3cDate(value: string): boolean {
  const m = W3C_DATE.exec(value);
  if (m === null) return false;
  const year = Number(m[1]);
  if (m[2] !== undefined) {
    const month = Number(m[2]);
    if (month < 1 || month > 12) return false;
    if (m[3] !== undefined) {
      const day = Number(m[3]);
      if (day < 1 || day > daysInMonth(year, month)) return false;
    }
  }
  if (m[4] !== undefined) {
    if (Number(m[4]) > 23 || Number(m[5]) > 59) return false;
    if (m[6] !== undefined && Number(m[6]) > 59) return false;
    if (m[8] !== undefined && (Number(m[8]) > 23 || Number(m[9]) > 59)) return false;
  }
  return true;
}
