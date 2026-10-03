import type { FetchRecord } from "./types";

export const ROBOTS_PARSE_CAP_BYTES = 512 * 1024;

export type RobotsRule = {
  allow: boolean;
  raw: string;
  segments: string[];
  anchored: boolean;
  length: number;
};

export type RobotsGroup = { agents: string[]; rules: RobotsRule[] };

export type ParsedRobots = {
  groups: RobotsGroup[];
  sitemaps: string[];
  truncated: boolean;
};

export type RobotsAccess =
  | { kind: "rules"; rules: ParsedRobots }
  | { kind: "allow-all" }
  | { kind: "error" };

export type RobotsDecision = {
  allowed: boolean;
  group: "specific" | "wildcard" | "none";
  rule: { allow: boolean; pattern: string } | null;
};

// URL encodes an apostrophe in the query but not the path; encoding it on both sides keeps rule and URL in one form.
const UNSAFE_ASCII = new Set([0x22, 0x27, 0x3c, 0x3e, 0x5c, 0x5e, 0x60, 0x7b, 0x7c, 0x7d]);

function isHex(code: number): boolean {
  return (
    (code >= 0x30 && code <= 0x39) ||
    (code >= 0x41 && code <= 0x46) ||
    (code >= 0x61 && code <= 0x66)
  );
}

function isUnreservedByte(b: number): boolean {
  return (
    (b >= 0x30 && b <= 0x39) ||
    (b >= 0x41 && b <= 0x5a) ||
    (b >= 0x61 && b <= 0x7a) ||
    b === 0x2d ||
    b === 0x2e ||
    b === 0x5f ||
    b === 0x7e
  );
}

