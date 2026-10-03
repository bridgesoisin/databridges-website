import { createHash } from "node:crypto";
import zlib from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { OWN_USER_AGENT } from "@/lib/visibility/lists";
import { ALLOWED_RESPONSE_HEADERS, FETCH_ERROR_CODES, type FetchRequest } from "@/lib/visibility/types";
import {
  FIXED_NOW,
  createTestFetcher,
  redirect,
  sendHtml,
  startHttpServer,
  startRawServer,
  type Handler,
  type HarnessOptions,
  type LocalServer,
} from "../helpers/net-harness";

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

const page = (server: LocalServer, path = "/"): FetchRequest => ({
  url: server.url("site.example", path),
  kind: "page",
  method: "GET",
});

describe("a plain GET", () => {
  it("fills every FetchRecord field from what the server sent", async () => {
    const body = "<!doctype html><html lang=\"en\"><head><title>Hello</title></head><body><h1>Hi</h1></body></html>";
    const server = await serve((_req, res) => {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "content-language": "en" });
      res.end(body);
    });
    const { fetcher } = fetcherFor(server);
    const record = await fetcher.fetch(page(server, "/a/b?x=1"));

    expect(record).toMatchObject({
      url: `http://site.example:${server.port}/a/b?x=1`,
      finalUrl: `http://site.example:${server.port}/a/b?x=1`,
      kind: "page",
      method: "GET",
      status: 200,
      redirectChain: [],
      contentType: "text/html; charset=utf-8",
      decodedBytes: Buffer.byteLength(body),
      body,
      bodyHash: createHash("sha256").update(body).digest("hex"),
      truncated: false,
      error: null,
      requestAcceptEncoding: "gzip, br",
      fetchedAt: FIXED_NOW.toISOString(),
      tls: null,
    });
    expect(record.wireBytes).toBe(Buffer.byteLength(body));
    expect(record.headers["content-language"]).toBe("en");
    expect(record.durationMs).toBeGreaterThanOrEqual(0);
    expect(record.ttfbMs).not.toBeNull();
    expect(record.ttfbMs as number).toBeGreaterThanOrEqual(0);
  });

  it("measures time to first byte from the connection, not from the start of the call", async () => {
    const server = await serve((_req, res) => {
      setTimeout(() => sendHtml(res), 250);
    });
    const { fetcher } = fetcherFor(server);
    const record = await fetcher.fetch(page(server));
    expect(record.ttfbMs).toBeGreaterThanOrEqual(230);
    expect(record.ttfbMs).toBeLessThan(1500);
    expect(record.durationMs).toBeGreaterThanOrEqual(record.ttfbMs as number);
  });

  it("has a null time to first byte when no connection was made", async () => {
    const server = await serve((_req, res) => sendHtml(res));
    const { fetcher } = fetcherFor(server);
    const record = await fetcher.fetch({ url: "http://other.example/", kind: "page", method: "GET" });
    expect(record.ttfbMs).toBeNull();
  });

  it("sends the documented request headers and nothing that identifies the user", async () => {
    const server = await serve((_req, res) => sendHtml(res));
    const { fetcher } = fetcherFor(server);
    await fetcher.fetch(page(server));
    const seen = server.seen[0];
    expect(seen.method).toBe("GET");
    expect(seen.headers["user-agent"]).toBe(OWN_USER_AGENT);
    expect(seen.headers["user-agent"]).toBe("DataBridgesBot/1.0 (+https://databridges.ie/index/bot)");
    expect(seen.headers["accept-encoding"]).toBe("gzip, br");
    expect(seen.headers.host).toBe(`site.example:${server.port}`);
    expect(seen.headers.cookie).toBeUndefined();
    expect(seen.headers.authorization).toBeUndefined();
    expect(seen.headers.referer).toBeUndefined();
    expect(seen.rawHeaderNames.sort()).toEqual(["accept", "accept-encoding", "connection", "host", "user-agent"]);
  });

  it("uses a content-type specific Accept header per kind", async () => {
    const server = await serve((_req, res) => {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("User-agent: *\nDisallow:\n");
    });
    const { fetcher } = fetcherFor(server);
    await fetcher.fetch({ url: server.url("site.example", "/robots.txt"), kind: "robots", method: "GET" });
    expect(server.seen[0].headers.accept).toContain("text/plain");
    expect(server.seen[0].headers.accept).not.toContain("text/html");
  });

  it("never stores or sends cookies, even across a redirect", async () => {
    const server = await serve((req, res) => {
      if (req.url === "/start") {
        res.writeHead(302, { location: "/next", "set-cookie": "sid=secret; Path=/" });
        res.end();
      } else {
        res.writeHead(200, { "content-type": "text/html", "set-cookie": "tracker=1" });
        res.end("<html></html>");
      }
    });
    const { fetcher } = fetcherFor(server);
    const first = await fetcher.fetch(page(server, "/start"));
    await fetcher.fetch(page(server, "/again"));
    expect(server.seen.map((s) => s.url)).toEqual(["/start", "/next", "/again"]);
    for (const seen of server.seen) expect(seen.headers.cookie).toBeUndefined();
    expect(first.headers["set-cookie"]).toBeUndefined();
  });

  it("keeps only the allowed response headers and joins repeated ones", async () => {
    const server = await serve((_req, res) => {
      res.writeHead(200, [
        ["Content-Type", "text/html"],
        ["X-Secret", "hunter2"],
        ["Set-Cookie", "a=b"],
        ["Strict-Transport-Security", "max-age=1"],
        ["Link", "<https://site.example/a>; rel=canonical"],
        ["Link", "<https://site.example/b>; rel=alternate"],
        ["X-Robots-Tag", "noindex"],
        ["Server", "test-server"],
        ["Cache-Control", "max-age=60"],
      ]);
      res.end("<html></html>");
    });
    const { fetcher } = fetcherFor(server);
    const record = await fetcher.fetch(page(server));
    const allowed = new Set<string>(ALLOWED_RESPONSE_HEADERS);
    for (const name of Object.keys(record.headers)) expect(allowed.has(name), name).toBe(true);
    expect(record.headers["x-robots-tag"]).toBe("noindex");
    expect(record.headers.server).toBe("test-server");
    expect(record.headers["cache-control"]).toBe("max-age=60");
    expect(record.headers.link).toBe("<https://site.example/a>; rel=canonical, <https://site.example/b>; rel=alternate");
    expect(record.headers["x-secret"]).toBeUndefined();
    expect(record.headers["set-cookie"]).toBeUndefined();
  });

  it("decodes the body using the declared charset", async () => {
    const server = await serve((_req, res) => {
      res.writeHead(200, { "content-type": "text/html; charset=iso-8859-1" });
      res.end(Buffer.from("<html><body>caf\xe9</body></html>", "latin1"));
    });
    const { fetcher } = fetcherFor(server);
    const record = await fetcher.fetch(page(server));
    expect(record.body).toContain("café");
  });

  it("decodes gzip, brotli and deflate bodies and reports both sizes", async () => {
    const text = "<html><body>" + "<p>repeat</p>".repeat(2000) + "</body></html>";
    const encodings: Record<string, Buffer> = {
      gzip: zlib.gzipSync(text),
      br: zlib.brotliCompressSync(text),
      deflate: zlib.deflateSync(text),
    };
    const server = await serve((req, res) => {
      const encoding = (req.url ?? "/").slice(1);
      res.writeHead(200, { "content-type": "text/html", "content-encoding": encoding });
      res.end(encodings[encoding]);
    });
    const { fetcher } = fetcherFor(server);
    for (const encoding of Object.keys(encodings)) {
      const record = await fetcher.fetch(page(server, `/${encoding}`));
      expect(record.error, encoding).toBeNull();
      expect(record.body, encoding).toBe(text);
      expect(record.wireBytes, encoding).toBe(encodings[encoding].length);
      expect(record.decodedBytes, encoding).toBe(Buffer.byteLength(text));
      expect(record.wireBytes, encoding).toBeLessThan(record.decodedBytes);
    }
  });

  it("returns DECODE_ERROR for an unsupported or corrupt content-encoding", async () => {
    const server = await serve((req, res) => {
      if (req.url === "/unsupported") {
        res.writeHead(200, { "content-type": "text/html", "content-encoding": "compress" });
        res.end("data");
      } else if (req.url === "/stacked") {
        res.writeHead(200, { "content-type": "text/html", "content-encoding": "gzip, br" });
        res.end(zlib.gzipSync("<html></html>"));
      } else {
        res.writeHead(200, { "content-type": "text/html", "content-encoding": "gzip" });
        res.end(Buffer.from("this is not gzip data at all"));
      }
    });
    const { fetcher } = fetcherFor(server);
    for (const path of ["/unsupported", "/stacked", "/corrupt"]) {
      const record = await fetcher.fetch(page(server, path));
      expect(record.error?.code, path).toBe("DECODE_ERROR");
      expect(record.body, path).toBeNull();
    }
  });

  it("keeps the HTML body of an error page (challenge markup needs it) but not a non-text one", async () => {
    const server = await serve((req, res) => {
      if (req.url === "/blocked") {
        res.writeHead(403, { "content-type": "text/html" });
        res.end("<html><body>Just a moment...</body></html>");
      } else {
        res.writeHead(500, { "content-type": "image/png" });
        res.end(Buffer.alloc(100));
      }
    });
    const { fetcher } = fetcherFor(server);
    const blocked = await fetcher.fetch(page(server, "/blocked"));
    expect(blocked).toMatchObject({ status: 403, error: null });
    expect(blocked.body).toContain("Just a moment");
    const image = await fetcher.fetch(page(server, "/image"));
    expect(image).toMatchObject({ status: 500, error: null, body: null });
  });

  it("does not read a body for 204 and 304", async () => {
    const server = await serve((req, res) => {
      res.writeHead(req.url === "/nc" ? 204 : 304);
      res.end();
    });
    const { fetcher } = fetcherFor(server);
    expect(await fetcher.fetch(page(server, "/nc"))).toMatchObject({ status: 204, error: null, body: null });
    expect(await fetcher.fetch(page(server, "/nm"))).toMatchObject({ status: 304, error: null, body: null });
  });
});

