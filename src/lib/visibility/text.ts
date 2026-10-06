import { EVIDENCE_STRING_MAX } from "./types";
import { QUESTION_STARTERS } from "./lists";

const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/g;
const WHITESPACE_RUN = /[\s\u0085]+/g;
const LETTER_OR_NUMBER = /[\p{L}\p{N}]/u;
const LETTER_OR_NUMBER_AT = /[\p{L}\p{N}]/uy;
const FIRST_WORD_AT = /[\p{L}\p{N}]+(?:['\u2019][\p{L}\p{N}]+)*/uy;

// Plan 4.2.5: NFKC, NBSP to space, remove zero-width characters, collapse whitespace, trim.
export function normaliseText(input: string): string {
  return input
    .normalize("NFKC")
    .replace(ZERO_WIDTH, "")
    .replace(WHITESPACE_RUN, " ")
    .trim();
}

export function foldCase(input: string): string {
  return input.toLowerCase();
}

export function codePointLength(input: string): number {
  let count = 0;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < input.length) {
      const next = input.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) i++;
    }
    count++;
  }
  return count;
}

function isWhitespaceCode(c: number): boolean {
  return (
    c === 32 ||
    (c >= 9 && c <= 13) ||
    c === 0xa0 ||
    c === 0x85 ||
    c === 0x1680 ||
    (c >= 0x2000 && c <= 0x200a) ||
    c === 0x2028 ||
    c === 0x2029 ||
    c === 0x202f ||
    c === 0x205f ||
    c === 0x3000 ||
    c === 0xfeff
  );
}

function isLetterOrNumberAt(text: string, index: number): boolean {
  const c = text.charCodeAt(index);
  if (c < 128) return (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
  LETTER_OR_NUMBER_AT.lastIndex = index;
  return LETTER_OR_NUMBER_AT.test(text);
}

export function hasWordCharacter(text: string): boolean {
  return LETTER_OR_NUMBER.test(text);
}

// Visits whitespace-delimited tokens; stops when visit returns false. A token counts only if it holds a letter or number.
function scanWords(text: string, visit: (tokenEnd: number, count: number) => boolean): void {
  const n = text.length;
  let count = 0;
  let i = 0;
  while (i < n) {
    while (i < n && isWhitespaceCode(text.charCodeAt(i))) i++;
    if (i >= n) break;
    let counted = false;
    while (i < n && !isWhitespaceCode(text.charCodeAt(i))) {
      const c = text.charCodeAt(i);
      const wide = c >= 0xd800 && c <= 0xdbff && i + 1 < n;
      if (!counted && isLetterOrNumberAt(text, i)) {
        counted = true;
        count++;
      }
      i += wide ? 2 : 1;
    }
    if (counted && !visit(i, count)) return;
  }
}

// Code points that are letters or numbers, counting stops at limit (for scripts without word spaces).
export function countWordCharacters(text: string, limit: number = Number.MAX_SAFE_INTEGER): number {
  let count = 0;
  let i = 0;
  while (i < text.length && count < limit) {
    const c = text.charCodeAt(i);
    const wide = c >= 0xd800 && c <= 0xdbff && i + 1 < text.length;
    if (isLetterOrNumberAt(text, i)) count++;
    i += wide ? 2 : 1;
  }
  return count;
}

export function countWords(text: string): number {
  let total = 0;
  scanWords(text, (_end, count) => {
    total = count;
    return true;
  });
  return total;
}

// The text up to and including the nth counted word.
export function takeWords(text: string, n: number): string {
  if (n <= 0) return "";
  let end = -1;
  scanWords(text, (tokenEnd, count) => {
    if (count >= n) {
      end = tokenEnd;
      return false;
    }
    return true;
  });
  return end === -1 ? text : text.slice(0, end);
}

export function isSpaceDelimitedLang(lang: string | null | undefined): boolean {
  if (!lang) return true;
  const dash = lang.indexOf("-");
  const primary = (dash === -1 ? lang : lang.slice(0, dash)).trim().toLowerCase();
  return primary !== "zh" && primary !== "ja" && primary !== "ko" && primary !== "th";
}

function isTerminator(c: number): boolean {
  return c === 46 || c === 33 || c === 63;
}

// Plan 4.2.5: split on [.!?]+ followed by whitespace. Pieces without a counted word are dropped.
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  const n = text.length;
  const push = (piece: string): void => {
    const trimmed = piece.trim();
    if (trimmed !== "" && hasWordCharacter(trimmed)) out.push(trimmed);
  };
  let start = 0;
  let i = 0;
  while (i < n) {
    if (!isTerminator(text.charCodeAt(i))) {
      i++;
      continue;
    }
    let j = i + 1;
    while (j < n && isTerminator(text.charCodeAt(j))) j++;
    if (j < n && isWhitespaceCode(text.charCodeAt(j))) {
      push(text.slice(start, j));
      while (j < n && isWhitespaceCode(text.charCodeAt(j))) j++;
      start = j;
    }
    i = j;
  }
  if (start < n) push(text.slice(start));
  return out;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function isBidiOrDirectionalMark(c: number): boolean {
  return c === 0x061c || c === 0x200e || c === 0x200f || (c >= 0x202a && c <= 0x202e) || (c >= 0x2066 && c <= 0x2069);
}

function isControl(c: number): boolean {
  return c < 0x20 || (c >= 0x7f && c <= 0x9f);
}

function isSeparatorControl(c: number): boolean {
  return (c >= 9 && c <= 13) || c === 0x85 || c === 0x2028 || c === 0x2029;
}

// Evidence strings: control and bidirectional override characters removed, capped by code points.
export function truncateEvidence(input: string, max: number = EVIDENCE_STRING_MAX): string {
  if (max <= 0) return "";
  let out = "";
  let kept = 0;
  let i = 0;
  while (i < input.length && kept < max) {
    const cp = input.codePointAt(i) as number;
    i += cp > 0xffff ? 2 : 1;
    if (isBidiOrDirectionalMark(cp)) continue;
    if (isControl(cp) || cp === 0x2028 || cp === 0x2029) {
      if (isSeparatorControl(cp)) {
        out += " ";
        kept++;
      }
      continue;
    }
    out += String.fromCodePoint(cp);
    kept++;
  }
  return out;
}

function isTrailingCloser(c: number): boolean {
  return (
    isWhitespaceCode(c) ||
    c === 0x22 || // "
    c === 0x27 || // '
    c === 0x29 || // )
    c === 0x5d || // ]
    c === 0x2019 || // right single quote
    c === 0x201d || // right double quote
    c === 0xbb // right guillemet
  );
}

// 4.5 A3.01: a question ends with "?" or starts with a word in QUESTION_STARTERS. Expects normalised text.
export function isQuestionForm(text: string): boolean {
  let end = text.length;
  while (end > 0 && isTrailingCloser(text.charCodeAt(end - 1))) end--;
  if (end > 0 && text.charCodeAt(end - 1) === 63) return true;
  let start = 0;
  while (start < text.length && !isLetterOrNumberAt(text, start)) {
    const c = text.charCodeAt(start);
    start += c >= 0xd800 && c <= 0xdbff && start + 1 < text.length ? 2 : 1;
  }
  if (start >= text.length) return false;
  FIRST_WORD_AT.lastIndex = start;
  const match = FIRST_WORD_AT.exec(text);
  return match !== null && QUESTION_STARTERS.has(foldCase(match[0]));
}

const ISO_DATE =
  /^(\d{4})(?:-(\d{2})(?:-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?(Z|[+-]\d{2}(?::?\d{2})?)?)?)?)?$/;

