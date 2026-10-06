import { describe, expect, it } from "vitest";
import {
  SITEMAP_MAX_BYTES,
  SITEMAP_MAX_LOCS,
  isValidW3cDate,
  parseSitemap,
} from "@/lib/visibility/sitemap-parse";

const NS = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"';

function urlset(entries: string, attrs = NS): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset ${attrs}>\n${entries}\n</urlset>`;
}

function url(loc: string, lastmod?: string): string {
  return `<url><loc>${loc}</loc>${lastmod === undefined ? "" : `<lastmod>${lastmod}</lastmod>`}</url>`;
}

describe("parseSitemap: structure", () => {
  it("reads a urlset with locs and lastmods in document order", () => {
    const xml = urlset(
      [
        url("https://example.ie/", "2026-09-01"),
        url("https://example.ie/about", "2026-08-15T10:30:00+01:00"),
        url("https://example.ie/contact"),
      ].join("\n")
    );
    expect(parseSitemap(xml)).toEqual({
      kind: "urlset",
      locs: ["https://example.ie/", "https://example.ie/about", "https://example.ie/contact"],
      lastmods: ["2026-09-01", "2026-08-15T10:30:00+01:00", null],
      truncated: false,
    });
  });

  it("reads a sitemapindex", () => {
    const xml = `<?xml version="1.0"?>
<sitemapindex ${NS}>
  <sitemap><loc>https://example.ie/sitemap-1.xml</loc><lastmod>2026-09-01</lastmod></sitemap>
  <sitemap><loc>https://example.ie/sitemap-2.xml</loc></sitemap>
</sitemapindex>`;
    expect(parseSitemap(xml)).toEqual({
      kind: "sitemapindex",
      locs: ["https://example.ie/sitemap-1.xml", "https://example.ie/sitemap-2.xml"],
      lastmods: ["2026-09-01", null],
      truncated: false,
    });
  });

  it("accepts an empty urlset and a self-closing root", () => {
    expect(parseSitemap(urlset(""))).toEqual({ kind: "urlset", locs: [], lastmods: [], truncated: false });
    expect(parseSitemap(`<urlset ${NS}/>`)).toEqual({
      kind: "urlset",
      locs: [],
      lastmods: [],
      truncated: false,
    });
  });

  it("accepts a prefixed root and prefixed children", () => {
    const xml = `<sm:urlset xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9">
<sm:url><sm:loc>https://example.ie/a</sm:loc><sm:lastmod>2026-01-01</sm:lastmod></sm:url>
</sm:urlset>`;
    const result = parseSitemap(xml);
    expect(result.kind).toBe("urlset");
    expect(result.locs).toEqual(["https://example.ie/a"]);
    expect(result.lastmods).toEqual(["2026-01-01"]);
  });

  it("ignores extension elements from other namespaces", () => {
    const xml = urlset(
      `<url>
  <loc>https://example.ie/page</loc>
  <image:image><image:loc>https://cdn.example.ie/pic.jpg</image:loc></image:image>
  <video:video><video:content_loc>https://cdn.example.ie/v.mp4</video:content_loc></video:video>
  <xhtml:link rel="alternate" hreflang="ga" href="https://example.ie/ga/page"/>
  <lastmod>2026-02-02</lastmod>
</url>`,
      `${NS} xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:xhtml="http://www.w3.org/1999/xhtml"`
    );
    const result = parseSitemap(xml);
    expect(result.locs).toEqual(["https://example.ie/page"]);
    expect(result.lastmods).toEqual(["2026-02-02"]);
  });

  it("ignores prefixed loc and lastmod elements even when they come first", () => {
    const xml = urlset(
      `<url><image:image><image:loc>https://cdn.example.ie/pic.jpg</image:loc></image:image><news:lastmod>1999-01-01</news:lastmod><loc>https://example.ie/real</loc><lastmod>2026-05-05</lastmod></url>
