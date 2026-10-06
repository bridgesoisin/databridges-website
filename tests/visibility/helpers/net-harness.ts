import http from "node:http";
import https from "node:https";
import net from "node:net";
import {
  PRODUCTION_LIMITS,
  _createFetcherCore,
  type FetchLimits,
  type GuardedFetcher,
  type RobotsGate,
} from "@/lib/visibility/fetch";
import { isBlockedAddress, type Resolver } from "@/lib/visibility/net-guard";

// Test-only wrapper around the internal factory. Hostnames used here end in ".example" (the production
// URL parser rejects ".test" and ".localhost"); a stub resolver maps them to 127.0.0.1 where a local
// server listens, or to an address the real block list refuses.

export const FIXED_NOW = new Date("2026-10-03T10:00:00.000Z");

export const FAST_LIMITS: FetchLimits = {
  ...PRODUCTION_LIMITS,
  minHostIntervalMs: 0,
  retryDelayMs: 25,
};

export type HostAnswer = readonly string[] | Error | ((call: number) => readonly string[]);

export interface HarnessOptions {
  // What the stub resolver answers for each hostname.
  hosts: Record<string, HostAnswer>;
  // The hard allowlist. Defaults to every hostname in "hosts"; set it to resolve names that must stay refused.
  allowed?: readonly string[];
  // Server ports to accept in addition to 80 and 443.
  ports?: readonly number[];
  limits?: Partial<FetchLimits>;
  // Addresses treated as public. Defaults to the loopback address the local servers listen on.
  exempt?: readonly string[];
  ca?: string | Buffer | readonly (string | Buffer)[];
  now?: () => Date;
  robotsGate?: RobotsGate;
}

export interface Harness {
  fetcher: GuardedFetcher;
  // Every hostname the resolver was asked about, in order.
  resolverCalls: string[];
}

export function createTestFetcher(options: HarnessOptions): Harness {
  const exempt = new Set(options.exempt ?? ["127.0.0.1"]);
  const resolverCalls: string[] = [];
  const perHost = new Map<string, number>();

  const resolver: Resolver = async (host) => {
    resolverCalls.push(host);
    const call = (perHost.get(host) ?? 0) + 1;
    perHost.set(host, call);
    const answer = options.hosts[host];
    if (answer === undefined) {
      const error: NodeJS.ErrnoException = new Error(`ENOTFOUND ${host}`);
      error.code = "ENOTFOUND";
      throw error;
    }
    if (answer instanceof Error) throw answer;
    const list = typeof answer === "function" ? answer(call) : answer;
    return list.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));
  };

  const fetcher = _createFetcherCore({
    allowedHosts: options.allowed ?? Object.keys(options.hosts),
    resolver,
    isBlocked: (address) => !exempt.has(address) && isBlockedAddress(address),
    allowedPorts: [80, 443, ...(options.ports ?? [])],
    limits: { ...FAST_LIMITS, ...options.limits },
    now: options.now ?? (() => FIXED_NOW),
    robotsGate: options.robotsGate,
    ca: options.ca,
  });
  return { fetcher, resolverCalls };
}

export interface SeenRequest {
  // performance.now() when the request reached the server.
  at: number;
  method: string;
  url: string;
  host: string;
  headers: http.IncomingHttpHeaders;
  rawHeaderNames: string[];
}

export interface LocalServer {
  readonly port: number;
  readonly seen: SeenRequest[];
  readonly sockets: Set<net.Socket>;
  connections(): number;
  maxConcurrent(): number;
  url(host: string, path?: string, scheme?: "http" | "https"): string;
  close(): Promise<void>;
}

export type Handler = (req: http.IncomingMessage, res: http.ServerResponse, server: LocalServer) => void;

function track(server: net.Server, local: { sockets: Set<net.Socket>; connections: number }): void {
  server.on("connection", (socket: net.Socket) => {
    local.connections += 1;
    local.sockets.add(socket);
    socket.on("close", () => local.sockets.delete(socket));
    socket.on("error", () => undefined);
  });
}

function listen(server: net.Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve((server.address() as net.AddressInfo).port));
  });
}

function build(
  server: net.Server,
  port: number,
  seen: SeenRequest[],
  local: { sockets: Set<net.Socket>; connections: number; peak: number },
): LocalServer {
  return {
    port,
    seen,
    sockets: local.sockets,
    connections: () => local.connections,
    maxConcurrent: () => local.peak,
    url: (host, path = "/", scheme = "http") => `${scheme}://${host}:${port}${path}`,
    close: () =>
      new Promise<void>((resolve) => {
        for (const socket of local.sockets) socket.destroy();
        server.close(() => resolve());
      }),
  };
}

function record(req: http.IncomingMessage, seen: SeenRequest[]): void {
  const names: string[] = [];
  for (let i = 0; i < req.rawHeaders.length; i += 2) names.push(req.rawHeaders[i].toLowerCase());
  seen.push({
    at: performance.now(),
    method: req.method ?? "",
    url: req.url ?? "",
    host: String(req.headers.host ?? "").split(":")[0],
    headers: req.headers,
    rawHeaderNames: names,
  });
}

export async function startHttpServer(handler: Handler): Promise<LocalServer> {
  const seen: SeenRequest[] = [];
  const local = { sockets: new Set<net.Socket>(), connections: 0, peak: 0 };
  let inFlight = 0;
  const server = http.createServer((req, res) => {
    record(req, seen);
    inFlight += 1;
    local.peak = Math.max(local.peak, inFlight);
    res.on("close", () => {
      inFlight -= 1;
    });
    handler(req, res, api);
  });
  server.keepAliveTimeout = 1;
  track(server, local);
  const port = await listen(server);
  const api = build(server, port, seen, local);
  return api;
}

export async function startTlsServer(
  credentials: { cert: string; key: string },
  handler: Handler,
): Promise<LocalServer> {
  const seen: SeenRequest[] = [];
  const local = { sockets: new Set<net.Socket>(), connections: 0, peak: 0 };
  const server = https.createServer(credentials, (req, res) => {
    record(req, seen);
    handler(req, res, api);
  });
  server.on("tlsClientError", () => undefined);
  track(server, local);
  const port = await listen(server);
  const api = build(server, port, seen, local);
  return api;
}

// A bare TCP server for responses that the http module will not produce (partial headers, stalls).
export async function startRawServer(onSocket: (socket: net.Socket) => void): Promise<LocalServer> {
  const seen: SeenRequest[] = [];
  const local = { sockets: new Set<net.Socket>(), connections: 0, peak: 0 };
  const server = net.createServer((socket) => {
    socket.on("error", () => undefined);
    onSocket(socket);
  });
  track(server, local);
  const port = await listen(server);
  return build(server, port, seen, local);
}

export function html(body = "<!doctype html><html lang=\"en\"><head><title>t</title></head><body><p>ok</p></body></html>") {
  return body;
}

export function sendHtml(res: http.ServerResponse, status = 200, body: string = html()): void {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
  res.end(body);
}

export function redirect(res: http.ServerResponse, location: string, status = 302): void {
  res.writeHead(status, { location });
  res.end();
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