describe("headers-only kinds", () => {
  it.each(["http-variant", "link-check", "timing"] as const)("%s never reads a body", async (kind) => {
    const server = await serve((_req, res) => {
      res.writeHead(200, { "content-type": "application/pdf" });
      res.write(Buffer.alloc(100_000));
      setTimeout(() => res.end(Buffer.alloc(100_000)), 100);
    });
    const { fetcher } = fetcherFor(server);
    const record = await fetcher.fetch({ url: server.url("site.example"), kind, method: "GET" });
    expect(record).toMatchObject({ status: 200, error: null, body: null, bodyHash: null, wireBytes: 0 });
    expect(record.contentType).toBe("application/pdf");
  });

  it("sends HEAD when asked and keeps the method on a redirect", async () => {
    const server = await serve((req, res) => {
      if (req.url === "/old") redirect(res, "/new", 307);
      else {
        res.writeHead(200, { "content-type": "text/html" });
        res.end();
      }
    });
    const { fetcher } = fetcherFor(server);
    const record = await fetcher.fetch({ url: server.url("site.example", "/old"), kind: "link-check", method: "HEAD" });
    expect(server.seen.map((s) => `${s.method} ${s.url}`)).toEqual(["HEAD /old", "HEAD /new"]);
    expect(record).toMatchObject({ method: "HEAD", status: 200, body: null });
  });
});

