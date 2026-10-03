import { describe, expect, it } from "vitest";
import {
  ROBOTS_PARSE_CAP_BYTES,
  declaredSitemaps,
  explainRobots,
  isAllowed,
  parseRobots,
  robotsFromRecord,
} from "@/lib/visibility/robots";
import { AI_AGENTS, OWN_AGENT_TOKEN, OWN_USER_AGENT } from "@/lib/visibility/lists";
import type { FetchRecord } from "@/lib/visibility/types";

const ORIGIN = "https://example.ie";

function allowed(robots: string, agent: string, path: string): boolean {
  return isAllowed(parseRobots(robots), agent, `${ORIGIN}${path}`);
}

function blocked(pattern: string, path: string): boolean {
  return !allowed(`User-agent: *\nDisallow: ${pattern}`, "anybot", path);
}

function record(overrides: Partial<FetchRecord>): FetchRecord {
  return {
    url: `${ORIGIN}/robots.txt`,
    finalUrl: `${ORIGIN}/robots.txt`,
    kind: "robots",
    method: "GET",
    status: 200,
    redirectChain: [],
    headers: {},
    contentType: "text/plain",
    wireBytes: 0,
    decodedBytes: 0,
    bodyHash: null,
    body: "",
    truncated: false,
    error: null,
    requestAcceptEncoding: null,
    fetchedAt: "2026-10-02T10:00:00.000Z",
    durationMs: 5,
    ttfbMs: 3,
    tls: null,
    ...overrides,
  };
}

const RFC_EXAMPLE = `User-Agent: *
Disallow: *.gif$
Disallow: /example/
Allow: /publications/

User-Agent: foobot
Disallow:/
Allow:/example/page.html
Allow:/example/allowed.gif

User-Agent: barbot
User-Agent: bazbot
Disallow: /example/page.html

User-Agent: quxbot

Disallow:
`;

describe("RFC 9309 section 5.1 example file", () => {
  it("applies the wildcard group to an unnamed crawler", () => {
    expect(allowed(RFC_EXAMPLE, "otherbot", "/example/page.html")).toBe(false);
    expect(allowed(RFC_EXAMPLE, "otherbot", "/example/")).toBe(false);
    expect(allowed(RFC_EXAMPLE, "otherbot", "/publications/index.html")).toBe(true);
    expect(allowed(RFC_EXAMPLE, "otherbot", "/pic.gif")).toBe(false);
    expect(allowed(RFC_EXAMPLE, "otherbot", "/pic.gif?size=2")).toBe(true);
    expect(allowed(RFC_EXAMPLE, "otherbot", "/")).toBe(true);
    expect(allowed(RFC_EXAMPLE, "otherbot", "/other/page.html")).toBe(true);
  });

  it("applies a named group instead of the wildcard group, with longest match", () => {
    expect(allowed(RFC_EXAMPLE, "foobot", "/index.html")).toBe(false);
    expect(allowed(RFC_EXAMPLE, "foobot", "/example/other.html")).toBe(false);
    expect(allowed(RFC_EXAMPLE, "foobot", "/example/page.html")).toBe(true);
    expect(allowed(RFC_EXAMPLE, "foobot", "/example/allowed.gif")).toBe(true);
  });

  it("shares one group between consecutive user-agent lines", () => {
    for (const bot of ["barbot", "bazbot"]) {
      expect(allowed(RFC_EXAMPLE, bot, "/example/page.html")).toBe(false);
      expect(allowed(RFC_EXAMPLE, bot, "/example/other.html")).toBe(true);
      expect(allowed(RFC_EXAMPLE, bot, "/pic.gif")).toBe(true);
    }
  });

  it("treats a named group with an empty Disallow as allow-all, not as the wildcard fallback", () => {
    expect(allowed(RFC_EXAMPLE, "quxbot", "/example/page.html")).toBe(true);
    expect(allowed(RFC_EXAMPLE, "quxbot", "/pic.gif")).toBe(true);
  });

  it("matches the product token case-insensitively", () => {
    expect(allowed(RFC_EXAMPLE, "FooBot", "/index.html")).toBe(false);
    expect(allowed(RFC_EXAMPLE, "FOOBOT", "/example/page.html")).toBe(true);
    expect(allowed("USER-AGENT: FooBot\nDISALLOW: /x", "foobot", "/x")).toBe(false);
  });
});