<image:loc>https://cdn.example.ie/stray.jpg</image:loc>`,
      `${NS} xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"`
    );
    const result = parseSitemap(xml);
    expect(result.locs).toEqual(["https://example.ie/real"]);
    expect(result.lastmods).toEqual(["2026-05-05"]);
  });

  it("keeps lastmods aligned with locs when lastmod is missing, empty or first", () => {
    const xml = urlset(
      [
        "<url><lastmod>2026-03-03</lastmod><loc>https://example.ie/a</loc></url>",
        "<url><loc>https://example.ie/b</loc><lastmod>  </lastmod></url>",
        "<url><loc>https://example.ie/c</loc><lastmod/></url>",
        "<url><loc>https://example.ie/d</loc><lastmod> 2026-04-04 </lastmod></url>",
      ].join("")
    );
    const result = parseSitemap(xml);
    expect(result.locs).toHaveLength(4);
    expect(result.lastmods).toEqual(["2026-03-03", null, null, "2026-04-04"]);
  });

  it("returns lastmod text as written without validating it", () => {
    const result = parseSitemap(urlset(url("https://example.ie/a", "yesterday")));
    expect(result.lastmods).toEqual(["yesterday"]);
  });

  it("uses the first loc when an entry holds two", () => {
    const xml = urlset("<url><loc>https://example.ie/first</loc><loc>https://example.ie/second</loc></url>");
    expect(parseSitemap(xml).locs).toEqual(["https://example.ie/first"]);
  });

  it("recovers an entry that is missing its closing tag", () => {
    const xml = urlset("<url><loc>https://example.ie/a</loc><url><loc>https://example.ie/b</loc></url>");
    expect(parseSitemap(xml).locs).toEqual(["https://example.ie/a", "https://example.ie/b"]);
  });

  it("trims whitespace around a loc", () => {
    const result = parseSitemap(urlset("<url><loc>\n   https://example.ie/a  \n</loc></url>"));
    expect(result.locs).toEqual(["https://example.ie/a"]);
  });

  it("handles a byte order mark, comments, processing instructions and CDATA", () => {
    const xml = `﻿<?xml version="1.0"?>
<?xml-stylesheet type="text/xsl" href="sitemap.xsl"?>
<!-- generated -->
<urlset ${NS}>
  <!-- <url><loc>https://example.ie/commented-out</loc></url> -->
  <url><loc><![CDATA[https://example.ie/cdata?a=1&b=2]]></loc></url>
  <url><loc>https://example.ie/plain</loc></url>
</urlset>`;
    const result = parseSitemap(xml);
    expect(result.kind).toBe("urlset");
    expect(result.locs).toEqual(["https://example.ie/cdata?a=1&b=2", "https://example.ie/plain"]);
  });

  it("handles CRLF and tabs inside tags", () => {
    const xml = `<urlset\r\n\t${NS}>\r\n<url\t>\r\n<loc >https://example.ie/a</loc>\r\n</url >\r\n</urlset>`;
    expect(parseSitemap(xml).locs).toEqual(["https://example.ie/a"]);
  });

  it("does not treat a greater-than sign inside an attribute value as the end of a tag", () => {
    const xml = `<urlset ${NS} note="a > b"><url><loc>https://example.ie/a</loc></url></urlset>`;
    expect(parseSitemap(xml).locs).toEqual(["https://example.ie/a"]);
  });

  it("ignores content after the closing root", () => {
    const xml = `${urlset(url("https://example.ie/a"))}<url><loc>https://example.ie/after</loc></url>`;
    expect(parseSitemap(xml).locs).toEqual(["https://example.ie/a"]);
  });
});