describe("only GET and HEAD to allowlisted resources", () => {
  it("refuses any other method and any unknown kind without sending anything", async () => {
    const server = await serve((_req, res) => sendHtml(res));
    const { fetcher } = fetcherFor(server);
    for (const method of ["POST", "PUT", "DELETE", "OPTIONS", "PATCH", "get"]) {
      const record = await fetcher.fetch({ url: server.url("site.example"), kind: "page", method } as unknown as FetchRequest);
      expect(record.error, method).not.toBeNull();
      expect(record.status, method).toBeNull();
    }
    const unknownKind = await fetcher.fetch({ url: server.url("site.example"), kind: "crawl", method: "GET" } as unknown as FetchRequest);
    expect(unknownKind.error).not.toBeNull();
    expect(server.seen).toHaveLength(0);
  });

  it("returns only documented error codes", async () => {
    const server = await serve((_req, res) => sendHtml(res));
    const { fetcher } = fetcherFor(server);
    const record = await fetcher.fetch({ url: "ftp://site.example/", kind: "page", method: "GET" });
    expect(FETCH_ERROR_CODES).toContain(record.error?.code);
  });

  it("refuses a host outside the allowlist before any DNS or network activity", async () => {
    const server = await serve((_req, res) => sendHtml(res));
    const { fetcher, resolverCalls } = fetcherFor(server, {
      hosts: { "site.example": ["127.0.0.1"], "other.example": ["127.0.0.1"] },
      allowed: ["site.example"],
    });
    const record = await fetcher.fetch({ url: server.url("other.example"), kind: "page", method: "GET" });
    expect(record.error?.code).toBe("HOST_NOT_ALLOWLISTED");
    expect(record).toMatchObject({ status: null, body: null, redirectChain: [], requestAcceptEncoding: null });
    expect(resolverCalls).toEqual([]);
    expect(server.seen).toHaveLength(0);
    expect(server.connections()).toBe(0);
  });

  it("treats the bare and www forms of an allowlisted host as the same site, and nothing else", async () => {
    const server = await serve((_req, res) => sendHtml(res));
    const { fetcher } = fetcherFor(server, {
      hosts: {
        "site.example": ["127.0.0.1"],
        "www.site.example": ["127.0.0.1"],
        "app.site.example": ["127.0.0.1"],
        "www.www.site.example": ["127.0.0.1"],
        "site.example.evil.example": ["127.0.0.1"],
        "notsite.example": ["127.0.0.1"],
      },
      allowed: ["site.example"],
    });
    const status = async (host: string) => (await fetcher.fetch({ url: server.url(host), kind: "page", method: "GET" })).error?.code ?? "OK";
    expect(await status("site.example")).toBe("OK");
    expect(await status("www.site.example")).toBe("OK");
    expect(await status("app.site.example")).toBe("HOST_NOT_ALLOWLISTED");
    expect(await status("www.www.site.example")).toBe("HOST_NOT_ALLOWLISTED");
    expect(await status("site.example.evil.example")).toBe("HOST_NOT_ALLOWLISTED");
    expect(await status("notsite.example")).toBe("HOST_NOT_ALLOWLISTED");
  });

  it("refuses unparsable, non-http, userinfo, IP-literal and bad-port targets with URL_REJECTED", async () => {
    const server = await serve((_req, res) => sendHtml(res));
    const { fetcher, resolverCalls } = fetcherFor(server);
    const targets = [
      "",
      "not a url",
      "file:///etc/passwd",
      "ftp://site.example/",
      "gopher://site.example/",
      "http://user:pw@site.example/",
      "http://127.0.0.1/",
      "http://[::1]/",
      "http://2130706433/",
      "http://localhost/",
      "http://site.example:22/",
      "http://site.example:6379/",
      `http://site.example/${"a".repeat(2100)}`,
    ];
    for (const url of targets) {
      const record = await fetcher.fetch({ url, kind: "page", method: "GET" });
      expect(record.error?.code, url.slice(0, 40)).toBe("URL_REJECTED");
      expect(record.url.length).toBeLessThanOrEqual(2048);
    }
    expect(resolverCalls).toEqual([]);
    expect(server.connections()).toBe(0);
  });
});

