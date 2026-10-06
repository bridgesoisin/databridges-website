import { isIP } from "node:net";
import { normaliseUrl } from "./normalise";

export const MAX_URL_LENGTH = 2048;
export const DEFAULT_ALLOWED_PORTS: readonly number[] = [80, 443];

export const TARGET_REJECT_REASONS = [
  "EMPTY",
  "TOO_LONG",
  "INVALID_URL",
  "SCHEME_NOT_ALLOWED",
  "USERINFO_NOT_ALLOWED",
  "IP_LITERAL_HOST",
  "RESERVED_HOSTNAME",
  "INVALID_HOST",
  "PORT_NOT_ALLOWED",
] as const;
export type TargetRejectReason = (typeof TARGET_REJECT_REASONS)[number];

export type ParseTargetResult =
  | { ok: true; url: string; host: string }
  | { ok: false; reason: TargetRejectReason };

export interface RequestUrl {
  // Exact WHATWG serialisation without the fragment. This is what goes on the wire.
  href: string;
  // normaliseUrl(href): the form stored in records and compared by evaluators.
  url: string;
  // Lowercase ASCII (punycode) hostname, no trailing dot.
  host: string;
  // Effective port (the scheme default when none is written).
  port: number;
  protocol: "http:" | "https:";
  // Path and query exactly as parsed.
  path: string;
}

export type ParseRequestUrlResult = ({ ok: true } & RequestUrl) | { ok: false; reason: TargetRejectReason };

export interface ParseOptions {
  allowedPorts?: readonly number[];
}

const SCHEME_WITH_SLASHES = /^[a-z][a-z0-9+.-]*:\/\//i;
const SCHEME_ONLY = /^[a-z][a-z0-9+.-]*:/i;
const HOST_AND_PORT = /^[^/?#:@\\[]+:\d+(?:[/?#\\]|$)/;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const RESERVED_SUFFIXES = [".localhost", ".local", ".internal", ".test"] as const;
const RESERVED_BARE_HOSTS: ReadonlySet<string> = new Set(["localhost", "local", "internal", "test"]);

function withDefaultScheme(input: string): string {
  if (SCHEME_WITH_SLASHES.test(input)) return input;
  if (input.startsWith("//")) return `https:${input}`;
  if (SCHEME_ONLY.test(input) && !HOST_AND_PORT.test(input)) return input;
  return `https://${input}`;
}

function authorityOf(input: string): string {
  const start = input.indexOf("://");
  if (start === -1) return "";
  const rest = input.slice(start + 3);
  const end = rest.search(/[/?#\\]/);
  return end === -1 ? rest : rest.slice(0, end);
}

function reject(reason: TargetRejectReason): { ok: false; reason: TargetRejectReason } {
  return { ok: false, reason };
}

function validHostname(host: string): boolean {
  if (host.length === 0 || host.length > 253) return false;
  return host.split(".").every((label) => label.length >= 1 && label.length <= 63);
}

export function parseRequestUrl(input: string, options: ParseOptions = {}): ParseRequestUrlResult {
  const allowedPorts = options.allowedPorts ?? DEFAULT_ALLOWED_PORTS;
  if (typeof input !== "string") return reject("INVALID_URL");
  const trimmed = input.trim();
  if (trimmed.length === 0) return reject("EMPTY");
  if (trimmed.length > MAX_URL_LENGTH) return reject("TOO_LONG");
  if (CONTROL_CHARS.test(trimmed)) return reject("INVALID_URL");

  const candidate = withDefaultScheme(trimmed);
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return reject("INVALID_URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return reject("SCHEME_NOT_ALLOWED");
  if (parsed.username !== "" || parsed.password !== "" || authorityOf(candidate).includes("@")) {
    return reject("USERINFO_NOT_ALLOWED");
  }

  let host = parsed.hostname.toLowerCase();
  if (host.startsWith("[")) return reject("IP_LITERAL_HOST");
  if (host.endsWith(".")) host = host.slice(0, -1);
  if (isIP(host) !== 0) return reject("IP_LITERAL_HOST");
  if (!validHostname(host)) return reject("INVALID_HOST");
  if (RESERVED_BARE_HOSTS.has(host) || RESERVED_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return reject("RESERVED_HOSTNAME");
  }

  const protocol = parsed.protocol;
  const port = parsed.port === "" ? (protocol === "https:" ? 443 : 80) : Number(parsed.port);
  if (!allowedPorts.includes(port)) return reject("PORT_NOT_ALLOWED");

  parsed.hostname = host;
  parsed.hash = "";
  const href = parsed.href;
  if (href.length > MAX_URL_LENGTH) return reject("TOO_LONG");
  const url = normaliseUrl(href);
  if (url === null) return reject("INVALID_URL");

  return { ok: true, href, url, host, port, protocol, path: `${parsed.pathname}${parsed.search}` };
}

export function parseTarget(input: string): ParseTargetResult {
  const result = parseRequestUrl(input);
  if (!result.ok) return result;
  return { ok: true, url: result.url, host: result.host };
}
