import { isIP } from "node:net";
import { describe, expect, it } from "vitest";
import { normaliseUrl, sameSite, siteHost } from "@/lib/visibility/normalise";
import { MAX_URL_LENGTH, TARGET_REJECT_REASONS, parseRequestUrl, parseTarget } from "@/lib/visibility/url";

function reason(input: string): string | null {
  const result = parseTarget(input);
  return result.ok ? null : result.reason;
}

describe("parseTarget: accepted input", () => {
  it("defaults a bare host to https and normalises it", () => {
    expect(parseTarget("example.com")).toEqual({ ok: true, url: "https://example.com/", host: "example.com" });
  });

  it("lowercases scheme and host, drops the fragment, keeps path and query", () => {
    expect(parseTarget("HTTPS://Example.COM/Some/Path?Q=1#frag")).toEqual({
      ok: true,
      url: "https://example.com/Some/Path?Q=1",
      host: "example.com",
    });
  });

  it("keeps an explicit http scheme", () => {
    expect(parseTarget("http://example.com")).toEqual({ ok: true, url: "http://example.com/", host: "example.com" });
  });

  it("accepts a scheme-relative URL as https", () => {
    expect(parseTarget("//example.com/x")).toEqual({ ok: true, url: "https://example.com/x", host: "example.com" });
  });

  it("trims surrounding whitespace", () => {
    expect(parseTarget("  example.com  ")).toEqual({ ok: true, url: "https://example.com/", host: "example.com" });
  });

  it("accepts the allowed ports 80 and 443 on either scheme and drops the default ones", () => {
    expect(parseTarget("https://example.com:443/")).toMatchObject({ ok: true, url: "https://example.com/" });
    expect(parseTarget("http://example.com:80/")).toMatchObject({ ok: true, url: "http://example.com/" });
    expect(parseTarget("http://example.com:443/")).toMatchObject({ ok: true, url: "http://example.com:443/" });
    expect(parseTarget("https://example.com:80/")).toMatchObject({ ok: true, url: "https://example.com:80/" });
    expect(parseTarget("example.com:443")).toMatchObject({ ok: true, host: "example.com" });
  });

  it("strips one trailing dot from the host", () => {
    expect(parseTarget("https://example.com./")).toEqual({ ok: true, url: "https://example.com/", host: "example.com" });
    expect(parseTarget("example.com.")).toMatchObject({ ok: true, host: "example.com" });
  });

  it("converts an IDN host to punycode", () => {
    expect(parseTarget("https://bücher.example/")).toEqual({
      ok: true,
      url: "https://xn--bcher-kva.example/",
      host: "xn--bcher-kva.example",
    });
    expect(parseTarget("https://bücher.example./")).toMatchObject({ ok: true, host: "xn--bcher-kva.example" });
  });

  it("accepts a URL of exactly 2,048 characters and rejects one character more", () => {
    const base = "https://example.com/";
    const exact = base + "a".repeat(MAX_URL_LENGTH - base.length);
    expect(exact).toHaveLength(MAX_URL_LENGTH);
    expect(parseTarget(exact).ok).toBe(true);
    expect(reason(exact + "a")).toBe("TOO_LONG");
  });

  it("uses the same normalisation as normaliseUrl", () => {
    const result = parseRequestUrl("https://Example.com/a%2fb?x=%e2%82%ac#top");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url).toBe(normaliseUrl(result.href));
      expect(result.href).not.toContain("#");
      expect(result.port).toBe(443);
      expect(result.protocol).toBe("https:");
    }
  });
});

