import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { extractPageFacts } from "@/lib/visibility/extract";
import type { PageFacts } from "@/lib/visibility/types";

const BASE = "https://example.com/";
const cp = (...codes: number[]): string => String.fromCodePoint(...codes);

interface DocOptions {
  head?: string;
  lang?: string | null;
  title?: string | null;
}

function doc(body = "", options: DocOptions = {}): string {
  const lang = options.lang === undefined ? "en" : options.lang;
  const title = options.title === undefined ? "Test page" : options.title;
  const langAttr = lang === null ? "" : ` lang="${lang}"`;
  const titleTag = title === null ? "" : `<title>${title}</title>`;
  return `<!doctype html><html${langAttr}><head><meta charset="utf-8">${titleTag}${options.head ?? ""}</head><body>${body}</body></html>`;
}

function extract(html: string, finalUrl: string = BASE, headers: Record<string, string> = {}): PageFacts {
  return extractPageFacts(html, { finalUrl, headers });
}

function words(count: number, word = "alpha"): string {
  return Array.from({ length: count }, () => word).join(" ");
}

function numbered(count: number): string {
  return Array.from({ length: count }, (_, i) => `w${i + 1}`).join(" ");
}

function ldScript(json: string, type = "application/ld+json"): string {
  return `<script type="${type}">${json}</script>`;
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

const jp = (count: number): string => cp(0x65e5).repeat(count);

describe("page identity and base URL", () => {
  it("normalises the page URL and keeps the document URL as the base", () => {
    const f = extract(doc("<p>x</p>"), "https://Example.com:443/About/#team");
    expect(f.url).toBe("https://example.com/About");
    expect(f.baseUrl).toBe("https://example.com/About/");
  });

  it("uses an http(s) <base href> to resolve relative links and canonicals", () => {
    const html = doc('<a href="x">X</a><a href="/root">R</a>', {
      head: '<base href="/docs/"><link rel="canonical" href="page">',
    });
    const f = extract(html, "https://example.com/blog/post");
    expect(f.baseUrl).toBe("https://example.com/docs/");
    expect(f.links.map((l) => l.url)).toEqual(["https://example.com/docs/x", "https://example.com/root"]);
    expect(f.head.canonicals[0].url).toBe("https://example.com/docs/page");
  });

  it("ignores a <base href> that is not http(s)", () => {
    const html = doc('<a href="x">X</a>', { head: '<base href="javascript:alert(1)">' });
    const f = extract(html, "https://example.com/dir/");
    expect(f.baseUrl).toBe("https://example.com/dir/");
    expect(f.links[0].url).toBe("https://example.com/dir/x");
  });
});

describe("head facts", () => {
  it("records a title normalised, with its code-point length", () => {
    const title = "  Caf&eacute;&nbsp;&#x200B;  Bar \n &#x1F600; ";
    const f = extract(doc("", { title }));
    expect(f.head.titles).toEqual([{ text: "Caf" + cp(0xe9) + " Bar " + cp(0x1f600), chars: 10 }]);
  });

  it("applies NFKC to head text", () => {
    const f = extract(doc("", { title: "&#xFB01;nd &#xFF21;" }));
    expect(f.head.titles[0].text).toBe("find A");
  });

  it("records every title, including empty and duplicate ones", () => {
    const f = extract(doc("", { title: "First", head: "<title>Second</title><title></title><title>First</title>" }));
    expect(f.head.titles.map((t) => t.text)).toEqual(["First", "Second", "", "First"]);
    expect(f.head.titles.map((t) => t.chars)).toEqual([5, 6, 0, 5]);
  });

  it("returns no titles when there is none and ignores SVG titles", () => {
    const f = extract(doc('<svg><title>Icon title</title><circle r="1"/></svg>', { title: null }));
    expect(f.head.titles).toEqual([]);
  });

  it("records every meta description, empty ones included, matching the name case-insensitively", () => {
    const head =
      '<meta name="Description" content="  First   one ">' +
      '<meta name="description" content="">' +
      '<meta property="og:description" content="Not a description">';
    const f = extract(doc("", { head }));
    expect(f.head.metaDescriptions).toEqual([
      { text: "First one", chars: 9 },
      { text: "", chars: 0 },
    ]);
  });

  it("resolves a relative canonical against the final URL and normalises it", () => {
    const html = doc("", { head: '<link rel="canonical" href="../other/#frag">' });
    const f = extract(html, "https://example.com/blog/post/");
    expect(f.head.canonicals).toEqual([{ source: "head", href: "../other/#frag", url: "https://example.com/blog/other" }]);
  });

  it("records multiple canonicals in order, matching rel tokens and ignoring other rels", () => {
    const head =
      '<link rel="canonical" href="https://example.com/a">' +
      '<link rel="CANONICAL nofollow" href="https://other.com/b?x=1">' +
      '<link rel="canonicalize" href="/z">' +
      '<link rel="alternate" href="/alt">' +
      '<link rel="canonical">';
    const f = extract(doc("", { head }));
    expect(f.head.canonicals.map((c) => c.url)).toEqual(["https://example.com/a", "https://other.com/b?x=1"]);
    expect(f.head.canonicals.every((c) => c.source === "head")).toBe(true);
  });

  it("gives a null url to empty, non-HTTP and unparsable canonicals", () => {
    const head =
      '<link rel="canonical" href="">' +
      '<link rel="canonical" href="javascript:void(0)">' +
      '<link rel="canonical" href="ftp://example.com/x">' +
      '<link rel="canonical" href="http://[bad">';
    const f = extract(doc("", { head }));
    expect(f.head.canonicals).toHaveLength(4);
    expect(f.head.canonicals.map((c) => c.url)).toEqual([null, null, null, null]);
  });

  it("reads canonicals from the Link header, header names case-insensitively, after head canonicals", () => {
    const head = '<link rel="canonical" href="/head">';
    const f = extract(doc("", { head }), "https://example.com/page", {
      LINK: '<https://example.com/c>; rel="canonical", </next>; rel="next", </c2>; title="x"; rel=canonical',
    });
    expect(f.head.canonicals.map((c) => [c.source, c.url])).toEqual([
      ["head", "https://example.com/head"],
      ["header", "https://example.com/c"],
      ["header", "https://example.com/c2"],
    ]);
  });

  it("parses meta robots, googlebot and bingbot directives and ignores other agents", () => {
    const head =
      '<meta name="robots" content="NoIndex, Follow, max-snippet:0">' +
      '<meta name="Googlebot" content="nosnippet">' +
      '<meta name="bingbot" content="none">' +
      '<meta name="slurp" content="noindex">';
    const f = extract(doc("", { head }));
    expect(f.head.metaRobots.map((s) => [s.source, s.agent])).toEqual([
      ["meta", null],
      ["meta", "googlebot"],
      ["meta", "bingbot"],
    ]);
    expect(f.head.metaRobots[0].raw).toBe("NoIndex, Follow, max-snippet:0");
    expect(f.head.metaRobots[0].directives).toEqual([
      { name: "noindex", value: null },
      { name: "follow", value: null },
      { name: "max-snippet", value: "0" },
    ]);
    expect(f.head.metaRobots[1].directives).toEqual([{ name: "nosnippet", value: null }]);
    expect(f.head.metaRobots[2].directives).toEqual([{ name: "none", value: null }]);
  });

  it("parses X-Robots-Tag with and without an agent prefix", () => {
    const plain = extract(doc(), BASE, { "X-Robots-Tag": "noindex, nofollow" });
    expect(plain.head.xRobotsTag).toEqual([
      {
        source: "header",
        agent: null,
        raw: "noindex, nofollow",
        directives: [
          { name: "noindex", value: null },
          { name: "nofollow", value: null },
        ],
      },
    ]);

    const prefixed = extract(doc(), BASE, { "x-robots-tag": "googlebot: noindex, bingbot: nosnippet" });
    expect(prefixed.head.xRobotsTag.map((s) => [s.agent, s.directives.map((d) => d.name)])).toEqual([
      ["googlebot", ["noindex"]],
      ["bingbot", ["nosnippet"]],
    ]);

    const mixed = extract(doc(), BASE, { "X-ROBOTS-TAG": "noarchive, googlebot: nofollow" });
    expect(mixed.head.xRobotsTag.map((s) => [s.agent, s.directives.map((d) => d.name)])).toEqual([
      [null, ["noarchive"]],
      ["googlebot", ["nofollow"]],
    ]);
  });

  it("does not mistake value directives for agent prefixes in X-Robots-Tag", () => {
    const f = extract(doc(), BASE, { "X-Robots-Tag": "max-snippet:50, unavailable_after: 25 Jun 2030 15:00:00 PST, noarchive" });
    expect(f.head.xRobotsTag).toHaveLength(1);
    expect(f.head.xRobotsTag[0].agent).toBeNull();
    expect(f.head.xRobotsTag[0].directives.map((d) => [d.name, d.value])).toEqual([
      ["max-snippet", "50"],
      ["unavailable_after", "25 Jun 2030 15:00:00 PST"],
      ["noarchive", null],
    ]);
  });

  it("records the viewport and the Open Graph and Twitter tags with lowercase keys", () => {
    const head =
      '<meta name="viewport" content="width=device-width,   initial-scale=1">' +
      '<meta property="og:title" content=" T ">' +
      '<meta name="og:site_name" content="S">' +
      '<meta property="OG:Image" content="https://example.com/y.png">' +
      '<meta name="twitter:card" content="summary">' +
      '<meta property="twitter:title" content="x">';
    const f = extract(doc("", { head }));
    expect(f.head.viewports).toEqual(["width=device-width, initial-scale=1"]);
    expect(f.head.openGraph).toEqual([
      { key: "og:title", content: "T" },
      { key: "og:site_name", content: "S" },
      { key: "og:image", content: "https://example.com/y.png" },
    ]);
    expect(f.head.twitter).toEqual([
      { key: "twitter:card", content: "summary" },
      { key: "twitter:title", content: "x" },
    ]);
  });

  it.each([
    ["en-GB", "en-GB", "en"],
    ["EN", "EN", "en"],
    ["zh-Hans-CN", "zh-Hans-CN", "zh"],
    [" fr ", "fr", "fr"],
    ["", "", null],
  ])("reads html lang %j", (attribute, htmlLang, langPrimary) => {
    const f = extract(doc("<p>x</p>", { lang: attribute }));
    expect(f.head.htmlLang).toBe(htmlLang);
    expect(f.head.langPrimary).toBe(langPrimary);
  });

  it("reports null language facts when html has no lang attribute", () => {
    const f = extract(doc("<p>x</p>", { lang: null }));
    expect(f.head.htmlLang).toBeNull();
    expect(f.head.langPrimary).toBeNull();
    expect(f.wordCountApplicable).toBe(true);
  });
});

describe("visible text", () => {
  it("excludes script, style, noscript, template, svg, head, hidden and inline-hidden elements", () => {
    const body =
      "<p>visibleText</p>" +
      "<script>var scriptText = 1;</script>" +
      "<style>.styleText{}</style>" +
      "<noscript>noscriptText</noscript>" +
      "<template><p>templateText</p></template>" +
      "<svg><text>svgText</text></svg>" +
      "<p hidden>hiddenAttrText</p>" +
      '<div style="display:none">displayNoneText</div>' +
      '<div style="color:red; DISPLAY : NONE !important">displayNoneImportantText</div>' +
      '<div style="visibility:hidden">visibilityHiddenText</div>' +
      '<div style="display:none"><p><span>nestedHiddenText</span></p></div>' +
      '<div style="display:block">displayBlockText</div>' +
      '<div style="visibility:visible">visibilityVisibleText</div>' +
      '<div aria-hidden="true">ariaHiddenStillVisibleText</div>';
    const f = extract(doc(body, { title: "headTitleText" }));
    expect(f.visibleText).toBe("visibleText displayBlockText visibilityVisibleText ariaHiddenStillVisibleText");
  });

  it("keeps noscript text out of the visible text but uses it for the render markers", () => {
    const f = extract(doc("<p>Shown</p><noscript>Please enable JavaScript to continue</noscript>"));
    expect(f.visibleText).toBe("Shown");
    expect(f.render.noscriptJsMessages).toEqual(["Please enable JavaScript to continue"]);
  });

  it("separates block elements and line breaks but joins inline elements", () => {
    const f = extract(doc("<p>one</p><div>two</div><b>fo</b>o<br>bar<ul><li>x</li><li>y</li></ul>"));
    expect(f.visibleText).toBe("one two foo bar x y");
  });

  it("normalises NBSP, zero-width characters and whitespace in body text", () => {
    const f = extract(doc("<main><p>one&nbsp;two&#x200B;three&#x2060;four&#xFEFF;five   six\n\n seven</p></main>"));
    expect(f.main.text).toBe("one twothreefourfive six seven");
    expect(f.main.wordCount).toBe(4);
  });

  it("treats a zero-width character inside a word as part of that word", () => {
    const f = extract(doc("<main><p>foo&#x200B;bar</p><p>a&nbsp;&nbsp;b</p></main>"));
    expect(f.main.text).toBe("foobar a b");
    expect(f.main.wordCount).toBe(3);
  });

  it("includes header, nav and footer text in the document visible text", () => {
    const f = extract(doc("<header>HeaderT</header><nav>NavT</nav><main><p>MainT</p></main><footer>FooterT</footer>"));
    expect(f.visibleText).toBe("HeaderT NavT MainT FooterT");
    expect(f.main.text).toBe("MainT");
  });
});

describe("main content selection", () => {
  it("prefers <main>", () => {
    const f = extract(doc('<header>H</header><div role="main">Role</div><article>Art</article><main><p>Main text</p></main>'));
    expect(f.main.method).toBe("main");
    expect(f.main.text).toBe("Main text");
  });

  it("takes the first <main> in document order, which includes a nested one", () => {
    const f = extract(doc("<main>outer <main>inner</main> tail</main>"));
    expect(f.main.method).toBe("main");
    expect(f.main.text).toBe("outer inner tail");
  });

  it("takes a <main> that comes after a role=main element", () => {
    const f = extract(doc('<div role="main">A</div><main>B</main>'));
    expect(f.main.method).toBe("main");
    expect(f.main.text).toBe("B");
  });

  it("falls back to [role=main] when there is no <main>", () => {
    const f = extract(doc('<nav>Nav</nav><div role="MAIN"><p>Role content</p></div><p>Outside</p>'));
    expect(f.main.method).toBe("role-main");
    expect(f.main.text).toBe("Role content");
  });

  it("falls back to a single <article>", () => {
    const f = extract(doc("<header>Head</header><article><header>Art head</header><p>Body text</p></article><footer>Foot</footer>"));
    expect(f.main.method).toBe("single-article");
    expect(f.main.text).toBe("Art head Body text");
  });

  it("does not treat two articles, or nested articles, as a single article", () => {
    const two = extract(doc("<article>One</article><article>Two</article>"));
    expect(two.main.method).toBe("body-fallback");
    expect(two.main.text).toBe("One Two");
    const nested = extract(doc("<article>Outer <article>Inner</article></article>"));
    expect(nested.main.method).toBe("body-fallback");
  });

  it("uses the body minus boilerplate when nothing else matches", () => {
    const body =
      "<header>HeaderText</header>" +
      "<nav>NavText</nav>" +
      "<aside>AsideText</aside>" +
      '<div role="banner">BannerRole</div>' +
      '<div role="navigation">NavRole</div>' +
      '<div role="contentinfo">ContentinfoRole</div>' +
      '<div role="complementary">ComplementaryRole</div>' +
      '<div id="cookie-notice">CookieId</div>' +
      '<div class="site-Consent">ConsentClass</div>' +
      '<div class="hero-banner">BannerClass</div>' +
      '<div class="newsletter-popup">PopupClass</div>' +
      '<div id="Modal1">ModalId</div>' +
      "<p>KeepMe one two three</p>" +
      "<footer>FooterText</footer>";
    const f = extract(doc(body));
    expect(f.main.method).toBe("body-fallback");
    expect(f.main.text).toBe("KeepMe one two three");
    expect(f.visibleText).toContain("HeaderText");
    expect(f.visibleText).toContain("ModalId");
  });

  it("applies the boilerplate exclusions only to the body fallback", () => {
    const f = extract(doc('<main><div class="cookie-banner">InsideMain</div><nav>MainNav</nav></main>'));
    expect(f.main.method).toBe("main");
    expect(f.main.text).toBe("InsideMain MainNav");
  });

  it("does not let a boilerplate-looking class on <body> remove the whole page", () => {
    const html =
      '<!doctype html><html lang="en" class="modal-open"><head><title>t</title></head>' +
      '<body class="modal-open cookie-consent"><p>Real content words here</p></body></html>';
    const f = extract(html);
    expect(f.main.text).toBe("Real content words here");
  });

  it("ignores a hidden <main>", () => {
    const f = extract(doc("<main hidden>Hidden main</main><p>Shown text</p>"));
    expect(f.main.method).toBe("body-fallback");
    expect(f.main.text).toBe("Shown text");
  });

  it("returns empty main facts for an empty body", () => {
    const f = extract(doc(""));
    expect(f.main.text).toBe("");
    expect(f.main.wordCount).toBe(0);
    expect(f.main.lead200).toBe("");
    expect(f.main.textHash).toBe(sha256(""));
    expect(f.main.sentences).toEqual({ count: 0, medianWords: null });
    expect(f.main.paragraphStats).toEqual({ count: 0, medianWords: null });
  });

  it("hashes the normalised main text so markup and spacing do not matter", () => {
    const a = extract(doc("<main><p>Hello   world</p></main>"));
    const b = extract(doc("<main><div>Hello <b>world</b></div></main>"));
    const c = extract(doc("<main><p>Hello there</p></main>"));
    expect(a.main.textHash).toBe(sha256("Hello world"));
    expect(b.main.textHash).toBe(a.main.textHash);
    expect(c.main.textHash).not.toBe(a.main.textHash);
    expect(a.main.textHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("word counts, lead text, paragraphs and sentences", () => {
  it("counts only tokens that hold a letter or a number", () => {
    const f = extract(doc("<main><p>one — two | three • four ... 5</p></main>"));
    expect(f.main.wordCount).toBe(5);
  });

  it("lead200 ends with the 200th counted word", () => {
    const f = extract(doc(`<main><p>${numbered(250)}</p></main>`));
    expect(f.main.wordCount).toBe(250);
    expect(f.main.lead200).toBe(numbered(200));
  });

  it("lead200 is the whole text when there are fewer than 200 words", () => {
    const f = extract(doc(`<main><p>${numbered(40)}</p></main>`));
    expect(f.main.lead200).toBe(numbered(40));
  });

  it("records paragraph facts for <p> inside main only, with sentence counts and the preceding heading", () => {
    const body =
      "<header><p>Header para here</p></header>" +
      "<main>" +
      "<p>Intro before any heading. Two sentences.</p>" +
      "<h1>Title</h1>" +
      "<p>Para one has five words.</p>" +
      "<p></p><p> — </p>" +
      "<h2>Sub</h2>" +
      "<p>Alpha beta! Gamma delta? Epsilon zeta.</p>" +
      "</main>" +
      "<footer><p>Footer para</p></footer>";
    const f = extract(doc(body));
    expect(f.main.paragraphs).toEqual([
      { index: 0, wordCount: 6, sentenceCount: 2, precedingHeadingIndex: null },
      { index: 1, wordCount: 5, sentenceCount: 1, precedingHeadingIndex: 0 },
      { index: 2, wordCount: 6, sentenceCount: 3, precedingHeadingIndex: 1 },
    ]);
    expect(f.main.paragraphStats).toEqual({ count: 3, medianWords: 6 });
    expect(f.main.sentences).toEqual({ count: 6, medianWords: 2 });
  });

  it("counts a paragraph inside a list item and ignores a hidden paragraph", () => {
    const f = extract(doc("<main><ul><li><p>List item paragraph here</p></li></ul><p hidden>Hidden paragraph words</p></main>"));
    expect(f.main.paragraphs).toHaveLength(1);
    expect(f.main.paragraphs[0].wordCount).toBe(4);
  });

  it("computes medians over even counts as the mean of the two middle values", () => {
    const f = extract(doc("<main><p>a b</p><p>c d e f</p></main>"));
    expect(f.main.paragraphStats).toEqual({ count: 2, medianWords: 3 });
  });
});

describe("language and word-count applicability", () => {
  it.each([
    ["en", true],
    ["en-IE", true],
    ["ga", true],
    ["zh", false],
    ["zh-Hans", false],
    ["ja", false],
    ["JA-JP", false],
    ["ko", false],
    ["th", false],
  ])("lang %s gives wordCountApplicable %s", (lang, applicable) => {
    const f = extract(doc("<main><p>Some text here</p></main>", { lang }));
    expect(f.wordCountApplicable).toBe(applicable);
  });

  it("extracts a Japanese page without error and reports its language", () => {
    const text = cp(0x6e2f, 0x753a, 0x306e, 0x30b3, 0x30fc, 0x30d2, 0x30fc);
    const f = extract(doc(`<main><h1>${text}</h1><p>${text}。${text}</p></main>`, { lang: "ja", title: text }));
    expect(f.head.langPrimary).toBe("ja");
    expect(f.wordCountApplicable).toBe(false);
    expect(f.headings[0].text).toBe(text);
    expect(f.head.titles[0].chars).toBe(7);
  });

  it("bases the render verdict on markers alone for CJK pages", () => {
    const shell = extract(doc('<div id="root"></div>', { lang: "ja" }));
    expect(shell.render.renderDependent).toBe(true);
    expect(shell.render.spaRootMarkers).toEqual(["#root"]);
    expect(shell.render.reasons.some((r) => /markers alone/.test(r))).toBe(true);

    const content = extract(doc(`<main><p>${jp(200)}</p></main>`, { lang: "ja" }));
    expect(content.render.renderDependent).toBe(false);

    const withMessage = extract(doc(`<main><p>${jp(200)}</p></main><noscript>Please enable JavaScript</noscript>`, { lang: "zh-Hans" }));
    expect(withMessage.render.renderDependent).toBe(true);

    const populated = extract(doc(`<div id="root"><p>${jp(60)}</p></div>`, { lang: "ko" }));
    expect(populated.render.spaRootMarkers).toEqual([]);
    expect(populated.render.renderDependent).toBe(false);
  });
});

describe("render dependence (4.2.6)", () => {
  it.each([
    ["#root", '<div id="root"></div>'],
    ["#app", '<div id="app"></div>'],
    ["#__next", '<div id="__next"></div>'],
    ["#__nuxt", '<div id="__nuxt"></div>'],
    ["[data-reactroot]", '<div data-reactroot=""></div>'],
    ["[ng-version]", '<app-root ng-version="17.0.0"></app-root>'],
  ])("an empty %s root on a thin page is render-dependent", (selector, markup) => {
    const f = extract(doc(markup));
    expect(f.render.renderDependent).toBe(true);
    expect(f.render.spaRootMarkers).toEqual([selector]);
    expect(f.render.mainWordCount).toBe(0);
  });

  it.each([
    "You need to enable JavaScript to run this app.",
    "This site requires JavaScript.",
    "JavaScript is required",
    "JavaScript required",
    "JavaScript is disabled",
    "javascript disabled",
    "Please ENABLE   JavaScript",
  ])("a thin page with the noscript message %j is render-dependent", (message) => {
    const f = extract(doc(`<p>Hello</p><noscript>${message}</noscript>`));
    expect(f.render.noscriptJsMessages).toHaveLength(1);
    expect(f.render.renderDependent).toBe(true);
  });

  it("counts a JavaScript message in a noscript element in the head", () => {
    const f = extract(doc("<p>Hello</p>", { head: "<noscript>Enable JavaScript</noscript>" }));
    expect(f.render.renderDependent).toBe(true);
  });

  it("strips markup inside noscript before matching and ignores noscript without a message", () => {
    const withTag = extract(doc("<noscript><p>Please <b>enable</b> JavaScript</p></noscript>"));
    expect(withTag.render.noscriptJsMessages).toEqual(["Please enable JavaScript"]);
    const pixel = extract(doc('<noscript><img src="https://example.com/pixel.gif"></noscript>'));
    expect(pixel.render.noscriptJsMessages).toEqual([]);
    expect(pixel.render.renderDependent).toBe(false);
  });

  it("does not flag a thin page that has no marker", () => {
    const f = extract(doc("<main><p>Just a short page.</p></main>"));
    expect(f.render.renderDependent).toBe(false);
    expect(f.render.mainWordCount).toBe(4);
    expect(f.render.spaRootMarkers).toEqual([]);
    expect(f.render.noscriptJsMessages).toEqual([]);
  });

  it("does not flag a page with 50 or more words even when a marker is present", () => {
    const ssr = extract(doc(`<div id="__next"><main><p>${words(60)}</p></main></div><noscript>Enable JavaScript</noscript>`));
    expect(ssr.render.mainWordCount).toBe(60);
    expect(ssr.render.renderDependent).toBe(false);
    expect(ssr.render.spaRootMarkers).toEqual([]);
    expect(ssr.render.reasons.some((r) => r.includes("#__next") && r.includes("server-rendered"))).toBe(true);
  });

  it("uses a threshold of exactly 50 words in main content", () => {
    const below = extract(doc(`<div id="root"></div><main><p>${words(49)}</p></main>`));
    expect(below.render.mainWordCount).toBe(49);
    expect(below.render.renderDependent).toBe(true);
    const at = extract(doc(`<div id="root"></div><main><p>${words(50)}</p></main>`));
    expect(at.render.mainWordCount).toBe(50);
    expect(at.render.renderDependent).toBe(false);
  });

  it("ignores a hidden framework root", () => {
    const f = extract(doc('<div id="root" hidden></div><p>Short</p>'));
    expect(f.render.spaRootMarkers).toEqual([]);
    expect(f.render.renderDependent).toBe(false);
  });

  it("explains the verdict in reasons", () => {
    const f = extract(doc('<div id="root"></div><noscript>You need to enable JavaScript</noscript>'));
    expect(f.render.reasons.join(" | ")).toMatch(/below 50/);
    expect(f.render.reasons.join(" | ")).toMatch(/#root/);
    expect(f.render.reasons.join(" | ")).toMatch(/noscript message/);
  });

  it("strips bidirectional overrides from the recorded noscript message", () => {
    const f = extract(doc("<noscript>Please enable&#x202E; JavaScript&#x2066;</noscript>"));
    expect(f.render.noscriptJsMessages).toEqual(["Please enable JavaScript"]);
    const literal = extract(doc("<noscript>Please enable" + cp(0x202e) + " JavaScript" + cp(0x2067) + "</noscript>"));
    expect(literal.render.noscriptJsMessages).toEqual(["Please enable JavaScript"]);
  });

  it("decodes character references inside noscript before matching the message", () => {
    const nbsp = extract(doc("<p>Hi</p><noscript>Please&nbsp;enable&nbsp;JavaScript &amp; reload</noscript>"));
    expect(nbsp.render.noscriptJsMessages).toEqual(["Please enable JavaScript & reload"]);
    expect(nbsp.render.renderDependent).toBe(true);
    const numeric = extract(doc("<p>Hi</p><noscript>JavaScript&#32;is&#x20;required</noscript>"));
    expect(numeric.render.renderDependent).toBe(true);
    const zeroWidth = extract(doc("<p>Hi</p><noscript>Enable Java&#x200B;Script</noscript>"));
    expect(zeroWidth.render.renderDependent).toBe(true);
  });

  it("matches a noscript message that is split across inline markup", () => {
    const f = extract(doc("<p>Hi</p><noscript><div class='msg'><strong>JavaScript</strong> <em>is</em> required</div></noscript>"));
    expect(f.render.noscriptJsMessages).toEqual(["JavaScript is required"]);
  });

  it("looks only at the first 50 noscript elements and records at most 5 messages", () => {
    const filler = "<noscript>tracking pixel</noscript>".repeat(60);
    const late = extract(doc(`<p>Hi</p>${filler}<noscript>Enable JavaScript</noscript>`));
    expect(late.render.noscriptJsMessages).toEqual([]);
    const messages = Array.from({ length: 10 }, (_, i) => `<noscript>Enable JavaScript ${i}</noscript>`).join("");
    const many = extract(doc(`<p>Hi</p>${messages}`));
    expect(many.render.noscriptJsMessages).toHaveLength(5);
  });
});

describe("headings", () => {
  it("records level, text, document index and whether the heading is inside main", () => {
    const body =
      "<header><h2>Site</h2></header>" +
      "<main><h1>  Main <em>Title</em> <span hidden>no</span> </h1><h2></h2><h3>Deep</h3></main>" +
      "<template><h4>Template heading</h4></template>" +
      "<footer><h5>Foot</h5></footer>";
    const f = extract(doc(body));
    expect(f.headings).toEqual([
      { level: 2, text: "Site", index: 0, inMain: false },
      { level: 1, text: "Main Title", index: 1, inMain: true },
      { level: 2, text: "", index: 2, inMain: true },
      { level: 3, text: "Deep", index: 3, inMain: true },
      { level: 5, text: "Foot", index: 4, inMain: false },
    ]);
  });

  it("omits hidden headings", () => {
    const f = extract(doc('<main><h1>Shown</h1><h2 hidden>Hidden</h2><div style="display:none"><h2>Also hidden</h2></div></main>'));
    expect(f.headings.map((h) => h.text)).toEqual(["Shown"]);
  });

  it("marks headings in excluded boilerplate as outside main when the body is the fallback", () => {
    const f = extract(doc("<nav><h2>Menu</h2></nav><h1>Page</h1><footer><h2>Foot</h2></footer>"));
    expect(f.main.method).toBe("body-fallback");
    expect(f.headings.map((h) => [h.text, h.inMain])).toEqual([
      ["Menu", false],
      ["Page", true],
      ["Foot", false],
    ]);
  });

  it("keeps heading levels in document order so skips can be found", () => {
    const f = extract(doc("<main><h1>A</h1><h2>B</h2><h4>C</h4><h2>D</h2></main>"));
    expect(f.headings.map((h) => h.level)).toEqual([1, 2, 4, 2]);
  });
});

describe("links", () => {
  it("records href, resolved URL, same-site flag and fragment-only flag", () => {
    const body =
      '<a href="/about">About</a>' +
      '<a href="https://example.com/x">Bare host</a>' +
      '<a href="https://other.org/p#frag">Other</a>' +
      '<a href="#top">Top</a>' +
      '<a href="mailto:a@b.com">Mail</a>' +
      '<a href="tel:123">Tel</a>' +
      '<a href="javascript:void(0)">Js</a>' +
      '<a href="  /spaced  ">Spaced</a>' +
      '<a href="http://[bad">Bad</a>' +
      '<a name="anchor">No href</a>';
    const f = extract(doc(body), "https://www.example.com/page/");
    expect(f.links.map((l) => l.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    const by = (name: string) => f.links.find((l) => l.name === name)!;
    expect(by("About")).toMatchObject({ href: "/about", url: "https://www.example.com/about", sameSite: true, fragmentOnly: false });
    expect(by("Bare host")).toMatchObject({ url: "https://example.com/x", sameSite: true });
    expect(by("Other")).toMatchObject({ url: "https://other.org/p", sameSite: false, fragmentOnly: false });
    expect(by("Top")).toMatchObject({ href: "#top", url: "https://www.example.com/page", sameSite: true, fragmentOnly: true });
    for (const name of ["Mail", "Tel", "Js", "Bad"]) {
      expect(by(name).url, name).toBeNull();
      expect(by(name).sameSite, name).toBe(false);
    }
    expect(by("Spaced")).toMatchObject({ href: "/spaced", url: "https://www.example.com/spaced" });
  });

  it("derives the accessible name from text, then aria-label, then image alt", () => {
    const body =
      '<a href="/1">  Visible   <b>text</b> </a>' +
      '<a href="/2" aria-label="Aria name"><svg width="1" height="1"></svg></a>' +
      '<a href="/3"><img src="/i.png" alt="Alt name"></a>' +
      '<a href="/4" aria-label="Aria wins"><img src="/i.png" alt="Alt loses"></a>' +
      '<a href="/5"><img src="/i.png"></a>' +
      '<a href="/6"><img src="/i.png" alt=""></a>' +
      '<a href="/7"><span hidden>unseen</span></a>' +
      '<a href="/8" aria-label="  ">  </a>';
    const f = extract(doc(body));
    expect(f.links.map((l) => [l.name, l.nameSource])).toEqual([
      ["Visible text", "text"],
      ["Aria name", "aria-label"],
      ["Alt name", "img-alt"],
      ["Aria wins", "aria-label"],
      ["", "none"],
      ["", "none"],
      ["", "none"],
      ["", "none"],
    ]);
  });

  it("assigns location with the precedence nav, footer, main, other", () => {
    const body =
      '<header><a href="/h">Head</a></header>' +
      '<nav><a href="/n">Nav</a></nav>' +
      "<main>" +
      '<a href="/m">Main</a>' +
      '<nav><a href="/mn">MainNav</a></nav>' +
      '<footer><a href="/mf">MainFooter</a></footer>' +
      "</main>" +
      '<footer><a href="/f">Foot</a><nav><a href="/fn">FootNav</a></nav></footer>' +
      '<div role="navigation"><a href="/rn">RoleNav</a></div>' +
      '<div role="contentinfo"><a href="/ci">Contentinfo</a></div>' +
      '<a href="/o">Other</a>';
    const f = extract(doc(body));
    expect(f.links.map((l) => [l.name, l.location])).toEqual([
      ["Head", "other"],
      ["Nav", "nav"],
      ["Main", "main"],
      ["MainNav", "nav"],
      ["MainFooter", "footer"],
      ["Foot", "footer"],
      ["FootNav", "nav"],
      ["RoleNav", "nav"],
      ["Contentinfo", "footer"],
      ["Other", "other"],
    ]);
  });

  it("records rel tokens in lowercase", () => {
    const f = extract(doc('<a href="/x" rel="NoFollow  Sponsored UGC">x</a><a href="/y">y</a>'));
    expect(f.links[0].rel).toEqual(["nofollow", "sponsored", "ugc"]);
    expect(f.links[1].rel).toEqual([]);
  });

  it("omits links inside hidden content", () => {
    const f = extract(doc('<a href="/shown">Shown</a><div hidden><a href="/hidden">Hidden</a></div><template><a href="/t">T</a></template>'));
    expect(f.links.map((l) => l.name)).toEqual(["Shown"]);
  });

  it("counts same-site, non-fragment links in each navigation block", () => {
    const body =
      '<nav><a href="/a">A</a><a href="https://other.com/">Ext</a><a href="#x">Frag</a><a href="mailto:a@b.co">M</a><a href="/b">B</a></nav>' +
      '<div role="navigation"><a href="/c">C</a></div>' +
      "<nav></nav>" +
      '<nav><ul><li><a href="/d">D</a></li><li><nav><a href="/e">E</a></nav></li></ul></nav>';
    const f = extract(doc(body));
    expect(f.navigations).toEqual([
      { source: "nav", sameSiteLinkCount: 2 },
      { source: "role", sameSiteLinkCount: 1 },
      { source: "nav", sameSiteLinkCount: 0 },
      { source: "nav", sameSiteLinkCount: 2 },
      { source: "nav", sameSiteLinkCount: 1 },
    ]);
  });
});

describe("images", () => {
  it("records alt state and decides which images are content images", () => {
    const body =
      '<img src="/a.png" alt="A cat">' +
      '<img src="/b.png" alt="">' +
      '<img src="/c.png">' +
      '<img src="/d.png" alt="x" role="presentation">' +
      '<img src="/e.png" alt="x" aria-hidden="true">' +
      '<img src="/f.png" alt="x" width="1" height="1">' +
      '<img src="/g.png" alt="x" width="2">' +
      '<img src="/h.png" alt="x" height="2px">' +
      '<img src="/i.png" alt="x" width="3" height="3">' +
      '<img src="/j.png" alt="x" width="100%">' +
      '<img src="/k.png" alt="x" role="Presentation none">' +
      '<img src="/l.png" alt="x" aria-hidden="false">' +
      '<picture hidden><img src="/hidden.png" alt="x"></picture>';
    const f = extract(doc(body));
    expect(f.images).toHaveLength(12);
    const byStem = (stem: string) => f.images.find((i) => i.src === `/${stem}.png`)!;
    expect(byStem("a")).toMatchObject({ hasAlt: true, alt: "A cat", isContent: true, role: null, ariaHidden: false });
    expect(byStem("b")).toMatchObject({ hasAlt: true, alt: "", isContent: true });
    expect(byStem("c")).toMatchObject({ hasAlt: false, alt: null, isContent: true });
    expect(byStem("d")).toMatchObject({ role: "presentation", isContent: false });
    expect(byStem("e")).toMatchObject({ ariaHidden: true, isContent: false });
    expect(byStem("f")).toMatchObject({ width: 1, height: 1, isContent: false });
    expect(byStem("g")).toMatchObject({ width: 2, height: null, isContent: false });
    expect(byStem("h")).toMatchObject({ width: null, height: 2, isContent: false });
    expect(byStem("i")).toMatchObject({ width: 3, height: 3, isContent: true });
    expect(byStem("j")).toMatchObject({ width: null, isContent: true });
    expect(byStem("k").isContent).toBe(false);
    expect(byStem("l")).toMatchObject({ ariaHidden: false, isContent: true });
    expect(f.images.map((i) => i.index)).toEqual(Array.from({ length: 12 }, (_, i) => i));
  });
});

describe("lists and tables", () => {
  it("records lists inside main only, nested lists separately", () => {
    const body =
      "<header><ul><li>h1</li></ul></header>" +
      "<main>" +
      "<ul><li>a</li><li>b</li><li>c<ul><li>n1</li><li>n2</li></ul></li></ul>" +
      "<ol><li>x</li><li>y</li></ol>" +
      "<ul hidden><li>hidden</li></ul>" +
      "</main>";
    const f = extract(doc(body));
    expect(f.lists).toEqual([
      { ordered: false, items: 3 },
      { ordered: false, items: 2 },
      { ordered: true, items: 2 },
    ]);
  });

  it("excludes boilerplate lists when the body is the fallback main", () => {
    const f = extract(doc("<nav><ul><li>menu</li><li>menu</li><li>menu</li></ul></nav><ul><li>one</li><li>two</li><li>three</li></ul>"));
    expect(f.main.method).toBe("body-fallback");
    expect(f.lists).toEqual([{ ordered: false, items: 3 }]);
  });

  it("records tables inside main with header cells and rows", () => {
    const body =
      "<header><table><tr><th>H</th></tr></table></header>" +
      "<main>" +
      "<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr><tr><td>3</td><td>4</td></tr></tbody></table>" +
      "<table><tr><td>no header</td></tr></table>" +
      "<table><tr><td><table><tr><th>inner</th></tr></table></td></tr></table>" +
      "</main>";
    const f = extract(doc(body));
    expect(f.tables).toEqual([
      { headerCells: 2, rows: 3 },
      { headerCells: 0, rows: 1 },
      { headerCells: 0, rows: 1 },
      { headerCells: 1, rows: 1 },
    ]);
  });
});

describe("FAQ pair detection", () => {
  it("counts details and summary pairs that have both a question and an answer", () => {
    const body =
      "<main>" +
      "<details><summary>What is it?</summary><p>An answer.</p></details>" +
      "<details open><summary>Pricing</summary>Answer text</details>" +
      "<details><summary>No answer here</summary></details>" +
      "<details><summary></summary><p>Answer without question</p></details>" +
      "</main>" +
      "<footer><details><summary>Outside?</summary><p>Not counted</p></details></footer>";
    const f = extract(doc(body));
    expect(f.faq.detailsSummary).toEqual({ pairs: 2, questionPairs: 1 });
  });

  it("counts dt and dd pairs, using the first dd of a term and the latest dt before a dd", () => {
    const body =
      "<main><dl>" +
      "<dt>How long does it take?</dt><dd>Two weeks.</dd>" +
      "<dt>Cost</dt><dd>Free</dd><dd>Second definition</dd>" +
      "<dt>Orphan term</dt>" +
      "<dt>Why?</dt><dd></dd>" +
      "</dl></main>";
    const f = extract(doc(body));
    expect(f.faq.definitionList).toEqual({ pairs: 2, questionPairs: 1 });
  });

  it("counts headings followed by a paragraph, and separately those in question form", () => {
    const body =
      "<main>" +
      "<h2>What do you do?</h2><p>We help.</p>" +
      "<h2>Our team</h2><p>Great people.</p>" +
      "<h3>Why us</h3>" +
      "<h2>Where are you?</h2><ul><li>Kildare</li></ul>" +
      "<h2>How much is it?</h2><div>no p here</div><p>Late paragraph still belongs.</p>" +
      "</main>" +
      "<footer><h2>Is this counted?</h2><p>No, it is outside main.</p></footer>";
    const f = extract(doc(body));
    expect(f.faq.headingParagraph).toEqual({ pairs: 3, questionPairs: 2 });
  });

  it("reports zero pairs when there is nothing to detect", () => {
    const f = extract(doc("<main><p>Plain text.</p></main>"));
    expect(f.faq).toEqual({
      detailsSummary: { pairs: 0, questionPairs: 0 },
      definitionList: { pairs: 0, questionPairs: 0 },
      headingParagraph: { pairs: 0, questionPairs: 0 },
    });
  });
});

describe("bylines and time elements", () => {
  it.each([
    ["rel=author link", '<a rel="author" href="/me">Jane</a>', { relAuthor: true, itempropAuthor: false, classMatch: false }],
    ["itemprop=author", '<span itemprop="author">Jane</span>', { relAuthor: false, itempropAuthor: true, classMatch: false }],
    ["class byline", '<span class="post-byline">Jane</span>', { relAuthor: false, itempropAuthor: false, classMatch: true }],
    ["class author", '<div class="author">Jane</div>', { relAuthor: false, itempropAuthor: false, classMatch: true }],
    ["class author segment", '<div class="entry-meta author_name">Jane</div>', { relAuthor: false, itempropAuthor: false, classMatch: true }],
    ["class authority is not a match", '<div class="authority">Jane</div>', { relAuthor: false, itempropAuthor: false, classMatch: false }],
    ["class coauthors is not a match", '<div class="coauthors">Jane</div>', { relAuthor: false, itempropAuthor: false, classMatch: false }],
    ["rel=author on a non-link is not a match", '<span rel="author">Jane</span>', { relAuthor: false, itempropAuthor: false, classMatch: false }],
    ["meta itemprop=author is not visible", '<meta itemprop="author" content="Jane">', { relAuthor: false, itempropAuthor: false, classMatch: false }],
  ])("%s", (_label, markup, expected) => {
    const f = extract(doc(`<main>${markup}<p>${words(60)}</p></main>`));
    expect(f.byline).toMatchObject(expected);
  });

  it("detects 'By ' in the first 400 characters of main", () => {
    const f = extract(doc("<main><h1>Title</h1><p>By Jane Doe, 5 March</p><p>More text follows.</p></main>"));
    expect(f.byline.byTextInFirst400).toBe(true);
    expect(f.byline.sample).toBe("By Jane Doe, 5 March More text follows.");
  });

  it("accepts 'Posted by' but not words that merely contain 'by'", () => {
    expect(extract(doc("<main><p>Posted by Jane</p></main>")).byline.byTextInFirst400).toBe(true);
    expect(extract(doc("<main><p>Standby mode and bypass lanes</p></main>")).byline.byTextInFirst400).toBe(false);
    expect(extract(doc("<main><p>Nearby places</p></main>")).byline.byTextInFirst400).toBe(false);
  });

  it("ignores 'By ' that appears after the first 400 characters", () => {
    const f = extract(doc(`<main><p>${words(100)}</p><p>By Jane</p></main>`));
    expect(f.byline.byTextInFirst400).toBe(false);
    expect(f.byline.sample).toBeNull();
  });

  it("takes the byline sample from the byline element and strips bidirectional overrides", () => {
    const f = extract(doc('<main><p class="byline">By <a href="/jane">Jane&#x202E;Doe</a> on 5 March</p><p>Text.</p></main>'));
    expect(f.byline.classMatch).toBe(true);
    expect(f.byline.sample).toBe("By JaneDoe on 5 March");
  });

  it("records time elements with parsed UTC value, location and itemprop", () => {
    const body =
      '<header><time datetime="2024-01-02">Jan</time></header>' +
      "<main>" +
      '<p class="byline"><time datetime="2024-03-05T10:00:00+01:00" itemprop="datePublished">5 Mar</time></p>' +
      '<time datetime="2024-04-01T00:00:00Z" itemprop="dateModified">Apr</time>' +
      '<time datetime="not a date">x</time>' +
      "<time>no attribute</time>" +
      '<time datetime="2024-02-30">bad day</time>' +
      "</main>" +
      '<footer><time datetime="2023-12-31T23:59:59Z">Dec</time></footer>';
    const f = extract(doc(body));
    expect(f.times).toEqual([
      { datetime: "2024-01-02", parsed: "2024-01-02T00:00:00.000Z", location: "header", itemprop: null },
      { datetime: "2024-03-05T10:00:00+01:00", parsed: "2024-03-05T09:00:00.000Z", location: "byline", itemprop: "datePublished" },
      { datetime: "2024-04-01T00:00:00Z", parsed: "2024-04-01T00:00:00.000Z", location: "main", itemprop: "dateModified" },
      { datetime: "not a date", parsed: null, location: "main", itemprop: null },
      { datetime: "2024-02-30", parsed: null, location: "main", itemprop: null },
      { datetime: "2023-12-31T23:59:59Z", parsed: "2023-12-31T23:59:59.000Z", location: "other", itemprop: null },
    ]);
  });
});

describe("contact facts", () => {
  it("collects mailto and tel targets, e-mail addresses in text, and address lengths", () => {
    const body =
      '<a href="mailto:Info@Example.com?subject=Hi">Mail</a>' +
      '<a href="MAILTO:a@b.co,c@d.co">Multi</a>' +
      '<a href="mailto:info@example.com">Dup</a>' +
      '<a href="tel:+353 1 234 5678">Call</a>' +
      '<a href="tel:+353-1-234-5678">Call2</a>' +
      "<p>Write to sales@example.org or sales@example.org again, or john.doe+x@sub.example.co.uk.</p>" +
      "<p>Not emails: a@b, @handle, foo@.com, x@@y.com</p>" +
      "<address>10 Main Street, Kilcock</address>" +
      "<address>Short</address>" +
      "<address hidden>Hidden address text is long</address>";
    const f = extract(doc(body));
    expect(f.contact.mailto).toEqual(["info@example.com", "a@b.co", "c@d.co"]);
    expect(f.contact.tel).toEqual(["+353 1 234 5678", "+353-1-234-5678"]);
    expect(f.contact.emailsInText).toBe(2);
    expect(f.contact.addressTextLengths).toEqual([23, 5]);
  });

  it("returns empty contact facts for a page without contact details", () => {
    const f = extract(doc("<p>Hello</p>"));
    expect(f.contact).toEqual({ mailto: [], tel: [], emailsInText: 0, addressTextLengths: [] });
  });
});

describe("mixed content", () => {
  const mixedBody =
    '<iframe src="http://frames.example/"></iframe>' +
    '<img src="http://img.example/a.png">' +
    '<video src="http://v.example/v.mp4"><source src="http://v.example/v.webm"></video>' +
    '<audio src="http://a.example/a.mp3"></audio>' +
    '<a href="http://plain.example/">plain link</a>' +
    '<img src="//proto.example/p.png">' +
    '<script src="https://secure.example/s.js"></script>' +
    '<img src="/relative.png">';
  const mixedHead =
    '<link rel="stylesheet" href="http://cdn.example/a.css">' +
    '<link rel="icon" href="http://cdn.example/fav.ico">' +
    '<link rel="preload" href="http://cdn.example/y" as="script">' +
    '<script src="http://cdn.example/a.js"></script>';

  it("flags http subresources on an https page as active or passive", () => {
    const f = extract(doc(mixedBody, { head: mixedHead }), "https://example.com/");
    expect(f.mixedContent.map((m) => `${m.tag}:${m.kind}`)).toEqual([
      "link:active",
      "script:active",
      "iframe:active",
      "img:passive",
      "video:passive",
      "source:passive",
      "audio:passive",
    ]);
    expect(f.mixedContent[1].url).toBe("http://cdn.example/a.js");
  });

  it("records nothing on an http page", () => {
    const f = extract(doc(mixedBody, { head: mixedHead }), "http://example.com/");
    expect(f.mixedContent).toEqual([]);
  });

  it("resolves relative references against an http <base>", () => {
    const f = extract(doc('<img src="a.png">', { head: '<base href="http://assets.example/">' }), "https://example.com/");
    expect(f.mixedContent).toEqual([{ url: "http://assets.example/a.png", tag: "img", kind: "passive" }]);
  });
});

describe("JSON-LD", () => {
  const graph =
    '{"@context":"https://schema.org","@graph":[' +
    '{"@type":"Organization","@id":"https://example.com/#org","name":"Acme","founder":{"@type":"Person","name":"Jo"}},' +
    '{"@type":["WebSite","CreativeWork"],"@id":"/#website","publisher":{"@id":"https://example.com/#org"}},' +
    '{"@type":"https://schema.org/Service","name":"S"},' +
    '{"@type":"schema:Thing"}' +
    "]}";

  it("flattens @graph into nodes with paths, depths, ids, resolved IRIs, types and references", () => {
    const f = extract(doc("", { head: ldScript(graph) }));
    expect(f.jsonLd.blocksSeen).toBe(1);
    const block = f.jsonLd.blocks[0];
    expect(block).toMatchObject({ index: 0, parsedOk: true, reason: null, schemaOrgContext: true, hasTypeOrGraph: true });
    expect(block.rawLength).toBe(graph.length);
    expect(block.value).toEqual(JSON.parse(graph));
    expect(block.nodes.map((n) => [n.path, n.types, n.id, n.iri, n.depth, n.isReference])).toEqual([
      ["@graph[0]", ["Organization"], "https://example.com/#org", "https://example.com/#org", 2, false],
      ["@graph[0].founder", ["Person"], null, null, 3, false],
      ["@graph[1]", ["WebSite", "CreativeWork"], "/#website", "https://example.com/#website", 2, false],
      ["@graph[1].publisher", [], "https://example.com/#org", "https://example.com/#org", 3, true],
      ["@graph[2]", ["Service"], null, null, 2, false],
      ["@graph[3]", ["Thing"], null, null, 2, false],
    ]);
    expect(block.nodes[0].properties).toMatchObject({ name: "Acme" });
  });

  it("indexes a top-level node and a top-level array of nodes", () => {
    const single = extract(doc("", { head: ldScript('{"@context":"https://schema.org","@type":"Thing","name":"x"}') }));
    expect(single.jsonLd.blocks[0].nodes.map((n) => [n.path, n.depth])).toEqual([["", 0]]);

    const array = extract(
      doc("", {
        head: ldScript('[{"@context":"https://schema.org","@type":"Thing"},{"@context":"https://schema.org","@type":"Other"}]'),
      }),
    );
    expect(array.jsonLd.blocks[0].parsedOk).toBe(true);
    expect(array.jsonLd.blocks[0].nodes.map((n) => [n.path, n.types[0]])).toEqual([
      ["[0]", "Thing"],
      ["[1]", "Other"],
    ]);
  });

  it("resolves relative @id values against the base URL and leaves blank nodes without an IRI", () => {
    const html = doc("", { head: ldScript('{"@context":"https://schema.org","@type":"Thing","@id":"#me","sameAs":{"@id":"_:b0"}}') });
    const f = extract(html, "https://example.com/team/");
    const [node, blank] = f.jsonLd.blocks[0].nodes;
    expect(node.iri).toBe("https://example.com/team/#me");
    expect(blank.id).toBe("_:b0");
    expect(blank.iri).toBeNull();
    expect(blank.isReference).toBe(true);
  });

  it.each([
    ['"https://schema.org"', true],
    ['"http://schema.org/"', true],
    ['"https://www.schema.org"', true],
    ['["https://schema.org",{"@language":"en"}]', true],
    ['{"@vocab":"https://schema.org/"}', true],
    ['"https://schema.org.evil.example/"', false],
    ['"https://example.com/context"', false],
    ['"schema.org"', false],
    ["42", false],
  ])("detects a schema.org @context in %s as %s", (context, expected) => {
    const f = extract(doc("", { head: ldScript(`{"@context":${context},"@type":"Thing"}`) }));
    expect(f.jsonLd.blocks[0].parsedOk).toBe(true);
    expect(f.jsonLd.blocks[0].schemaOrgContext).toBe(expected);
  });

  it("flags blocks that lack @type and @graph, or lack a schema.org @context", () => {
    const noType = extract(doc("", { head: ldScript('{"@context":"https://schema.org","name":"x"}') })).jsonLd.blocks[0];
    expect(noType).toMatchObject({ parsedOk: true, hasTypeOrGraph: false, schemaOrgContext: true });
    expect(noType.nodes).toEqual([]);
    const noContext = extract(doc("", { head: ldScript('{"@type":"Thing"}') })).jsonLd.blocks[0];
    expect(noContext).toMatchObject({ parsedOk: true, hasTypeOrGraph: true, schemaOrgContext: false });
    const graphOnly = extract(doc("", { head: ldScript('{"@context":"https://schema.org","@graph":[]}') })).jsonLd.blocks[0];
    expect(graphOnly).toMatchObject({ parsedOk: true, hasTypeOrGraph: true });
  });

  it.each([
    ["trailing comma", '{"@type":"Thing",}'],
    ["single quotes", "{'@type':'Thing'}"],
    ["HTML comment wrapper", '<!-- {"@type":"Thing"} -->'],
    ["JavaScript comment", '{"@type":"Thing"} // note'],
    ["truncated", '{"@type":"Thing","name":"x'],
    ["plain text", "not json"],
  ])("records %s as invalid_json without nodes", (_label, json) => {
    const f = extract(doc("", { head: ldScript(json) }));
    const block = f.jsonLd.blocks[0];
    expect(block).toMatchObject({ parsedOk: false, reason: "invalid_json", value: null, nodes: [] });
  });

  it("records empty and non-object blocks with their own reasons", () => {
    expect(extract(doc("", { head: ldScript("") })).jsonLd.blocks[0].reason).toBe("empty");
    expect(extract(doc("", { head: ldScript("  \n ") })).jsonLd.blocks[0].reason).toBe("empty");
    for (const json of ['"text"', "42", "null", "true"]) {
      const block = extract(doc("", { head: ldScript(json) })).jsonLd.blocks[0];
      expect(block.reason, json).toBe("not_object_or_array");
      expect(block.parsedOk, json).toBe(false);
    }
  });

  it("keeps valid blocks when another block is invalid", () => {
    const head = ldScript('{"@context":"https://schema.org","@type":"Thing"}') + ldScript("{oops");
    const f = extract(doc("", { head }));
    expect(f.jsonLd.blocks.map((b) => [b.index, b.parsedOk])).toEqual([
      [0, true],
      [1, false],
    ]);
    expect(f.jsonLd.blocksSeen).toBe(2);
  });

  it("finds JSON-LD in the body, accepts type parameters and any case, and ignores other types and templates", () => {
    const body =
      ldScript('{"@type":"A"}', "application/ld+json; charset=utf-8") +
      ldScript('{"@type":"B"}', "APPLICATION/LD+JSON") +
      ldScript('{"@type":"C"}', "application/json") +
      `<template>${ldScript('{"@type":"D"}')}</template>` +
      `<div hidden>${ldScript('{"@type":"E"}')}</div>`;
    const f = extract(doc(body));
    expect(f.jsonLd.blocks.map((b) => b.nodes[0].types[0])).toEqual(["A", "B", "E"]);
  });

  it("accepts a block of exactly 256 KB and rejects one byte more", () => {
    const build = (total: number): string => {
      const open = '{"@type":"Thing","pad":"';
      const close = '"}';
      return open + "x".repeat(total - open.length - close.length) + close;
    };
    const ok = build(256 * 1024);
    const tooBig = build(256 * 1024 + 1);
    expect(ok.length).toBe(262144);
    const fOk = extract(doc("", { head: ldScript(ok) }));
    expect(fOk.jsonLd.blocks[0].parsedOk).toBe(true);
    expect(fOk.capsHit).not.toContain("jsonld_block_bytes");
    const fBig = extract(doc("", { head: ldScript(tooBig) }));
    expect(fBig.jsonLd.blocks[0]).toMatchObject({ parsedOk: false, reason: "too_large", nodes: [], value: null });
    expect(fBig.jsonLd.blocks[0].rawLength).toBe(tooBig.length);
    expect(fBig.capsHit).toContain("jsonld_block_bytes");
    expect(fBig.truncated).toBe(false);
    const huge = extract(doc("", { head: ldScript(build(1_500_000)) }));
    expect(huge.jsonLd.blocks[0]).toMatchObject({ reason: "too_large", rawLength: 1_500_000 });
  });

  it("measures the block size in bytes, not characters", () => {
    const pad = cp(0xe9).repeat(140_000);
    const json = `{"@type":"Thing","pad":"${pad}"}`;
    expect(json.length).toBeLessThan(256 * 1024);
    const f = extract(doc("", { head: ldScript(json) }));
    expect(f.jsonLd.blocks[0].reason).toBe("too_large");
  });

  it("parses at most 20 blocks and reports how many it saw", () => {
    const blocks = (n: number): string =>
      Array.from({ length: n }, (_, i) => ldScript(`{"@context":"https://schema.org","@type":"Thing","name":"n${i}"}`)).join("");
    const over = extract(doc("", { head: blocks(25) }));
    expect(over.jsonLd.blocks).toHaveLength(20);
    expect(over.jsonLd.blocksSeen).toBe(25);
    expect(over.capsHit).toContain("jsonld_block_count");
    const exact = extract(doc("", { head: blocks(20) }));
    expect(exact.jsonLd.blocks).toHaveLength(20);
    expect(exact.capsHit).not.toContain("jsonld_block_count");
  });

  it("allows nesting to depth 32 and records deeper blocks as invalid", () => {
    const nest = (depth: number): string => '{"a":'.repeat(depth) + '{"@type":"Thing"}' + "}".repeat(depth);
    const ok = extract(doc("", { head: ldScript(nest(32)) }));
    expect(ok.jsonLd.blocks[0].parsedOk).toBe(true);
    expect(ok.jsonLd.blocks[0].nodes[0].depth).toBe(32);
    expect(ok.capsHit).not.toContain("jsonld_depth");
    const deep = extract(doc("", { head: ldScript(nest(33)) }));
    expect(deep.jsonLd.blocks[0]).toMatchObject({ parsedOk: false, reason: "too_deep", nodes: [], value: null });
    expect(deep.capsHit).toContain("jsonld_depth");
  });

  it("rejects very deep arrays and brackets inside strings do not count towards depth", () => {
    const f = extract(doc("", { head: ldScript("[".repeat(100_000) + "]".repeat(100_000)) }));
    expect(f.jsonLd.blocks[0].reason).toBe("too_deep");
    const text = "[".repeat(100);
    const quoted = extract(doc("", { head: ldScript(JSON.stringify({ "@type": "Thing", name: text })) }));
    expect(quoted.jsonLd.blocks[0].parsedOk).toBe(true);
  });

  it("is not affected by __proto__ keys", () => {
    const f = extract(doc("", { head: ldScript('{"@type":"Thing","__proto__":{"polluted":true}}') }));
    expect(f.jsonLd.blocks[0].parsedOk).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("detects microdata and RDFa markers but not Open Graph property attributes", () => {
    expect(extract(doc('<div itemscope itemtype="https://schema.org/Thing">x</div>')).microdataOrRdfa).toBe(true);
    expect(extract(doc('<div vocab="https://schema.org/" typeof="Thing">x</div>')).microdataOrRdfa).toBe(true);
    expect(extract(doc("<p>x</p>", { head: '<meta property="og:title" content="t">' })).microdataOrRdfa).toBe(false);
    expect(extract(doc("<template><div itemscope>x</div></template>")).microdataOrRdfa).toBe(false);
  });
});

describe("caps and hostile input", () => {
  it("evaluates 5,000 nested divs without truncating", () => {
    const html = doc("<div>".repeat(5000) + "deepest text here" + "</div>".repeat(5000));
    const started = Date.now();
    const f = extract(html);
    expect(Date.now() - started).toBeLessThan(10_000);
    expect(f.truncated).toBe(false);
    expect(f.capsHit).toEqual([]);
    expect(f.visibleText).toBe("deepest text here");
  }, 30_000);

  it("stops evaluating beyond 100,000 elements and sets the truncated flag", () => {
    const html = doc("<span>w </span>".repeat(120_000) + "<h2>After the cap</h2>");
    const f = extract(html);
    expect(f.truncated).toBe(true);
    expect(f.capsHit).toContain("element_count");
    expect(f.main.wordCount).toBeLessThanOrEqual(100_000);
    expect(f.main.wordCount).toBeGreaterThan(90_000);
    expect(f.headings).toEqual([]);
  }, 60_000);

  it("does not set the element cap for a page just under 100,000 elements", () => {
    const f = extract(doc("<p>word</p>".repeat(90_000)));
    expect(f.truncated).toBe(false);
    expect(f.capsHit).toEqual([]);
    expect(f.main.wordCount).toBe(90_000);
  }, 60_000);

  it("handles extreme nesting depth in bounded time and flags the truncation", () => {
    const started = Date.now();
    const f = extract(doc("<div>".repeat(60_000) + "deep"));
    expect(Date.now() - started).toBeLessThan(20_000);
    expect(f.truncated).toBe(true);
    expect(f.capsHit).toContain("element_count");
  }, 60_000);

  it("handles unclosed formatting elements in bounded time", () => {
    const started = Date.now();
    for (const tag of ["<b>", "<p>", "<li>", '<a href="/x">', "<table><tr><td>"]) {
      const f = extract(doc(tag.repeat(100_000) + "x"));
      expect(f.truncated, tag).toBe(true);
    }
    expect(Date.now() - started).toBeLessThan(30_000);
  }, 60_000);

  it("bounds the work of deeply nested text captures and flags the page", () => {
    const text = "lorem ipsum dolor sit amet ".repeat(2000);
    for (const open of ['<address id="root">', '<h1 id="root"><b>', '<div id="root">']) {
      const started = Date.now();
      const f = extract(doc(open.repeat(15_000) + text));
      expect(Date.now() - started, open).toBeLessThan(6000);
      expect(f.truncated, open).toBe(true);
      expect(f.capsHit, open).toContain("element_count");
    }
  }, 60_000);

  it("does not flag a large ordinary page full of headings, links and paragraphs", () => {
    const section = '<h2>What is this section about?</h2><p>Some words here. Another sentence follows.</p><a href="/page/1">A descriptive link</a>';
    const f = extract(doc(`<main>${section.repeat(8000)}</main>`));
    expect(f.truncated).toBe(false);
    expect(f.capsHit).toEqual([]);
    expect(f.headings).toHaveLength(8000);
    expect(f.links).toHaveLength(8000);
    expect(f.main.paragraphs).toHaveLength(8000);
    expect(f.headings[7999].text).toBe("What is this section about?");
    expect(f.links[7999].name).toBe("A descriptive link");
  }, 60_000);

  it("keeps only the first 3 MB of HTML and flags it", () => {
    const html = doc(`<p>${"word ".repeat(700_000)}</p><h2>Past the byte cap</h2>`);
    expect(Buffer.byteLength(html, "utf8")).toBeGreaterThan(3 * 1024 * 1024);
    const f = extract(html);
    expect(f.truncated).toBe(true);
    expect(f.capsHit).toContain("html_bytes");
    expect(f.capsHit).not.toContain("element_count");
    expect(f.headings).toEqual([]);
    expect(f.main.wordCount).toBeGreaterThan(500_000);
  }, 60_000);

  it("counts the byte cap in bytes, not characters", () => {
    const html = doc(`<p>${cp(0x65e5).repeat(1_100_000)}</p>`);
    expect(html.length).toBeLessThan(3 * 1024 * 1024);
    expect(Buffer.byteLength(html, "utf8")).toBeGreaterThan(3 * 1024 * 1024);
    const f = extract(html);
    expect(f.capsHit).toContain("html_bytes");
  }, 60_000);

  it("copes with very large attribute values", () => {
    const huge = "a".repeat(1_000_000);
    const started = Date.now();

    const link = extract(doc(`<a href="/${huge}">link</a>`));
    expect(link.links).toHaveLength(1);
    expect(link.links[0].name).toBe("link");
    expect(link.links[0].sameSite).toBe(true);

    const image = extract(doc(`<img src="/a.png" alt="${huge}">`));
    expect(image.images).toHaveLength(1);
    expect(image.images[0].hasAlt).toBe(true);

    const description = extract(doc("", { head: `<meta name="description" content="${huge}">` }));
    expect(description.head.metaDescriptions[0].chars).toBe(1_000_000);

    const canonical = extract(doc("", { head: `<link rel="canonical" href="/${huge}">` }));
    expect(canonical.head.canonicals).toHaveLength(1);

    const byline = extract(doc(`<div class="${"byline ".repeat(150_000)}">x</div>`));
    expect(byline.byline.classMatch).toBe(true);

    const style = extract(doc(`<div style="${"color:red;".repeat(100_000)}">y</div>`));
    expect(style.visibleText).toBe("y");

    const hiddenStyle = extract(doc(`<div style="${"color:red;".repeat(100_000)}display:none">y</div><p>z</p>`));
    expect(hiddenStyle.visibleText).toBe("z");

    const id = extract(doc(`<div id="${huge}">z</div>`));
    expect(id.visibleText).toBe("z");

    const manyAttributes = extract(doc(`<p ${Array.from({ length: 20_000 }, (_, i) => `a${i}="v"`).join(" ")}>attrs</p>`));
    expect(manyAttributes.visibleText).toBe("attrs");

    expect(Date.now() - started).toBeLessThan(15_000);
  }, 30_000);

  it("handles pathological text runs in linear time", () => {
    const started = Date.now();
    extract(doc("a@".repeat(500_000)));
    extract(doc(" ".repeat(2_000_000) + "x"));
    extract(doc("<p>" + ".".repeat(1_000_000) + "</p>"));
    extract(doc("<p>" + "a. ".repeat(300_000) + "</p>"));
    extract(doc("<".repeat(1_000_000)));
    extract(doc("<!-- " + "x".repeat(500_000)));
    extract(doc("<div " + "x ".repeat(250_000)));
    extract(doc("<noscript>" + "enable ".repeat(100_000) + "</noscript>"));
    expect(Date.now() - started).toBeLessThan(15_000);
  }, 60_000);

  it("never throws on malformed or hostile input", () => {
    const inputs = [
      "",
      "\0\0\0",
      "<",
      "<<<>>>",
      "<html",
      "&",
      "&#x110000;&#0;&#xD800;",
      "<div",
      "<!--",
      "<![CDATA[ x ]]>",
      "<?xml version='1.0'?>",
      "<svg><foreignObject><p>x</p></foreignObject></svg>",
      "<plaintext><p>text",
      "<table><tr><td><table><tr><td>",
      "<script>",
      '<script type="application/ld+json">',
      '<a href="',
      "<title>unterminated",
      "<template><template><template>",
      Array.from({ length: 5000 }, (_, i) => String.fromCharCode(i % 256)).join(""),
      "<a href=\"javascript:alert(1)\" onclick=\"x\">y</a><img src=x onerror=alert(1)>",
    ];
    for (const input of inputs) {
      const f = extract(input);
      expect(typeof f.url, JSON.stringify(input.slice(0, 20))).toBe("string");
      expect(Array.isArray(f.links)).toBe(true);
      expect(f.main).toBeDefined();
    }
  });

  it("does not throw on an unusable final URL, missing headers or non-string input", () => {
    const html = doc('<a href="/rel">r</a><a href="https://abs.example/">a</a><link rel="canonical" href="/c">');
    const odd = extractPageFacts(html, { finalUrl: "not a url", headers: {} });
    expect(odd.url).toBe("not a url");
    expect(odd.links.map((l) => l.url)).toEqual([null, "https://abs.example/"]);
    expect(extractPageFacts(html, { finalUrl: "", headers: undefined as unknown as Record<string, string> }).links).toHaveLength(2);
    expect(extractPageFacts(null as unknown as string, { finalUrl: BASE, headers: {} }).main.text).toBe("");
    expect(extractPageFacts(html, undefined as unknown as { finalUrl: string; headers: Record<string, string> }).links).toHaveLength(2);
    const nonStringHeaders = extractPageFacts(html, { finalUrl: BASE, headers: { "x-robots-tag": 5 as unknown as string, link: null as unknown as string } });
    expect(nonStringHeaders.head.xRobotsTag).toEqual([]);
  });
});

describe("determinism and shape", () => {
  const sample = doc(
    '<header><nav><a href="/a">A</a></nav></header><main><h1>T</h1><p>Some words here. More words!</p></main>',
    { head: ldScript('{"@context":"https://schema.org","@type":"Organization","name":"X"}') + '<meta name="robots" content="noindex">' },
  );

  it("returns identical facts for identical input, regardless of earlier calls", () => {
    const first = extract(sample);
    extract(doc("<main><h1>Other</h1><p>Different? Content. Here!</p></main>", { lang: "ja" }));
    extract("<div>".repeat(50) + "x");
    const second = extract(sample);
    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it("produces plain JSON data", () => {
    const f = extract(sample);
    expect(JSON.parse(JSON.stringify(f))).toEqual(f);
  });

  it("does not depend on the clock", () => {
    const first = extract(sample);
    const realNow = Date.now;
    Date.now = () => 0;
    try {
      expect(extract(sample)).toEqual(first);
    } finally {
      Date.now = realNow;
    }
  });

  it("extracts a realistic homepage consistently", () => {
    const html = doc(
      '<header><a href="/">Home</a><nav><a href="/services">Services</a><a href="/about">About</a><a href="/contact">Contact</a></nav></header>' +
        "<main><h1>Acme Plumbing in Kilcock</h1>" +
        `<p>Acme Plumbing fixes boilers and leaks across Kildare. ${words(60)}.</p>` +
        "<h2>What do we fix?</h2><p>Boilers, pipes and taps.</p>" +
        '<ul><li>Boilers</li><li>Pipes</li><li>Taps</li></ul>' +
        '<img src="/van.jpg" alt="Our van" width="800" height="600"></main>' +
        '<footer><a href="/privacy">Privacy</a><a href="mailto:hello@acme.example">Email</a><address>1 High Street, Kilcock</address></footer>',
      {
        head:
          '<meta name="description" content="Plumbers in Kildare">' +
          '<link rel="canonical" href="https://example.com/">' +
          '<meta name="viewport" content="width=device-width, initial-scale=1">' +
          ldScript('{"@context":"https://schema.org","@type":"Plumber","name":"Acme Plumbing","url":"https://example.com/"}'),
        title: "Acme Plumbing | Kilcock",
      },
    );
    const f = extract(html);
    expect(f.main.method).toBe("main");
    expect(f.headings.map((h) => [h.level, h.text, h.inMain])).toEqual([
      [1, "Acme Plumbing in Kilcock", true],
      [2, "What do we fix?", true],
    ]);
    expect(f.main.wordCount).toBeGreaterThan(60);
    expect(f.lists).toEqual([{ ordered: false, items: 3 }]);
    expect(f.images[0]).toMatchObject({ hasAlt: true, isContent: true, width: 800, height: 600 });
    expect(f.links.filter((l) => l.location === "nav")).toHaveLength(3);
    expect(f.navigations).toEqual([{ source: "nav", sameSiteLinkCount: 3 }]);
    expect(f.contact.mailto).toEqual(["hello@acme.example"]);
    expect(f.contact.addressTextLengths).toEqual([22]);
    expect(f.faq.headingParagraph).toEqual({ pairs: 2, questionPairs: 1 });
    expect(f.render.renderDependent).toBe(false);
    expect(f.head.canonicals[0].url).toBe("https://example.com/");
    expect(f.jsonLd.blocks[0].nodes[0].types).toEqual(["Plumber"]);
    expect(f.truncated).toBe(false);
  });
});
