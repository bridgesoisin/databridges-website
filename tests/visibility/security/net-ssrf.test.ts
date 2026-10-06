import zlib from "node:zlib";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FetchRecord, FetchRequest } from "@/lib/visibility/types";
import {
  createTestFetcher,
  redirect,
  sendHtml,
  startHttpServer,
  type Handler,
  type HarnessOptions,
  type LocalServer,
} from "../helpers/net-harness";
import { observeConnections, type ConnectionObserver } from "../helpers/net-observe";

// Plan 7.3, item by item. Every test runs against a local server on 127.0.0.1 and a stub resolver; the
// observer below sits under the fetch layer and fails the test if any socket was ever pointed at an
// address other than that one server.

const cleanups: Array<() => Promise<void> | void> = [];
let observer: ConnectionObserver;

beforeEach(() => {
  observer = observeConnections();
});

afterEach(async () => {
  observer.stop();
  for (const fn of cleanups.splice(0).reverse()) await fn();
  for (const address of [...observer.lookups, ...observer.connected]) expect(address).toBe("127.0.0.1");
});

async function serve(handler: Handler): Promise<LocalServer> {
  const server = await startHttpServer(handler);
  cleanups.push(() => server.close());
  return server;
}

function fetcherFor(server: LocalServer, options: Partial<HarnessOptions>) {
  const harness = createTestFetcher({ hosts: { "site.example": ["127.0.0.1"] }, ports: [server.port], ...options });
  cleanups.push(() => harness.fetcher.close());
  return harness;
}

const page = (url: string): FetchRequest => ({ url, kind: "page", method: "GET" });

function expectRefusedBeforeNetwork(record: FetchRecord, code: string): void {
  expect(record.error?.code).toBe(code);
  expect(record).toMatchObject({ status: null, body: null, bodyHash: null, redirectChain: [], wireBytes: 0, requestAcceptEncoding: null });
}

describe("7.3 loopback, private, link-local, metadata, CGNAT, reserved and documentation destinations", () => {
  let target: LocalServer;
  beforeAll(async () => {
    target = await startHttpServer((_req, res) => sendHtml(res));
  });
  afterAll(async () => {
    await target.close();
  });

  const blocked: Array<[string, string]> = [
    ["loopback v4", "127.0.0.1"],
    ["loopback v4 elsewhere in 127/8", "127.1.2.3"],
    ["loopback v6", "::1"],
    ["loopback v6 long form", "0:0:0:0:0:0:0:1"],
    ["IPv4-mapped loopback, dotted", "::ffff:127.0.0.1"],
    ["IPv4-mapped loopback, hex", "::ffff:7f00:1"],
    ["IPv4-mapped metadata", "::ffff:a9fe:a9fe"],
    ["IPv4-mapped private", "::ffff:10.0.0.1"],
    ["IPv4-compatible loopback", "::127.0.0.1"],
    ["this network", "0.0.0.0"],
    ["this network, host part", "0.1.2.3"],
    ["unspecified v6", "::"],
    ["rfc1918 10/8", "10.0.0.5"],
    ["rfc1918 172.16/12 low", "172.16.0.1"],
    ["rfc1918 172.16/12 high", "172.31.255.254"],
    ["rfc1918 192.168/16", "192.168.1.1"],
    ["link-local", "169.254.1.1"],
    ["cloud metadata", "169.254.169.254"],
    ["cloud metadata (ECS)", "169.254.170.2"],
    ["link-local v6", "fe80::1"],
    ["unique-local v6", "fc00::1"],
    ["cloud metadata v6", "fd00:ec2::254"],
    ["carrier-grade NAT", "100.64.0.1"],
    ["carrier-grade NAT (Alibaba metadata)", "100.100.100.200"],
    ["IETF protocol assignments", "192.0.0.1"],
    ["documentation 192.0.2/24", "192.0.2.1"],
    ["documentation 198.51.100/24", "198.51.100.1"],
    ["documentation 203.0.113/24", "203.0.113.1"],
    ["documentation v6", "2001:db8::1"],
    ["benchmarking", "198.18.0.1"],
    ["multicast", "224.0.0.1"],
    ["multicast v6", "ff02::1"],
    ["reserved", "240.0.0.1"],
    ["broadcast", "255.255.255.255"],
    ["NAT64", "64:ff9b::7f00:1"],
    ["6to4", "2002:7f00:1::1"],
    ["Teredo", "2001::1"],
    ["not global unicast", "4000::1"],
  ];

  it.each(blocked)("refuses a hostname that resolves to %s (%s)", async (_label, address) => {
    const { fetcher, resolverCalls } = fetcherFor(target, { hosts: { "victim.example": [address] }, exempt: [] });
    const record = await fetcher.fetch(page(target.url("victim.example")));
    expectRefusedBeforeNetwork(record, "ADDRESS_BLOCKED");
    expect(resolverCalls).toEqual(["victim.example"]);
    expect(target.connections()).toBe(0);
    expect(observer.connectCalls).toBe(0);
    expect(observer.lookups).toEqual([]);
  });

  it("refuses the same destinations for every request kind and for HEAD", async () => {
    const { fetcher } = fetcherFor(target, { hosts: { "victim.example": ["169.254.169.254"] }, exempt: [] });
    for (const kind of ["page", "robots", "sitemap", "llms", "http-variant", "link-check", "timing"] as const) {
      for (const method of ["GET", "HEAD"] as const) {
        const record = await fetcher.fetch({ url: target.url("victim.example"), kind, method });
        expect(record.error?.code, `${kind} ${method}`).toBe("ADDRESS_BLOCKED");
      }
    }
    expect(observer.connectCalls).toBe(0);
  });

  it("refuses https as well", async () => {
    const { fetcher } = fetcherFor(target, { hosts: { "victim.example": ["10.0.0.5"] }, exempt: [] });
    const record = await fetcher.fetch(page(target.url("victim.example", "/", "https")));
    expect(record.error?.code).toBe("ADDRESS_BLOCKED");
    expect(observer.connectCalls).toBe(0);
  });
});