function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

// ISO 8601 extended format or W3C datetime to ISO 8601 UTC; a date-time without an offset is read as UTC.
export function parseIsoDate(input: string): string | null {
  const value = input.trim();
  if (value.length < 4 || value.length > 40) return null;
  const m = ISO_DATE.exec(value);
  if (m === null) return null;
  const year = Number(m[1]);
  const month = m[2] === undefined ? 1 : Number(m[2]);
  const day = m[3] === undefined ? 1 : Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  const hour = m[4] === undefined ? 0 : Number(m[4]);
  const minute = m[5] === undefined ? 0 : Number(m[5]);
  const second = m[6] === undefined ? 0 : Number(m[6]);
  if (hour > 23 || minute > 59 || second > 59) return null;
  const millis = m[7] === undefined ? 0 : Math.floor(Number(`0.${m[7]}`) * 1000);
  let offsetMinutes = 0;
  const zone = m[8];
  if (zone !== undefined && zone !== "Z") {
    const digits = zone.slice(1).replace(":", "");
    const oh = Number(digits.slice(0, 2));
    const om = digits.length > 2 ? Number(digits.slice(2, 4)) : 0;
    if (oh > 23 || om > 59) return null;
    offsetMinutes = (zone[0] === "-" ? -1 : 1) * (oh * 60 + om);
  }
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, millis);
  const time = date.getTime() - offsetMinutes * 60_000;
  if (Number.isNaN(time)) return null;
  const out = new Date(time);
  const outYear = out.getUTCFullYear();
  if (outYear < 0 || outYear > 9999) return null;
  return out.toISOString();
}