describe("redirects", () => {
  it("follows a redirect, records the hop exactly as received and resolves relative locations", async () => {
    const server = await serve((req, res) => {
      if (req.url === "/old") redirect(res, "../new/page?x=1#frag", 301);
      else sendHtml(res);
    });
    const { fetcher } = fetcherFor(server);
    const record = await fetcher.fetch(page(server, "/old"));
    expect(record.status).toBe(200);
    expect(record.redirectChain).toEqual([
      { url: `http://site.example:${server.port}/old`, status: 301, location: "../new/page?x=1#frag" },
    ]);
    expect(record.url).toBe(`http://site.example:${server.port}/old`);
    expect(record.finalUrl).toBe(`http://site.example:${server.port}/new/page?x=1`);
    expect(server.seen.map((s) => s.url)).toEqual(["/old", "/new/page?x=1"]);
  });

  it("follows up to four redirects", async () => {
    const server = await serve((req, res) => {
      const n = Number((req.url ?? "/h0").slice(2));
      if (n < 4) redirect(res, `/h${n + 1}`);
      else sendHtml(res);
    });
    const { fetcher } = fetcherFor(server);
    const record = await fetcher.fetch(page(server, "/h0"));
    expect(record).toMatchObject({ status: 200, error: null });
    expect(record.redirectChain).toHaveLength(4);
    expect(record.finalUrl.endsWith("/h4")).toBe(true);
  });

  it("stops at the fifth redirect with TOO_MANY_REDIRECTS and keeps the chain", async () => {
    const server = await serve((req, res) => {
      const n = Number((req.url ?? "/h0").slice(2));
      redirect(res, `/h${n + 1}`);
    });
    const { fetcher } = fetcherFor(server);
    const record = await fetcher.fetch(page(server, "/h0"));
    expect(record.error?.code).toBe("TOO_MANY_REDIRECTS");
    expect(record.redirectChain).toHaveLength(5);
    expect(record.status).toBe(302);
    expect(server.seen).toHaveLength(5);
  });

  it("stops a ten-hop chain after five requests", async () => {
    const server = await serve((req, res) => {
      const n = Number((req.url ?? "/h0").slice(2));
      if (n < 10) redirect(res, `/h${n + 1}`);
      else sendHtml(res);
    });
    const { fetcher } = fetcherFor(server);
    const record = await fetcher.fetch(page(server, "/h0"));
    expect(record.error?.code).toBe("TOO_MANY_REDIRECTS");
    expect(server.seen).toHaveLength(5);
  });

  it("detects a redirect loop and a redirect to itself", async () => {
    const server = await serve((req, res) => {
      if (req.url === "/a") redirect(res, "/b");
      else if (req.url === "/b") redirect(res, "/a");
      else redirect(res, "/self");
    });
    const { fetcher } = fetcherFor(server);
    const loop = await fetcher.fetch(page(server, "/a"));
    expect(loop.error?.code).toBe("REDIRECT_LOOP");
    expect(loop.redirectChain).toHaveLength(2);
    const self = await fetcher.fetch(page(server, "/self"));
    expect(self.error?.code).toBe("REDIRECT_LOOP");
    expect(self.redirectChain).toHaveLength(1);
  });

  it("returns a redirect without a Location as an unresolved 3xx with no error", async () => {
    const server = await serve((_req, res) => {
      res.writeHead(302);
      res.end();
    });
    const { fetcher } = fetcherFor(server);
    const record = await fetcher.fetch(page(server));
    expect(record).toMatchObject({ status: 302, error: null });
    expect(record.redirectChain).toEqual([{ url: `http://site.example:${server.port}/`, status: 302, location: null }]);
  });

  it("does not treat 300, 304 or 305 as redirects", async () => {
    const server = await serve((req, res) => {
      res.writeHead(Number((req.url ?? "/300").slice(1)), { location: "/elsewhere", "content-type": "text/html" });
      res.end("<html></html>");
    });
    const { fetcher } = fetcherFor(server);
    for (const code of [300, 305]) {
      const record = await fetcher.fetch(page(server, `/${code}`));
      expect(record.redirectChain, String(code)).toEqual([]);
      expect(record.status).toBe(code);
    }
    expect(server.seen.every((s) => s.url !== "/elsewhere")).toBe(true);
  });
});