describe("RFC 9309 section 5.2 path matching", () => {
  it("/fish matches by prefix and is case-sensitive", () => {
    for (const path of [
      "/fish",
      "/fish.html",
      "/fish/salmon.html",
      "/fishheads",
      "/fishheads/yummy.html",
      "/fish.php?id=anything",
    ]) {
      expect(blocked("/fish", path), path).toBe(true);
    }
    for (const path of ["/Fish.asp", "/catfish", "/?id=fish", "/desert/fish"]) {
      expect(blocked("/fish", path), path).toBe(false);
    }
  });

  it("/fish* behaves like /fish", () => {
    expect(blocked("/fish*", "/fish")).toBe(true);
    expect(blocked("/fish*", "/fishheads/yummy.html")).toBe(true);
    expect(blocked("/fish*", "/Fish.asp")).toBe(false);
  });

  it("/fish/ requires the trailing slash", () => {
    for (const path of ["/fish/", "/fish/?id=anything", "/fish/salmon.htm"]) {
      expect(blocked("/fish/", path), path).toBe(true);
    }
    for (const path of ["/fish", "/fish.html", "/Fish/Salmon.asp"]) {
      expect(blocked("/fish/", path), path).toBe(false);
    }
  });

  it("/*.php matches anywhere after the wildcard", () => {
    for (const path of [
      "/filename.php",
      "/folder/filename.php",
      "/folder/filename.php?parameters",
      "/folder/any.php.file.html",
      "/filename.php/",
    ]) {
      expect(blocked("/*.php", path), path).toBe(true);
    }
    for (const path of ["/", "/windows.PHP"]) {
      expect(blocked("/*.php", path), path).toBe(false);
    }
  });

  it("/*.php$ anchors at the end of the path and query", () => {
    for (const path of ["/filename.php", "/folder/filename.php"]) {
      expect(blocked("/*.php$", path), path).toBe(true);
    }
    for (const path of [
      "/filename.php?parameters",
      "/filename.php/",
      "/filename.php5",
      "/windows.PHP",
    ]) {
      expect(blocked("/*.php$", path), path).toBe(false);
    }
  });

  it("/fish*.php combines prefix and wildcard", () => {
    expect(blocked("/fish*.php", "/fish.php")).toBe(true);
    expect(blocked("/fish*.php", "/fishheads/catfish.php?parameters")).toBe(true);
    expect(blocked("/fish*.php", "/Fish.PHP")).toBe(false);
  });
});

describe("precedence", () => {
  it("the longest matching rule wins regardless of order", () => {
    expect(allowed("User-agent: *\nAllow: /p\nDisallow: /", "x", "/page")).toBe(true);
    expect(allowed("User-agent: *\nDisallow: /\nAllow: /p", "x", "/page")).toBe(true);
    expect(allowed("User-agent: *\nDisallow: /page\nAllow: /", "x", "/page")).toBe(false);
  });

  it("allow wins when allow and disallow match with equal length", () => {
    expect(allowed("User-agent: *\nDisallow: /folder\nAllow: /folder", "x", "/folder/page")).toBe(true);
    expect(allowed("User-agent: *\nAllow: /folder\nDisallow: /folder", "x", "/folder/page")).toBe(true);
  });

  it("counts wildcard characters in the pattern length", () => {
    expect(allowed("User-agent: *\nAllow: /page\nDisallow: /*.htm", "x", "/page.htm")).toBe(false);
    expect(allowed("User-agent: *\nDisallow: /*.htm\nAllow: /page", "x", "/page.htm")).toBe(false);
  });

  it("counts the end anchor in the pattern length", () => {
    const text = "User-agent: *\nAllow: /$\nDisallow: /";
    expect(allowed(text, "x", "/")).toBe(true);
    expect(allowed(text, "x", "/page.htm")).toBe(false);
  });

  it("allows everything when no rule matches", () => {
    expect(allowed("User-agent: *\nDisallow: /private", "x", "/public")).toBe(true);
  });

  it("reports the rule that decided the outcome", () => {
    const rules = parseRobots("User-agent: *\nDisallow: /a\nAllow: /a/b");
    expect(explainRobots(rules, "x", `${ORIGIN}/a/b/c`)).toEqual({
      allowed: true,
      group: "wildcard",
      rule: { allow: true, pattern: "/a/b" },
    });
    expect(explainRobots(rules, "x", `${ORIGIN}/a/z`).rule).toEqual({
      allow: false,
      pattern: "/a",
    });
    expect(explainRobots(rules, "x", `${ORIGIN}/other`).rule).toBeNull();
  });
});

