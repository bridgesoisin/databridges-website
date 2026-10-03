import { createHash } from "node:crypto";
import { promises as dnsPromises } from "node:dns";
import * as http from "node:http";
import * as https from "node:https";
import type { LookupFunction } from "node:net";
import type { Transform } from "node:stream";
import type { TLSSocket } from "node:tls";
import * as zlib from "node:zlib";
import { OWN_USER_AGENT } from "./lists";
import {
  GuardError,
  isBlockedAddress,
  resolveAndValidate,
  type Resolver,
  type ValidatedAddress,
} from "./net-guard";
import { normaliseUrl, siteHost } from "./normalise";
import {
  ALLOWED_RESPONSE_HEADERS,
  FETCH_KINDS,
  FETCH_METHODS,
  type FetchError,
  type FetchErrorCode,
  type FetchKind,
  type FetchMethod,
  type FetchRecord,
  type FetchRequest,
  type Fetcher,
  type RedirectHop,
  type ScanStats,
  type TlsInfo,
} from "./types";
import { DEFAULT_ALLOWED_PORTS, MAX_URL_LENGTH, parseRequestUrl, type RequestUrl } from "./url";

type TrustAnchors = string | Buffer | readonly (string | Buffer)[];

export const DEFAULT_ALLOWED_HOSTS: readonly string[] = ["databridges.ie", "www.databridges.ie"];
export const EXTRA_HOSTS_ENV = "VISIBILITY_EXTRA_HOSTS";

// Plan 5.3. MB and KB are read as decimal (the smaller reading); KiB is binary where the plan says KiB.
export interface FetchLimits {
  connectTimeoutMs: number;
  requestTimeoutMs: number;
  deadlineMs: number;
  maxRedirects: number;
  maxRequests: number;
  maxConcurrent: number;
  maxPerHost: number;
  minHostIntervalMs: number;
  retryDelayMs: number;
  wireCapBytes: number;
  decodedCapBytes: number;
  headerCapBytes: number;
}

export const PRODUCTION_LIMITS: Readonly<FetchLimits> = Object.freeze({
  connectTimeoutMs: 3_000,
  requestTimeoutMs: 8_000,
  deadlineMs: 20_000,
  maxRedirects: 4,
  maxRequests: 60,
  maxConcurrent: 3,
  maxPerHost: 2,
  minHostIntervalMs: 250,
  retryDelayMs: 1_000,
  wireCapBytes: 1_000_000,
  decodedCapBytes: 3_000_000,
  headerCapBytes: 32_000,
});

export interface GuardedFetcher extends Fetcher {
  stats(): ScanStats;
  // True when the request was retried after a 5xx or a timeout (plan 5.3). FetchRecord has no field for it.
  wasRetried(req: FetchRequest): boolean;
  // Stops the job timer. Safe to call more than once.
  close(): void;
}

export interface GuardedFetcherOptions {
  // Replaces DEFAULT_ALLOWED_HOSTS. VISIBILITY_EXTRA_HOSTS is always added on top.
  allowedHosts?: readonly string[];
  // Supplies DNS answers. Whatever it returns is still validated before any connection.
  resolver?: Resolver;
  // Scan time source for fetchedAt and certificate days-to-expiry.
  now?: () => Date;
  // Job deadline; can be shortened but never raised above 20 s.
  deadlineMs?: number;
  // Own-agent robots.txt gate (plan 4.2.1). Return false to refuse a non-robots request without sending it.
  robotsGate?: RobotsGate;
}

export type RobotsGate = (url: string, kind: FetchKind) => boolean | Promise<boolean>;

type KindPolicy = {
  readBody: boolean;
  prefix: boolean;
  prefixCap: number;
  types: readonly string[];
  retry: boolean;
  accept: string;
};

const KIND_POLICY: Readonly<Record<FetchKind, KindPolicy>> = {
  page: {
    readBody: true,
    prefix: false,
    prefixCap: 0,
    types: ["text/html", "application/xhtml+xml"],
    retry: true,
    accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
  },
  robots: {
    readBody: true,
    prefix: true,
    prefixCap: 512 * 1024,
    types: ["text/plain"],
    retry: false,
    accept: "text/plain,*/*;q=0.1",
  },
  sitemap: {
    readBody: true,
    prefix: true,
    prefixCap: 2_000_000,
    types: ["application/xml", "text/xml", "text/plain"],
    retry: true,
    accept: "application/xml,text/xml;q=0.9,text/plain;q=0.8,*/*;q=0.1",
  },
  llms: {
    readBody: true,
    prefix: true,
    prefixCap: 256_000,
    types: ["text/plain", "text/markdown", "text/x-markdown"],
    retry: false,
    accept: "text/plain,text/markdown;q=0.9,*/*;q=0.1",
  },
  "http-variant": { readBody: false, prefix: false, prefixCap: 0, types: [], retry: false, accept: "*/*" },
  "link-check": { readBody: false, prefix: false, prefixCap: 0, types: [], retry: true, accept: "*/*" },
  timing: { readBody: false, prefix: false, prefixCap: 0, types: [], retry: false, accept: "*/*" },
};