describe("parseSitemap: invalid input", () => {
  const invalid = { kind: "invalid", locs: [], lastmods: [], truncated: false };

  it("rejects HTML, including an SPA fallback page", () => {
    expect(parseSitemap("<!DOCTYPE html><html><body><div id=root></div></body></html>")).toEqual(invalid);
    expect(parseSitemap("<html><head></head><body>Not found</body></html>")).toEqual(invalid);
  });

  it("rejects empty, plain text and JSON", () => {
    expect(parseSitemap("")).toEqual(invalid);
    expect(parseSitemap("   \n  ")).toEqual(invalid);
    expect(parseSitemap("Not found")).toEqual(invalid);
    expect(parseSitemap('{"urlset":[]}')).toEqual(invalid);
  });

  it("rejects other XML roots, including feeds, and a case-mismatched root", () => {
    expect(parseSitemap('<?xml version="1.0"?><rss version="2.0"><channel><link>https://example.ie/</link></channel></rss>')).toEqual(invalid);
    expect(parseSitemap('<feed xmlns="http://www.w3.org/2005/Atom"></feed>')).toEqual(invalid);
    expect(parseSitemap("<URLSET><url><loc>https://example.ie/a</loc></url></URLSET>")).toEqual(invalid);
    expect(parseSitemap("<urlsets><url><loc>https://example.ie/a</loc></url></urlsets>")).toEqual(invalid);
  });

  it("does not mistake a sitemap element inside another root for a sitemap", () => {
    expect(parseSitemap("<wrapper><urlset><url><loc>https://example.ie/a</loc></url></urlset></wrapper>")).toEqual(invalid);
  });

  it("never throws on junk", () => {
    const junk = [
      "<",
      "<>",
      "</",
      "<urlset",
      "<urlset ",
      '<urlset a="',
      "<urlset><url><loc>https://example.ie/a",
      "<urlset><url><loc>https://example.ie/a</url></urlset>",
      "<urlset><!--",
      "<urlset><![CDATA[",
      "<urlset><?pi",
      "<!DOCTYPE",
      "<!DOCTYPE x [",
      "\u0000\u0001\u0002",
      "\uD800",
      "<urlset>".repeat(10_000),
      "<url><loc>".repeat(10_000),
    ];
    for (const input of junk) expect(() => parseSitemap(input), input.slice(0, 20)).not.toThrow();
    expect(() => parseSitemap(undefined as unknown as string)).not.toThrow();
    expect(() => parseSitemap(null as unknown as string)).not.toThrow();
    expect(parseSitemap(42 as unknown as string).kind).toBe("invalid");
  });

  it("keeps what it parsed before a malformed tail", () => {
    const result = parseSitemap(
      urlset(`${url("https://example.ie/a")}<url><loc>https://example.ie/b</loc></url><url><loc>https://example.ie/c`)
    );
    expect(result.kind).toBe("urlset");
    expect(result.locs).toEqual(["https://example.ie/a", "https://example.ie/b"]);
  });
});

describe("parseSitemap: loc filtering", () => {
  it("keeps only absolute http and https locs", () => {
    const xml = urlset(
      [
        url("https://example.ie/ok"),
        url("http://example.ie/also-ok"),
        url("HTTPS://EXAMPLE.IE/Upper"),
        url("ftp://example.ie/file"),
        url("javascript:alert(1)"),
        url("mailto:a@example.ie"),
        url("data:text/html,hi"),
        url("file:///etc/passwd"),
        url("//example.ie/protocol-relative"),
        url("/relative"),
        url("relative/path"),
        url("https://"),
        url("http:///x"),
        url(""),
        url("   "),
        url("https://example.ie/has space"),
        url("https://example.ie/has\ttab"),
      ].join("")
    );
    const result = parseSitemap(xml);
    expect(result.locs).toEqual([
      "https://example.ie/ok",
      "http://example.ie/also-ok",
      "HTTPS://EXAMPLE.IE/Upper",
    ]);
    expect(result.lastmods).toEqual([null, null, null]);
    expect(result.truncated).toBe(false);
  });

  it("does not count rejected locs towards the loc cap", () => {
    const rejected = Array.from({ length: 200 }, (_, i) => url(`ftp://example.ie/${i}`)).join("");
    const result = parseSitemap(urlset(`${rejected}${url("https://example.ie/real")}`));
    expect(result.locs).toEqual(["https://example.ie/real"]);
    expect(result.truncated).toBe(false);
  });
});

