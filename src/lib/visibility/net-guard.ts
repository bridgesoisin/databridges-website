import { BlockList, isIP, isIPv4, isIPv6 } from "node:net";

export type GuardErrorCode = "DNS_FAILED" | "ADDRESS_BLOCKED";

export class GuardError extends Error {
  readonly code: GuardErrorCode;
  readonly host: string;
  readonly address: string | null;

  constructor(code: GuardErrorCode, message: string, host: string, address: string | null = null) {
    super(message);
    this.name = "GuardError";
    this.code = code;
    this.host = host;
    this.address = address;
  }
}

export type BlockedRange = {
  readonly network: string;
  readonly prefix: number;
  readonly family: "ipv4" | "ipv6";
  readonly label: string;
};

// Plan 5.4, exactly. IPv6 must additionally be global unicast (2000::/3); see blockedReason.
export const BLOCKED_RANGES: readonly BlockedRange[] = [
  { network: "0.0.0.0", prefix: 8, family: "ipv4", label: "this-network" },
  { network: "10.0.0.0", prefix: 8, family: "ipv4", label: "private-rfc1918" },
  { network: "100.64.0.0", prefix: 10, family: "ipv4", label: "carrier-grade-nat" },
  { network: "127.0.0.0", prefix: 8, family: "ipv4", label: "loopback" },
  { network: "169.254.0.0", prefix: 16, family: "ipv4", label: "link-local-and-metadata" },
  { network: "172.16.0.0", prefix: 12, family: "ipv4", label: "private-rfc1918" },
  { network: "192.0.0.0", prefix: 24, family: "ipv4", label: "ietf-protocol-assignments" },
  { network: "192.0.2.0", prefix: 24, family: "ipv4", label: "documentation" },
  { network: "192.168.0.0", prefix: 16, family: "ipv4", label: "private-rfc1918" },
  { network: "198.18.0.0", prefix: 15, family: "ipv4", label: "benchmarking" },
  { network: "198.51.100.0", prefix: 24, family: "ipv4", label: "documentation" },
  { network: "203.0.113.0", prefix: 24, family: "ipv4", label: "documentation" },
  { network: "224.0.0.0", prefix: 4, family: "ipv4", label: "multicast" },
  { network: "240.0.0.0", prefix: 4, family: "ipv4", label: "reserved" },
  { network: "::", prefix: 128, family: "ipv6", label: "unspecified" },
  { network: "::1", prefix: 128, family: "ipv6", label: "loopback" },
  { network: "fc00::", prefix: 7, family: "ipv6", label: "unique-local" },
  { network: "fe80::", prefix: 10, family: "ipv6", label: "link-local" },
  { network: "ff00::", prefix: 8, family: "ipv6", label: "multicast" },
  { network: "2001:db8::", prefix: 32, family: "ipv6", label: "documentation" },
  { network: "64:ff9b::", prefix: 96, family: "ipv6", label: "nat64" },
  { network: "2002::", prefix: 16, family: "ipv6", label: "6to4" },
  { network: "2001::", prefix: 32, family: "ipv6", label: "teredo" },
];

function buildList(ranges: readonly BlockedRange[]): BlockList {
  const list = new BlockList();
  for (const range of ranges) list.addSubnet(range.network, range.prefix, range.family);
  return list;
}

const BLOCK_LIST = buildList(BLOCKED_RANGES);
const LABELLED_LISTS = BLOCKED_RANGES.map((range) => ({ range, list: buildList([range]) }));

function labelFor(address: string, family: "ipv4" | "ipv6"): string {
  for (const { range, list } of LABELLED_LISTS) {
    if (range.family === family && list.check(address, family)) return range.label;
  }
  return "blocked-range";
}

function parseIPv6(text: string): number[] | null {
  if (!isIPv6(text) || text.includes("%")) return null;
  const halves = text.split("::");
  if (halves.length > 2) return null;

  const expand = (part: string): number[] | null => {
    if (part === "") return [];
    const groups: number[] = [];
    const pieces = part.split(":");
    for (let i = 0; i < pieces.length; i += 1) {
      const piece = pieces[i];
      if (piece.includes(".")) {
        if (i !== pieces.length - 1 || !isIPv4(piece)) return null;
        const octets = piece.split(".").map(Number);
        groups.push((octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]);
      } else {
        if (!/^[0-9a-f]{1,4}$/i.test(piece)) return null;
        groups.push(parseInt(piece, 16));
      }
    }
    return groups;
  };

  const head = expand(halves[0]);
  if (head === null) return null;
  if (halves.length === 1) return head.length === 8 ? head : null;
  const tail = expand(halves[1]);
  if (tail === null) return null;
  const missing = 8 - head.length - tail.length;
  if (missing < 1) return null;
  return [...head, ...new Array<number>(missing).fill(0), ...tail];
}

