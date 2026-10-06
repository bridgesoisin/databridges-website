import { describe, expect, it } from "vitest";
import {
  BLOCKED_RANGES,
  GuardError,
  blockedReason,
  isBlockedAddress,
  resolveAndValidate,
  type Resolver,
} from "@/lib/visibility/net-guard";

// Plan 5.4, written out independently of the implementation.
const PLAN_V4 = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.0.2.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "198.51.100.0/24",
  "203.0.113.0/24",
  "224.0.0.0/4",
  "240.0.0.0/4",
];
const PLAN_V6 = ["::/128", "::1/128", "fc00::/7", "fe80::/10", "ff00::/8", "2001:db8::/32", "64:ff9b::/96", "2002::/16", "2001::/32"];

describe("block list contents", () => {
  it("holds exactly the plan 5.4 ranges", () => {
    const actual = BLOCKED_RANGES.map((r) => `${r.network}/${r.prefix}`).sort();
    expect(actual).toEqual([...PLAN_V4, ...PLAN_V6].sort());
  });
});

describe("isBlockedAddress: IPv4", () => {
  it.each([
    ["this-network", ["0.0.0.0", "0.0.0.1", "0.255.255.255"]],
    ["rfc1918 10/8", ["10.0.0.0", "10.1.2.3", "10.255.255.255"]],
    ["carrier-grade NAT", ["100.64.0.0", "100.100.100.200", "100.127.255.255"]],
    ["loopback", ["127.0.0.1", "127.0.0.53", "127.255.255.255"]],
    ["link-local and metadata", ["169.254.0.0", "169.254.169.254", "169.254.170.2", "169.254.255.255"]],
    ["rfc1918 172.16/12", ["172.16.0.0", "172.20.1.1", "172.31.255.255"]],
    ["ietf protocol assignments", ["192.0.0.0", "192.0.0.8", "192.0.0.255"]],
    ["documentation 192.0.2/24", ["192.0.2.0", "192.0.2.1", "192.0.2.255"]],
    ["rfc1918 192.168/16", ["192.168.0.0", "192.168.1.1", "192.168.255.255"]],
    ["benchmarking", ["198.18.0.0", "198.19.0.1", "198.19.255.255"]],
    ["documentation 198.51.100/24", ["198.51.100.0", "198.51.100.77", "198.51.100.255"]],
    ["documentation 203.0.113/24", ["203.0.113.0", "203.0.113.9", "203.0.113.255"]],
    ["multicast", ["224.0.0.0", "224.0.0.251", "239.255.255.255"]],
    ["reserved and broadcast", ["240.0.0.0", "250.1.2.3", "255.255.255.255"]],
  ])("blocks %s", (_label, addresses) => {
    for (const address of addresses) expect(isBlockedAddress(address), address).toBe(true);
  });

  it("allows the public neighbours of every blocked range", () => {
    const allowed = [
      "1.1.1.1",
      "8.8.8.8",
      "93.184.216.34",
      "9.255.255.255",
      "11.0.0.0",
      "100.63.255.255",
      "100.128.0.0",
      "126.255.255.255",
      "128.0.0.0",
      "169.253.255.255",
      "169.255.0.0",
      "172.15.255.255",
      "172.32.0.0",
      "192.0.1.1",
      "192.0.3.1",
      "192.167.255.255",
      "192.169.0.0",
      "198.17.255.255",
      "198.20.0.0",
      "198.51.99.255",
      "198.51.101.0",
      "203.0.112.255",
      "203.0.114.0",
      "223.255.255.255",
    ];
    for (const address of allowed) expect(isBlockedAddress(address), address).toBe(false);
  });

  it("reports a reason that names the range", () => {
    expect(blockedReason("127.0.0.1")).toBe("loopback");
    expect(blockedReason("169.254.169.254")).toBe("link-local-and-metadata");
    expect(blockedReason("10.1.1.1")).toBe("private-rfc1918");
    expect(blockedReason("100.64.1.1")).toBe("carrier-grade-nat");
    expect(blockedReason("8.8.8.8")).toBeNull();
  });
});