describe("parseTarget: rejected input", () => {
  it("rejects empty input", () => {
    expect(reason("")).toBe("EMPTY");
    expect(reason("   ")).toBe("EMPTY");
  });

  it("rejects non-string input", () => {
    expect(reason(undefined as unknown as string)).toBe("INVALID_URL");
    expect(reason(null as unknown as string)).toBe("INVALID_URL");
    expect(reason(42 as unknown as string)).toBe("INVALID_URL");
  });

  it.each([
    "file:///etc/passwd",
    "ftp://example.com/",
    "gopher://example.com/",
    "javascript:alert(1)",
    "data:text/html,hello",
    "mailto:someone@example.com",
    "ws://example.com/",
    "wss://example.com/",
    "ssh://example.com/",
    "ldap://example.com/",
    "dict://example.com:11211/stats",
    "view-source:https://example.com/",
    "FILE:///c:/windows/win.ini",
  ])("rejects the non-http scheme in %s", (input) => {
    expect(reason(input)).toBe("SCHEME_NOT_ALLOWED");
  });

  it.each([
    "https://example.com:22/",
    "https://example.com:25/",
    "https://example.com:6379/",
    "https://example.com:5432/",
    "https://example.com:3306/",
    "https://example.com:8080/",
    "http://example.com:8443/",
    "example.com:22",
    "example.com:6379/info",
    "http://example.com:0/",
  ])("rejects the disallowed port in %s", (input) => {
    expect(reason(input)).toBe("PORT_NOT_ALLOWED");
  });

  it("rejects a port outside the valid range as an invalid URL", () => {
    expect(reason("https://example.com:65536/")).toBe("INVALID_URL");
  });

  it.each([
    "https://user:pass@example.com/",
    "https://user@example.com/",
    "https://@example.com/",
    "https://good.com@evil.com/",
    "https://good.com:80@evil.com/",
    "https://good.com:pw@evil.com:443/",
    "good.com@evil.com",
    "http://example.com:80@evil.com/",
  ])("rejects userinfo in %s", (input) => {
    expect(reason(input)).toBe("USERINFO_NOT_ALLOWED");
  });

  it("never lets an encoded @ smuggle a second host", () => {
    expect(parseTarget("https://good.com%40evil.com/").ok).toBe(false);
    expect(parseTarget("https://good.com%2540evil.com/").ok).toBe(false);
  });

  it("uses the host the WHATWG parser selects for backslash and fragment tricks", () => {
    expect(parseTarget("https://evil.com\\@good.com/")).toMatchObject({ ok: true, host: "evil.com" });
    expect(parseTarget("https://evil.com#@good.com/")).toMatchObject({ ok: true, host: "evil.com" });
    expect(parseTarget("https://evil.com?@good.com/")).toMatchObject({ ok: true, host: "evil.com" });
    expect(parseTarget("https://evil.com/@good.com")).toMatchObject({ ok: true, host: "evil.com" });
  });

  it.each([
    "http://127.0.0.1/",
    "http://127.0.0.1:80/",
    "http://8.8.8.8/",
    "https://169.254.169.254/latest/meta-data/",
    "http://10.0.0.1/",
    "http://192.168.1.1/",
    "http://0.0.0.0/",
    "http://0/",
    "http://1.1.1.1./",
    "127.0.0.1",
    "169.254.169.254",
  ])("rejects the IPv4 literal %s", (input) => {
    expect(reason(input)).toBe("IP_LITERAL_HOST");
  });

  it.each([
    ["decimal", "http://2130706433/"],
    ["decimal metadata", "http://2852039166/"],
    ["hex", "http://0x7f000001/"],
    ["hex dotted", "http://0x7f.0x0.0x0.0x1/"],
    ["hex mixed", "http://0x7f.0.0.1/"],
    ["octal dotted", "http://0177.0.0.1/"],
    ["octal metadata", "http://0251.0376.0251.0376/"],
    ["octal whole", "http://017700000001/"],
    ["short two-part", "http://127.1/"],
    ["short three-part", "http://127.0.1/"],
    ["short with zeros", "http://0.0/"],
    ["percent-encoded digits", "http://%31%32%37.0.0.1/"],
    ["fullwidth digits", "http://１２７.０.０.１/"],
    ["ideographic full stop", "http://127。0。0。1/"],
  ])("rejects the alternative IPv4 encoding (%s)", (_label, input) => {
    expect(reason(input)).toBe("IP_LITERAL_HOST");
  });

  it.each([
    "http://[::1]/",
    "http://[::1]:80/",
    "https://[::ffff:127.0.0.1]/",
    "https://[::ffff:7f00:1]/",
    "https://[::ffff:8.8.8.8]/",
    "https://[::]/",
    "https://[2001:db8::1]/",
    "https://[2606:4700:4700::1111]/",
    "https://[fe80::1]/",
    "https://[fd00::1]/",
    "https://[0:0:0:0:0:0:0:1]/",
    "https://[64:ff9b::7f00:1]/",
    "https://[::1]:22/",
  ])("rejects the IPv6 literal %s", (input) => {
    expect(reason(input)).toBe("IP_LITERAL_HOST");
  });

  it.each([
    "localhost",
    "LOCALHOST",
    "localhost.",
    "http://localhost/",
    "http://localhost:80/",
    "localhost:6379",
    "foo.localhost",
    "a.b.localhost.",
    "printer.local",
    "a.b.local",
    "svc.cluster.internal",
    "metadata.google.internal",
    "app.test",
    "a.b.test.",
    "local",
    "internal",
    "test",
  ])("rejects the reserved hostname %s", (input) => {
    expect(reason(input)).toBe("RESERVED_HOSTNAME");
  });

  it("does not treat lookalike public names as reserved", () => {
    expect(parseTarget("notlocalhost.com").ok).toBe(true);
    expect(parseTarget("localhost.example.com").ok).toBe(true);
    expect(parseTarget("contest.ie").ok).toBe(true);
    expect(parseTarget("latest.com").ok).toBe(true);
  });

  it.each(["https://exa mple.com/", "https://a..b/", "https://.example.com/", "https://example..com/"])(
    "rejects the malformed host in %s",
    (input) => {
      expect(parseTarget(input).ok).toBe(false);
    },
  );

  it.each(["https://", "https:///", "http://:80/", "not a url at all"])("rejects the unparsable input %s", (input) => {
    expect(parseTarget(input).ok).toBe(false);
  });

  it.each(["https://exam\nple.com/", "https://example.com/\u0000", "https://example.com/a\tb", "https://example.com/\r\nHost: evil"])(
    "rejects control characters (%j)",
    (input) => {
      expect(reason(input)).toBe("INVALID_URL");
    },
  );

  it("rejects a host label over 63 characters and a host over 253", () => {
    expect(parseTarget(`https://${"a".repeat(64)}.com/`).ok).toBe(false);
    expect(parseTarget(`https://${"a.".repeat(130)}com/`).ok).toBe(false);
  });
});