// RFC 9309 2.2.2: percent-encode non-ASCII and unsafe octets, upper-case hex, decode unreserved escapes only.
function canonicalise(input: string): string {
  let out = "";
  let i = 0;
  while (i < input.length) {
    const code = input.charCodeAt(i);
    if (
      code === 0x25 &&
      i + 2 < input.length &&
      isHex(input.charCodeAt(i + 1)) &&
      isHex(input.charCodeAt(i + 2))
    ) {
      const hex = input.slice(i + 1, i + 3);
      const byte = parseInt(hex, 16);
      out += isUnreservedByte(byte) ? String.fromCharCode(byte) : `%${hex.toUpperCase()}`;
      i += 3;
      continue;
    }
    if (code > 0x20 && code < 0x7f && !UNSAFE_ASCII.has(code)) {
      out += input[i];
      i += 1;
      continue;
    }
    const cp = input.codePointAt(i) ?? code;
    const len = cp > 0xffff ? 2 : 1;
    for (const byte of Buffer.from(input.slice(i, i + len), "utf8")) {
      out += `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
    }
    i += len;
  }
  return out;
}

function productToken(value: string): string {
  const m = /^[^\s/,;(]+/.exec(value.trim());
  return m ? m[0].toLowerCase() : "";
}

function compileRule(allow: boolean, raw: string): RobotsRule | null {
  if (raw === "" || (raw[0] !== "/" && raw[0] !== "*")) return null;
  const canon = canonicalise(raw);
  const anchored = canon.endsWith("$");
  const body = anchored ? canon.slice(0, -1) : canon;
  return { allow, raw, segments: body.split("*"), anchored, length: canon.length };
}

function matchRule(rule: RobotsRule, target: string): boolean {
  const { segments, anchored } = rule;
  const first = segments[0];
  if (!target.startsWith(first)) return false;
  let pos = first.length;
  if (segments.length === 1) return anchored ? pos === target.length : true;
  const last = segments.length - 1;
  for (let i = 1; i < last; i++) {
    const idx = target.indexOf(segments[i], pos);
    if (idx === -1) return false;
    pos = idx + segments[i].length;
  }
  const tail = segments[last];
  if (!anchored) return target.indexOf(tail, pos) !== -1;
  return target.length - tail.length >= pos && target.endsWith(tail);
}

function capUtf8(
  text: string,
  maxBytes: number
): { text: string; truncated: boolean; atLineBoundary: boolean } {
  if (text.length * 3 <= maxBytes) return { text, truncated: false, atLineBoundary: true };
  const buf = Buffer.from(text, "utf8");
  if (buf.length <= maxBytes) return { text, truncated: false, atLineBoundary: true };
  let end = maxBytes;
  while (end > 0 && (buf[end] & 0xc0) === 0x80) end--;
  const next = buf[end];
  return {
    text: buf.subarray(0, end).toString("utf8"),
    truncated: true,
    atLineBoundary: next === 0x0a || next === 0x0d,
  };
}

function absoluteHttpUrl(value: string): string | null {
  if (!/^https?:\/\/[^/?#\\\s]/i.test(value) || /[\u0000- \u007f\s]/.test(value)) return null;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

export function parseRobots(text: string): ParsedRobots {
  const result: ParsedRobots = { groups: [], sitemaps: [], truncated: false };
  if (typeof text !== "string" || text === "") return result;

  const capped = capUtf8(text, ROBOTS_PARSE_CAP_BYTES);
  let body = capped.text;
  if (capped.truncated) {
    result.truncated = true;
    if (!capped.atLineBoundary) {
      const cut = Math.max(body.lastIndexOf("\n"), body.lastIndexOf("\r"));
      body = cut >= 0 ? body.slice(0, cut) : "";
    }
  }
  if (body.charCodeAt(0) === 0xfeff) body = body.slice(1);

  const seenSitemaps = new Set<string>();
  let current: RobotsGroup | null = null;
  let ruleSeen = false;

  for (const rawLine of body.split(/\r\n|\r|\n/)) {
    const hash = rawLine.indexOf("#");
    const line = (hash === -1 ? rawLine : rawLine.slice(0, hash)).trim();
    if (line === "") continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (key === "user-agent") {
      if (current === null || ruleSeen) {
        current = { agents: [], rules: [] };
        result.groups.push(current);
        ruleSeen = false;
      }
      const token = productToken(value);
      if (token !== "" && !current.agents.includes(token)) current.agents.push(token);
    } else if (key === "allow" || key === "disallow") {
      if (current === null) continue;
      ruleSeen = true;
      const rule = compileRule(key === "allow", value);
      if (rule !== null) current.rules.push(rule);
    } else if (key === "sitemap") {
      const url = absoluteHttpUrl(value);
      if (url !== null && !seenSitemaps.has(url)) {
        seenSitemaps.add(url);
        result.sitemaps.push(url);
      }
    }
  }
  return result;
}

function selectRules(
  rules: ParsedRobots,
  agentToken: string
): { rules: RobotsRule[]; group: RobotsDecision["group"] } {
  const token = productToken(agentToken) || "*";
  const specific = rules.groups.filter((g) => g.agents.includes(token));
  if (specific.length > 0) {
    return {
      rules: specific.flatMap((g) => g.rules),
      group: token === "*" ? "wildcard" : "specific",
    };
  }
  const wildcard = rules.groups.filter((g) => g.agents.includes("*"));
  if (wildcard.length > 0) {
    return { rules: wildcard.flatMap((g) => g.rules), group: "wildcard" };
  }
  return { rules: [], group: "none" };
}

function pathAndQuery(absoluteUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(absoluteUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  // URL.search is "" for a bare trailing "?", which a rule such as /*? still has to see.
  const emptyQuery = url.search === "" && url.href.split("#", 1)[0].endsWith("?");
  return canonicalise(url.pathname + url.search + (emptyQuery ? "?" : ""));
}

export function explainRobots(
  rules: ParsedRobots,
  agentToken: string,
  absoluteUrl: string
): RobotsDecision {
  const selected = selectRules(rules, agentToken);
  const target = pathAndQuery(absoluteUrl);
  if (target === null) return { allowed: true, group: selected.group, rule: null };

  let best: RobotsRule | null = null;
  for (const rule of selected.rules) {
    if (!matchRule(rule, target)) continue;
    if (
      best === null ||
      rule.length > best.length ||
      (rule.length === best.length && rule.allow && !best.allow)
    ) {
      best = rule;
    }
  }
  return {
    allowed: best === null ? true : best.allow,
    group: selected.group,
    rule: best === null ? null : { allow: best.allow, pattern: best.raw },
  };
}

export function isAllowed(
  rules: ParsedRobots,
  agentToken: string,
  absoluteUrl: string
): boolean {
  return explainRobots(rules, agentToken, absoluteUrl).allowed;
}

export function declaredSitemaps(rules: ParsedRobots): string[] {
  return rules.sitemaps.slice();
}

const SIZE_CAP_CODES: ReadonlySet<string> = new Set([
  "RESPONSE_TOO_LARGE",
  "DECOMPRESSED_TOO_LARGE",
]);

export function robotsFromRecord(record: FetchRecord): RobotsAccess {
  const status = record.status;
  if (status !== null && status >= 400 && status <= 499) return { kind: "allow-all" };
  if (status === null || status < 200 || status > 299) return { kind: "error" };
  if (record.body === null) return { kind: "error" };
  const error = record.error;
  if (error !== null && !SIZE_CAP_CODES.has(error.code)) return { kind: "error" };

  const rules = parseRobots(record.body);
  if (record.truncated || error !== null) rules.truncated = true;
  return { kind: "rules", rules };
}