describe("isBlockedAddress: IPv6", () => {
  it.each([
    ["unspecified", ["::", "0:0:0:0:0:0:0:0", "0000:0000:0000:0000:0000:0000:0000:0000"]],
    ["loopback", ["::1", "0:0:0:0:0:0:0:1", "0000:0000:0000:0000:0000:0000:0000:0001"]],
    ["unique local", ["fc00::", "fd12:3456:789a::1", "fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff"]],
    ["link-local", ["fe80::1", "fe80::dead:beef", "febf:ffff::1"]],
    ["multicast", ["ff00::", "ff02::1", "ffff:ffff::1"]],
    ["documentation", ["2001:db8::", "2001:db8::1", "2001:db8:ffff:ffff::1"]],
    ["nat64", ["64:ff9b::1", "64:ff9b::7f00:1", "64:ff9b::a9fe:a9fe"]],
    ["6to4", ["2002::", "2002:7f00:1::1", "2002:a9fe:a9fe::1"]],
    ["teredo", ["2001::1", "2001:0:4136:e378:8000:63bf:3fff:fdd2"]],
  ])("blocks %s", (_label, addresses) => {
    for (const address of addresses) expect(isBlockedAddress(address), address).toBe(true);
  });

  it("requires global unicast (2000::/3) for everything outside the listed sub-ranges", () => {
    for (const address of ["::2", "1::1", "100::1", "4000::1", "8000::1", "a000::1", "dead:beef::1", "::127.0.0.1", "::8.8.8.8"]) {
      expect(isBlockedAddress(address), address).toBe(true);
      expect(blockedReason(address), address).not.toBeNull();
    }
    expect(blockedReason("4000::1")).toBe("not-global-unicast");
  });

  it("allows ordinary global unicast addresses, including near-misses of blocked ranges", () => {
    for (const address of [
      "2606:4700:4700::1111",
      "2001:4860:4860::8888",
      "2a00:1450:4009:81f::200e",
      "2001:db9::1",
      "2001:1::1",
      "2001:200::1",
      "2000::1",
      "2003::1",
      "2a02:26f0::1",
    ]) {
      expect(isBlockedAddress(address), address).toBe(false);
    }
  });

  it("unwraps and blocks IPv4-mapped addresses in dotted and hex form", () => {
    for (const address of [
      "::ffff:127.0.0.1",
      "::ffff:7f00:1",
      "::FFFF:7F00:0001",
      "0:0:0:0:0:ffff:7f00:1",
      "0000:0000:0000:0000:0000:ffff:127.0.0.1",
      "::ffff:10.0.0.1",
      "::ffff:a00:1",
      "::ffff:169.254.169.254",
      "::ffff:a9fe:a9fe",
      "::ffff:192.168.1.1",
      "::ffff:c0a8:101",
      "::ffff:172.16.0.1",
      "::ffff:100.64.0.1",
      "::ffff:0.0.0.0",
      "::ffff:224.0.0.1",
    ]) {
      expect(isBlockedAddress(address), address).toBe(true);
    }
    expect(blockedReason("::ffff:127.0.0.1")).toBe("ipv4-mapped-loopback");
    expect(blockedReason("::ffff:7f00:1")).toBe("ipv4-mapped-loopback");
    expect(blockedReason("::ffff:a9fe:a9fe")).toBe("ipv4-mapped-link-local-and-metadata");
  });

  it("blocks a mapped address even when the wrapped IPv4 address is public (conservative reading)", () => {
    expect(isBlockedAddress("::ffff:8.8.8.8")).toBe(true);
    expect(blockedReason("::ffff:808:808")).toBe("ipv4-mapped");
  });

  it("blocks scoped addresses", () => {
    expect(isBlockedAddress("fe80::1%eth0")).toBe(true);
    expect(isBlockedAddress("2606:4700:4700::1111%lo")).toBe(true);
  });
});

describe("isBlockedAddress: anything that is not a plain IP literal is blocked", () => {
  it.each([
    "",
    " ",
    "localhost",
    "example.com",
    "127.1",
    "0x7f.0.0.1",
    "2130706433",
    "017700000001",
    "010.0.0.1",
    "1.2.3",
    "1.2.3.4.5",
    "256.1.1.1",
    "8.8.8.8 ",
    " 8.8.8.8",
    "8.8.8.8\n",
    "８.８.８.８",
    "::g",
    "1::2::3",
    "[::1]",
    "[2606:4700:4700::1111]",
    "12345::1",
    "1:2:3:4:5:6:7:8:9",
  ])("blocks %j", (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it("blocks non-string values", () => {
    for (const value of [null, undefined, 127, {}, []]) {
      expect(isBlockedAddress(value as unknown as string)).toBe(true);
    }
  });
});

function stubResolver(answers: readonly string[] | Error, calls: string[] = []): Resolver {
  return async (host) => {
    calls.push(host);
    if (answers instanceof Error) throw answers;
    return answers.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));
  };
}

async function rejection(promise: Promise<unknown>): Promise<GuardError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(GuardError);
    return error as GuardError;
  }
  throw new Error("expected a rejection");
}

