import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isAllowed, parseRobots, robotsFromRecord } from "@/lib/visibility/robots";
import type { FetchRecord } from "@/lib/visibility/types";

type RfcCase = {
  robots: string;
  agent: string;
  url: string;
  allowed: boolean;
  why: string;
};

const here = dirname(fileURLToPath(import.meta.url));
const casesPath = join(here, "fixtures", "fx-robots-rfc-matching", "cases.json");
const cases = JSON.parse(readFileSync(casesPath, "utf8")) as RfcCase[];

const REQUIRED_TOPICS = [
  "prefix",
  "case-sensitive",
  "longest-match",
  "equal-length",
  "wildcard",
  "end-anchor",
  "specific-group",
  "fallback-wildcard",
  "agent-case",
  "directive-case",
  "group-merging",
  "empty-disallow",
  "4xx",
  "percent-encoding",
];

function topicOf(c: RfcCase): string {
  return c.why.split(":")[0];
}

function pathOf(c: RfcCase): string {
  return c.url.slice("https://fixture.example".length);
}

describe("fx-robots-rfc-matching cases.json", () => {
  it("has the documented shape", () => {
    expect(Array.isArray(cases)).toBe(true);
    expect(cases.length).toBeGreaterThanOrEqual(100);
    for (const c of cases) {
      expect(Object.keys(c).sort()).toEqual(["agent", "allowed", "robots", "url", "why"]);
      expect(typeof c.robots).toBe("string");
      expect(typeof c.agent).toBe("string");
      expect(c.agent.length).toBeGreaterThan(0);
      expect(c.url.startsWith("https://fixture.example/")).toBe(true);
      expect(typeof c.allowed).toBe("boolean");
      expect(c.why).toMatch(/^[a-z0-9-]+: \S/);
    }
  });

  it("covers every required RFC 9309 area", () => {
    const topics = new Set(cases.map(topicOf));
    for (const t of REQUIRED_TOPICS) expect(topics.has(t), `missing topic ${t}`).toBe(true);
  });

  it("has both allowed and blocked expectations for the core matching topics", () => {
    for (const t of ["prefix", "longest-match", "wildcard", "end-anchor", "specific-group", "fallback-wildcard"]) {
      const rows = cases.filter((c) => topicOf(c) === t);
      expect(rows.some((c) => c.allowed), `${t} has no allowed case`).toBe(true);
      expect(rows.some((c) => !c.allowed), `${t} has no blocked case`).toBe(true);
    }
  });

  it("contains no duplicate (robots, agent, url) triples", () => {
    const seen = new Set<string>();
    for (const c of cases) {
      const key = JSON.stringify([c.robots, c.agent, c.url]);
      expect(seen.has(key), `duplicate case ${c.agent} ${c.url}`).toBe(false);
      seen.add(key);
    }
  });
});

describe("RFC 9309 matching against src/lib/visibility/robots.ts", () => {
  const parsed = new Map<string, ReturnType<typeof parseRobots>>();
  function rulesFor(text: string) {
    let rules = parsed.get(text);
    if (!rules) {
      rules = parseRobots(text);
      parsed.set(text, rules);
    }
    return rules;
  }

  cases.forEach((c, i) => {
    it(`#${String(i + 1).padStart(3, "0")} ${c.agent} ${pathOf(c)} is ${c.allowed ? "allowed" : "blocked"} (${c.why})`, () => {
      expect(isAllowed(rulesFor(c.robots), c.agent, c.url)).toBe(c.allowed);
    });
  });
});

function robotsRecord(
  status: number | null,
  body: string | null,
  error: FetchRecord["error"] = null
): FetchRecord {
  const size = body === null ? 0 : body.length;
  return {
    url: "https://fixture.example/robots.txt",
    finalUrl: "https://fixture.example/robots.txt",
    kind: "robots",
    method: "GET",
    status,
    redirectChain: [],
    headers: { "content-type": "text/plain; charset=utf-8" },
    contentType: "text/plain; charset=utf-8",
    wireBytes: size,
    decodedBytes: size,
    bodyHash: null,
    body,
    truncated: false,
    error,
    requestAcceptEncoding: null,
    fetchedAt: "2026-10-02T09:15:00.000Z",
    durationMs: 10,
    ttfbMs: 10,
    tls: null,
  };
}

describe("robots.txt response status (plan 4.5 S1.02, RFC 9309 2.3.1)", () => {
  const blockAll = "User-agent: *\nDisallow: /\n";

  it("treats a 404 response as allow-all even when the body looks like rules", () => {
    expect(robotsFromRecord(robotsRecord(404, blockAll)).kind).toBe("allow-all");
  });

  it("treats a 410 response as allow-all", () => {
    expect(robotsFromRecord(robotsRecord(410, null)).kind).toBe("allow-all");
  });

  it("parses a 200 response and applies its rules", () => {
    const access = robotsFromRecord(robotsRecord(200, blockAll));
    expect(access.kind).toBe("rules");
    if (access.kind === "rules") {
      expect(isAllowed(access.rules, "Googlebot", "https://fixture.example/")).toBe(false);
    }
  });

  it("reports a 500 response as an error (S1.02 becomes SCAN_ERROR)", () => {
    expect(robotsFromRecord(robotsRecord(500, null)).kind).toBe("error");
  });

  it("reports a 503 response as an error", () => {
    expect(robotsFromRecord(robotsRecord(503, null)).kind).toBe("error");
  });

  it("reports a timeout as an error", () => {
    const record = robotsRecord(null, null, { code: "TIMEOUT", message: "timed out" });
    expect(robotsFromRecord(record).kind).toBe("error");
  });
});