describe("7.3 IP literals and alternative IP encodings", () => {
  it.each([
    "http://127.0.0.1/",
    "http://127.0.0.1:80/",
    "http://169.254.169.254/latest/meta-data/",
    "http://10.0.0.1/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[::ffff:7f00:1]/",
    "http://[fe80::1]/",
    "http://2130706433/",
    "http://0x7f000001/",
    "http://0x7f.0.0.1/",
    "http://0177.0.0.1/",
    "http://017700000001/",
    "http://127.1/",
    "http://0/",
    "http://2852039166/",
    "http://0251.0376.0251.0376/",
  ])("rejects %s before resolving or connecting", async (url) => {
    const server = await serve((_req, res) => sendHtml(res));
    const { fetcher, resolverCalls } = fetcherFor(server, {});
    expectRefusedBeforeNetwork(await fetcher.fetch(page(url)), "URL_REJECTED");
    expect(resolverCalls).toEqual([]);
    expect(server.connections()).toBe(0);
    expect(observer.connectCalls).toBe(0);
  });
});

describe("7.3 userinfo tricks, IDN lookalikes, schemes and ports", () => {
  it.each([
    ["userinfo naming the allowed host", "http://site.example@evil.example/"],
    ["userinfo with credentials", "http://user:pass@site.example/"],
    ["port in userinfo position", "http://site.example:80@evil.example/"],
    ["empty userinfo", "http://@site.example/"],
  ])("rejects %s", async (_label, url) => {
    const server = await serve((_req, res) => sendHtml(res));
    const { fetcher } = fetcherFor(server, {});
    expectRefusedBeforeNetwork(await fetcher.fetch(page(url)), "URL_REJECTED");
    expect(server.connections()).toBe(0);
  });

  it("keeps an encoded-@ or backslash trick pointed at the host the parser really uses, and checks that host", async () => {
    const server = await serve((_req, res) => sendHtml(res));
    const { fetcher, resolverCalls } = fetcherFor(server, {
      hosts: { "site.example": ["127.0.0.1"], "evil.example": ["127.0.0.1"] },
      allowed: ["site.example"],
    });
    for (const url of [
      `http://evil.example\\@site.example:${server.port}/`,
      `http://evil.example:${server.port}\\@site.example/`,
      "http://site.example%40evil.example/",
    ]) {
      const record = await fetcher.fetch(page(url));
      expect(record.error, url).not.toBeNull();
      expect(record.status, url).toBeNull();
    }
    expect(resolverCalls).toEqual([]);
    expect(server.seen).toHaveLength(0);
  });

  it("treats an IDN lookalike of an allowlisted host as a different, refused host", async () => {
    const server = await serve((_req, res) => sendHtml(res));
    const { fetcher, resolverCalls } = fetcherFor(server, {
      hosts: { "site.example": ["127.0.0.1"], "xn--ite-9ta.example": ["127.0.0.1"] },
      allowed: ["site.example"],
    });
    const lookalike = await fetcher.fetch(page(`http://sіte.example:${server.port}/`));
    expect(lookalike.error?.code).toBe("HOST_NOT_ALLOWLISTED");
    const accented = await fetcher.fetch(page(`http://šite.example:${server.port}/`));
    expect(accented.error?.code).toBe("HOST_NOT_ALLOWLISTED");
    expect(resolverCalls).toEqual([]);
    expect(server.seen).toHaveLength(0);
  });

  it.each([
    "file:///etc/passwd",
    "file://site.example/etc/passwd",
    "gopher://site.example/",
    "ftp://site.example/",
    "dict://site.example:11211/stat",
    "ldap://site.example/",
    "javascript:alert(1)",
    "data:text/html,hi",
    "ws://site.example/",
  ])("rejects the scheme in %s", async (url) => {
    const server = await serve((_req, res) => sendHtml(res));
    const { fetcher } = fetcherFor(server, {});
    expectRefusedBeforeNetwork(await fetcher.fetch(page(url)), "URL_REJECTED");
    expect(server.connections()).toBe(0);
  });

  it.each([22, 25, 110, 143, 389, 445, 3306, 5432, 6379, 8080, 9200, 11211, 27017])("rejects port %i", async (port) => {
    const server = await serve((_req, res) => sendHtml(res));
    const { fetcher } = fetcherFor(server, {});
    expectRefusedBeforeNetwork(await fetcher.fetch(page(`http://site.example:${port}/`)), "URL_REJECTED");
    expect(server.connections()).toBe(0);
    expect(observer.connectCalls).toBe(0);
  });
});

