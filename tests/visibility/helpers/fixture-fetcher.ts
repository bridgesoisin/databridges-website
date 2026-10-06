import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { RobotsGate } from "@/lib/visibility/fetch";
import { normaliseUrl } from "@/lib/visibility/normalise";
import {
  ALLOWED_RESPONSE_HEADERS,
  FETCH_ERROR_CODES,
  type FetchErrorCode,
  type FetchKind,
  type FetchMethod,
  type FetchRecord,
  type FetchRequest,
  type Fetcher,
  type RedirectHop,
  type TlsInfo,
} from "@/lib/visibility/types";

export const FIXTURES_DIR = path.resolve(__dirname, "../fixtures");

export type FixtureTls = { authorized: boolean; error?: string; daysToExpiry?: number };

export type FixtureResource = {
  status?: number;
  headers?: Record<string, string>;
  bodyFile?: string;
  // Not part of the fixture format: lets a synthetic in-memory site carry its bodies without files.
  inlineBody?: string;
  // Not part of the fixture format: the status a HEAD request gets, for example 405 to force a GET fallback.
  headStatus?: number;
  ttfbMs?: number;
  ttfbSamplesMs?: number[];
  tls?: FixtureTls;
  error?: { code: string; message: string };
};

export type FixtureSite = {
  description?: string;
  scannedAt: string;
  inputUrl: string;
  samplingExpectation?: string[];
  samplingNote?: string;
  resources: Record<string, FixtureResource>;
};

export type FixtureMetricExpectation = { result: string; points: number | null };

export type FixtureExpected = {
  outcome: "SCORED" | "BLOCKED_BY_ROBOTS" | "UNREACHABLE";
  partial: boolean;
  scores: { overall: number | null; seo: number | null; aeo: number | null; coverage: number } | null;
  categories: Record<string, { score: number | null; coverage: number; shown: boolean }> | null;
  criticalFindings: string[];
  metrics: Record<string, FixtureMetricExpectation>;
};

export type LoadedFixture = {
  name: string;
  dir: string;
  site: FixtureSite;
  expected: FixtureExpected;
};

export type LoggedRequest = { method: FetchMethod; kind: FetchKind; url: string };

export type FixtureFetcherOptions = {
  // Test emulation of the production fetcher's gate contract: asked before a non-robots request and before
  // every redirect hop; a refusal gives ROBOTS_DISALLOWED (first hop) or REDIRECT_BLOCKED (later hops).
  robotsGate?: RobotsGate;
  // Redirect limit; the production fetcher allows 4.
  maxRedirects?: number;
  // Emulates the job request cap: once this many HTTP requests (hops included) were made, further ones fail
  // with REQUEST_CAP_REACHED, as the production fetcher does.
  maxRequests?: number;
};

const REDIRECT_STATUSES: ReadonlySet<number> = new Set([301, 302, 303, 307, 308]);
const BODY_KINDS: ReadonlySet<FetchKind> = new Set<FetchKind>(["page", "robots", "sitemap", "llms"]);
const ERROR_CODES: ReadonlySet<string> = new Set(FETCH_ERROR_CODES);
const ALLOWED_HEADERS: ReadonlySet<string> = new Set(ALLOWED_RESPONSE_HEADERS);
const ACCEPT_ENCODING = "gzip, br";

export function fixtureNames(): string[] {
  return readdirSync(FIXTURES_DIR)
    .filter((name) => existsSync(path.join(FIXTURES_DIR, name, "site.json")))
    .sort();
}

export function loadFixture(name: string): LoadedFixture {
  const dir = path.join(FIXTURES_DIR, name);
  const site = JSON.parse(readFileSync(path.join(dir, "site.json"), "utf8")) as FixtureSite;
  const expected = JSON.parse(readFileSync(path.join(dir, "expected.json"), "utf8")) as FixtureExpected;
  return { name, dir, site, expected };
}

// The fixture format lists the homepage first in samplingExpectation, but some fixtures omit it.
export function expectedSample(site: FixtureSite): string[] {
  const list = site.samplingExpectation ?? [];
  if (list.length === 0) return [];
  return list[0] === site.inputUrl ? list : [site.inputUrl, ...list];
}