const ACCEPT_ENCODING = "gzip, br";
const DAY_MS = 86_400_000;
const REDIRECT_STATUSES: ReadonlySet<number> = new Set([301, 302, 303, 307, 308]);
const ALLOWED_HEADER_SET: ReadonlySet<string> = new Set<string>(ALLOWED_RESPONSE_HEADERS);
const POLICY_REFUSALS: ReadonlySet<FetchErrorCode> = new Set<FetchErrorCode>([
  "URL_REJECTED",
  "HOST_NOT_ALLOWLISTED",
  "ADDRESS_BLOCKED",
  "ROBOTS_DISALLOWED",
]);
const CERT_ERROR_CODES: ReadonlySet<string> = new Set([
  "UNABLE_TO_GET_ISSUER_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_DECRYPT_CERT_SIGNATURE",
  "UNABLE_TO_DECODE_ISSUER_PUBLIC_KEY",
  "CERT_SIGNATURE_FAILURE",
  "CERT_NOT_YET_VALID",
  "CERT_HAS_EXPIRED",
  "ERROR_IN_CERT_NOT_BEFORE_FIELD",
  "ERROR_IN_CERT_NOT_AFTER_FIELD",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "CERT_CHAIN_TOO_LONG",
  "CERT_REVOKED",
  "INVALID_CA",
  "PATH_LENGTH_EXCEEDED",
  "INVALID_PURPOSE",
  "CERT_UNTRUSTED",
  "CERT_REJECTED",
  "HOSTNAME_MISMATCH",
  "ERR_TLS_CERT_ALTNAME_INVALID",
]);

class Failure extends Error {
  readonly code: FetchErrorCode;
  readonly certCode: string | null;

  constructor(code: FetchErrorCode, message: string, certCode: string | null = null) {
    super(message);
    this.name = "Failure";
    this.code = code;
    this.certCode = certCode;
  }
}

type RawTls = {
  authorized: boolean;
  error: string | null;
  validToIso: string | null;
};

type Attempt = {
  status: number | null;
  headers: Record<string, string>;
  contentType: string | null;
  wireBytes: number;
  decodedBytes: number;
  body: Buffer | null;
  truncated: boolean;
  ttfbMs: number | null;
  tls: RawTls | null;
  failure: Failure | null;
  // Set when a verified TLS attempt was refused for a certificate reason on the way to this attempt.
  certFailure: string | null;
};