describe("transport failures", () => {
  it("reports DNS_FAILED when the stub resolver cannot find the host", async () => {
    const notFound: NodeJS.ErrnoException = new Error("ENOTFOUND");
    notFound.code = "ENOTFOUND";
    const server = await serve((_req, res) => sendHtml(res));
    const { fetcher } = fetcherFor(server, { hosts: { "site.example": notFound } });
    const record = await fetcher.fetch(page(server));
    expect(record.error?.code).toBe("DNS_FAILED");
    expect(record.status).toBeNull();
  });

  it("reports CONNECT_REFUSED for a closed port", async () => {
    const closed = await startHttpServer((_req, res) => sendHtml(res));
    const port = closed.port;
    await closed.close();
    const { fetcher } = createTestFetcher({ hosts: { "site.example": ["127.0.0.1"] }, ports: [port] });
    cleanups.push(() => fetcher.close());
    const record = await fetcher.fetch({ url: `http://site.example:${port}/`, kind: "page", method: "GET" });
    expect(record.error?.code).toBe("CONNECT_REFUSED");
  });

  it("reports CONNECTION_RESET when the server drops the connection mid-body", async () => {
    const server = await serve((_req, res) => {
      res.writeHead(200, { "content-type": "text/html", "content-length": "100000" });
      res.write("<html>partial");
      setTimeout(() => res.destroy(), 30);
    });
    const { fetcher } = fetcherFor(server);
    const record = await fetcher.fetch(page(server));
    expect(record.error?.code).toBe("CONNECTION_RESET");
    expect(record.body).toBeNull();
    expect(record.truncated).toBe(true);
  });

  it("reports CONNECTION_RESET when the server closes without answering", async () => {
    const raw = await startRawServer((socket) => socket.destroy());
    cleanups.push(() => raw.close());
    const { fetcher } = fetcherFor(raw);
    const record = await fetcher.fetch(page(raw));
    expect(record.error?.code).toBe("CONNECTION_RESET");
  });

  it("reports PROTOCOL_ERROR for a response that is not HTTP", async () => {
    const raw = await startRawServer((socket) => {
      socket.write("this is definitely not http\r\n\r\n");
    });
    cleanups.push(() => raw.close());
    const { fetcher } = fetcherFor(raw);
    const record = await fetcher.fetch(page(raw));
    expect(record.error?.code).toBe("PROTOCOL_ERROR");
  });
});

