import { createHash } from "node:crypto";
import type http from "node:http";
import zlib from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { PRODUCTION_LIMITS } from "@/lib/visibility/fetch";
import type { FetchKind, FetchRequest } from "@/lib/visibility/types";
import {
  createTestFetcher,
  delay,
  redirect,
  sendHtml,
  startHttpServer,
  startRawServer,
  type Handler,
  type HarnessOptions,
  type LocalServer,
} from "../helpers/net-harness";
import { armHangingConnect } from "../helpers/net-observe";

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  for (const fn of cleanups.splice(0).reverse()) await fn();
});

async function serve(handler: Handler): Promise<LocalServer> {
  const server = await startHttpServer(handler);
  cleanups.push(() => server.close());
  return server;
}

function fetcherFor(server: LocalServer, options: Partial<HarnessOptions> = {}) {
  const harness = createTestFetcher({
    hosts: { "site.example": ["127.0.0.1"] },
    ports: [server.port],
    ...options,
  });
  cleanups.push(() => harness.fetcher.close());
  return harness;
}

const req = (server: LocalServer, path = "/", kind: FetchKind = "page", method: "GET" | "HEAD" = "GET"): FetchRequest => ({
  url: server.url("site.example", path),
  kind,
  method,
});

function body(res: http.ServerResponse, type: string, payload: Buffer | string, extra: Record<string, string> = {}): void {
  res.writeHead(200, { "content-type": type, ...extra });
  res.end(payload);
}