describe("parseSitemap: entities and DTDs", () => {
  it("decodes only the five predefined entities, once", () => {
    const result = parseSitemap(
      urlset(
        url("https://example.ie/?a=1&amp;b=2&lt;&gt;&quot;x&quot;&apos;y&apos;") +
          url("https://example.ie/&amp;amp;") +
          url("https://example.ie/&#38;&#x26;&nbsp;&unknown;")
      )
    );
    expect(result.locs).toEqual([
      "https://example.ie/?a=1&b=2<>\"x\"'y'",
      "https://example.ie/&amp;",
      "https://example.ie/&#38;&#x26;&nbsp;&unknown;",
    ]);
  });

  it("does not expand entities declared in a DTD (billion laughs)", () => {
    const lol = [
      '<!DOCTYPE urlset [',
      '<!ENTITY lol "lol">',
      '<!ENTITY lol1 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">',
      '<!ENTITY lol2 "&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;">',
      '<!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">',
      "]>",
    ].join("\n");
    const xml = `<?xml version="1.0"?>\n${lol}\n<urlset ${NS}><url><loc>https://example.ie/a/&lol3;</loc></url></urlset>`;
    const started = Date.now();
    const result = parseSitemap(xml);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(result.kind).toBe("urlset");
    expect(result.locs).toEqual(["https://example.ie/a/&lol3;"]);
  });

  it("does not resolve external entities", () => {
    const xml = `<?xml version="1.0"?>
<!DOCTYPE urlset [<!ENTITY xxe SYSTEM "file:///etc/passwd"><!ENTITY remote SYSTEM "http://127.0.0.1:1/x">]>
<urlset ${NS}><url><loc>https://example.ie/&xxe;</loc></url><url><loc>&remote;</loc></url></urlset>`;
    const result = parseSitemap(xml);
    expect(result.kind).toBe("urlset");
    expect(result.locs).toEqual(["https://example.ie/&xxe;"]);
  });

  it("skips a DOCTYPE whose internal subset contains quoted brackets and comments", () => {
    const xml = `<!DOCTYPE urlset [
<!-- ] > -->
<!ENTITY a "]>">
<!ELEMENT urlset ANY>
]>
<urlset ${NS}><url><loc>https://example.ie/a</loc></url></urlset>`;
    const result = parseSitemap(xml);
    expect(result.kind).toBe("urlset");
    expect(result.locs).toEqual(["https://example.ie/a"]);
  });

  it("returns invalid for an unterminated DOCTYPE", () => {
    expect(parseSitemap(`<!DOCTYPE urlset [<!ENTITY a "x"><urlset ${NS}></urlset>`).kind).toBe("invalid");
  });
});

describe("parseSitemap: caps", () => {
  it("exports the caps", () => {
    expect(SITEMAP_MAX_BYTES).toBe(2 * 1024 * 1024);
    expect(SITEMAP_MAX_LOCS).toBe(5000);
  });

  it("returns exactly 5,000 locs without flagging truncation", () => {
    const entries = Array.from({ length: SITEMAP_MAX_LOCS }, (_, i) => url(`https://example.ie/p/${i}`)).join("");
    const result = parseSitemap(urlset(entries));
    expect(result.locs).toHaveLength(SITEMAP_MAX_LOCS);
    expect(result.lastmods).toHaveLength(SITEMAP_MAX_LOCS);
    expect(result.truncated).toBe(false);
  });

  it("stops at 5,000 locs and flags truncation", () => {
    const entries = Array.from({ length: SITEMAP_MAX_LOCS + 250 }, (_, i) => url(`https://example.ie/p/${i}`)).join("");
    const result = parseSitemap(urlset(entries));
    expect(result.kind).toBe("urlset");
    expect(result.locs).toHaveLength(SITEMAP_MAX_LOCS);
    expect(result.lastmods).toHaveLength(SITEMAP_MAX_LOCS);
    expect(result.locs[0]).toBe("https://example.ie/p/0");
    expect(result.locs[SITEMAP_MAX_LOCS - 1]).toBe(`https://example.ie/p/${SITEMAP_MAX_LOCS - 1}`);
    expect(result.truncated).toBe(true);
  });

  it("applies the loc cap to sitemap indexes too", () => {
    const entries = Array.from(
      { length: SITEMAP_MAX_LOCS + 1 },
      (_, i) => `<sitemap><loc>https://example.ie/s/${i}.xml</loc></sitemap>`
    ).join("");
    const result = parseSitemap(`<sitemapindex ${NS}>${entries}</sitemapindex>`);
    expect(result.kind).toBe("sitemapindex");
    expect(result.locs).toHaveLength(SITEMAP_MAX_LOCS);
    expect(result.truncated).toBe(true);
  });

  it("ignores input beyond 2 MB and flags truncation", () => {
    const pad = `<!-- ${"x".repeat(SITEMAP_MAX_BYTES)} -->`;
    const xml = urlset(`${url("https://example.ie/early")}${pad}${url("https://example.ie/late")}`);
    expect(xml.length).toBeGreaterThan(SITEMAP_MAX_BYTES);
    const result = parseSitemap(xml);
    expect(result.kind).toBe("urlset");
    expect(result.locs).toEqual(["https://example.ie/early"]);
    expect(result.truncated).toBe(true);
  });

  it("measures the 2 MB cap in bytes, not characters", () => {
    const pad = `<!-- ${"é".repeat(1_200_000)} -->`;
    const xml = urlset(`${url("https://example.ie/early")}${pad}${url("https://example.ie/late")}`);
    expect(xml.length).toBeLessThan(SITEMAP_MAX_BYTES);
    const result = parseSitemap(xml);
    expect(result.locs).toEqual(["https://example.ie/early"]);
    expect(result.truncated).toBe(true);
  });

  it("does not flag truncation for a document within the cap", () => {
    expect(parseSitemap(urlset(url("https://example.ie/a"))).truncated).toBe(false);
  });

  it("copes with a cut in the middle of a tag or a multi-byte character", () => {
    const head = urlset("").replace("\n</urlset>", "");
    const filler = `<!--${"é".repeat(500_000)}-->`;
    const tail = `<url><loc>https://example.ie/${"a".repeat(2_000_000)}`;
    const result = parseSitemap(`${head}${filler}${tail}`);
    expect(result.kind).toBe("urlset");
    expect(result.locs).toEqual([]);
    expect(result.truncated).toBe(true);
  });

  it("parses a hostile 2 MB document of unclosed tags in bounded time", () => {
    const started = Date.now();
    parseSitemap(`<urlset ${NS}>${"<url><loc>".repeat(200_000)}`);
    parseSitemap(`<urlset ${NS}>${"<![CDATA[".repeat(200_000)}`);
    parseSitemap(`<urlset ${NS}>${"<!-- ".repeat(200_000)}`);
    expect(Date.now() - started).toBeLessThan(3000);
  });
});