type ChainOutcome = {
  finalHref: string | null;
  chain: { href: string; status: number; location: string | null }[];
  attempt: Attempt | null;
  failure: Failure | null;
  requested: boolean;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clip(text: string): string {
  return text.length > 200 ? `${text.slice(0, 197)}...` : text;
}

class Scheduler {
  private active = 0;
  private readonly perHost = new Map<string, number>();
  private readonly nextStart = new Map<string, number>();
  private waiting: { key: string; resolve: (release: () => void) => void }[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private rejection: Failure | null = null;
  private readonly rejecters = new Map<{ key: string; resolve: (release: () => void) => void }, (f: Failure) => void>();

  constructor(private readonly limits: Pick<FetchLimits, "maxConcurrent" | "maxPerHost" | "minHostIntervalMs">) {}

  acquire(key: string): Promise<() => void> {
    if (this.rejection) return Promise.reject(this.rejection);
    return new Promise((resolve, reject) => {
      const waiter = { key, resolve };
      this.rejecters.set(waiter, reject);
      this.waiting.push(waiter);
      this.pump();
    });
  }

  failAll(failure: Failure): void {
    this.rejection = failure;
    this.clearTimer();
    const waiting = this.waiting;
    this.waiting = [];
    for (const waiter of waiting) {
      this.rejecters.get(waiter)?.(failure);
      this.rejecters.delete(waiter);
    }
  }

  close(): void {
    this.clearTimer();
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private pump(): void {
    this.clearTimer();
    let soonest = Number.POSITIVE_INFINITY;
    const now = performance.now();
    for (let i = 0; i < this.waiting.length && this.active < this.limits.maxConcurrent; ) {
      const waiter = this.waiting[i];
      if ((this.perHost.get(waiter.key) ?? 0) >= this.limits.maxPerHost) {
        i += 1;
        continue;
      }
      const wait = (this.nextStart.get(waiter.key) ?? 0) - now;
      if (wait > 0) {
        soonest = Math.min(soonest, wait);
        i += 1;
        continue;
      }
      this.waiting.splice(i, 1);
      this.rejecters.delete(waiter);
      this.start(waiter);
    }
    if (this.waiting.length > 0 && Number.isFinite(soonest)) {
      this.timer = setTimeout(() => {
        this.timer = null;
        this.pump();
      }, Math.ceil(soonest));
    }
  }

  private start(waiter: { key: string; resolve: (release: () => void) => void }): void {
    this.active += 1;
    this.perHost.set(waiter.key, (this.perHost.get(waiter.key) ?? 0) + 1);
    this.nextStart.set(waiter.key, performance.now() + this.limits.minHostIntervalMs);
    let released = false;
    waiter.resolve(() => {
      if (released) return;
      released = true;
      this.active -= 1;
      this.perHost.set(waiter.key, (this.perHost.get(waiter.key) ?? 1) - 1);
      this.pump();
    });
  }
}

class JobState {
  readonly startedAt = performance.now();
  requestCount = 0;
  requestCapReached = false;
  timedOut = false;
  lastActivityAt: number | null = null;
  readonly aborters = new Set<(failure: Failure) => void>();
  readonly deadline: Promise<never>;
  private rejectDeadline: (failure: Failure) => void = () => undefined;
  private readonly timer: ReturnType<typeof setTimeout>;

  constructor(
    private readonly limits: Pick<FetchLimits, "deadlineMs" | "maxRequests">,
    private readonly scheduler: Scheduler,
  ) {
    this.deadline = new Promise<never>((_, reject) => {
      this.rejectDeadline = reject;
    });
    this.deadline.catch(() => undefined);
    this.timer = setTimeout(() => this.expire(), limits.deadlineMs);
    this.timer.unref();
  }

  remainingMs(): number {
    return this.limits.deadlineMs - (performance.now() - this.startedAt);
  }

  assertAlive(): void {
    if (this.timedOut || this.remainingMs() <= 0) {
      this.expire();
      throw this.timeoutFailure();
    }
  }

  beginRequest(): void {
    if (this.requestCount >= this.limits.maxRequests) {
      this.requestCapReached = true;
      throw new Failure("REQUEST_CAP_REACHED", `Request cap of ${this.limits.maxRequests} per job reached`);
    }
    this.requestCount += 1;
  }

  race<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([promise, this.deadline]);
  }

  touch(): void {
    this.lastActivityAt = performance.now();
  }

  close(): void {
    clearTimeout(this.timer);
  }

  private timeoutFailure(): Failure {
    return new Failure("JOB_TIMEOUT", `Job deadline of ${this.limits.deadlineMs} ms reached`);
  }

  private expire(): void {
    if (this.timedOut) return;
    this.timedOut = true;
    const failure = this.timeoutFailure();
    this.scheduler.failAll(failure);
    this.rejectDeadline(failure);
    for (const abort of [...this.aborters]) abort(failure);
  }
}

function toFailure(error: unknown): Failure {
  if (error instanceof Failure) return error;
  if (error instanceof GuardError) return new Failure(error.code, error.message);
  const message = error instanceof Error ? error.message : String(error);
  return new Failure("UNKNOWN", clip(message));
}

function mapNetworkError(error: unknown, connected: boolean): Failure {
  const err = error as NodeJS.ErrnoException | undefined;
  const code = err?.code;
  const message = clip(err?.message ?? String(error));
  if (code === "ECONNREFUSED") return new Failure("CONNECT_REFUSED", message);
  if (code === "ETIMEDOUT") return new Failure(connected ? "TIMEOUT" : "CONNECT_TIMEOUT", message);
  if (code === "EHOSTUNREACH" || code === "ENETUNREACH" || code === "EADDRNOTAVAIL" || code === "EACCES") {
    return new Failure("CONNECT_REFUSED", message);
  }
  if (code === "ECONNRESET" || code === "EPIPE" || code === "ECONNABORTED" || message === "socket hang up") {
    return new Failure("CONNECTION_RESET", message);
  }
  if (code === "HPE_HEADER_OVERFLOW") return new Failure("HEADERS_TOO_LARGE", message);
  if (code?.startsWith("HPE_")) return new Failure("PROTOCOL_ERROR", message);
  if (code && (CERT_ERROR_CODES.has(code) || code.startsWith("ERR_TLS_CERT"))) {
    return new Failure("TLS_ERROR", message, code);
  }
  if (code === "EPROTO" || code?.startsWith("ERR_SSL") || code?.startsWith("ERR_TLS")) {
    return new Failure("TLS_ERROR", message);
  }
  if (code?.startsWith("ERR_HTTP") || code === "ERR_INVALID_CHAR") return new Failure("PROTOCOL_ERROR", message);
  return new Failure("UNKNOWN", message);
}

function pickHeaders(rawHeaders: readonly string[]): Record<string, string> {
  const headers: Record<string, string> = {};
  for (let i = 0; i + 1 < rawHeaders.length; i += 2) {
    const name = rawHeaders[i].toLowerCase();
    if (!ALLOWED_HEADER_SET.has(name)) continue;
    const value = rawHeaders[i + 1].trim();
    headers[name] = name in headers ? `${headers[name]}, ${value}` : value;
  }
  return headers;
}

function mimeOf(contentType: string | null): string {
  return contentType ? contentType.split(";")[0].trim().toLowerCase() : "";
}

function isTextual(mime: string): boolean {
  return (
    mime.startsWith("text/") ||
    mime.endsWith("+xml") ||
    mime.endsWith("+json") ||
    mime === "application/xml" ||
    mime === "application/json" ||
    mime === "application/javascript"
  );
}

function decodeText(body: Buffer, contentType: string | null): string {
  const label = /charset\s*=\s*"?([^";\s]+)/i.exec(contentType ?? "")?.[1] ?? "utf-8";
  try {
    return new TextDecoder(label, { fatal: false }).decode(body);
  } catch {
    return new TextDecoder("utf-8", { fatal: false }).decode(body);
  }
}