describe("7.3 redirects to private addresses, other schemes and other hosts", () => {
  async function redirectOutcome(location: string, extra: Partial<HarnessOptions> = {}) {
    const server = await serve((_req, res) => redirect(res, location));
    const harness = fetcherFor(server, extra);
    const record = await harness.fetcher.fetch(page(server.url("site.example", "/start")));
    return { server, record, ...harness };
  }

  it.each([
    ["the metadata address", "http://169.254.169.254/latest/meta-data/"],
    ["loopback", "http://127.0.0.1/admin"],
    ["loopback v6", "http://[::1]/"],
    ["IPv4-mapped loopback", "http://[::ffff:127.0.0.1]/"],
    ["a decimal-encoded loopback", "http://2130706433/"],
    ["an octal-encoded loopback", "http://0177.0.0.1/"],
    ["a hex-encoded metadata address", "http://0xa9fea9fe/"],
    ["a private address", "http://10.0.0.1/"],
    ["userinfo naming the allowed host", "http://site.example@evil.example/"],
    ["credentials", "http://user:pass@site.example/"],
    ["a disallowed port", "http://site.example:6379/"],
    ["ssh port", "http://site.example:22/"],
  ])("blocks a redirect to %s", async (_label, location) => {
    const { server, record } = await redirectOutcome(location);
    expect(record.error?.code).toBe("REDIRECT_BLOCKED");
    expect(record.redirectChain).toHaveLength(1);
    expect(record.redirectChain[0]).toMatchObject({ status: 302, location });
    expect(record.finalUrl).toBe(`http://site.example:${server.port}/start`);
    expect(server.seen).toHaveLength(1);
    expect(observer.lookups).toEqual(["127.0.0.1"]);
  });

  it.each([
    "file:///etc/passwd",
    "ftp://site.example/",
    "gopher://site.example/_GET%20/",
    "javascript:alert(1)",
    "data:text/html,hi",
    "ws://site.example/",
    "ssh://site.example/",
  ])("blocks a redirect to the non-http scheme in %s", async (location) => {
    const { server, record } = await redirectOutcome(location);
    expect(record.error?.code).toBe("REDIRECT_BLOCKED");
    expect(server.seen).toHaveLength(1);
    expect(observer.lookups).toEqual(["127.0.0.1"]);
  });

  it("blocks a redirect to an allowlisted-looking hostname that resolves to a private address", async () => {
    const { server, record, resolverCalls } = await redirectOutcome("http://internal.example/", {
      hosts: { "site.example": ["127.0.0.1"], "internal.example": ["10.0.0.5"] },
    });
    expect(record.error?.code).toBe("REDIRECT_BLOCKED");
    expect(record.error?.message).toContain("ADDRESS_BLOCKED");
    expect(resolverCalls).toEqual(["site.example", "internal.example"]);
    expect(server.seen).toHaveLength(1);
    expect(observer.lookups).toEqual(["127.0.0.1"]);
  });

  it("blocks a redirect to an allowlisted host that resolves to another loopback address", async () => {
    const { server, record } = await redirectOutcome("http://shadow.example/", {
      hosts: { "site.example": ["127.0.0.1"], "shadow.example": ["127.0.0.2"] },
    });
    expect(record.error?.code).toBe("REDIRECT_BLOCKED");
    expect(server.seen).toHaveLength(1);
    expect(observer.lookups).toEqual(["127.0.0.1"]);
  });

  it("blocks a redirect to a host that is not on the allowlist even when it resolves to a harmless address", async () => {
    const server = await serve((req, res) => {
      if (req.url === "/start") redirect(res, `http://other.example:${server.port}/landed`);
      else sendHtml(res);
    });
    const { fetcher, resolverCalls } = fetcherFor(server, {
      hosts: { "site.example": ["127.0.0.1"], "other.example": ["127.0.0.1"] },
      allowed: ["site.example"],
    });
    const record = await fetcher.fetch(page(server.url("site.example", "/start")));
    expect(record.error?.code).toBe("REDIRECT_BLOCKED");
    expect(record.error?.message).toContain("HOST_NOT_ALLOWLISTED");
    expect(server.seen.map((s) => `${s.host}${s.url}`)).toEqual(["site.example/start"]);
    expect(resolverCalls).toEqual(["site.example"]);
  });

  it("follows a redirect between the bare and www forms of the allowlisted host", async () => {
    const server = await serve((req, res) => {
      if (req.url === "/start") redirect(res, `http://www.site.example:${server.port}/landed`);
      else sendHtml(res);
    });
    const { fetcher } = fetcherFor(server, {
      hosts: { "site.example": ["127.0.0.1"], "www.site.example": ["127.0.0.1"] },
      allowed: ["site.example"],
    });
    const record = await fetcher.fetch(page(server.url("site.example", "/start")));
    expect(record).toMatchObject({ status: 200, error: null, finalUrl: `http://www.site.example:${server.port}/landed` });
  });

  it("re-validates every hop of a longer chain, not just the first", async () => {
    const server = await serve((req, res) => {
      if (req.url === "/a") redirect(res, "/b");
      else if (req.url === "/b") redirect(res, "/c");
      else redirect(res, "http://169.254.169.254/latest/meta-data/iam/security-credentials/");
    });
    const { fetcher } = fetcherFor(server, {});
    const record = await fetcher.fetch(page(server.url("site.example", "/a")));
    expect(record.error?.code).toBe("REDIRECT_BLOCKED");
    expect(record.redirectChain).toHaveLength(3);
    expect(server.seen.map((s) => s.url)).toEqual(["/a", "/b", "/c"]);
    expect(observer.lookups).toEqual(["127.0.0.1", "127.0.0.1", "127.0.0.1"]);
  });

  it("ends a redirect loop and a ten-hop chain without further requests", async () => {
    const server = await serve((req, res) => {
      const url = req.url ?? "/";
      if (url === "/loop-a") redirect(res, "/loop-b");
      else if (url === "/loop-b") redirect(res, "/loop-a");
      else redirect(res, `/hop${Number(url.slice(4)) + 1}`);
    });
    const { fetcher } = fetcherFor(server, {});
    const loop = await fetcher.fetch(page(server.url("site.example", "/loop-a")));
    expect(loop.error?.code).toBe("REDIRECT_LOOP");
    expect(server.seen).toHaveLength(2);

    server.seen.length = 0;
    const chain = await fetcher.fetch(page(server.url("site.example", "/hop0")));
    expect(chain.error?.code).toBe("TOO_MANY_REDIRECTS");
    expect(server.seen).toHaveLength(5);
  });

  it("ignores a Location that is malformed", async () => {
    for (const location of ["http://", "http://[::1", "http://exa mple.com", "//", "http://:80/"]) {
      const { record } = await redirectOutcome(location);
      expect(record.error?.code, location).toBe("REDIRECT_BLOCKED");
    }
  });
});