export class FixtureFetcher implements Fetcher {
  // Every request the scanner made, in order, as it asked for it (redirect hops are not listed).
  readonly requests: LoggedRequest[] = [];
  // Every URL an HTTP request was actually made to, redirect hops included.
  readonly hops: string[] = [];
  // Requests for URLs the fixture does not list (answered 404).
  readonly unknown: string[] = [];
  private readonly samples = new Map<string, number>();
  private readonly resources = new Map<string, FixtureResource>();
  private readonly fetchedAt: string;

  constructor(
    private readonly site: FixtureSite,
    private readonly dir: string | null,
    private readonly options: FixtureFetcherOptions = {},
  ) {
    this.fetchedAt = new Date(site.scannedAt).toISOString();
    for (const [key, resource] of Object.entries(site.resources)) {
      if (normaliseUrl(key) !== key) throw new Error(`Fixture resource key is not normalised: ${key}`);
      if (resource.error !== undefined && !ERROR_CODES.has(resource.error.code)) {
        throw new Error(`Fixture resource ${key} uses an unknown error code: ${resource.error.code}`);
      }
      this.resources.set(key, resource);
    }
  }

  get requestCount(): number {
    return this.hops.length;
  }

  private bodyOf(resource: FixtureResource | undefined): string | null {
    if (resource === undefined) return null;
    if (resource.inlineBody !== undefined) return resource.inlineBody;
    if (resource.bodyFile === undefined) return null;
    if (this.dir === null) throw new Error(`Fixture resource uses bodyFile without a directory: ${resource.bodyFile}`);
    return readFileSync(path.join(this.dir, resource.bodyFile), "utf8");
  }

  private nextTtfb(url: string, resource: FixtureResource | undefined): number | null {
    if (resource === undefined) return null;
    const list = resource.ttfbSamplesMs;
    if (list !== undefined && list.length > 0) {
      const count = this.samples.get(url) ?? 0;
      this.samples.set(url, count + 1);
      return list[count % list.length];
    }
    return resource.ttfbMs ?? null;
  }

  private base(req: FetchRequest, url: string): FetchRecord {
    return {
      url,
      finalUrl: url,
      kind: req.kind,
      method: req.method,
      status: null,
      redirectChain: [],
      headers: {},
      contentType: null,
      wireBytes: 0,
      decodedBytes: 0,
      bodyHash: null,
      body: null,
      truncated: false,
      error: null,
      requestAcceptEncoding: null,
      fetchedAt: this.fetchedAt,
      durationMs: 0,
      ttfbMs: null,
      tls: null,
    };
  }