// Node ignores maxOutputLength on streams today; the byte counter in performRequest is the control that holds.
function makeDecoder(encoding: "gzip" | "deflate" | "br", first: number, second: number, maxOutputLength: number): Transform {
  const options = { maxOutputLength };
  if (encoding === "gzip") return zlib.createGunzip(options);
  if (encoding === "br") return zlib.createBrotliDecompress(options);
  const zlibWrapped = (first & 0x0f) === 8 && ((first << 8) | second) % 31 === 0;
  return zlibWrapped ? zlib.createInflate(options) : zlib.createInflateRaw(options);
}

function captureTls(socket: TLSSocket): RawTls {
  let validToIso: string | null = null;
  try {
    const validTo = socket.getPeerCertificate(false)?.valid_to;
    const parsed = validTo ? Date.parse(validTo) : Number.NaN;
    if (!Number.isNaN(parsed)) validToIso = new Date(parsed).toISOString();
  } catch {
    validToIso = null;
  }
  const authError = socket.authorizationError as unknown;
  let error: string | null = null;
  if (typeof authError === "string") error = authError;
  else if (authError instanceof Error) error = (authError as NodeJS.ErrnoException).code ?? authError.message;
  return { authorized: socket.authorized === true, error, validToIso };
}

function pinnedLookup(host: string, address: ValidatedAddress): LookupFunction {
  return (hostname, options, callback) => {
    const wantedFamily = typeof options?.family === "number" ? options.family : 0;
    if (hostname.toLowerCase() !== host || (wantedFamily !== 0 && wantedFamily !== address.family)) {
      const error: NodeJS.ErrnoException = new Error(`Unexpected lookup for ${hostname}`);
      error.code = "ENOTFOUND";
      callback(error, "", 0);
      return;
    }
    if (options?.all) {
      (callback as unknown as (e: null, a: { address: string; family: number }[]) => void)(null, [
        { address: address.address, family: address.family },
      ]);
    } else {
      callback(null, address.address, address.family);
    }
  };
}

type RequestArgs = {
  target: RequestUrl;
  address: ValidatedAddress;
  method: FetchMethod;
  kind: FetchKind;
  rejectUnauthorized: boolean;
  ca: TrustAnchors | undefined;
  limits: FetchLimits;
  job: JobState;
};

