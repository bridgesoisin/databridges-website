import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fetchModule from "@/lib/visibility/fetch";
import {
  DEFAULT_ALLOWED_HOSTS,
  EXTRA_HOSTS_ENV,
  PRODUCTION_LIMITS,
  createGuardedFetcher,
  defaultResolver,
} from "@/lib/visibility/fetch";
import { GuardError, resolveAndValidate, type Resolver } from "@/lib/visibility/net-guard";
import type { FetchRecord } from "@/lib/visibility/types";
import { sendHtml, startHttpServer, type LocalServer } from "../helpers/net-harness";
import { armTripwire, type Tripwire } from "../helpers/net-observe";

// The production factory against hostile DNS answers. A tripwire makes any client socket fail loudly, so a
// regression cannot reach a real address even when the answer looks public.

let tripwire: Tripwire;
const cleanups: Array<() => Promise<void> | void> = [];
const savedEnv = process.env[EXTRA_HOSTS_ENV];

beforeEach(() => {
  tripwire = armTripwire();
  delete process.env[EXTRA_HOSTS_ENV];
});

afterEach(async () => {
  tripwire.stop();
  vi.useRealTimers();
  if (savedEnv === undefined) delete process.env[EXTRA_HOSTS_ENV];
  else process.env[EXTRA_HOSTS_ENV] = savedEnv;
  for (const fn of cleanups.splice(0).reverse()) await fn();
});

function production(resolver: Resolver, extra: Record<string, unknown> = {}) {
  const fetcher = createGuardedFetcher({ resolver, ...extra } as Parameters<typeof createGuardedFetcher>[0]);
  cleanups.push(() => fetcher.close());
  return fetcher;
}

const answers =
  (list: readonly string[], calls: string[] = []): Resolver =>
  async (host) => {
    calls.push(host);
    return list.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));
  };

function expectRefused(record: FetchRecord, code: string): void {
  expect(record.error?.code).toBe(code);
  expect(record).toMatchObject({ status: null, body: null, redirectChain: [], wireBytes: 0 });
  expect(tripwire.attempts).toBe(0);
}

describe("production factory: allowlist", () => {
  it("defaults to databridges.ie and www.databridges.ie", () => {
    expect([...DEFAULT_ALLOWED_HOSTS]).toEqual(["databridges.ie", "www.databridges.ie"]);
  });

  it("refuses every other host before any DNS lookup", async () => {
    const calls: string[] = [];
    const fetcher = production(answers(["8.8.8.8"], calls));
    for (const url of [
      "https://example.com/",
      "https://google.com/",
      "https://databridges.ie.evil.example/",
      "https://evildatabridges.ie/",
      "https://sub.databridges.ie/",
      "https://www.www.databridges.ie/",
      "https://databridges.com/",
      "https://xn--bcher-kva.example/",
      "https://databrіdges.ie/",
    ]) {
      expectRefused(await fetcher.fetch({ url, kind: "page", method: "GET" }), "HOST_NOT_ALLOWLISTED");
    }
    expect(calls).toEqual([]);
  });

  it("lets both default hosts through the allowlist (the stub answer is then refused as private)", async () => {
    const calls: string[] = [];
    const fetcher = production(answers(["10.0.0.5"], calls));
    for (const url of ["https://databridges.ie/", "https://www.databridges.ie/", "http://databridges.ie/", "https://DataBridges.IE./x?y=1"]) {
      expectRefused(await fetcher.fetch({ url, kind: "page", method: "GET" }), "ADDRESS_BLOCKED");
    }
    expect(calls).toHaveLength(4);
  });

  it("replaces the default list with options.allowedHosts", async () => {
    const calls: string[] = [];
    const fetcher = production(answers(["10.0.0.5"], calls), { allowedHosts: ["one.example"] });
    expectRefused(await fetcher.fetch({ url: "https://databridges.ie/", kind: "page", method: "GET" }), "HOST_NOT_ALLOWLISTED");
    expectRefused(await fetcher.fetch({ url: "https://one.example/", kind: "page", method: "GET" }), "ADDRESS_BLOCKED");
    expect(calls).toEqual(["one.example"]);
  });
});