  async fetch(req: FetchRequest): Promise<FetchRecord> {
    const start = normaliseUrl(req.url);
    this.requests.push({ method: req.method, kind: req.kind, url: start ?? req.url });
    if (start === null) {
      return { ...this.base(req, String(req.url)), error: { code: "URL_REJECTED", message: "Target rejected" } };
    }
    const gate = this.options.robotsGate;
    if (gate !== undefined && req.kind !== "robots" && !(await gate(start, req.kind))) {
      return { ...this.base(req, start), error: { code: "ROBOTS_DISALLOWED", message: "Disallowed by robots.txt for this scanner" } };
    }

    const maxRedirects = this.options.maxRedirects ?? 4;
    const chain: RedirectHop[] = [];
    const visited = new Set<string>([start]);
    let current = start;
    for (;;) {
      if (this.hops.length >= (this.options.maxRequests ?? Number.POSITIVE_INFINITY)) {
        const last = chain.length > 0 ? chain[chain.length - 1] : null;
        return {
          ...this.base(req, start),
          finalUrl: last === null ? start : last.url,
          status: last === null ? null : last.status,
          redirectChain: chain,
          error: { code: "REQUEST_CAP_REACHED", message: "The request cap was reached" },
          requestAcceptEncoding: last === null ? null : ACCEPT_ENCODING,
        };
      }
      this.hops.push(current);
      const resource = this.resources.get(current);
      if (resource === undefined) this.unknown.push(current);
      const ttfbMs = this.nextTtfb(current, resource);

      if (resource?.error !== undefined) {
        return {
          ...this.base(req, start),
          finalUrl: current,
          redirectChain: chain,
          error: { code: resource.error.code as FetchErrorCode, message: resource.error.message },
          requestAcceptEncoding: ACCEPT_ENCODING,
        };
      }

      const status = (req.method === "HEAD" ? resource?.headStatus : undefined) ?? resource?.status ?? 404;
      const headers: Record<string, string> = {};
      for (const [name, value] of Object.entries(resource?.headers ?? {})) {
        const lower = name.toLowerCase();
        if (ALLOWED_HEADERS.has(lower)) headers[lower] = value;
      }

      if (REDIRECT_STATUSES.has(status)) {
        const location = headers.location ?? null;
        chain.push({ url: current, status, location });
        if (location === null || location === "") {
          return this.finalRecord(req, start, current, chain, status, headers, resource, ttfbMs);
        }
        const next = normaliseUrl(location, current);
        if (next === null) {
          return this.failedRedirect(req, start, current, chain, status, headers, "URL_REJECTED", "Redirect Location is not a valid URL", ttfbMs);
        }
        if (visited.has(next)) {
          return this.failedRedirect(req, start, current, chain, status, headers, "REDIRECT_LOOP", "Redirect points back to a URL already requested", ttfbMs);
        }
        if (chain.length > maxRedirects) {
          return this.failedRedirect(req, start, current, chain, status, headers, "TOO_MANY_REDIRECTS", `More than ${maxRedirects} redirects`, ttfbMs);
        }
        if (gate !== undefined && !(await gate(next, req.kind))) {
          return this.failedRedirect(req, start, current, chain, status, headers, "REDIRECT_BLOCKED", "ROBOTS_DISALLOWED: Redirect target is disallowed by robots.txt", ttfbMs);
        }
        visited.add(next);
        current = next;
        continue;
      }
      return this.finalRecord(req, start, current, chain, status, headers, resource, ttfbMs);
    }
  }

  private failedRedirect(
    req: FetchRequest,
    start: string,
    current: string,
    chain: RedirectHop[],
    status: number,
    headers: Record<string, string>,
    code: FetchErrorCode,
    message: string,
    ttfbMs: number | null,
  ): FetchRecord {
    return {
      ...this.base(req, start),
      finalUrl: current,
      status,
      redirectChain: chain,
      headers,
      contentType: headers["content-type"] ?? null,
      error: { code, message },
      requestAcceptEncoding: ACCEPT_ENCODING,
      ttfbMs,
    };
  }

  private finalRecord(
    req: FetchRequest,
    start: string,
    current: string,
    chain: RedirectHop[],
    status: number,
    headers: Record<string, string>,
    resource: FixtureResource | undefined,
    ttfbMs: number | null,
  ): FetchRecord {
    const wantsBody = req.method === "GET" && BODY_KINDS.has(req.kind) && !REDIRECT_STATUSES.has(status);
    const body = wantsBody ? this.bodyOf(resource) : null;
    const bytes = body === null ? 0 : Buffer.byteLength(body, "utf8");
    let tls: TlsInfo | null = null;
    if (current.startsWith("https:") && resource?.tls !== undefined) {
      tls = { authorized: resource.tls.authorized };
      if (resource.tls.error !== undefined) tls.error = resource.tls.error;
      if (resource.tls.daysToExpiry !== undefined) tls.daysToExpiry = resource.tls.daysToExpiry;
    }
    return {
      ...this.base(req, start),
      finalUrl: current,
      status,
      redirectChain: chain,
      headers,
      contentType: headers["content-type"] ?? null,
      wireBytes: bytes,
      decodedBytes: bytes,
      bodyHash: body === null ? null : createHash("sha256").update(body).digest("hex"),
      body,
      requestAcceptEncoding: ACCEPT_ENCODING,
      ttfbMs,
      tls,
    };
  }
}

export function createFixtureFetcher(
  source: string | LoadedFixture,
  options: FixtureFetcherOptions = {},
): FixtureFetcher {
  const fixture = typeof source === "string" ? loadFixture(source) : source;
  return new FixtureFetcher(fixture.site, fixture.dir, options);
}

export function createSiteFetcher(site: FixtureSite, options: FixtureFetcherOptions = {}): FixtureFetcher {
  return new FixtureFetcher(site, null, options);
}