function performRequest(args: RequestArgs): Promise<Attempt> {
  const { target, address, method, kind, limits, job } = args;
  const kp = KIND_POLICY[kind];
  const isTls = target.protocol === "https:";

  return new Promise<Attempt>((resolve) => {
    let settled = false;
    let req: http.ClientRequest | null = null;
    let res: http.IncomingMessage | null = null;
    let decoder: Transform | null = null;
    let connectTimer: ReturnType<typeof setTimeout> | null = null;
    let totalTimer: ReturnType<typeof setTimeout> | null = null;
    let connectedAt: number | null = null;
    let firstByteAt: number | null = null;
    let tls: RawTls | null = null;
    let status: number | null = null;
    let headers: Record<string, string> = {};
    let bodyRead = false;
    let truncated = false;
    let wire = 0;
    let decoded = 0;
    let kept = 0;
    const chunks: Buffer[] = [];

    const done = (failure: Failure | null): void => {
      if (settled) return;
      settled = true;
      if (connectTimer) clearTimeout(connectTimer);
      if (totalTimer) clearTimeout(totalTimer);
      job.aborters.delete(abort);
      const body = failure === null && bodyRead ? Buffer.concat(chunks) : null;
      const ttfbMs =
        connectedAt !== null && firstByteAt !== null ? Math.max(0, Math.round(firstByteAt - connectedAt)) : null;
      req?.destroy();
      res?.destroy();
      decoder?.destroy();
      resolve({
        status,
        headers,
        contentType: headers["content-type"] ?? null,
        wireBytes: wire,
        decodedBytes: decoded,
        body,
        truncated: truncated || (failure !== null && bodyRead),
        ttfbMs,
        tls,
        failure,
        certFailure: failure?.certCode ?? null,
      });
    };
    const abort = (failure: Failure): void => done(failure);
    job.aborters.add(abort);

    const finishPrefix = (): void => {
      truncated = true;
      done(null);
    };

    const pushDecoded = (buf: Buffer): void => {
      decoded += buf.length;
      if (kp.prefix) {
        const room = kp.prefixCap - kept;
        if (buf.length > room) {
          if (room > 0) chunks.push(buf.subarray(0, room));
          kept += Math.max(room, 0);
          finishPrefix();
          return;
        }
      } else if (decoded > limits.decodedCapBytes) {
        done(new Failure("DECOMPRESSED_TOO_LARGE", `Decoded body exceeded ${limits.decodedCapBytes} bytes`));
        return;
      }
      chunks.push(buf);
      kept += buf.length;
    };

    const onWireChunk = (chunk: Buffer, encoding: "identity" | "gzip" | "deflate" | "br"): void => {
      if (settled) return;
      wire += chunk.length;
      if (wire > limits.wireCapBytes) {
        if (kp.prefix) finishPrefix();
        else done(new Failure("RESPONSE_TOO_LARGE", `Response exceeded ${limits.wireCapBytes} bytes on the wire`));
        return;
      }
      if (encoding === "identity") {
        pushDecoded(chunk);
        return;
      }
      if (decoder === null) {
        const active = makeDecoder(encoding, chunk[0] ?? 0, chunk[1] ?? 0, limits.decodedCapBytes + 1);
        decoder = active;
        active.on("data", (out: Buffer) => {
          if (!settled) pushDecoded(out);
        });
        active.on("end", () => done(null));
        active.on("error", (error: Error) => {
          if ((error as NodeJS.ErrnoException).code === "ERR_BUFFER_TOO_LARGE") {
            done(new Failure("DECOMPRESSED_TOO_LARGE", `Decoded body exceeded ${limits.decodedCapBytes} bytes`));
          } else {
            done(new Failure("DECODE_ERROR", clip(error.message)));
          }
        });
      }
      const active = decoder;
      if (!active.write(chunk)) {
        res?.pause();
        active.once("drain", () => {
          if (!settled) res?.resume();
        });
      }
    };

    const onResponse = (response: http.IncomingMessage): void => {
      res = response;
      status = response.statusCode ?? null;
      headers = pickHeaders(response.rawHeaders);
      if (firstByteAt === null) firstByteAt = performance.now();
      response.on("error", (error: Error) => done(mapNetworkError(error, true)));
      response.on("close", () => {
        if (!response.complete) done(new Failure("CONNECTION_RESET", "Connection closed before the response finished"));
      });

      const code = status ?? 0;
      if (REDIRECT_STATUSES.has(code) || !kp.readBody || method === "HEAD" || code === 204 || code === 304 || code < 200) {
        done(null);
        return;
      }

      const mime = mimeOf(headers["content-type"] ?? null);
      if (code >= 200 && code < 300) {
        if (!kp.types.includes(mime)) {
          done(new Failure("CONTENT_TYPE_REJECTED", `Content type "${clip(mime || "(none)")}" is not accepted for ${kind}`));
          return;
        }
      } else if (!isTextual(mime)) {
        done(null);
        return;
      }

      const declared = Number(response.headers["content-length"]);
      if (!kp.prefix && Number.isFinite(declared) && declared > limits.wireCapBytes) {
        done(new Failure("RESPONSE_TOO_LARGE", `Declared length ${declared} exceeds ${limits.wireCapBytes} bytes`));
        return;
      }

      const rawEncoding = (response.headers["content-encoding"] ?? "").toLowerCase().trim();
      let encoding: "identity" | "gzip" | "deflate" | "br";
      if (rawEncoding === "" || rawEncoding === "identity") encoding = "identity";
      else if (rawEncoding === "gzip" || rawEncoding === "x-gzip") encoding = "gzip";
      else if (rawEncoding === "deflate") encoding = "deflate";
      else if (rawEncoding === "br") encoding = "br";
      else {
        done(new Failure("DECODE_ERROR", `Unsupported content-encoding "${clip(rawEncoding)}"`));
        return;
      }

      bodyRead = true;
      response.on("data", (chunk: Buffer) => onWireChunk(chunk, encoding));
      response.on("end", () => {
        if (settled) return;
        if (decoder) decoder.end();
        else done(null);
      });
    };

    connectTimer = setTimeout(
      () => done(new Failure("CONNECT_TIMEOUT", `No connection within ${limits.connectTimeoutMs} ms`)),
      limits.connectTimeoutMs,
    );
    totalTimer = setTimeout(
      () => done(new Failure("TIMEOUT", `Request exceeded ${limits.requestTimeoutMs} ms`)),
      limits.requestTimeoutMs,
    );

    const options: https.RequestOptions = {
      protocol: target.protocol,
      host: target.host,
      port: target.port,
      method,
      path: target.path,
      agent: false,
      lookup: pinnedLookup(target.host, address),
      maxHeaderSize: limits.headerCapBytes,
      headers: {
        "User-Agent": OWN_USER_AGENT,
        Accept: kp.accept,
        "Accept-Encoding": ACCEPT_ENCODING,
        Connection: "close",
      },
    };
    if (isTls) {
      options.servername = target.host;
      options.rejectUnauthorized = args.rejectUnauthorized;
      if (args.ca !== undefined) options.ca = args.ca as string | Buffer | (string | Buffer)[];
    }

    try {
      req = (isTls ? https : http).request(options);
    } catch (error) {
      done(mapNetworkError(error, false));
      return;
    }

    req.on("error", (error: Error) => done(mapNetworkError(error, connectedAt !== null)));
    req.on("response", onResponse);
    req.on("socket", (socket) => {
      socket.once("data", () => {
        if (firstByteAt === null) firstByteAt = performance.now();
      });
      const onConnected = (): void => {
        connectedAt = performance.now();
        if (connectTimer) clearTimeout(connectTimer);
        if (isTls) tls = captureTls(socket as TLSSocket);
      };
      if (isTls) socket.once("secureConnect", onConnected);
      else if (socket.connecting) socket.once("connect", onConnected);
      else onConnected();
    });
    req.setTimeout(limits.requestTimeoutMs, () =>
      done(new Failure("TIMEOUT", `Socket idle for ${limits.requestTimeoutMs} ms`)),
    );
    req.end();
  });
}