describe("production factory: VISIBILITY_EXTRA_HOSTS", () => {
  it("cannot widen an autonomous batch allowlist from ambient environment", async () => {
    process.env[EXTRA_HOSTS_ENV] = "extra.example";
    const calls: string[] = [];
    const fetcher = production(answers(["10.0.0.5"], calls), { allowedHosts: ["one.example"], includeExtraHosts: false });
    expectRefused(await fetcher.fetch({ url: "https://extra.example/", kind: "page", method: "GET" }), "HOST_NOT_ALLOWLISTED");
    expect(calls).toEqual([]);
  });
  it("adds hosts from the environment variable, comma separated, read when the factory is created", async () => {
    process.env[EXTRA_HOSTS_ENV] = " Extra.Example , other.example,, ";
    const calls: string[] = [];
    const fetcher = production(answers(["10.0.0.5"], calls));
    process.env[EXTRA_HOSTS_ENV] = "later.example";

    expectRefused(await fetcher.fetch({ url: "https://extra.example/", kind: "page", method: "GET" }), "ADDRESS_BLOCKED");
    expectRefused(await fetcher.fetch({ url: "https://www.other.example/", kind: "page", method: "GET" }), "ADDRESS_BLOCKED");
    expectRefused(await fetcher.fetch({ url: "https://databridges.ie/", kind: "page", method: "GET" }), "ADDRESS_BLOCKED");
    expectRefused(await fetcher.fetch({ url: "https://later.example/", kind: "page", method: "GET" }), "HOST_NOT_ALLOWLISTED");
    expect(calls).toEqual(["extra.example", "www.other.example", "databridges.ie"]);
  });

  it("is not consulted when the variable is empty or unset", async () => {
    process.env[EXTRA_HOSTS_ENV] = "";
    const fetcher = production(answers(["10.0.0.5"]));
    expectRefused(await fetcher.fetch({ url: "https://extra.example/", kind: "page", method: "GET" }), "HOST_NOT_ALLOWLISTED");
  });

  it("fails closed on an entry that is not a plain public hostname", () => {
    for (const bad of [
      "127.0.0.1",
      "localhost",
      "[::1]",
      "a b",
      "user@example.com",
      "svc.internal",
      "x.local",
      "host:22",
      "https://example.com",
      "example.com/path",
      "example.com?x=1",
      "singlelabel",
      "exa%6dple.com",
      "2130706433",
    ]) {
      process.env[EXTRA_HOSTS_ENV] = bad;
      expect(() => createGuardedFetcher({ resolver: answers([]) }), bad).toThrow(TypeError);
    }
  });

  it("is not read by the internal factory", async () => {
    process.env[EXTRA_HOSTS_ENV] = "env-only.example";
    const { createTestFetcher } = await import("../helpers/net-harness");
    const { fetcher } = createTestFetcher({ hosts: { "site.example": ["10.0.0.5"] } });
    cleanups.push(() => fetcher.close());
    const record = await fetcher.fetch({ url: "https://env-only.example/", kind: "page", method: "GET" });
    expect(record.error?.code).toBe("HOST_NOT_ALLOWLISTED");
  });
});