describe("stats and lifecycle", () => {
  it("counts every request actually sent, including redirect hops", async () => {
    const server = await serve((req, res) => {
      if (req.url === "/old") redirect(res, "/new");
      else sendHtml(res);
    });
    const { fetcher } = fetcherFor(server);
    await fetcher.fetch(page(server, "/old"));
    await fetcher.fetch(page(server, "/new"));
    await fetcher.fetch({ url: "ftp://site.example/", kind: "page", method: "GET" });
    const stats = fetcher.stats();
    expect(stats.requestCount).toBe(3);
    expect(stats.requestCapReached).toBe(false);
    expect(stats.jobTimedOut).toBe(false);
    expect(stats.jobDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("can be closed more than once", async () => {
    const server = await serve((_req, res) => sendHtml(res));
    const { fetcher } = fetcherFor(server);
    await fetcher.fetch(page(server));
    fetcher.close();
    expect(() => fetcher.close()).not.toThrow();
  });
});

describe("the own-agent robots gate", () => {
  it("refuses a gated request with ROBOTS_DISALLOWED and sends nothing", async () => {
    const server = await serve((_req, res) => sendHtml(res));
    const asked: string[] = [];
    const { fetcher } = fetcherFor(server, {
      robotsGate: (url, kind) => {
        asked.push(`${kind} ${url}`);
        return !url.includes("/private");
      },
    });
    const blocked = await fetcher.fetch(page(server, "/private/x"));
    expect(blocked).toMatchObject({ status: null, body: null, redirectChain: [], requestAcceptEncoding: null });
    expect(blocked.error?.code).toBe("ROBOTS_DISALLOWED");
    expect(server.seen).toHaveLength(0);

    const allowed = await fetcher.fetch(page(server, "/open"));
    expect(allowed.status).toBe(200);
    expect(asked).toEqual([`page http://site.example:${server.port}/private/x`, `page http://site.example:${server.port}/open`]);
  });

  it("never gates robots.txt itself", async () => {
    const server = await serve((_req, res) => {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("User-agent: *\nDisallow: /\n");
    });
    const { fetcher } = fetcherFor(server, { robotsGate: () => false });
    const record = await fetcher.fetch({ url: server.url("site.example", "/robots.txt"), kind: "robots", method: "GET" });
    expect(record.status).toBe(200);
    expect(record.body).toContain("Disallow");
  });

  it("applies the gate to every redirect hop", async () => {
    const server = await serve((req, res) => {
      if (req.url === "/start") redirect(res, "/private");
      else sendHtml(res);
    });
    const { fetcher } = fetcherFor(server, { robotsGate: (url) => !url.endsWith("/private") });
    const record = await fetcher.fetch(page(server, "/start"));
    expect(record.error?.code).toBe("REDIRECT_BLOCKED");
    expect(record.error?.message).toContain("ROBOTS_DISALLOWED");
    expect(server.seen.map((s) => s.url)).toEqual(["/start"]);
  });

  it("fails closed when the gate throws", async () => {
    const server = await serve((_req, res) => sendHtml(res));
    const { fetcher } = fetcherFor(server, {
      robotsGate: () => {
        throw new Error("gate failure");
      },
    });
    const record = await fetcher.fetch(page(server));
    expect(record.error).not.toBeNull();
    expect(server.seen).toHaveLength(0);
  });
});