describe("parseTarget: IDN lookalikes", () => {
  it("turns a Cyrillic lookalike into a different punycode host that the allowlist cannot match", () => {
    const real = parseTarget("https://apple.com/");
    const fake = parseTarget("https://\u0430pple.com/");
    expect(real).toMatchObject({ ok: true, host: "apple.com" });
    expect(fake).toMatchObject({ ok: true, host: "xn--pple-43d.com" });
    if (real.ok && fake.ok) {
      expect(sameSite(real.url, fake.url)).toBe(false);
      expect(siteHost(fake.host)).not.toBe(siteHost(real.host));
    }
  });

  it("keeps a mixed-script lookalike of databridges.ie distinct from the real host", () => {
    const fake = parseTarget("https://databr\u0456dges.ie/");
    expect(fake.ok).toBe(true);
    if (fake.ok) {
      expect(fake.host).toMatch(/^xn--/);
      expect(sameSite(fake.url, "https://databridges.ie/")).toBe(false);
    }
  });

  it("maps fullwidth letters and the ideographic full stop to the ASCII host the parser actually uses", () => {
    expect(parseTarget("https://ｅｘａｍｐｌｅ。com/")).toMatchObject({ ok: true, host: "example.com" });
  });

  it("returns whatever host the parser settles on for ignorable characters, never a different string", () => {
    const result = parseTarget("https://exam\u200Bple.com/");
    if (result.ok) expect(result.host).toBe("example.com");
  });

  it("rejects a reserved name written with lookalike dots or a trailing dot", () => {
    expect(reason("https://localhost。/")).toBe("RESERVED_HOSTNAME");
    expect(reason("https://LocalHost./")).toBe("RESERVED_HOSTNAME");
  });
});