describe("7.3 DNS that returns a public then a private address (rebinding) and mixed A records", () => {
  it("resolves once per connection and connects only to the validated address", async () => {
    const server = await serve((_req, res) => sendHtml(res));
    const answers: Array<readonly string[]> = [["127.0.0.1"], ["10.0.0.5"], ["169.254.169.254"]];
    const { fetcher, resolverCalls } = fetcherFor(server, {
      hosts: { "rebind.example": (call) => answers[Math.min(call - 1, answers.length - 1)] },
    });
    const record = await fetcher.fetch(page(server.url("rebind.example")));
    expect(record).toMatchObject({ status: 200, error: null });
    expect(resolverCalls).toEqual(["rebind.example"]);
    expect(observer.lookups).toEqual(["127.0.0.1"]);
    expect(observer.connected).toEqual(["127.0.0.1"]);
  });

  it("does not trust the first answer for the next hop: the second resolution is validated again", async () => {
    const server = await serve((req, res) => {
      if (req.url === "/start") redirect(res, `http://rebind.example:${server.port}/second`);
      else sendHtml(res);
    });
    const { fetcher, resolverCalls } = fetcherFor(server, {
      hosts: { "rebind.example": (call) => (call === 1 ? ["127.0.0.1"] : ["10.0.0.5"]) },
    });
    const record = await fetcher.fetch(page(server.url("rebind.example", "/start")));
    expect(record.error?.code).toBe("REDIRECT_BLOCKED");
    expect(record.error?.message).toContain("ADDRESS_BLOCKED");
    expect(resolverCalls).toEqual(["rebind.example", "rebind.example"]);
    expect(server.seen.map((s) => s.url)).toEqual(["/start"]);
    expect(observer.lookups).toEqual(["127.0.0.1"]);
  });

  it("never lets the socket resolve the name itself: the name has no DNS record anywhere", async () => {
    const server = await serve((_req, res) => sendHtml(res));
    const { fetcher } = fetcherFor(server, { hosts: { "only-the-stub-knows.example": ["127.0.0.1"] } });
    const record = await fetcher.fetch(page(server.url("only-the-stub-knows.example")));
    expect(record).toMatchObject({ status: 200, error: null });
    expect(server.seen[0].host).toBe("only-the-stub-knows.example");
  });

  it.each([
    ["public then private", ["127.0.0.1", "10.0.0.5"]],
    ["private then public", ["10.0.0.5", "127.0.0.1"]],
    ["public, public, loopback v6", ["127.0.0.1", "127.0.0.1", "::1"]],
    ["public with the metadata address", ["127.0.0.1", "169.254.169.254"]],
    ["public v4 with mapped loopback", ["127.0.0.1", "::ffff:7f00:1"]],
  ])("refuses the whole host for mixed records (%s) and connects to nothing, not even the good address", async (_label, answer) => {
    const server = await serve((_req, res) => sendHtml(res));
    const { fetcher, resolverCalls } = fetcherFor(server, { hosts: { "mixed.example": answer } });
    const record = await fetcher.fetch(page(server.url("mixed.example")));
    expectRefusedBeforeNetwork(record, "ADDRESS_BLOCKED");
    expect(resolverCalls).toEqual(["mixed.example"]);
    expect(server.connections()).toBe(0);
    expect(observer.connectCalls).toBe(0);
  });

  it("fails cleanly when resolution fails or returns nothing", async () => {
    const server = await serve((_req, res) => sendHtml(res));
    const { fetcher } = fetcherFor(server, { hosts: { "empty.example": [], "bad.example": ["not-an-address"] } });
    expect((await fetcher.fetch(page(server.url("empty.example")))).error?.code).toBe("DNS_FAILED");
    expect((await fetcher.fetch(page(server.url("bad.example")))).error?.code).toBe("ADDRESS_BLOCKED");
    expect(observer.connectCalls).toBe(0);
  });
});