describe("resolveAndValidate", () => {
  it("resolves exactly once and returns the validated address", async () => {
    const calls: string[] = [];
    const result = await resolveAndValidate("example.com", stubResolver(["93.184.216.34"], calls));
    expect(calls).toEqual(["example.com"]);
    expect(result).toEqual({ host: "example.com", address: "93.184.216.34", family: 4, addresses: ["93.184.216.34"] });
  });

  it("prefers an IPv4 address when both families are returned and validates every one", async () => {
    const result = await resolveAndValidate("example.com", stubResolver(["2606:4700:4700::1111", "93.184.216.34"]));
    expect(result.address).toBe("93.184.216.34");
    expect(result.family).toBe(4);
    expect(result.addresses).toEqual(["2606:4700:4700::1111", "93.184.216.34"]);
  });

  it("returns an IPv6 address when only IPv6 is available", async () => {
    const result = await resolveAndValidate("example.com", stubResolver(["2606:4700:4700::1111"]));
    expect(result).toMatchObject({ address: "2606:4700:4700::1111", family: 6 });
  });

  it.each([
    "127.0.0.1",
    "::1",
    "::ffff:127.0.0.1",
    "169.254.169.254",
    "10.0.0.5",
    "172.16.5.5",
    "192.168.0.10",
    "100.64.0.1",
    "198.18.0.1",
    "203.0.113.5",
    "0.0.0.0",
    "224.0.0.1",
    "fd00::1",
    "fe80::1",
  ])("rejects a host that resolves to %s", async (address) => {
    const error = await rejection(resolveAndValidate("evil.example", stubResolver([address])));
    expect(error.code).toBe("ADDRESS_BLOCKED");
    expect(error.host).toBe("evil.example");
    expect(error.address).toBe(address);
  });

  it("rejects the whole host when any address is blocked, wherever it sits in the answer", async () => {
    for (const answers of [
      ["93.184.216.34", "10.0.0.5"],
      ["10.0.0.5", "93.184.216.34"],
      ["93.184.216.34", "2606:4700:4700::1111", "::1"],
      ["8.8.8.8", "169.254.169.254", "1.1.1.1"],
    ]) {
      const error = await rejection(resolveAndValidate("mixed.example", stubResolver(answers)));
      expect(error.code).toBe("ADDRESS_BLOCKED");
    }
  });

  it("fails with DNS_FAILED for an empty answer, a resolver error and a hung resolver", async () => {
    expect((await rejection(resolveAndValidate("a.example", stubResolver([])))).code).toBe("DNS_FAILED");

    const notFound: NodeJS.ErrnoException = new Error("getaddrinfo ENOTFOUND");
    notFound.code = "ENOTFOUND";
    const failed = await rejection(resolveAndValidate("a.example", stubResolver(notFound)));
    expect(failed.code).toBe("DNS_FAILED");
    expect(failed.message).toContain("ENOTFOUND");

    const hung: Resolver = () => new Promise(() => undefined);
    expect((await rejection(resolveAndValidate("a.example", hung, { timeoutMs: 30 }))).code).toBe("DNS_FAILED");
  });

  it("rejects malformed resolver output instead of trusting it", async () => {
    for (const bad of ["not-an-ip", "", "127.1", "0x7f.0.0.1"]) {
      const error = await rejection(resolveAndValidate("a.example", async () => [{ address: bad }]));
      expect(error.code).toBe("ADDRESS_BLOCKED");
    }
    const error = await rejection(resolveAndValidate("a.example", (async () => [null]) as unknown as Resolver));
    expect(error.code).toBe("ADDRESS_BLOCKED");
    const notArray = await rejection(resolveAndValidate("a.example", (async () => "1.2.3.4") as unknown as Resolver));
    expect(notArray.code).toBe("DNS_FAILED");
  });

  it("never calls the resolver more than once, even for a mixed answer", async () => {
    const calls: string[] = [];
    await rejection(resolveAndValidate("mixed.example", stubResolver(["93.184.216.34", "10.0.0.5"], calls)));
    expect(calls).toHaveLength(1);
  });

  it("accepts an injected block predicate (internal factory only) and still validates the format", async () => {
    const result = await resolveAndValidate("local.example", stubResolver(["127.0.0.1"]), { isBlocked: () => false });
    expect(result.address).toBe("127.0.0.1");
    const error = await rejection(resolveAndValidate("local.example", stubResolver(["nonsense"]), { isBlocked: () => false }));
    expect(error.code).toBe("ADDRESS_BLOCKED");
  });
});