describe("plan 5.3 limits", () => {
  it("are the proposed values", () => {
    expect(PRODUCTION_LIMITS).toEqual({
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
    expect(Object.isFrozen(PRODUCTION_LIMITS)).toBe(true);
  });
});

describe("response size on the wire", () => {
  it("accepts a body of exactly 1,000,000 bytes", async () => {
    const payload = "<html>" + "a".repeat(1_000_000 - 6);
    const server = await serve((_req, res) => body(res, "text/html", payload));
    const { fetcher } = fetcherFor(server);
    const record = await fetcher.fetch(req(server));
    expect(record).toMatchObject({ status: 200, error: null, wireBytes: 1_000_000, truncated: false });
  });

  it("rejects a declared length over the cap without reading the body", async () => {
    const payload = "<html>" + "a".repeat(1_000_000);
    const server = await serve((_req, res) => body(res, "text/html", payload, { "content-length": String(payload.length) }));
    const { fetcher } = fetcherFor(server);
    const record = await fetcher.fetch(req(server));
    expect(record.error?.code).toBe("RESPONSE_TOO_LARGE");
    expect(record).toMatchObject({ status: 200, body: null, bodyHash: null, wireBytes: 0 });
  });

  it("aborts a chunked body that has no declared length once it passes the cap", async () => {
    const state = { sent: 0, closed: false };
    const server = await serve((_req, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      const chunk = Buffer.alloc(16_384, 0x61);
      const pump = (): void => {
        while (!res.destroyed) {
          state.sent += chunk.length;
          if (!res.write(chunk)) {
            res.once("drain", pump);
            return;
          }
        }
      };
      res.on("close", () => {
        state.closed = true;
      });
      pump();
    });
    const { fetcher } = fetcherFor(server);
    const record = await fetcher.fetch(req(server));
    expect(record.error?.code).toBe("RESPONSE_TOO_LARGE");
    expect(record.body).toBeNull();
    expect(record.truncated).toBe(true);
    expect(record.wireBytes).toBeGreaterThan(1_000_000);
    expect(record.wireBytes).toBeLessThan(1_000_000 + 131_072);
    await delay(100);
    expect(state.closed).toBe(true);
    expect(state.sent).toBeLessThan(20_000_000);
  });
});

describe("decompressed size", () => {
  const zeros = (n: number) => Buffer.alloc(n, 0x20);

  it("accepts a compressed body that expands to the 3,000,000 byte cap exactly", async () => {
    const payload = zlib.gzipSync(zeros(3_000_000));
    const server = await serve((_req, res) => body(res, "text/html", payload, { "content-encoding": "gzip" }));
    const { fetcher } = fetcherFor(server);
    const record = await fetcher.fetch(req(server));
    expect(record).toMatchObject({ status: 200, error: null, decodedBytes: 3_000_000 });
    expect(record.wireBytes).toBeLessThan(10_000);
  });

  it("rejects one byte over the cap", async () => {
    const payload = zlib.gzipSync(zeros(3_000_001));
    const server = await serve((_req, res) => body(res, "text/html", payload, { "content-encoding": "gzip" }));
    const { fetcher } = fetcherFor(server);
    const record = await fetcher.fetch(req(server));
    expect(record.error?.code).toBe("DECOMPRESSED_TOO_LARGE");
    expect(record.body).toBeNull();
  });

  it.each([
    ["gzip", (b: Buffer) => zlib.gzipSync(b, { level: 9 })],
    ["br", (b: Buffer) => zlib.brotliCompressSync(b, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 1 } })],
    ["deflate", (b: Buffer) => zlib.deflateSync(b, { level: 9 })],
    ["deflate", (b: Buffer) => zlib.deflateRawSync(b, { level: 9 })],
  ])("aborts a %s bomb after at most one decoder chunk past the cap", async (encoding, compress) => {
    const payload = compress(zeros(80_000_000));
    expect(payload.length).toBeLessThan(1_000_000);
    const server = await serve((_req, res) => body(res, "text/html", payload, { "content-encoding": encoding }));
    const { fetcher } = fetcherFor(server);
    const started = Date.now();
    const record = await fetcher.fetch(req(server));
    expect(record.error?.code).toBe("DECOMPRESSED_TOO_LARGE");
    expect(record.body).toBeNull();
    expect(record.decodedBytes).toBeGreaterThan(3_000_000);
    expect(record.decodedBytes).toBeLessThan(3_000_000 + 1_048_576);
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  it("aborts a bomb that is sent as many small chunks", async () => {
    const payload = zlib.gzipSync(zeros(80_000_000), { level: 9 });
    const server = await serve((_req, res) => {
      res.writeHead(200, { "content-type": "text/html", "content-encoding": "gzip" });
      let offset = 0;
      const timer = setInterval(() => {
        if (res.destroyed || offset >= payload.length) {
          clearInterval(timer);
          res.end();
          return;
        }
        res.write(payload.subarray(offset, offset + 512));
        offset += 512;
      }, 1);
      res.on("close", () => clearInterval(timer));
    });
    const { fetcher } = fetcherFor(server);
    const record = await fetcher.fetch(req(server));
    expect(record.error?.code).toBe("DECOMPRESSED_TOO_LARGE");
    expect(record.decodedBytes).toBeLessThan(3_000_000 + 1_048_576);
  });

  it("keeps a bounded prefix for robots, sitemap and llms instead of failing", async () => {
    const server = await serve((req2, res) => {
      const path = req2.url ?? "/";
      if (path === "/robots.txt") body(res, "text/plain", "r".repeat(600_000));
      else if (path === "/robots-big.txt") body(res, "text/plain", "r".repeat(2_000_000));
      else if (path === "/sitemap.xml") body(res, "application/xml", zlib.gzipSync("s".repeat(5_000_000)), { "content-encoding": "gzip" });
      else body(res, "text/plain", "l".repeat(300_000));
    });
    const { fetcher } = fetcherFor(server);

    const robots = await fetcher.fetch(req(server, "/robots.txt", "robots"));
    expect(robots).toMatchObject({ status: 200, error: null, truncated: true });
    expect(robots.body).toHaveLength(512 * 1024);
    expect(robots.bodyHash).toBe(createHash("sha256").update("r".repeat(512 * 1024)).digest("hex"));

    const robotsBig = await fetcher.fetch(req(server, "/robots-big.txt", "robots"));
    expect(robotsBig).toMatchObject({ status: 200, error: null, truncated: true });
    expect(robotsBig.body).toHaveLength(512 * 1024);

    const sitemap = await fetcher.fetch(req(server, "/sitemap.xml", "sitemap"));
    expect(sitemap).toMatchObject({ status: 200, error: null, truncated: true });
    expect(sitemap.body).toHaveLength(2_000_000);

    const llms = await fetcher.fetch(req(server, "/llms.txt", "llms"));
    expect(llms).toMatchObject({ status: 200, error: null, truncated: true });
    expect(llms.body).toHaveLength(256_000);
  });

  it("does not mark a body that fits as truncated", async () => {
    const server = await serve((_req, res) => body(res, "text/plain", "User-agent: *\n"));
    const { fetcher } = fetcherFor(server);
    const record = await fetcher.fetch(req(server, "/robots.txt", "robots"));
    expect(record).toMatchObject({ status: 200, error: null, truncated: false, body: "User-agent: *\n" });
  });
});

describe("response header size", () => {
  it("rejects a header block over 32 KB", async () => {
    const server = await serve((_req, res) => {
      res.setHeader("x-padding", "a".repeat(40_000));
      sendHtml(res);
    });
    const { fetcher } = fetcherFor(server);
    const record = await fetcher.fetch(req(server));
    expect(record.error?.code).toBe("HEADERS_TOO_LARGE");
    expect(record.body).toBeNull();
  });

  it("rejects many small headers that add up to more than 32 KB", async () => {
    const server = await serve((_req, res) => {
      for (let i = 0; i < 700; i += 1) res.setHeader(`x-pad-${i}`, "b".repeat(50));
      sendHtml(res);
    });
    const { fetcher } = fetcherFor(server);
    const record = await fetcher.fetch(req(server));
    expect(record.error?.code).toBe("HEADERS_TOO_LARGE");
  });

  it("accepts 20 KB of headers (the cap is raised above Node's 16 KB default)", async () => {
    const server = await serve((_req, res) => {
      res.setHeader("x-padding", "a".repeat(20_000));
      sendHtml(res);
    });
    const { fetcher } = fetcherFor(server);
    const record = await fetcher.fetch(req(server));
    expect(record).toMatchObject({ status: 200, error: null });
  });
});

describe("content-type allowlist per kind", () => {
  async function typeOutcome(kind: FetchKind, contentType: string | null): Promise<string> {
    const server = await serve((_req, res) => {
      res.writeHead(200, contentType === null ? {} : { "content-type": contentType });
      res.end("<html></html>");
    });
    const { fetcher } = fetcherFor(server);
    const record = await fetcher.fetch(req(server, "/x", kind));
    expect(record.status).toBe(200);
    return record.error?.code ?? "OK";
  }

  it.each([
    "text/html",
    "text/html; charset=utf-8",
    "TEXT/HTML;charset=UTF-8",
    "application/xhtml+xml",
  ])("accepts %s for a page", async (type) => {
    expect(await typeOutcome("page", type)).toBe("OK");
  });

  it.each([
    "application/octet-stream",
    "image/png",
    "image/svg+xml",
    "application/pdf",
    "application/json",
    "application/zip",
    "text/plain",
    "text/css",
    "application/javascript",
    "video/mp4",
    "binary/octet-stream",
    "",
    null,
  ])("rejects %j for a page", async (type) => {
    expect(await typeOutcome("page", type)).toBe("CONTENT_TYPE_REJECTED");
  });

  it("does not keep the body of a rejected response", async () => {
    const server = await serve((_req, res) => body(res, "application/octet-stream", "<html><body>looks like html</body></html>"));
    const { fetcher } = fetcherFor(server);
    const record = await fetcher.fetch(req(server));
    expect(record).toMatchObject({ status: 200, body: null, bodyHash: null });
    expect(record.error?.code).toBe("CONTENT_TYPE_REJECTED");
  });

  it("allows only plain text for robots, xml or text for sitemaps, text or markdown for llms", async () => {
    expect(await typeOutcome("robots", "text/plain; charset=utf-8")).toBe("OK");
    expect(await typeOutcome("robots", "text/html")).toBe("CONTENT_TYPE_REJECTED");
    expect(await typeOutcome("robots", "application/octet-stream")).toBe("CONTENT_TYPE_REJECTED");

    expect(await typeOutcome("sitemap", "application/xml")).toBe("OK");
    expect(await typeOutcome("sitemap", "text/xml; charset=utf-8")).toBe("OK");
    expect(await typeOutcome("sitemap", "text/html")).toBe("CONTENT_TYPE_REJECTED");
    expect(await typeOutcome("sitemap", "application/pdf")).toBe("CONTENT_TYPE_REJECTED");

    expect(await typeOutcome("llms", "text/plain")).toBe("OK");
    expect(await typeOutcome("llms", "text/markdown")).toBe("OK");
    expect(await typeOutcome("llms", "text/html")).toBe("CONTENT_TYPE_REJECTED");
  });

  it("does not apply the allowlist to a response that is not a success", async () => {
    const server = await serve((_req, res) => {
      res.writeHead(404, { "content-type": "application/octet-stream" });
      res.end("nope");
    });
    const { fetcher } = fetcherFor(server);
    const record = await fetcher.fetch(req(server));
    expect(record).toMatchObject({ status: 404, error: null, body: null });
  });
});

describe("timeouts", () => {
  it("cuts off a trickling body (slow loris) at the per-request timeout", async () => {
    const server = await serve((_req, res) => {
      res.writeHead(200, { "content-type": "text/plain", "content-length": "100000" });
      res.flushHeaders();
      const timer = setInterval(() => res.write("x"), 40);
      res.on("close", () => clearInterval(timer));
    });
    const { fetcher } = fetcherFor(server, { limits: { requestTimeoutMs: 400 } });
    const started = performance.now();
    const record = await fetcher.fetch(req(server, "/slow", "robots"));
    const elapsed = performance.now() - started;
    expect(record.error?.code).toBe("TIMEOUT");
    expect(record.body).toBeNull();
    expect(elapsed).toBeGreaterThanOrEqual(380);
    expect(elapsed).toBeLessThan(1_500);
    expect(server.seen).toHaveLength(1);
  });

  it("cuts off trickling response headers", async () => {
    const raw = await startRawServer((socket) => {
      socket.write("HTTP/1.1 200 OK\r\n");
      const timer = setInterval(() => socket.write("X-Slow: a\r\n"), 40);
      socket.on("close", () => clearInterval(timer));
    });
    cleanups.push(() => raw.close());
    const { fetcher } = fetcherFor(raw, { limits: { requestTimeoutMs: 400 } });
    const record = await fetcher.fetch(req(raw, "/", "robots"));
    expect(record.error?.code).toBe("TIMEOUT");
  });

  it("reports TIMEOUT, not CONNECT_TIMEOUT, when the server accepts but never answers", async () => {
    const server = await serve(() => undefined);
    const { fetcher } = fetcherFor(server, { limits: { requestTimeoutMs: 300 } });
    const record = await fetcher.fetch(req(server, "/", "robots"));
    expect(record.error?.code).toBe("TIMEOUT");
    expect(record.status).toBeNull();
    expect(record.ttfbMs).toBeNull();
  });

  it("applies the connect timeout to a TLS handshake that never completes", async () => {
    const raw = await startRawServer(() => undefined);
    cleanups.push(() => raw.close());
    const { fetcher } = fetcherFor(raw, { limits: { connectTimeoutMs: 250, requestTimeoutMs: 5_000 } });
    const started = performance.now();
    const record = await fetcher.fetch({ url: raw.url("site.example", "/", "https"), kind: "robots", method: "GET" });
    const elapsed = performance.now() - started;
    expect(record.error?.code).toBe("CONNECT_TIMEOUT");
    expect(elapsed).toBeGreaterThanOrEqual(230);
    expect(elapsed).toBeLessThan(2_000);
  });

  it("applies the connect timeout to a TCP connection that never completes, without sending a packet", async () => {
    const hanging = armHangingConnect();
    cleanups.push(() => hanging.stop());
    const { fetcher } = createTestFetcher({
      hosts: { "site.example": ["127.0.0.1"] },
      limits: { connectTimeoutMs: 250, requestTimeoutMs: 5_000 },
    });
    cleanups.push(() => fetcher.close());
    const started = performance.now();
    const record = await fetcher.fetch({ url: "http://site.example/robots.txt", kind: "robots", method: "GET" });
    const elapsed = performance.now() - started;
    expect(record.error?.code).toBe("CONNECT_TIMEOUT");
    expect(record).toMatchObject({ status: null, body: null, ttfbMs: null });
    expect(elapsed).toBeGreaterThanOrEqual(230);
    expect(elapsed).toBeLessThan(2_000);
    expect(hanging.attempts).toBe(1);
  });

  it("retries a hanging page connection once and then gives up", async () => {
    const hanging = armHangingConnect();
    cleanups.push(() => hanging.stop());
    const { fetcher } = createTestFetcher({
      hosts: { "site.example": ["127.0.0.1"] },
      limits: { connectTimeoutMs: 150, requestTimeoutMs: 5_000 },
    });
    cleanups.push(() => fetcher.close());
    const request: FetchRequest = { url: "http://site.example/", kind: "page", method: "GET" };
    const record = await fetcher.fetch(request);
    expect(record.error?.code).toBe("CONNECT_TIMEOUT");
    expect(hanging.attempts).toBe(2);
    expect(fetcher.wasRetried(request)).toBe(true);
  });

  it("stops the whole job at the deadline, aborts what is in flight and refuses later requests", async () => {
    const server = await serve((_req, res) => {
      setTimeout(() => sendHtml(res), 3_000);
    });
    const { fetcher } = fetcherFor(server, { limits: { deadlineMs: 400 } });
    const started = performance.now();
    const first = await fetcher.fetch(req(server, "/a"));
    const elapsed = performance.now() - started;
    expect(first.error?.code).toBe("JOB_TIMEOUT");
    expect(elapsed).toBeGreaterThanOrEqual(380);
    expect(elapsed).toBeLessThan(1_500);

    const laterStarted = performance.now();
    const later = await fetcher.fetch(req(server, "/b"));
    expect(later.error?.code).toBe("JOB_TIMEOUT");
    expect(performance.now() - laterStarted).toBeLessThan(100);
    expect(server.seen.map((s) => s.url)).toEqual(["/a"]);
    expect(fetcher.stats().jobTimedOut).toBe(true);
  });

  it("fails queued requests with JOB_TIMEOUT when the deadline passes while they wait", async () => {
    const server = await serve(() => undefined);
    const { fetcher } = fetcherFor(server, { limits: { deadlineMs: 300, requestTimeoutMs: 5_000, maxPerHost: 1, maxConcurrent: 1 } });
    const results = await Promise.all([fetcher.fetch(req(server, "/1")), fetcher.fetch(req(server, "/2")), fetcher.fetch(req(server, "/3"))]);
    expect(results.map((r) => r.error?.code)).toEqual(["JOB_TIMEOUT", "JOB_TIMEOUT", "JOB_TIMEOUT"]);
    expect(server.seen).toHaveLength(1);
  });

  it("does not let a caller raise the deadline above 20 seconds in the production limits", () => {
    expect(PRODUCTION_LIMITS.deadlineMs).toBe(20_000);
  });
});

describe("request cap", () => {
  it("refuses the request after the cap with REQUEST_CAP_REACHED and sends nothing more", async () => {
    const server = await serve((_req, res) => sendHtml(res));
    const { fetcher } = fetcherFor(server, { limits: { maxRequests: 3 } });
    const codes: Array<string | undefined> = [];
    for (let i = 0; i < 5; i += 1) codes.push((await fetcher.fetch(req(server, `/p${i}`))).error?.code);
    expect(codes).toEqual([undefined, undefined, undefined, "REQUEST_CAP_REACHED", "REQUEST_CAP_REACHED"]);
    expect(server.seen).toHaveLength(3);
    expect(fetcher.stats()).toMatchObject({ requestCount: 3, requestCapReached: true });
  });

  it("counts redirect hops and keeps the chain when the cap hits mid-redirect", async () => {
    const server = await serve((r, res) => {
      const n = Number((r.url ?? "/h0").slice(2));
      redirect(res, `/h${n + 1}`);
    });
    const { fetcher } = fetcherFor(server, { limits: { maxRequests: 2 } });
    const record = await fetcher.fetch(req(server, "/h0"));
    expect(record.error?.code).toBe("REQUEST_CAP_REACHED");
    expect(record.redirectChain).toHaveLength(2);
    expect(server.seen).toHaveLength(2);
  });

  it("counts a retry as a request", async () => {
    const server = await serve((_r, res) => sendHtml(res, 503));
    const { fetcher } = fetcherFor(server);
    await fetcher.fetch(req(server));
    expect(fetcher.stats().requestCount).toBe(2);
  });

  it("does not count requests that were refused before the network", async () => {
    const server = await serve((_r, res) => sendHtml(res));
    const { fetcher } = fetcherFor(server, { limits: { maxRequests: 1 } });
    await fetcher.fetch({ url: "ftp://site.example/", kind: "page", method: "GET" });
    await fetcher.fetch({ url: "http://other.example/", kind: "page", method: "GET" });
    expect((await fetcher.fetch(req(server))).error).toBeNull();
    expect(fetcher.stats().requestCount).toBe(1);
  });
});

describe("retries", () => {
  async function hitsAfter(kind: FetchKind, method: "GET" | "HEAD", status: number): Promise<{ hits: number; retried: boolean; code: number | null }> {
    const server = await serve((_r, res) => {
      res.writeHead(status, { "content-type": kind === "robots" || kind === "llms" ? "text/plain" : "text/html" });
      res.end("x");
    });
    const { fetcher } = fetcherFor(server);
    const request = req(server, "/r", kind, method);
    const record = await fetcher.fetch(request);
    return { hits: server.seen.length, retried: fetcher.wasRetried(request), code: record.status };
  }

  it.each(["page", "sitemap", "link-check"] as const)("retries a %s once after a 5xx", async (kind) => {
    const result = await hitsAfter(kind, kind === "link-check" ? "HEAD" : "GET", 503);
    expect(result).toEqual({ hits: 2, retried: true, code: 503 });
  });

  it.each(["robots", "llms", "http-variant", "timing"] as const)("never retries a %s", async (kind) => {
    const result = await hitsAfter(kind, "GET", 503);
    expect(result).toEqual({ hits: 1, retried: false, code: 503 });
  });

  it("does not retry a 4xx or a success", async () => {
    expect(await hitsAfter("page", "GET", 404)).toEqual({ hits: 1, retried: false, code: 404 });
    expect(await hitsAfter("page", "GET", 429)).toEqual({ hits: 1, retried: false, code: 429 });
    expect(await hitsAfter("page", "GET", 200)).toEqual({ hits: 1, retried: false, code: 200 });
  });

  it("returns the success of the retry", async () => {
    let calls = 0;
    const server = await serve((_r, res) => {
      calls += 1;
      if (calls === 1) sendHtml(res, 502);
      else sendHtml(res);
    });
    const { fetcher } = fetcherFor(server);
    const record = await fetcher.fetch(req(server));
    expect(record).toMatchObject({ status: 200, error: null });
    expect(server.seen).toHaveLength(2);
  });

  it("retries only once", async () => {
    const server = await serve((_r, res) => sendHtml(res, 500));
    const { fetcher } = fetcherFor(server);
    const record = await fetcher.fetch(req(server));
    expect(record.status).toBe(500);
    expect(server.seen).toHaveLength(2);
  });

  it("waits for the retry delay before retrying", async () => {
    const server = await serve((_r, res) => sendHtml(res, 503));
    const { fetcher } = fetcherFor(server, { limits: { retryDelayMs: 300 } });
    await fetcher.fetch(req(server));
    const gap = server.seen[1].at - server.seen[0].at;
    expect(gap).toBeGreaterThanOrEqual(285);
    expect(gap).toBeLessThan(1_500);
  });

  it("retries after a timeout and succeeds when the second attempt is fast", async () => {
    let calls = 0;
    const server = await serve((_r, res) => {
      calls += 1;
      if (calls === 1) return;
      sendHtml(res);
    });
    const { fetcher } = fetcherFor(server, { limits: { requestTimeoutMs: 250 } });
    const record = await fetcher.fetch(req(server));
    expect(record).toMatchObject({ status: 200, error: null });
    expect(server.seen).toHaveLength(2);
  });

  it("gives up after a second timeout", async () => {
    const server = await serve(() => undefined);
    const { fetcher } = fetcherFor(server, { limits: { requestTimeoutMs: 200 } });
    const record = await fetcher.fetch(req(server));
    expect(record.error?.code).toBe("TIMEOUT");
    expect(server.seen).toHaveLength(2);
  });

  it("does not retry a timeout for robots.txt", async () => {
    const server = await serve(() => undefined);
    const { fetcher } = fetcherFor(server, { limits: { requestTimeoutMs: 200 } });
    const record = await fetcher.fetch(req(server, "/robots.txt", "robots"));
    expect(record.error?.code).toBe("TIMEOUT");
    expect(server.seen).toHaveLength(1);
  });

  it("does not retry a job timeout", async () => {
    const server = await serve(() => undefined);
    const { fetcher } = fetcherFor(server, { limits: { deadlineMs: 250, requestTimeoutMs: 5_000 } });
    const record = await fetcher.fetch(req(server));
    expect(record.error?.code).toBe("JOB_TIMEOUT");
    expect(server.seen).toHaveLength(1);
  });
});

describe("scheduler", () => {
  it("starts requests to one host at least 250 ms apart", async () => {
    const server = await serve((_r, res) => sendHtml(res));
    const { fetcher } = fetcherFor(server, { limits: { minHostIntervalMs: 250, maxPerHost: 2, maxConcurrent: 3 } });
    await Promise.all([fetcher.fetch(req(server, "/1")), fetcher.fetch(req(server, "/2")), fetcher.fetch(req(server, "/3"))]);
    const times = server.seen.map((s) => s.at).sort((a, b) => a - b);
    expect(times).toHaveLength(3);
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(235);
    expect(times[2] - times[1]).toBeGreaterThanOrEqual(235);
  });

  it("spaces redirect hops the same way", async () => {
    const server = await serve((r, res) => {
      const n = Number((r.url ?? "/h0").slice(2));
      if (n < 2) redirect(res, `/h${n + 1}`);
      else sendHtml(res);
    });
    const { fetcher } = fetcherFor(server, { limits: { minHostIntervalMs: 250 } });
    await fetcher.fetch(req(server, "/h0"));
    const times = server.seen.map((s) => s.at);
    expect(times).toHaveLength(3);
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(235);
    expect(times[2] - times[1]).toBeGreaterThanOrEqual(235);
  });

  it("never runs more than two requests to one host at once", async () => {
    const server = await serve((_r, res) => {
      setTimeout(() => sendHtml(res), 120);
    });
    const { fetcher } = fetcherFor(server);
    await Promise.all(Array.from({ length: 6 }, (_, i) => fetcher.fetch(req(server, `/${i}`))));
    expect(server.seen).toHaveLength(6);
    expect(server.maxConcurrent()).toBe(2);
  });

  it("counts the bare and www forms as one host for the per-host limit", async () => {
    const server = await serve((_r, res) => {
      setTimeout(() => sendHtml(res), 120);
    });
    const { fetcher } = fetcherFor(server, { hosts: { "site.example": ["127.0.0.1"], "www.site.example": ["127.0.0.1"] }, allowed: ["site.example"] });
    await Promise.all(
      ["site.example", "www.site.example", "site.example", "www.site.example"].map((host) =>
        fetcher.fetch({ url: server.url(host), kind: "page", method: "GET" }),
      ),
    );
    expect(server.maxConcurrent()).toBe(2);
  });

  it("never runs more than three requests at once across hosts, and does use three", async () => {
    const server = await serve((_r, res) => {
      setTimeout(() => sendHtml(res), 150);
    });
    const names = ["a", "b", "c", "d", "e", "f"].map((n) => `${n}.site.example`);
    const hosts = Object.fromEntries(names.map((n) => [n, ["127.0.0.1"]]));
    const { fetcher } = fetcherFor(server, { hosts, allowed: names });
    await Promise.all(names.flatMap((n) => [0, 1].map(() => fetcher.fetch({ url: server.url(n), kind: "page", method: "GET" }))));
    expect(server.seen).toHaveLength(12);
    expect(server.maxConcurrent()).toBe(3);
  });
});