function dotted(high: number, low: number): string {
  return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
}

// Returns why an address must not be connected to, or null when it is a permitted global address.
// Anything that is not a well-formed IP literal is treated as blocked.
export function blockedReason(address: string): string | null {
  if (typeof address !== "string") return "invalid-address";
  if (isIPv4(address)) {
    return BLOCK_LIST.check(address, "ipv4") ? labelFor(address, "ipv4") : null;
  }
  const groups = parseIPv6(address);
  if (groups === null) return "invalid-address";

  const mapped = groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff;
  if (mapped) {
    // Plan 5.4 says to unwrap before checking but also that IPv6 must be global unicast; ::ffff:0:0/96 is
    // not, and no resolver returns it for a real host, so the conservative reading blocks it whatever it wraps.
    const inner = dotted(groups[6], groups[7]);
    return BLOCK_LIST.check(inner, "ipv4") ? `ipv4-mapped-${labelFor(inner, "ipv4")}` : "ipv4-mapped";
  }

  const canonical = groups.map((g) => g.toString(16)).join(":");
  if (BLOCK_LIST.check(canonical, "ipv6")) return labelFor(canonical, "ipv6");
  if ((groups[0] & 0xe000) !== 0x2000) return "not-global-unicast";
  return null;
}

export function isBlockedAddress(address: string): boolean {
  return blockedReason(address) !== null;
}

export type ResolvedAddress = { address: string; family?: number };
export type Resolver = (host: string) => Promise<readonly ResolvedAddress[]>;

export interface ValidatedAddress {
  host: string;
  address: string;
  family: 4 | 6;
  // Every address the resolver returned; all were validated.
  addresses: readonly string[];
}

export interface ResolveOptions {
  isBlocked?: (address: string) => boolean;
  timeoutMs?: number;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number | undefined, onTimeout: () => Error): Promise<T> {
  if (timeoutMs === undefined) return promise;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(onTimeout()), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

// Resolves once. Rejects the whole host when any returned address is blocked, so a mixed answer cannot
// be used to slip a private address in beside a public one. The returned address is the only one the
// caller may connect to.
export async function resolveAndValidate(
  host: string,
  resolver: Resolver,
  options: ResolveOptions = {},
): Promise<ValidatedAddress> {
  const isBlocked = options.isBlocked ?? isBlockedAddress;

  let answers: readonly ResolvedAddress[];
  try {
    answers = await withTimeout(
      Promise.resolve().then(() => resolver(host)),
      options.timeoutMs,
      () => new GuardError("DNS_FAILED", `DNS resolution timed out for ${host}`, host),
    );
  } catch (error) {
    if (error instanceof GuardError) throw error;
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    throw new GuardError("DNS_FAILED", `DNS resolution failed for ${host}${code ? ` (${code})` : ""}`, host);
  }

  if (!Array.isArray(answers) || answers.length === 0) {
    throw new GuardError("DNS_FAILED", `DNS returned no addresses for ${host}`, host);
  }

  const addresses: string[] = [];
  for (const answer of answers) {
    const address = answer?.address;
    if (typeof address !== "string" || isIP(address) === 0) {
      throw new GuardError("ADDRESS_BLOCKED", `Resolver returned a malformed address for ${host}`, host);
    }
    if (isBlocked(address)) {
      const reason = options.isBlocked ? "blocked" : (blockedReason(address) ?? "blocked");
      throw new GuardError("ADDRESS_BLOCKED", `${host} resolves to a blocked address (${reason})`, host, address);
    }
    addresses.push(address);
  }

  const chosen = addresses.find((a) => isIPv4(a)) ?? addresses[0];
  return { host, address: chosen, family: isIPv4(chosen) ? 4 : 6, addresses };
}