const STRUCTURAL_CHARS = /[\s/\\?#@:[\]%]/;

// An allowlist entry is a bare public hostname: no scheme, port, path or userinfo, and at least one dot.
function validateHostEntry(entry: string): string {
  const text = typeof entry === "string" ? entry.trim() : "";
  if (text === "" || STRUCTURAL_CHARS.test(text) || !text.includes(".")) {
    throw new TypeError(`Invalid allowlist host "${clip(String(entry))}": expected a bare hostname`);
  }
  const parsed = parseRequestUrl(`https://${text}/`);
  if (!parsed.ok) throw new TypeError(`Invalid allowlist host "${clip(text)}": ${parsed.reason}`);
  return siteHost(parsed.host);
}

// Everything the production factory fixes and the internal factory lets tests inject.
export interface CorePolicy {
  allowedHosts: readonly string[];
  resolver: Resolver;
  isBlocked: (address: string) => boolean;
  allowedPorts: readonly number[];
  limits: FetchLimits;
  now: () => Date;
  robotsGate?: RobotsGate;
  // Extra trust anchors for test servers with a throwaway certificate. The production factory never sets it.
  ca?: TrustAnchors;
}

export const defaultResolver: Resolver = async (host) => {
  const answers = await dnsPromises.lookup(host, { all: true, verbatim: true });
  return answers.map((a) => ({ address: a.address, family: a.family }));
};

// Internal factory. Tests wrap it (tests/visibility/helpers/net-harness.ts) so they can aim at a local
// server; nothing else may import it (tests/visibility/security/net-seam.test.ts enforces that).
export function _createFetcherCore(policy: CorePolicy): GuardedFetcher {
  const { limits } = policy;
  const allowedSites = new Set(policy.allowedHosts.map(validateHostEntry));
  const scheduler = new Scheduler(limits);
  const job = new JobState(limits, scheduler);
  const insecureOrigins = new Map<string, string>();
  const retried = new Set<string>();

  const keyOf = (req: FetchRequest): string => `${req.method} ${normaliseUrl(req.url) ?? req.url}`;

  async function requestHop(target: RequestUrl, method: FetchMethod, kind: FetchKind): Promise<Attempt> {
    job.assertAlive();
    let address: ValidatedAddress;
    try {
      address = await job.race(
        resolveAndValidate(target.host, policy.resolver, {
          isBlocked: policy.isBlocked,
          timeoutMs: limits.connectTimeoutMs,
        }),
      );
    } catch (error) {
      throw toFailure(error);
    }

    const origin = `${target.protocol}//${target.host}:${target.port}`;
    let insecure = target.protocol === "https:" && insecureOrigins.has(origin);
    let certFailure = insecureOrigins.get(origin) ?? null;
    let attempt: Attempt | null = null;

    for (let round = 0; round < 2; round += 1) {
      const release = await scheduler.acquire(siteHost(target.host));
      try {
        job.assertAlive();
        job.beginRequest();
        attempt = await performRequest({
          target,
          address,
          method,
          kind,
          rejectUnauthorized: !insecure,
          ca: policy.ca,
          limits,
          job,
        });
      } finally {
        release();
      }
      const refusal = attempt.failure?.certCode ?? null;
      if (refusal !== null && !insecure && target.protocol === "https:") {
        certFailure = refusal;
        insecureOrigins.set(origin, refusal);
        insecure = true;
        continue;
      }
      break;
    }

    const final = attempt as Attempt;
    final.certFailure = final.certFailure ?? certFailure;
    return final;
  }

  async function checkGate(url: string, kind: FetchKind): Promise<boolean> {
    if (kind === "robots" || !policy.robotsGate) return true;
    return Boolean(await policy.robotsGate(url, kind));
  }

  async function runChain(first: RequestUrl, method: FetchMethod, kind: FetchKind): Promise<ChainOutcome> {
    const outcome: ChainOutcome = { finalHref: first.href, chain: [], attempt: null, failure: null, requested: false };
    const visited = new Set<string>([first.href]);
    let current = first;
    let followed = 0;

    const blocked = (failure: Failure): ChainOutcome => {
      outcome.failure = POLICY_REFUSALS.has(failure.code)
        ? new Failure("REDIRECT_BLOCKED", `${failure.code}: ${failure.message}`)
        : failure;
      return outcome;
    };

    for (;;) {
      let attempt: Attempt;
      try {
        attempt = await requestHop(current, method, kind);
      } catch (error) {
        const failure = toFailure(error);
        outcome.failure = outcome.chain.length > 0 ? blocked(failure).failure : failure;
        return outcome;
      }
      outcome.requested = true;
      outcome.attempt = attempt;
      outcome.finalHref = current.href;
      if (attempt.failure) {
        outcome.failure = attempt.failure;
        return outcome;
      }

      const status = attempt.status ?? 0;
      if (!REDIRECT_STATUSES.has(status)) return outcome;

      const location = attempt.headers.location ?? null;
      outcome.chain.push({ href: current.href, status, location });
      if (location === null || location === "") return outcome;

      let nextHref: string;
      try {
        nextHref = new URL(location, current.href).href;
      } catch {
        return blocked(new Failure("URL_REJECTED", "Redirect Location is not a valid URL"));
      }
      const next = parseRequestUrl(nextHref, { allowedPorts: policy.allowedPorts });
      if (!next.ok) return blocked(new Failure("URL_REJECTED", `Redirect target rejected (${next.reason})`));
      if (visited.has(next.href)) {
        outcome.failure = new Failure("REDIRECT_LOOP", "Redirect points back to a URL already requested");
        return outcome;
      }
      if (followed >= limits.maxRedirects) {
        outcome.failure = new Failure("TOO_MANY_REDIRECTS", `More than ${limits.maxRedirects} redirects`);
        return outcome;
      }
      if (!allowedSites.has(siteHost(next.host))) {
        return blocked(new Failure("HOST_NOT_ALLOWLISTED", "Redirect target host is not on the allowlist"));
      }
      let permitted: boolean;
      try {
        permitted = await checkGate(next.url, kind);
      } catch (error) {
        return blocked(new Failure("UNKNOWN", `Robots gate failed: ${toFailure(error).message}`));
      }
      if (!permitted) return blocked(new Failure("ROBOTS_DISALLOWED", "Redirect target is disallowed by robots.txt"));

      followed += 1;
      visited.add(next.href);
      current = next;
    }
  }

  function shouldRetry(kind: FetchKind, outcome: ChainOutcome): boolean {
    if (!KIND_POLICY[kind].retry || outcome.failure?.code === "JOB_TIMEOUT") return false;
    const code = outcome.failure?.code;
    if (code === "TIMEOUT" || code === "CONNECT_TIMEOUT") return true;
    const status = outcome.attempt?.status ?? 0;
    return outcome.failure === null && status >= 500 && status <= 599;
  }

  function buildRecord(
    req: FetchRequest,
    requestUrl: string,
    outcome: ChainOutcome,
    fetchedAt: Date,
    durationMs: number,
  ): FetchRecord {
    const attempt = outcome.attempt;
    const finalUrl = outcome.finalHref ? (normaliseUrl(outcome.finalHref) ?? outcome.finalHref) : requestUrl;
    const redirectChain: RedirectHop[] = outcome.chain.map((hop) => ({
      url: normaliseUrl(hop.href) ?? hop.href,
      status: hop.status,
      location: hop.location,
    }));

    let body: string | null = null;
    let bodyHash: string | null = null;
    if (attempt?.body) {
      body = decodeText(attempt.body, attempt.contentType);
      bodyHash = createHash("sha256").update(attempt.body).digest("hex");
    }

    let tls: TlsInfo | null = null;
    if (attempt?.tls) {
      tls = { authorized: attempt.tls.authorized };
      const error = attempt.tls.error ?? (attempt.tls.authorized ? null : attempt.certFailure);
      if (error) tls.error = error;
      if (attempt.tls.validToIso) {
        tls.validTo = attempt.tls.validToIso;
        tls.daysToExpiry = Math.floor((Date.parse(attempt.tls.validToIso) - fetchedAt.getTime()) / DAY_MS);
      }
    } else if (attempt?.certFailure) {
      tls = { authorized: false, error: attempt.certFailure };
    }

    const failure: FetchError | null = outcome.failure
      ? { code: outcome.failure.code, message: clip(outcome.failure.message) }
      : null;

    return {
      url: requestUrl,
      finalUrl,
      kind: req.kind,
      method: req.method,
      status: attempt?.status ?? null,
      redirectChain,
      headers: attempt?.headers ?? {},
      contentType: attempt?.contentType ?? null,
      wireBytes: attempt?.wireBytes ?? 0,
      decodedBytes: attempt?.decodedBytes ?? 0,
      bodyHash,
      body,
      truncated: attempt?.truncated ?? false,
      error: failure,
      requestAcceptEncoding: outcome.requested ? ACCEPT_ENCODING : null,
      fetchedAt: fetchedAt.toISOString(),
      durationMs,
      ttfbMs: attempt?.ttfbMs ?? null,
      tls,
    };
  }

  function refusal(failure: Failure): ChainOutcome {
    return { finalHref: null, chain: [], attempt: null, failure, requested: false };
  }

  async function run(req: FetchRequest, requestUrl: string): Promise<ChainOutcome> {
    if (!FETCH_KINDS.includes(req.kind)) return refusal(new Failure("UNKNOWN", "Unknown fetch kind"));
    if (!FETCH_METHODS.includes(req.method)) return refusal(new Failure("UNKNOWN", "Only GET and HEAD are permitted"));

    const parsed = parseRequestUrl(req.url, { allowedPorts: policy.allowedPorts });
    if (!parsed.ok) return refusal(new Failure("URL_REJECTED", `Target rejected (${parsed.reason})`));
    if (!allowedSites.has(siteHost(parsed.host))) {
      return refusal(new Failure("HOST_NOT_ALLOWLISTED", "Host is not on the scan allowlist"));
    }
    try {
      job.assertAlive();
      if (!(await checkGate(parsed.url, req.kind))) {
        return refusal(new Failure("ROBOTS_DISALLOWED", "Disallowed by robots.txt for this scanner"));
      }
    } catch (error) {
      return refusal(toFailure(error));
    }

    let outcome = await runChain(parsed, req.method, req.kind);
    if (shouldRetry(req.kind, outcome) && job.remainingMs() > limits.retryDelayMs) {
      try {
        await job.race(sleep(limits.retryDelayMs));
        retried.add(keyOf(req));
        outcome = await runChain(parsed, req.method, req.kind);
      } catch {
        // Job deadline reached while waiting: keep the first attempt's result.
      }
    }
    void requestUrl;
    return outcome;
  }

  return {
    async fetch(req: FetchRequest): Promise<FetchRecord> {
      const fetchedAt = policy.now();
      const started = performance.now();
      const parsedForRecord = parseRequestUrl(req.url, { allowedPorts: policy.allowedPorts });
      const requestUrl = parsedForRecord.ok
        ? parsedForRecord.url
        : (normaliseUrl(req.url) ?? String(req.url)).slice(0, MAX_URL_LENGTH);
      let outcome: ChainOutcome;
      try {
        outcome = await run(req, requestUrl);
      } catch (error) {
        outcome = refusal(toFailure(error));
      }
      job.touch();
      return buildRecord(req, requestUrl, outcome, fetchedAt, Math.round(performance.now() - started));
    },
    stats(): ScanStats {
      return {
        requestCount: job.requestCount,
        requestCapReached: job.requestCapReached,
        jobTimedOut: job.timedOut,
        jobDurationMs: Math.round((job.lastActivityAt ?? job.startedAt) - job.startedAt),
      };
    },
    wasRetried(req: FetchRequest): boolean {
      return retried.has(keyOf(req));
    },
    close(): void {
      job.close();
      scheduler.close();
    },
  };
}

function readExtraHosts(): string[] {
  const raw = process.env[EXTRA_HOSTS_ENV] ?? "";
  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

// Production factory. It offers no switch for address validation, ports, limits or the allowlist
// beyond naming more allowed hostnames; anything else passed in is ignored.
export function createGuardedFetcher(options: GuardedFetcherOptions = {}): GuardedFetcher {
  const extra = readExtraHosts();
  const deadlineMs = Math.min(
    PRODUCTION_LIMITS.deadlineMs,
    typeof options.deadlineMs === "number" && options.deadlineMs > 0 ? options.deadlineMs : PRODUCTION_LIMITS.deadlineMs,
  );
  return _createFetcherCore({
    allowedHosts: [...(options.allowedHosts ?? DEFAULT_ALLOWED_HOSTS), ...extra],
    resolver: options.resolver ?? defaultResolver,
    isBlocked: isBlockedAddress,
    allowedPorts: DEFAULT_ALLOWED_PORTS,
    limits: { ...PRODUCTION_LIMITS, deadlineMs },
    now: options.now ?? (() => new Date()),
    robotsGate: options.robotsGate,
  });
}