describe("production factory: address validation cannot be bypassed", () => {
  it.each([
    ["127.0.0.1", "http://127.0.0.1/", "URL_REJECTED"],
    ["::1", "http://[::1]/", "URL_REJECTED"],
    ["169.254.169.254", "http://169.254.169.254/latest/meta-data/", "URL_REJECTED"],
    ["::ffff:127.0.0.1", "http://[::ffff:127.0.0.1]/", "URL_REJECTED"],
    ["decimal loopback", "http://2130706433/", "URL_REJECTED"],
    ["localhost", "http://localhost/", "URL_REJECTED"],
    ["0.0.0.0", "http://0.0.0.0/", "URL_REJECTED"],
  ])("rejects the literal %s", async (_label, url, code) => {
    const calls: string[] = [];
    const fetcher = production(answers(["127.0.0.1"], calls));
    expectRefused(await fetcher.fetch({ url, kind: "page", method: "GET" }), code);
    expect(calls).toEqual([]);
  });

  it.each([
    ["loopback v4", ["127.0.0.1"]],
    ["loopback v6", ["::1"]],
    ["metadata", ["169.254.169.254"]],
    ["mapped loopback", ["::ffff:7f00:1"]],
    ["private 10/8", ["10.0.0.5"]],
    ["private 172.16/12", ["172.16.9.9"]],
    ["private 192.168/16", ["192.168.0.10"]],
    ["unique local", ["fd12::1"]],
    ["carrier-grade NAT", ["100.64.0.9"]],
    ["unspecified", ["0.0.0.0"]],
    ["mixed public and private", ["8.8.8.8", "10.0.0.5"]],
    ["mixed private and public", ["10.0.0.5", "8.8.8.8"]],
    ["public v6 with loopback v4", ["2606:4700:4700::1111", "127.0.0.1"]],
  ])("refuses a hostname that resolves to %s", async (_label, list) => {
    const calls: string[] = [];
    const fetcher = production(answers(list, calls));
    expectRefused(await fetcher.fetch({ url: "https://databridges.ie/", kind: "page", method: "GET" }), "ADDRESS_BLOCKED");
    expect(calls).toEqual(["databridges.ie"]);
  });

  it("refuses what the real system resolver returns for localhost (hosts file, no network traffic)", async () => {
    const answers = await defaultResolver("localhost");
    expect(answers.length).toBeGreaterThan(0);
    const error = await resolveAndValidate("localhost", defaultResolver).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GuardError);
    expect((error as GuardError).code).toBe("ADDRESS_BLOCKED");
    expect(tripwire.attempts).toBe(0);
  });

  it("refuses a redirect-free hostname that resolves to a private address for HEAD and every kind", async () => {
    const fetcher = production(answers(["192.168.1.1"]));
    for (const kind of ["page", "robots", "sitemap", "llms", "http-variant", "link-check", "timing"] as const) {
      expectRefused(await fetcher.fetch({ url: "https://www.databridges.ie/x", kind, method: "HEAD" }), "ADDRESS_BLOCKED");
    }
  });

  it("ignores policy smuggled in through the options object", async () => {
    const server: LocalServer = await startHttpServer((_req, res) => sendHtml(res));
    cleanups.push(() => server.close());
    tripwire.stop();
    const fetcher = production(answers(["127.0.0.1"]), {
      isBlocked: () => false,
      allowedPorts: [server.port],
      limits: { maxRequests: 100_000, deadlineMs: 600_000, wireCapBytes: 1e12 },
      ca: "-----BEGIN CERTIFICATE-----",
      allowedHosts: ["databridges.ie"],
      policy: { allowedHosts: ["127.0.0.1"] },
      _createFetcherCore: () => {
        throw new Error("must not be used");
      },
    });
    const blocked = await fetcher.fetch({ url: "http://databridges.ie/", kind: "page", method: "GET" });
    expect(blocked.error?.code).toBe("ADDRESS_BLOCKED");
    const port = await fetcher.fetch({ url: `http://databridges.ie:${server.port}/`, kind: "page", method: "GET" });
    expect(port.error?.code).toBe("URL_REJECTED");
    expect(server.connections()).toBe(0);
    expect(server.seen).toHaveLength(0);
  });
});

describe("production factory: shape", () => {
  it("exposes only the documented members", () => {
    const fetcher = createGuardedFetcher({ resolver: answers([]) });
    cleanups.push(() => fetcher.close());
    expect(Object.keys(fetcher).sort()).toEqual(["close", "fetch", "stats", "wasRetried"]);
  });

  it("keeps the production limits frozen at the plan values", () => {
    expect(Object.isFrozen(PRODUCTION_LIMITS)).toBe(true);
    expect(() => {
      (PRODUCTION_LIMITS as { maxRequests: number }).maxRequests = 1_000;
    }).toThrow();
    expect(PRODUCTION_LIMITS.maxRequests).toBe(60);
  });

  it("exports the internal factory under a leading underscore and nothing else with one", () => {
    const underscored = Object.keys(fetchModule).filter((name) => name.startsWith("_"));
    expect(underscored).toEqual(["_createFetcherCore"]);
  });

  it("stops the job at 20 seconds even when asked for longer", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const fetcher = production(answers(["10.0.0.5"]), { deadlineMs: 600_000 });
    expect(fetcher.stats().jobTimedOut).toBe(false);
    await vi.advanceTimersByTimeAsync(19_999);
    expect(fetcher.stats().jobTimedOut).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect((await fetcher.fetch({ url: "https://databridges.ie/", kind: "page", method: "GET" })).error?.code).toBe("JOB_TIMEOUT");
    expect(fetcher.stats().jobTimedOut).toBe(true);
  });

  it("honours a shorter deadline", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const fetcher = production(answers(["10.0.0.5"]), { deadlineMs: 500 });
    await vi.advanceTimersByTimeAsync(501);
    expect((await fetcher.fetch({ url: "https://databridges.ie/", kind: "page", method: "GET" })).error?.code).toBe("JOB_TIMEOUT");
  });
});