describe("7.3 hostile responses end in a documented outcome", () => {
  const zeros = (n: number) => Buffer.alloc(n, 0x20);

  async function hostile(handler: Handler, request: (server: LocalServer) => FetchRequest, options: Partial<HarnessOptions> = {}) {
    const server = await serve(handler);
    const { fetcher } = fetcherFor(server, options);
    const record = await fetcher.fetch(request(server));
    return { record, server };
  }

  const homepage = (server: LocalServer) => page(server.url("site.example"));

  it("gzip bomb: DECOMPRESSED_TOO_LARGE", async () => {
    const payload = zlib.gzipSync(zeros(60_000_000), { level: 9 });
    const { record } = await hostile((_r, res) => {
      res.writeHead(200, { "content-type": "text/html", "content-encoding": "gzip" });
      res.end(payload);
    }, homepage);
    expect(record.error?.code).toBe("DECOMPRESSED_TOO_LARGE");
    expect(record.body).toBeNull();
  });

  it("brotli bomb: DECOMPRESSED_TOO_LARGE", async () => {
    const payload = zlib.brotliCompressSync(zeros(60_000_000), { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 1 } });
    const { record } = await hostile((_r, res) => {
      res.writeHead(200, { "content-type": "text/html", "content-encoding": "br" });
      res.end(payload);
    }, homepage);
    expect(record.error?.code).toBe("DECOMPRESSED_TOO_LARGE");
    expect(record.body).toBeNull();
  });

  it("oversized body: RESPONSE_TOO_LARGE", async () => {
    const { record } = await hostile((_r, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(zeros(3_000_000));
    }, homepage);
    expect(record.error?.code).toBe("RESPONSE_TOO_LARGE");
    expect(record.body).toBeNull();
  });

  it("trickling response (slow loris): TIMEOUT, retried once like any page", async () => {
    const { record, server } = await hostile(
      (_r, res) => {
        res.writeHead(200, { "content-type": "text/html", "content-length": "5000" });
        res.flushHeaders();
        const timer = setInterval(() => res.write("x"), 30);
        res.on("close", () => clearInterval(timer));
      },
      homepage,
      { limits: { requestTimeoutMs: 300 } },
    );
    expect(record.error?.code).toBe("TIMEOUT");
    expect(record.body).toBeNull();
    expect(server.seen).toHaveLength(2);
  });

  it("wrong content type: CONTENT_TYPE_REJECTED", async () => {
    for (const type of ["application/octet-stream", "image/png", "application/pdf"]) {
      const { record } = await hostile((_r, res) => {
        res.writeHead(200, { "content-type": type });
        res.end("<html><body>hello</body></html>");
      }, homepage);
      expect(record.error?.code, type).toBe("CONTENT_TYPE_REJECTED");
      expect(record.body, type).toBeNull();
    }
  });

  it("very large headers: HEADERS_TOO_LARGE", async () => {
    const { record } = await hostile((_r, res) => {
      res.setHeader("x-bloat", "z".repeat(64_000));
      sendHtml(res);
    }, homepage);
    expect(record.error?.code).toBe("HEADERS_TOO_LARGE");
    expect(record.body).toBeNull();
  });
});