describe("isValidW3cDate", () => {
  it("accepts the W3C datetime forms", () => {
    for (const value of [
      "2026",
      "2026-09",
      "2026-09-01",
      "2026-09-01T10:30Z",
      "2026-09-01T10:30:15Z",
      "2026-09-01T10:30:15.123Z",
      "2026-09-01T10:30:15+01:00",
      "2026-09-01T10:30:15-05:30",
      "2026-09-01T00:00:00+00:00",
      "2026-09-01T23:59:59Z",
    ]) {
      expect(isValidW3cDate(value), value).toBe(true);
    }
  });

  it("applies calendar rules, including leap years", () => {
    expect(isValidW3cDate("2024-02-29")).toBe(true);
    expect(isValidW3cDate("2000-02-29")).toBe(true);
    expect(isValidW3cDate("2023-02-29")).toBe(false);
    expect(isValidW3cDate("1900-02-29")).toBe(false);
    expect(isValidW3cDate("2026-04-31")).toBe(false);
    expect(isValidW3cDate("2026-04-30")).toBe(true);
    expect(isValidW3cDate("2026-12-31")).toBe(true);
    expect(isValidW3cDate("2026-13-01")).toBe(false);
    expect(isValidW3cDate("2026-00-10")).toBe(false);
    expect(isValidW3cDate("2026-01-00")).toBe(false);
    expect(isValidW3cDate("2026-01-32")).toBe(false);
  });

  it("applies time and offset ranges", () => {
    expect(isValidW3cDate("2026-09-01T24:00:00Z")).toBe(false);
    expect(isValidW3cDate("2026-09-01T10:60:00Z")).toBe(false);
    expect(isValidW3cDate("2026-09-01T10:30:60Z")).toBe(false);
    expect(isValidW3cDate("2026-09-01T10:30:00+24:00")).toBe(false);
    expect(isValidW3cDate("2026-09-01T10:30:00+01:60")).toBe(false);
  });

  it("requires a timezone designator on a time of day", () => {
    expect(isValidW3cDate("2026-09-01T10:30")).toBe(false);
    expect(isValidW3cDate("2026-09-01T10:30:15")).toBe(false);
    expect(isValidW3cDate("2026-09-01T10:30:15.5")).toBe(false);
  });

  it("rejects other formats and junk", () => {
    for (const value of [
      "",
      " ",
      "yesterday",
      "2026-9-1",
      "20260901",
      "2026/09/01",
      "01-09-2026",
      "2026-09-01 10:30:00Z",
      "2026-09-01t10:30:00z",
      "2026-09-01T10Z",
      " 2026-09-01",
      "2026-09-01 ",
      "2026-09-01T10:30:00+0100",
      "2026-09-01T10:30:00.Z",
      "26-09-01",
      "2026-09-01T",
    ]) {
      expect(isValidW3cDate(value), JSON.stringify(value)).toBe(false);
    }
    expect(isValidW3cDate(undefined as unknown as string)).toBe(false);
  });
});