describe("wildcards and anchors", () => {
  it("handles several wildcards without backtracking blow-ups", () => {
    const pattern = `/${"*a".repeat(40)}b$`;
    const path = `/${"a".repeat(2000)}`;
    const started = Date.now();
    expect(blocked(pattern, path)).toBe(false);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("treats a dollar sign as an anchor only at the end of the pattern", () => {
    expect(blocked("/a$b", "/a$b")).toBe(true);
    expect(blocked("/a$b", "/ab")).toBe(false);
    expect(blocked("/a$", "/a")).toBe(true);
    expect(blocked("/a$", "/ab")).toBe(false);
  });

  it("matches a query-only pattern", () => {
    expect(blocked("/*?", "/a?x=1")).toBe(true);
    expect(blocked("/*?", "/a")).toBe(false);
    expect(blocked("/search?q=", "/search?q=term")).toBe(true);
  });

  it("matches wildcards spanning slashes and zero characters", () => {
    expect(blocked("/a*b", "/ab")).toBe(true);
    expect(blocked("/a*b", "/a/x/y/b")).toBe(true);
    expect(blocked("/**/z", "/q/z")).toBe(true);
    expect(blocked("*.gif$", "/img/x.gif")).toBe(true);
  });

  it("ignores rules whose pattern does not start with a slash or wildcard", () => {
    expect(blocked("private", "/private")).toBe(false);
    expect(blocked("https://example.ie/private", "/private")).toBe(false);
  });
});

describe("case sensitivity and percent-encoding", () => {
  it("compares paths case-sensitively", () => {
    expect(blocked("/Private", "/private")).toBe(false);
    expect(blocked("/Private", "/Private/x")).toBe(true);
  });

  it("normalises percent-encoding hex case", () => {
    expect(blocked("/a%2fb", "/a%2Fb")).toBe(true);
    expect(blocked("/a%2Fb", "/a%2fb")).toBe(true);
  });

  it("keeps reserved escapes distinct from the literal character", () => {
    expect(blocked("/a%2Fb", "/a/b")).toBe(false);
    expect(blocked("/a/b", "/a%2Fb")).toBe(false);
  });

  it("decodes percent-encoded unreserved characters on both sides", () => {
    expect(blocked("/%7Euser", "/~user")).toBe(true);
    expect(blocked("/~user", "/%7Euser")).toBe(true);
    expect(blocked("/%61bc", "/abc")).toBe(true);
  });

  it("does not turn an encoded asterisk or dollar sign into an operator", () => {
    expect(blocked("/a%2Ab", "/aXb")).toBe(false);
    expect(blocked("/a%2Ab", "/a%2Ab")).toBe(true);
    expect(blocked("/a%24", "/a")).toBe(false);
  });

  it("percent-encodes non-ASCII patterns and URLs to the same form", () => {
    expect(blocked("/ツ", "/%E3%83%84")).toBe(true);
    expect(blocked("/%E3%83%84", "/ツ")).toBe(true);
    expect(blocked("/%e3%83%84", "/ツ/x")).toBe(true);
    expect(isAllowed(parseRobots("User-agent: *\nDisallow: /café"), "x", `${ORIGIN}/café/menu`)).toBe(false);
  });

  it("encodes spaces inside a pattern", () => {
    expect(blocked("/a b", "/a%20b")).toBe(true);
  });

  it("tolerates a lone percent sign", () => {
    expect(blocked("/100%", "/100%")).toBe(true);
    expect(blocked("/100%", "/100")).toBe(false);
  });

  it("encodes an apostrophe the same way in rules and URLs", () => {
    expect(blocked("/a?q='b", "/a?q='b")).toBe(true);
    expect(blocked("/a?q=%27b", "/a?q='b")).toBe(true);
    expect(blocked("/a?q='b", "/a?q=%27b")).toBe(true);
    expect(blocked("/it's", "/it's")).toBe(true);
    expect(blocked("/it's", "/it%27s")).toBe(true);
    expect(blocked("/it%27s", "/it's")).toBe(true);
    expect(blocked("/it's", "/its")).toBe(false);
  });

  it("matches the same rule form for every printable ASCII character in a path and a query", () => {
    const mismatches: string[] = [];
    for (let code = 0x21; code < 0x7f; code++) {
      const ch = String.fromCharCode(code);
      if (ch === "#" || ch === "%" || ch === "*" || ch === "$" || ch === "?" || ch === "/" || ch === "\\") continue;
      for (const target of [`/a${ch}b`, `/a?q=${ch}b`]) {
        let url: URL;
        try {
          url = new URL(`${ORIGIN}${target}`);
        } catch {
          continue;
        }
        const stillBlocked = !isAllowed(parseRobots(`User-agent: *\nDisallow: ${target}`), "x", url.href);
        if (!stillBlocked) mismatches.push(JSON.stringify(target));
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("keeps a bare trailing question mark visible to query rules", () => {
    expect(blocked("/*?", "/a?")).toBe(true);
    expect(blocked("/a?", "/a?")).toBe(true);
    expect(blocked("/a?", "/a")).toBe(false);
    expect(blocked("/a$", "/a?")).toBe(false);
    expect(blocked("/a?$", "/a?")).toBe(true);
    expect(blocked("/*?", "/a#frag?")).toBe(false);
  });

  it("ignores the fragment and any credentials in the URL", () => {
    expect(isAllowed(parseRobots("User-agent: *\nDisallow: /a$"), "x", `${ORIGIN}/a#top`)).toBe(false);
    expect(isAllowed(parseRobots("User-agent: *\nDisallow: /a"), "x", "https://user:pw@example.ie/a")).toBe(false);
    expect(isAllowed(parseRobots("User-agent: *\nDisallow: /user"), "x", "https://user:pw@example.ie/")).toBe(true);
  });

  it("resolves dot segments in the URL before matching", () => {
    expect(blocked("/private", "/public/../private")).toBe(true);
    expect(blocked("/private", "/./private/x")).toBe(true);
  });
});

describe("group selection", () => {
  it("falls back to the wildcard group for unnamed agents", () => {
    const text = "User-agent: *\nDisallow: /wild\n\nUser-agent: gptbot\nDisallow: /gpt";
    expect(allowed(text, "otherbot", "/wild")).toBe(false);
    expect(allowed(text, "otherbot", "/gpt")).toBe(true);
    expect(allowed(text, "GPTBot", "/wild")).toBe(true);
    expect(allowed(text, "GPTBot", "/gpt")).toBe(false);
  });

  it("allows everything when there is no matching group and no wildcard group", () => {
    expect(allowed("User-agent: gptbot\nDisallow: /", "otherbot", "/x")).toBe(true);
    expect(allowed("", "otherbot", "/x")).toBe(true);
  });

  it("merges every group that names the same agent", () => {
    const text = [
      "User-agent: foobot",
      "Disallow: /a",
      "",
      "User-agent: *",
      "Disallow: /z",
      "",
      "User-agent: FooBot",
      "Disallow: /b",
    ].join("\n");
    expect(allowed(text, "foobot", "/a")).toBe(false);
    expect(allowed(text, "foobot", "/b")).toBe(false);
    expect(allowed(text, "foobot", "/z")).toBe(true);
    expect(allowed(text, "other", "/z")).toBe(false);
    expect(allowed(text, "other", "/a")).toBe(true);
  });

  it("merges multiple wildcard groups when no group names the agent", () => {
    const text = "User-agent: *\nDisallow: /a\n\nUser-agent: bot\nDisallow: /x\n\nUser-agent: *\nDisallow: /b";
    expect(allowed(text, "other", "/a")).toBe(false);
    expect(allowed(text, "other", "/b")).toBe(false);
    expect(allowed(text, "bot", "/a")).toBe(true);
    expect(allowed(text, "bot", "/x")).toBe(false);
  });

  it("token * evaluates the wildcard group only", () => {
    const text = "User-agent: *\nDisallow: /\n\nUser-agent: Googlebot\nAllow: /";
    expect(allowed(text, "*", "/page")).toBe(false);
    expect(allowed(text, "Googlebot", "/page")).toBe(true);
    expect(explainRobots(parseRobots(text), "*", `${ORIGIN}/page`).group).toBe("wildcard");
    expect(explainRobots(parseRobots(text), "Googlebot", `${ORIGIN}/page`).group).toBe("specific");
  });

  it("reduces a full user-agent string to its product token", () => {
    const text = "User-agent: DataBridgesBot\nDisallow: /private\n\nUser-agent: *\nDisallow: /";
    const ua = "DataBridgesBot/1.0 (+https://databridges.ie/index/bot)";
    expect(allowed(text, ua, "/open")).toBe(true);
    expect(allowed(text, ua, "/private")).toBe(false);
  });

  it("accepts a version suffix on the user-agent line", () => {
    expect(allowed("User-agent: Googlebot/2.1\nDisallow: /", "Googlebot", "/x")).toBe(false);
  });

  it("matches the product token exactly, not by prefix", () => {
    const text = "User-agent: Googlebot-News\nDisallow: /\n\nUser-agent: Google\nDisallow: /g\n\nUser-agent: *\nDisallow: /star";
    expect(allowed(text, "Googlebot", "/page")).toBe(true);
    expect(allowed(text, "Googlebot", "/g")).toBe(true);
    expect(allowed(text, "Googlebot", "/star")).toBe(false);
    expect(allowed(text, "Googlebot-News", "/page")).toBe(false);
    expect(allowed(text, "Googlebot-NewsX", "/page")).toBe(true);
  });

  it("applies a group to every scored and informational agent token, in any case", () => {
    for (const agent of AI_AGENTS) {
      const upper = `User-agent: ${agent.token.toUpperCase()}\nDisallow: /\n\nUser-agent: *\nAllow: /`;
      const lower = `User-agent: ${agent.token.toLowerCase()}\nDisallow: /\n\nUser-agent: *\nAllow: /`;
      for (const text of [upper, lower]) {
        expect(allowed(text, agent.token, "/page"), agent.token).toBe(false);
        expect(allowed(text, `${agent.token}/1.0 (+https://example.com/bot)`, "/page"), agent.token).toBe(false);
        for (const other of AI_AGENTS) {
          if (other.token === agent.token) continue;
          expect(allowed(text, other.token, "/page"), `${agent.token} vs ${other.token}`).toBe(true);
        }
      }
    }
  });

  it("evaluates the scanner's own agent by its token and by its full user-agent string", () => {
    const block = "User-agent: DataBridgesBot\nDisallow: /\n\nUser-agent: *\nAllow: /";
    expect(allowed(block, OWN_AGENT_TOKEN, "/")).toBe(false);
    expect(allowed(block, OWN_USER_AGENT, "/")).toBe(false);
    expect(allowed("User-agent: *\nDisallow: /", OWN_USER_AGENT, "/")).toBe(false);
    expect(allowed("User-agent: *\nDisallow: /", "Googlebot", "/")).toBe(false);
    expect(allowed("User-agent: Googlebot\nAllow: /\n\nUser-agent: *\nDisallow: /", OWN_USER_AGENT, "/")).toBe(false);
  });

  it("ignores rules that appear before any user-agent line", () => {
    const text = "Disallow: /orphan\nUser-agent: *\nDisallow: /real";
    expect(allowed(text, "x", "/orphan")).toBe(true);
    expect(allowed(text, "x", "/real")).toBe(false);
  });

  it("ignores rules under a user-agent line with no value", () => {
    expect(allowed("User-agent:\nDisallow: /", "x", "/a")).toBe(true);
  });

  it("starts a new group when a user-agent line follows a rule", () => {
    const text = "User-agent: a\nDisallow: /x\nUser-agent: b\nDisallow: /y";
    expect(allowed(text, "a", "/x")).toBe(false);
    expect(allowed(text, "a", "/y")).toBe(true);
    expect(allowed(text, "b", "/y")).toBe(false);
    expect(allowed(text, "b", "/x")).toBe(true);
  });

  it("keeps user-agent lines in one group across blank lines and comments", () => {
    const text = "User-agent: a\n\n# also applies to b\n\nUser-agent: b\nDisallow: /shared";
    expect(allowed(text, "a", "/shared")).toBe(false);
    expect(allowed(text, "b", "/shared")).toBe(false);
    expect(allowed(text, "c", "/shared")).toBe(true);
  });

  it("keeps blank lines and comments inside a group", () => {
    const text = "User-agent: *\n\n# note\nDisallow: /a\n\n\nDisallow: /b";
    expect(allowed(text, "x", "/a")).toBe(false);
    expect(allowed(text, "x", "/b")).toBe(false);
  });

  it("ignores Crawl-delay and unknown lines without ending a user-agent run", () => {
    const text = "User-agent: a\nCrawl-delay: 10\nFoo: bar\nUser-agent: b\nDisallow: /";
    expect(allowed(text, "a", "/x")).toBe(false);
    expect(allowed(text, "b", "/x")).toBe(false);
  });

  it("does not turn Crawl-delay into a rule", () => {
    expect(allowed("User-agent: *\nCrawl-delay: 5", "x", "/anything")).toBe(true);
  });
});

describe("parsing", () => {
  it("handles a BOM", () => {
    expect(allowed("﻿User-agent: *\nDisallow: /a", "x", "/a")).toBe(false);
  });

  it("handles CRLF, CR and LF line endings", () => {
    for (const eol of ["\r\n", "\r", "\n"]) {
      const text = ["User-agent: *", "Disallow: /a", "Allow: /a/b"].join(eol);
      expect(allowed(text, "x", "/a/c"), JSON.stringify(eol)).toBe(false);
      expect(allowed(text, "x", "/a/b"), JSON.stringify(eol)).toBe(true);
    }
  });

  it("strips comments, including trailing ones", () => {
    const text = "# header\nUser-agent: * # everyone\nDisallow: /a # private\n#Disallow: /b";
    expect(allowed(text, "x", "/a")).toBe(false);
    expect(allowed(text, "x", "/b")).toBe(true);
  });

  it("is lenient about key case and whitespace", () => {
    expect(allowed("  user-AGENT :  *  \n  DISALLOW  :  /a  ", "x", "/a")).toBe(false);
  });

  it("ignores lines without a colon", () => {
    expect(allowed("User-agent: *\nDisallow /a\nDisallow: /b", "x", "/a")).toBe(true);
    expect(allowed("User-agent: *\nDisallow /a\nDisallow: /b", "x", "/b")).toBe(false);
  });

  it("treats an empty Disallow as allow-all", () => {
    expect(allowed("User-agent: *\nDisallow:", "x", "/a")).toBe(true);
  });

  it("never throws on junk input", () => {
    for (const junk of ["", "\u0000\u0001", ":::", "User-agent", "<html><body>404</body></html>", "\uD800"]) {
      expect(() => parseRobots(junk)).not.toThrow();
    }
    expect(allowed("<html><body>Not found: nothing here</body></html>", "x", "/a")).toBe(true);
  });

  it("returns allowed for a URL it cannot evaluate", () => {
    const rules = parseRobots("User-agent: *\nDisallow: /");
    expect(isAllowed(rules, "x", "not a url")).toBe(true);
    expect(isAllowed(rules, "x", "mailto:a@b.ie")).toBe(true);
  });
});

describe("512 KiB parse cap", () => {
  const head = "User-agent: *\nDisallow: /early\n";

  it("exports the cap", () => {
    expect(ROBOTS_PARSE_CAP_BYTES).toBe(512 * 1024);
  });

  it("parses rules before the cap and ignores rules after it", () => {
    const filler = `# ${"x".repeat(1022)}\n`;
    const count = Math.ceil(ROBOTS_PARSE_CAP_BYTES / filler.length) + 2;
    const text = `${head}${filler.repeat(count)}Disallow: /late\n`;
    const rules = parseRobots(text);
    expect(rules.truncated).toBe(true);
    expect(isAllowed(rules, "x", `${ORIGIN}/early`)).toBe(false);
    expect(isAllowed(rules, "x", `${ORIGIN}/late`)).toBe(true);
  });

  it("does not report truncation for a file within the cap", () => {
    expect(parseRobots(head).truncated).toBe(false);
  });

  it("drops a directive that the cap cuts in half", () => {
    const prefix = head;
    const target = "Disallow: /stuff-after-cut\n";
    const fillerBytes = ROBOTS_PARSE_CAP_BYTES - prefix.length - 16;
    const filler = `#${"x".repeat(fillerBytes - 2)}\n`;
    const text = `${prefix}${filler}${target}`;
    expect(Buffer.byteLength(prefix + filler)).toBe(ROBOTS_PARSE_CAP_BYTES - 16);
    const rules = parseRobots(text);
    expect(rules.truncated).toBe(true);
    expect(isAllowed(rules, "x", `${ORIGIN}/stuff-after-cut`)).toBe(true);
    expect(isAllowed(rules, "x", `${ORIGIN}/early`)).toBe(false);
    expect(isAllowed(rules, "x", `${ORIGIN}/`)).toBe(true);
  });

  it("keeps a directive that ends exactly at the cap", () => {
    const rule = "Disallow: /exact\n";
    const fillerBytes = ROBOTS_PARSE_CAP_BYTES - head.length - rule.length;
    const filler = `#${"x".repeat(fillerBytes - 2)}\n`;
    const text = `${head}${filler}${rule}Disallow: /after\n`;
    expect(Buffer.byteLength(head + filler + rule)).toBe(ROBOTS_PARSE_CAP_BYTES);
    const rules = parseRobots(text);
    expect(rules.truncated).toBe(true);
    expect(isAllowed(rules, "x", `${ORIGIN}/exact`)).toBe(false);
    expect(isAllowed(rules, "x", `${ORIGIN}/after`)).toBe(true);
  });

  it("measures the cap in bytes, not characters", () => {
    const text = `${head}# ${"é".repeat(300_000)}\nDisallow: /late\n`;
    expect(text.length).toBeLessThan(ROBOTS_PARSE_CAP_BYTES);
    const rules = parseRobots(text);
    expect(rules.truncated).toBe(true);
    expect(isAllowed(rules, "x", `${ORIGIN}/late`)).toBe(true);
    expect(isAllowed(rules, "x", `${ORIGIN}/early`)).toBe(false);
  });

  it("parses a hostile 512 KiB file of many rules in bounded time", () => {
    const lines = ["User-agent: *"];
    for (let i = 0; i < 20_000; i++) lines.push(`Disallow: /*a*b*c*${i}`);
    const rules = parseRobots(lines.join("\n"));
    const started = Date.now();
    isAllowed(rules, "x", `${ORIGIN}/${"abc".repeat(600)}`);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe("cross-check against an independent reference", () => {
  function mulberry32(seed: number): () => number {
    let a = seed;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Written from RFC 9309 section 2.2.2 alone: "*" is any run of characters, a final "$" anchors the end.
  function referenceMatch(pattern: string, target: string): boolean {
    const anchored = pattern.endsWith("$");
    const body = anchored ? pattern.slice(0, -1) : pattern;
    const source = body
      .split("*")
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*");
    return new RegExp(`^${source}${anchored ? "$" : ""}`, "s").test(target);
  }

  function makeWord(random: () => number, alphabet: string, max: number): string {
    let out = "";
    for (let n = Math.floor(random() * (max + 1)); n > 0; n--) {
      out += alphabet[Math.floor(random() * alphabet.length)];
    }
    return out;
  }

  it("matches a single rule exactly as the reference does", () => {
    const random = mulberry32(9309);
    let hits = 0;
    for (let i = 0; i < 4000; i++) {
      const pattern = `/${makeWord(random, "ab/*?", 7)}${random() < 0.3 ? "$" : ""}`;
      const target = `/${makeWord(random, "ab/?", 8)}`;
      const expected = referenceMatch(pattern, target);
      if (expected) hits += 1;
      expect(blocked(pattern, target), `${pattern} vs ${target}`).toBe(expected);
    }
    expect(hits).toBeGreaterThan(300);
    expect(hits).toBeLessThan(3700);
  });

  it("applies longest match, then allow-wins-ties, over random rule sets", () => {
    const random = mulberry32(2026);
    let allowedCount = 0;
    for (let i = 0; i < 3000; i++) {
      const rules = Array.from({ length: 1 + Math.floor(random() * 5) }, () => ({
        allow: random() < 0.5,
        pattern: `/${makeWord(random, "ab/*?", 5)}${random() < 0.25 ? "$" : ""}`,
      }));
      const target = `/${makeWord(random, "ab/?", 7)}`;
      let best: { allow: boolean; length: number } | null = null;
      for (const rule of rules) {
        if (!referenceMatch(rule.pattern, target)) continue;
        const length = rule.pattern.length;
        if (best === null || length > best.length || (length === best.length && rule.allow && !best.allow)) {
          best = { allow: rule.allow, length };
        }
      }
      const expected = best === null ? true : best.allow;
      if (expected) allowedCount += 1;
      const text = ["User-agent: *", ...rules.map((r) => `${r.allow ? "Allow" : "Disallow"}: ${r.pattern}`)].join("\n");
      expect(allowed(text, "x", target), `${text.replace(/\n/g, " | ")} vs ${target}`).toBe(expected);
    }
    expect(allowedCount).toBeGreaterThan(300);
    expect(allowedCount).toBeLessThan(2900);
  });

  it("selects groups as the reference does over random group layouts", () => {
    const random = mulberry32(51);
    const names = ["a", "b", "c", "*"];
    const pickName = (): string => names[Math.floor(random() * names.length)];
    for (let i = 0; i < 1500; i++) {
      const groups = Array.from({ length: 1 + Math.floor(random() * 4) }, () => ({
        agents: Array.from({ length: 1 + Math.floor(random() * 2) }, pickName),
        rules: Array.from({ length: 1 + Math.floor(random() * 3) }, () => ({
          allow: random() < 0.4,
          pattern: `/${makeWord(random, "xy/", 3)}`,
        })),
      }));
      const agent = ["a", "b", "c", "d"][Math.floor(random() * 4)];
      const target = `/${makeWord(random, "xy/", 4)}`;

      const named = groups.filter((g) => g.agents.includes(agent));
      const chosen = named.length > 0 ? named : groups.filter((g) => g.agents.includes("*"));
      let best: { allow: boolean; length: number } | null = null;
      for (const rule of chosen.flatMap((g) => g.rules)) {
        if (!referenceMatch(rule.pattern, target)) continue;
        const length = rule.pattern.length;
        if (best === null || length > best.length || (length === best.length && rule.allow && !best.allow)) {
          best = { allow: rule.allow, length };
        }
      }
      const expected = best === null ? true : best.allow;

      const text = groups
        .map((g) =>
          [...g.agents.map((name) => `User-agent: ${name}`), ...g.rules.map((r) => `${r.allow ? "Allow" : "Disallow"}: ${r.pattern}`)].join("\n")
        )
        .join("\n\n");
      expect(allowed(text, agent, target), `${agent} ${target}\n${text}`).toBe(expected);
    }
  });
});

describe("Sitemap lines", () => {
  it("collects absolute http(s) sitemap URLs from anywhere in the file", () => {
    const text = [
      "Sitemap: https://example.ie/sitemap.xml",
      "User-agent: *",
      "Disallow: /a",
      "sitemap: https://example.ie/news.xml # comment",
      "SITEMAP:http://example.ie/old.xml",
    ].join("\n");
    expect(declaredSitemaps(parseRobots(text))).toEqual([
      "https://example.ie/sitemap.xml",
      "https://example.ie/news.xml",
      "http://example.ie/old.xml",
    ]);
  });

  it("deduplicates and drops relative, empty and non-http entries", () => {
    const text = [
      "Sitemap: /relative.xml",
      "Sitemap:",
      "Sitemap: ftp://example.ie/s.xml",
      "Sitemap: javascript:alert(1)",
      "Sitemap: https://example.ie/s.xml",
      "Sitemap: https://example.ie/s.xml",
    ].join("\n");
    expect(declaredSitemaps(parseRobots(text))).toEqual(["https://example.ie/s.xml"]);
  });

  it("drops Sitemap values with no host or with whitespace", () => {
    const text = [
      "Sitemap: http:///nohost.xml",
      "Sitemap: https://",
      "Sitemap: https://?q=1",
      "Sitemap: https://example.ie/a b.xml",
      "Sitemap: https://example.ie/ok.xml",
    ].join("\n");
    expect(declaredSitemaps(parseRobots(text))).toEqual(["https://example.ie/ok.xml"]);
  });

  it("does not let a Sitemap line end a user-agent group", () => {
    const text = "User-agent: a\nSitemap: https://example.ie/s.xml\nUser-agent: b\nDisallow: /";
    expect(allowed(text, "a", "/x")).toBe(false);
  });

  it("returns a copy", () => {
    const rules = parseRobots("Sitemap: https://example.ie/s.xml");
    declaredSitemaps(rules).push("https://evil.example/");
    expect(declaredSitemaps(rules)).toEqual(["https://example.ie/s.xml"]);
  });
});

describe("robotsFromRecord", () => {
  it("parses a 2xx body into rules", () => {
    const access = robotsFromRecord(record({ body: "User-agent: *\nDisallow: /a" }));
    expect(access.kind).toBe("rules");
    if (access.kind === "rules") {
      expect(isAllowed(access.rules, "x", `${ORIGIN}/a`)).toBe(false);
      expect(access.rules.truncated).toBe(false);
    }
  });

  it("treats an empty 2xx body as rules that allow everything", () => {
    const access = robotsFromRecord(record({ body: "" }));
    expect(access.kind).toBe("rules");
    if (access.kind === "rules") expect(isAllowed(access.rules, "x", `${ORIGIN}/a`)).toBe(true);
  });

  it("maps any 4xx to allow-all", () => {
    for (const status of [400, 401, 403, 404, 410, 429, 451, 499]) {
      expect(robotsFromRecord(record({ status, body: null }))).toEqual({ kind: "allow-all" });
    }
  });

  it("maps a 4xx that also carries an error code to allow-all", () => {
    const access = robotsFromRecord(
      record({
        status: 404,
        body: "<html>nope</html>",
        error: { code: "CONTENT_TYPE_REJECTED", message: "html" },
      })
    );
    expect(access).toEqual({ kind: "allow-all" });
  });

  it("maps 5xx to error, never to a block", () => {
    for (const status of [500, 502, 503, 504, 599]) {
      expect(robotsFromRecord(record({ status, body: null }))).toEqual({ kind: "error" });
    }
  });

  it("maps timeouts and other fetch failures to error", () => {
    for (const code of ["TIMEOUT", "CONNECT_TIMEOUT", "DNS_FAILED", "TLS_ERROR", "CONNECTION_RESET", "JOB_TIMEOUT", "UNKNOWN"] as const) {
      expect(
        robotsFromRecord(record({ status: null, body: null, error: { code, message: code } }))
      ).toEqual({ kind: "error" });
    }
  });

  it("maps a request that was never made to error", () => {
    expect(
      robotsFromRecord(
        record({ status: null, body: null, error: { code: "ROBOTS_DISALLOWED", message: "x" } })
      )
    ).toEqual({ kind: "error" });
    expect(
      robotsFromRecord(
        record({ status: null, body: null, error: { code: "REQUEST_CAP_REACHED", message: "x" } })
      )
    ).toEqual({ kind: "error" });
  });

  it("maps an unresolved redirect or other non-2xx status to error", () => {
    expect(robotsFromRecord(record({ status: 301, body: null }))).toEqual({ kind: "error" });
    expect(
      robotsFromRecord(
        record({ status: 302, body: null, error: { code: "TOO_MANY_REDIRECTS", message: "x" } })
      )
    ).toEqual({ kind: "error" });
    expect(robotsFromRecord(record({ status: 100, body: null }))).toEqual({ kind: "error" });
  });

  it("maps a 2xx with a rejected content type or no body to error", () => {
    expect(
      robotsFromRecord(
        record({ body: null, error: { code: "CONTENT_TYPE_REJECTED", message: "x" } })
      )
    ).toEqual({ kind: "error" });
    expect(robotsFromRecord(record({ body: null }))).toEqual({ kind: "error" });
    expect(
      robotsFromRecord(
        record({ body: "User-agent: *\nDisallow: /", error: { code: "DECODE_ERROR", message: "x" } })
      )
    ).toEqual({ kind: "error" });
  });

  it("parses the retained prefix of an oversized 2xx body and flags truncation", () => {
    const access = robotsFromRecord(
      record({
        body: "User-agent: *\nDisallow: /a\n",
        truncated: true,
        error: { code: "RESPONSE_TOO_LARGE", message: "cap" },
      })
    );
    expect(access.kind).toBe("rules");
    if (access.kind === "rules") {
      expect(access.rules.truncated).toBe(true);
      expect(isAllowed(access.rules, "x", `${ORIGIN}/a`)).toBe(false);
    }
    const flagged = robotsFromRecord(record({ body: "User-agent: *\nDisallow: /a\n", truncated: true }));
    expect(flagged.kind === "rules" && flagged.rules.truncated).toBe(true);
  });
});