describe("parseRequestUrl", () => {
  it("honours an allowed-port override for the internal test factory only", () => {
    expect(parseRequestUrl("http://example.com:8123/").ok).toBe(false);
    const result = parseRequestUrl("http://example.com:8123/x?y=1", { allowedPorts: [80, 443, 8123] });
    expect(result).toMatchObject({ ok: true, port: 8123, path: "/x?y=1", host: "example.com" });
  });

  it("serialises exactly what goes on the wire", () => {
    const result = parseRequestUrl("https://EXAMPLE.com/a b?c=d e#f");
    expect(result).toMatchObject({ ok: true, path: "/a%20b?c=d%20e", href: "https://example.com/a%20b?c=d%20e" });
  });
});

describe("parseTarget: invariants over generated input", () => {
  const schemes = ["", "http://", "https://", "//", "ftp://", "file://", "HTTP://", "javascript:", "https:/", "https:\\\\"];
  const userinfo = ["", "user@", "user:pw@", "good.com@", "%40", "@"];
  const hosts = [
    "example.com",
    "EXAMPLE.com.",
    "127.0.0.1",
    "127.0.0.1.",
    "0x7f.1",
    "0177.0.0.1",
    "2130706433",
    "169.254.169.254",
    "[::1]",
    "[::ffff:7f00:1]",
    "[2606:4700:4700::1111]",
    "localhost",
    "LocalHost.",
    "a.localhost",
    "b.local",
    "c.internal",
    "d.test",
    "bücher.example",
    "xn--bcher-kva.example",
    "ｅｘａｍｐｌｅ。com",
    "%31%32%37.0.0.1",
    "exa mple.com",
    "a..b",
    "",
  ];
  const ports = ["", ":80", ":443", ":22", ":8080", ":0", ":65536", ":"];
  const tails = ["", "/", "/a?b#c", "\\@x", "/%00", "?x=1#@y"];

  it("never throws, only returns documented reasons, and every accepted target is a public http(s) name on port 80 or 443", () => {
    let accepted = 0;
    let rejected = 0;
    const violations: string[] = [];
    const reasons: readonly string[] = TARGET_REJECT_REASONS;
    const reservedHost = /(^|\.)(localhost|local|internal|test)$/;
    for (const scheme of schemes) {
      for (const user of userinfo) {
        for (const host of hosts) {
          for (const port of ports) {
            for (const tail of tails) {
              const input = `${scheme}${user}${host}${port}${tail}`;
              const result = parseTarget(input);
              if (!result.ok) {
                rejected += 1;
                if (!reasons.includes(result.reason)) violations.push(`${input}: undocumented reason ${result.reason}`);
                continue;
              }
              accepted += 1;
              const parsed = new URL(result.url);
              const problems: string[] = [];
              if (parsed.protocol !== "http:" && parsed.protocol !== "https:") problems.push("scheme");
              if (parsed.username !== "" || parsed.password !== "") problems.push("userinfo");
              if (isIP(parsed.hostname.replace(/^\[|\]$/g, "")) !== 0 || parsed.hostname.startsWith("[")) problems.push("ip literal");
              if (parsed.hostname !== result.host) problems.push("host mismatch");
              if (!/^[a-z0-9.-]+$/.test(result.host)) problems.push("host charset");
              if (reservedHost.test(result.host)) problems.push("reserved host");
              if (!["", "80", "443"].includes(parsed.port)) problems.push("port");
              if (result.url.length > MAX_URL_LENGTH) problems.push("length");
              if (result.url.includes("#")) problems.push("fragment");
              if (problems.length > 0) violations.push(`${input}: ${problems.join(", ")}`);
            }
          }
        }
      }
    }
    expect(violations.slice(0, 5)).toEqual([]);
    expect(accepted).toBeGreaterThan(100);
    expect(rejected).toBeGreaterThan(1_000);
  });
});
