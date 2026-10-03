import { describe, expect, it } from "vitest";
import {
  MAX_SAMPLED_PAGES,
  SAMPLE_TYPE_ORDER,
  classifyPath,
  pathDepth,
  selectSample,
} from "@/lib/visibility/sample";
import type { SampleResult } from "@/lib/visibility/sample";
import { CANDIDATE_EXCLUSIONS, PAGE_TYPES } from "@/lib/visibility/types";

const HOME = "https://example.ie/";
const at = (path: string): string => `https://example.ie${path}`;

function run(opts: {
  links?: readonly string[];
  locs?: readonly string[];
  home?: string;
  capped?: boolean;
}): SampleResult {
  return selectSample({
    homeUrl: opts.home ?? HOME,
    sitemapLocs: opts.locs ?? [],
    homepageLinks: opts.links ?? [],
    ...(opts.capped === undefined ? {} : { sourcesCapped: opts.capped }),
  });
}

const urls = (result: SampleResult): string[] => result.pages.map((p) => p.url);
const types = (result: SampleResult): string[] => result.pages.map((p) => p.type);
const paths = (result: SampleResult): string[] =>
  result.pages.map((p) => p.url.replace("https://example.ie", ""));

function sumOf(record: Record<string, number>): number {
  return Object.values(record).reduce((a, b) => a + b, 0);
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

describe("constants", () => {
  it("samples at most 4 pages in the fixed type order", () => {
    expect(MAX_SAMPLED_PAGES).toBe(4);
    expect([...SAMPLE_TYPE_ORDER]).toEqual(["services", "about", "faq", "article", "other"]);
  });
});

describe("pathDepth", () => {
  it("counts non-empty path segments", () => {
    expect(pathDepth("/")).toBe(0);
    expect(pathDepth("")).toBe(0);
    expect(pathDepth("/a")).toBe(1);
    expect(pathDepth("/a/")).toBe(1);
    expect(pathDepth("/a/b/")).toBe(2);
    expect(pathDepth("/a//b")).toBe(2);
    expect(pathDepth("/a/b/c/d")).toBe(4);
  });

  it("ignores the query string and fragment", () => {
    expect(pathDepth("/a/b?x=/y/z")).toBe(2);
    expect(pathDepth("/a#/b/c")).toBe(1);
    expect(pathDepth("/?a=/b")).toBe(0);
  });
});

describe("classifyPath", () => {
  const cases: Record<string, string[]> = {
    services: [
      "/services",
      "/service",
      "/solutions",
      "/solution",
      "/what-we-do",
      "/offering",
      "/offerings",
      "/products",
      "/product",
      "/services/ai-training",
      "/products/widget/large",
    ],
    about: ["/about", "/about-us", "/who-we-are", "/our-story", "/team", "/company", "/about/history"],
    faq: ["/faq", "/faqs", "/questions", "/help", "/help/billing"],
    contact: ["/contact", "/contact-us", "/get-in-touch", "/enquiry", "/enquiries", "/enquire", "/contact/dublin"],
    legal: [
      "/privacy",
      "/privacy-policy",
      "/terms",
      "/cookie",
      "/cookies",
      "/legal",
      "/disclaimer",
      "/terms/website",
    ],
    article: [
      "/blog/post",
      "/news/launch",
      "/insights/a/b",
      "/article/x",
      "/articles/x",
      "/resources/guide",
      "/journal/entry",
      "/post/x",
      "/posts/x",
      "/blog/2026/09/title",
    ],
    other: ["/pricing", "/case-studies", "/careers", "/a/b/c", "/blog", "/news", "/aboutus", "/servicesx"],
  };

  for (const [type, paths] of Object.entries(cases)) {
    it(`classifies ${type} paths`, () => {
      for (const path of paths) expect(classifyPath(path), path).toBe(type);
    });
  }

  it("classifies the root path as home", () => {
    expect(classifyPath("/")).toBe("home");
    expect(classifyPath("")).toBe("home");
    expect(classifyPath("/?lang=ga")).toBe("home");
  });

  it("is case-insensitive", () => {
    expect(classifyPath("/SERVICES")).toBe("services");
    expect(classifyPath("/About-Us")).toBe("about");
    expect(classifyPath("/FAQ")).toBe("faq");
    expect(classifyPath("/Blog/Post")).toBe("article");
    expect(classifyPath("/Privacy-Policy")).toBe("legal");
  });

  it("matches on a path segment boundary, not a bare prefix", () => {
    expect(classifyPath("/servicesx")).toBe("other");
    expect(classifyPath("/aboutus")).toBe("other");
    expect(classifyPath("/helpful-tips")).toBe("other");
    expect(classifyPath("/blogging/x")).toBe("other");
    expect(classifyPath("/teams")).toBe("other");
  });

  it("anchors patterns at the start of the path", () => {
    expect(classifyPath("/en/services")).toBe("other");
    expect(classifyPath("/x/about")).toBe("other");
    expect(classifyPath("services")).toBe("other");
  });

  it("lets the first matching pattern win", () => {
    expect(classifyPath("/services/contact")).toBe("services");
    expect(classifyPath("/about/privacy")).toBe("about");
    expect(classifyPath("/contact/blog/x")).toBe("contact");
    expect(classifyPath("/help/privacy")).toBe("faq");
    expect(classifyPath("/privacy/blog/x")).toBe("legal");
  });

  it("requires an article to sit below its prefix (depth 2 or more)", () => {
    expect(classifyPath("/blog")).toBe("other");
    expect(classifyPath("/blog/")).toBe("other");
    expect(classifyPath("/blog//")).toBe("other");
    expect(classifyPath("/news")).toBe("other");
    expect(classifyPath("/blog/x")).toBe("article");
  });

  it("looks at the path only", () => {
    expect(classifyPath("/services?x=1")).toBe("services");
    expect(classifyPath("/blog/x#top")).toBe("article");
    expect(classifyPath("/pricing?ref=/services")).toBe("other");
  });
});

describe("selectSample: type order, depth and path", () => {
  it("selects one page per type in the fixed order, whatever the depth", () => {
    const result = run({
      links: [at("/blog/a"), at("/faq/x/y"), at("/about"), at("/services/a/b/c")],
    });
    expect(types(result)).toEqual(["services", "about", "faq", "article"]);
    expect(paths(result)).toEqual(["/services/a/b/c", "/about", "/faq/x/y", "/blog/a"]);
  });

  it("takes the smallest depth, then the smallest path, within a type", () => {
    const result = run({
      locs: [
        at("/services/x/y"),
        at("/solutions/zeta"),
        at("/services/alpha"),
        at("/team"),
        at("/about"),
      ],
    });
    expect(types(result).slice(0, 2)).toEqual(["services", "about"]);
    expect(paths(result)[0]).toBe("/services/alpha");
    expect(paths(result)[1]).toBe("/about");
  });

  it("prefers the shallower page even when its path sorts later", () => {
    const result = run({ links: [at("/services/aaa"), at("/zzz-not-services"), at("/products")] });
    expect(paths(result)[0]).toBe("/products");
  });

  it("compares paths by code unit, not by locale", () => {
    const result = run({ links: [at("/services/b"), at("/services/B")] });
    expect(paths(result)).toEqual(["/services/B", "/services/b"]);
  });

  it("breaks ties between URLs that share a path by URL", () => {
    const result = run({
      links: [at("/services?lang=ga"), at("/services?lang=en"), at("/services")],
    });
    expect(urls(result)).toEqual([at("/services"), at("/services?lang=en"), at("/services?lang=ga")]);
  });

  it("treats a bare blog or news index as other, and a post below it as article", () => {
    const result = run({ links: [at("/blog"), at("/news"), at("/blog/post")] });
    expect(types(result)).toEqual(["article", "other", "other"]);
    expect(paths(result)).toEqual(["/blog/post", "/blog", "/news"]);
  });

  it("selects an other page after the typed pages when slots remain", () => {
    const result = run({ links: [at("/services"), at("/about"), at("/pricing")] });
    expect(types(result)).toEqual(["services", "about", "other"]);
    expect(paths(result)).toEqual(["/services", "/about", "/pricing"]);
  });

  it("records the depth of each selected page", () => {
    const result = run({ links: [at("/services"), at("/about/team"), at("/blog/2026/09/post")] });
    const byPath = Object.fromEntries(result.pages.map((p) => [p.url.replace("https://example.ie", ""), p.depth]));
    expect(byPath).toEqual({ "/services": 1, "/about/team": 2, "/blog/2026/09/post": 4 });
  });

  it("gives every page a type-specific or fill reason within the evidence limit", () => {
    const result = run({
      links: [at("/services"), at("/services/b"), at("/about"), at("/faq"), at("/blog/x")],
    });
    expect(result.pages).toHaveLength(4);
    const [services, about, faq, article] = result.pages;
    expect(services.reason).toContain("services");
    expect(about.reason).toContain("about");
    expect(faq.reason).toContain("faq");
    expect(article.reason).toContain("article");
    for (const page of result.pages) {
      expect(page.reason.length).toBeGreaterThan(0);
      expect(page.reason.length).toBeLessThanOrEqual(200);
    }
    const fill = run({ links: [at("/services"), at("/services/b")] });
    expect(fill.pages[1].reason.startsWith("Fill")).toBe(true);
  });
});

describe("selectSample: the four-page cap and slot filling", () => {
  it("never selects more than four pages, dropping other when all five types exist", () => {
    const result = run({
      links: [at("/services"), at("/about"), at("/faq"), at("/blog/a"), at("/pricing")],
    });
    expect(result.pages).toHaveLength(4);
    expect(types(result)).toEqual(["services", "about", "faq", "article"]);
    expect(urls(result)).not.toContain(at("/pricing"));
  });

  it("fills remaining slots from the best unselected candidates of any type by depth then path", () => {
    const result = run({ links: [at("/a"), at("/b/c"), at("/b"), at("/d/e/f"), at("/c")] });
    expect(paths(result)).toEqual(["/a", "/b", "/c", "/b/c"]);
    expect(types(result)).toEqual(["other", "other", "other", "other"]);
  });

  it("fills with extra pages of a type that already has a pick", () => {
    const result = run({
      links: [at("/services"), at("/services/web"), at("/services/ai/training"), at("/about")],
    });
    expect(paths(result)).toEqual(["/services", "/about", "/services/web", "/services/ai/training"]);
    expect(types(result)).toEqual(["services", "about", "services", "services"]);
  });

  it("orders type picks first and fills after, even when a fill page is shallower", () => {
    const result = run({ links: [at("/services/deep/er/path"), at("/z"), at("/y"), at("/x")] });
    expect(paths(result)).toEqual(["/services/deep/er/path", "/x", "/y", "/z"]);
  });

  it("returns fewer than four pages when there are fewer candidates", () => {
    expect(run({ links: [at("/about")] }).pages).toHaveLength(1);
    expect(run({ links: [at("/about"), at("/pricing")] }).pages).toHaveLength(2);
  });

  it("never selects a page twice", () => {
    const result = run({
      locs: [at("/services"), at("/about"), at("/faq")],
      links: [at("/services"), at("/about"), at("/faq")],
    });
    expect(new Set(urls(result)).size).toBe(result.pages.length);
    expect(result.pages).toHaveLength(3);
  });

  it("never samples contact or legal pages, including to fill slots", () => {
    const result = run({
      links: [
        at("/contact"),
        at("/contact-us"),
        at("/privacy"),
        at("/terms"),
        at("/cookies"),
        at("/legal"),
        at("/about"),
      ],
    });
    expect(paths(result)).toEqual(["/about"]);
    expect(result.candidates.byType.contact).toBe(2);
    expect(result.candidates.byType.legal).toBe(4);
    expect(result.candidates.considered).toBe(7);
  });

  it("selects nothing when only contact and legal pages exist", () => {
    expect(run({ links: [at("/contact"), at("/privacy-policy")] }).pages).toEqual([]);
  });
});

describe("selectSample: candidate filters", () => {
  it("drops the homepage in every form", () => {
    const result = run({
      links: [
        HOME,
        "https://example.ie",
        "https://EXAMPLE.ie/",
        "https://example.ie:443/",
        "https://example.ie/#top",
        "https://www.example.ie/",
        "http://example.ie/",
        "https://example.ie/?utm_source=nav",
        "#",
        "#main",
        "/",
        "./",
        "",
      ],
    });
    expect(result.pages).toEqual([]);
    expect(result.candidates.considered).toBe(0);
    expect(result.candidates.excluded.homepage).toBe(13);
    expect(sumOf(result.candidates.excluded)).toBe(13);
  });

  it("drops the homepage even when it is listed in the sitemap", () => {
    const result = run({ locs: [HOME, "https://example.ie"], links: [at("/about")] });
    expect(paths(result)).toEqual(["/about"]);
    expect(result.candidates.excluded.homepage).toBe(2);
  });

  it("drops the root path of the site when the homepage is a locale path", () => {
    const result = run({
      home: "https://example.ie/en/",
      links: ["https://example.ie/en", "https://example.ie/", "https://example.ie/en/about"],
    });
    expect(result.candidates.excluded.homepage).toBe(2);
    expect(urls(result)).toEqual(["https://example.ie/en/about"]);
  });

  it("drops other sites and treats a leading www as the same site", () => {
    const result = run({
      links: [
        "https://other.com/about",
        "https://blog.example.ie/post",
        "https://example.com/about",
        "https://notexample.ie/about",
        "https://example.ie.evil.com/about",
        "https://www.example.ie/about",
        "http://EXAMPLE.ie/faq",
      ],
    });
    expect(result.candidates.excluded.other_site).toBe(5);
    expect(urls(result)).toEqual(["https://www.example.ie/about", "http://example.ie/faq"]);
    expect(types(result)).toEqual(["about", "faq"]);
  });

  it("matches the site when the homepage itself is on www", () => {
    const result = run({
      home: "https://www.example.ie/",
      locs: ["https://example.ie/about", "https://www.example.ie/faq", "https://other.ie/x"],
    });
    expect(result.pages.map((p) => p.type)).toEqual(["about", "faq"]);
    expect(result.candidates.excluded.other_site).toBe(1);
  });

  it("drops non-HTTP schemes and unparseable values", () => {
    const result = run({
      locs: ["not a url", "/relative", "http://", ""],
      links: [
        "mailto:hello@example.ie",
        "tel:+353123456789",
        "javascript:void(0)",
        "ftp://example.ie/file",
        "data:text/html,x",
        "sms:+353123",
        "http://",
      ],
    });
    expect(result.pages).toEqual([]);
    expect(result.candidates.excluded.non_http).toBe(11);
    expect(sumOf(result.candidates.excluded)).toBe(11);
  });

  it("resolves relative homepage links against the homepage URL", () => {
    const result = run({
      home: "https://example.ie/en/",
      links: ["about", "../faq", "/blog/x", "./"],
    });
    expect(urls(result).sort()).toEqual(
      ["https://example.ie/blog/x", "https://example.ie/en/about", "https://example.ie/faq"].sort()
    );
    expect(result.candidates.excluded.homepage).toBe(1);
  });

  const nonHtml = [
    ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico", ".css", ".js", ".json", ".xml",
    ".zip", ".gz", ".mp3", ".mp4", ".webm", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt",
  ];

  it("drops every non-HTML extension, in any case, ignoring the query string", () => {
    const links = [
      ...nonHtml.map((ext) => at(`/files/report${ext}`)),
      at("/brochure.PDF"),
      at("/img/Photo.JPG"),
      at("/download.zip?version=2"),
    ];
    const result = run({ links });
    expect(result.pages).toEqual([]);
    expect(result.candidates.excluded.non_html_extension).toBe(links.length);
  });

  it("keeps paths that only look similar to a non-HTML extension", () => {
    const result = run({
      links: [at("/docs"), at("/about.html"), at("/page.php"), at("/report.pdfx"), at("/pdf"), at("/jsonp")],
    });
    expect(result.candidates.excluded.non_html_extension).toBe(0);
    expect(result.candidates.considered).toBe(6);
  });

  const utility = [
    "/login", "/Login", "/signin", "/sign-in", "/register", "/signup", "/account", "/my-account",
    "/cart", "/cart/items", "/basket", "/checkout", "/wp-admin", "/wp-admin/options.php", "/wp-login",
    "/admin", "/search", "/search/results", "/thank", "/thanks", "/cdn-cgi", "/cdn-cgi/l/email",
    "/api", "/api/v1/items", "/feed", "/tag", "/tag/ai", "/category", "/category/news", "/author",
    "/author/jane", "/page/2", "/page/10", "/page/2/",
  ];

  it("drops utility paths", () => {
    const result = run({ links: utility.map(at) });
    expect(result.pages).toEqual([]);
    expect(result.candidates.excluded.utility_path).toBe(utility.length);
    expect(result.candidates.considered).toBe(0);
  });

  it("matches utility prefixes at the start of the path only", () => {
    const result = run({
      links: [at("/blog/page/2"), at("/about/author"), at("/services/search"), at("/pages/2"), at("/page/about")],
    });
    expect(result.candidates.excluded.utility_path).toBe(0);
    expect(result.candidates.considered).toBe(5);
  });

  it("removes duplicates after normalisation, across both sources", () => {
    const result = run({
      locs: [at("/about"), at("/about/"), at("/about#team"), "HTTPS://EXAMPLE.IE:443/about"],
      links: [at("/about"), "about", "/about/"],
    });
    expect(urls(result)).toEqual([at("/about")]);
    expect(result.candidates.considered).toBe(1);
    expect(result.candidates.excluded.duplicate).toBe(6);
    expect(result.candidates.fromSitemap).toBe(4);
    expect(result.candidates.fromHomepageLinks).toBe(3);
  });

  it("treats percent-encoding hex case as the same URL", () => {
    const result = run({ links: [at("/a%2fb"), at("/a%2Fb")] });
    expect(urls(result)).toEqual([at("/a%2Fb")]);
    expect(result.candidates.excluded.duplicate).toBe(1);
  });

  it("keeps URLs that differ only in the query string as distinct candidates", () => {
    const result = run({ links: [at("/services?lang=en"), at("/services?lang=ga"), at("/services")] });
    expect(result.candidates.considered).toBe(3);
    expect(result.candidates.excluded.duplicate).toBe(0);
  });

  it("keeps http and https variants of a page as distinct candidates", () => {
    const result = run({ links: ["http://example.ie/about", "https://example.ie/about"] });
    expect(result.candidates.considered).toBe(2);
  });

  it("does not mutate its inputs", () => {
    const locs = Object.freeze([at("/b"), at("/a")]) as readonly string[];
    const links = Object.freeze([at("/d"), at("/c")]) as readonly string[];
    expect(() => selectSample({ homeUrl: HOME, sitemapLocs: locs, homepageLinks: links })).not.toThrow();
    expect(locs).toEqual([at("/b"), at("/a")]);
    expect(links).toEqual([at("/d"), at("/c")]);
  });
});

describe("selectSample: candidate summary", () => {
  const SITE = "https://www.example.ie/";
  const locs = [
    "https://www.example.ie/",
    "https://www.example.ie/services",
    "https://www.example.ie/services/copilot-training",
    "https://www.example.ie/about-us",
    "https://www.example.ie/contact",
    "https://www.example.ie/privacy-policy",
    "https://www.example.ie/blog",
    "https://www.example.ie/blog/ai-for-sme",
    "https://www.example.ie/blog/ai-for-sme/",
    "https://www.example.ie/logo.png",
    "https://www.example.ie/wp-admin/",
    "https://other.example.com/page",
  ];
  const links = [
    "/faq",
    "https://www.example.ie/services",
    "mailto:hello@example.ie",
    "#main",
    "/blog/ai-for-sme",
    "/pricing",
  ];

  it("counts sources, exclusions and candidates by type", () => {
    const result = selectSample({ homeUrl: SITE, sitemapLocs: locs, homepageLinks: links });
    expect(result.candidates).toEqual({
      fromSitemap: 12,
      fromHomepageLinks: 6,
      considered: 9,
      excluded: {
        other_site: 1,
        non_http: 1,
        non_html_extension: 1,
        utility_path: 1,
        duplicate: 3,
        homepage: 2,
      },
      byType: {
        home: 0,
        services: 2,
        about: 1,
        faq: 1,
        article: 1,
        contact: 1,
        legal: 1,
        other: 2,
      },
      capped: false,
    });
  });

  it("selects the expected pages for the worked site", () => {
    const result = selectSample({ homeUrl: SITE, sitemapLocs: locs, homepageLinks: links });
    expect(urls(result)).toEqual([
      "https://www.example.ie/services",
      "https://www.example.ie/about-us",
      "https://www.example.ie/faq",
      "https://www.example.ie/blog/ai-for-sme",
    ]);
    expect(types(result)).toEqual(["services", "about", "faq", "article"]);
  });

  it("accounts for every raw candidate exactly once", () => {
    const { candidates } = selectSample({ homeUrl: SITE, sitemapLocs: locs, homepageLinks: links });
    expect(candidates.fromSitemap + candidates.fromHomepageLinks).toBe(
      candidates.considered + sumOf(candidates.excluded)
    );
    expect(sumOf(candidates.byType)).toBe(candidates.considered);
  });

  it("lists every exclusion reason and page type, even at zero", () => {
    const { candidates } = run({});
    expect(Object.keys(candidates.excluded).sort()).toEqual([...CANDIDATE_EXCLUSIONS].sort());
    expect(Object.keys(candidates.byType).sort()).toEqual([...PAGE_TYPES].sort());
    expect(sumOf(candidates.excluded)).toBe(0);
    expect(sumOf(candidates.byType)).toBe(0);
  });

  it("passes the capped flag through and defaults to false", () => {
    expect(run({}).candidates.capped).toBe(false);
    expect(run({ capped: false }).candidates.capped).toBe(false);
    expect(run({ capped: true }).candidates.capped).toBe(true);
  });
});

describe("selectSample: empty and malformed input", () => {
  it("returns an empty sample for empty inputs", () => {
    const result = run({});
    expect(result.pages).toEqual([]);
    expect(result.candidates.fromSitemap).toBe(0);
    expect(result.candidates.fromHomepageLinks).toBe(0);
    expect(result.candidates.considered).toBe(0);
  });

  it("works from the sitemap alone and from homepage links alone", () => {
    expect(paths(run({ locs: [at("/about"), at("/faq")] }))).toEqual(["/about", "/faq"]);
    expect(paths(run({ links: [at("/about"), at("/faq")] }))).toEqual(["/about", "/faq"]);
  });

  it("does not throw when the sources are missing or hold non-strings", () => {
    expect(() =>
      selectSample({
        homeUrl: HOME,
        sitemapLocs: undefined as unknown as string[],
        homepageLinks: null as unknown as string[],
      })
    ).not.toThrow();
    const result = selectSample({
      homeUrl: HOME,
      sitemapLocs: [42, null, undefined, {}] as unknown as string[],
      homepageLinks: [at("/about")],
    });
    expect(result.candidates.excluded.non_http).toBe(4);
    expect(paths(result)).toEqual(["/about"]);
  });

  it("selects nothing when the homepage URL is unusable", () => {
    const result = selectSample({
      homeUrl: "not a url",
      sitemapLocs: [at("/about")],
      homepageLinks: ["/faq", at("/services")],
    });
    expect(result.pages).toEqual([]);
    expect(() =>
      selectSample({ homeUrl: undefined as unknown as string, sitemapLocs: [], homepageLinks: [] })
    ).not.toThrow();
  });
});

describe("selectSample: determinism", () => {
  const home = "https://www.example.ie/";
  const everything = [
    "https://www.example.ie/",
    "https://www.example.ie/services",
    "https://www.example.ie/services/copilot-training",
    "https://www.example.ie/services/b",
    "https://www.example.ie/services/B",
    "https://www.example.ie/about-us",
    "https://www.example.ie/team",
    "https://www.example.ie/contact",
    "https://www.example.ie/privacy-policy",
    "https://www.example.ie/blog",
    "https://www.example.ie/blog/ai-for-sme",
    "https://www.example.ie/blog/ai-for-sme/",
    "https://www.example.ie/blog/zebra",
    "https://www.example.ie/blog/alpha",
    "https://www.example.ie/logo.png",
    "https://www.example.ie/wp-admin/",
    "https://www.example.ie/faq",
    "https://www.example.ie/faq?ref=nav",
    "https://www.example.ie/faq?ref=footer",
    "https://www.example.ie/pricing",
    "https://www.example.ie/case-studies",
    "https://example.ie/about-us",
    "https://other.example.com/page",
    "mailto:hello@example.ie",
  ];

  it("returns the same result for every ordering of the same inputs", () => {
    const baseline = selectSample({
      homeUrl: home,
      sitemapLocs: everything.slice(0, 12),
      homepageLinks: everything.slice(12),
    });
    expect(baseline.pages).toHaveLength(4);
    const random = mulberry32(20261002);
    for (let i = 0; i < 300; i++) {
      const mixed = shuffled(everything, random);
      const cut = Math.floor(random() * (mixed.length + 1));
      const result = selectSample({
        homeUrl: home,
        sitemapLocs: mixed.slice(0, cut),
        homepageLinks: mixed.slice(cut),
      });
      expect(result.pages, `iteration ${i}`).toEqual(baseline.pages);
      expect(result.candidates.excluded, `iteration ${i}`).toEqual(baseline.candidates.excluded);
      expect(result.candidates.byType, `iteration ${i}`).toEqual(baseline.candidates.byType);
      expect(result.candidates.considered, `iteration ${i}`).toBe(baseline.candidates.considered);
    }
  });

  it("does not depend on which source supplied a URL", () => {
    const absolute = everything;
    const asSitemap = selectSample({ homeUrl: home, sitemapLocs: absolute, homepageLinks: [] });
    const asLinks = selectSample({ homeUrl: home, sitemapLocs: [], homepageLinks: absolute });
    const split = selectSample({
      homeUrl: home,
      sitemapLocs: absolute.filter((_, i) => i % 2 === 0),
      homepageLinks: absolute.filter((_, i) => i % 2 === 1),
    });
    expect(asLinks.pages).toEqual(asSitemap.pages);
    expect(split.pages).toEqual(asSitemap.pages);
  });

  it("is stable across repeated calls with identical input", () => {
    const input = { homeUrl: home, sitemapLocs: everything, homepageLinks: [] as string[] };
    const first = JSON.stringify(selectSample(input));
    for (let i = 0; i < 10; i++) expect(JSON.stringify(selectSample(input))).toBe(first);
  });

  it("orders ties between query variants and duplicate depths independently of input order", () => {
    const variants = [at("/faq?ref=b"), at("/faq?ref=a"), at("/faq"), at("/faq/b"), at("/faq/a")];
    const random = mulberry32(7);
    const baseline = run({ links: variants });
    for (let i = 0; i < 50; i++) {
      expect(run({ links: shuffled(variants, random) }).pages).toEqual(baseline.pages);
    }
    expect(paths(baseline)).toEqual(["/faq", "/faq?ref=a", "/faq?ref=b", "/faq/a"]);
  });
});

describe("selectSample: scale", () => {
  it("handles tens of thousands of candidates in bounded time", () => {
    const locs = Array.from({ length: 30_000 }, (_, i) => at(`/products/item-${i}/detail`));
    const links = Array.from({ length: 30_000 }, (_, i) => at(`/blog/post-${i}`));
    const started = Date.now();
    const result = selectSample({ homeUrl: HOME, sitemapLocs: locs, homepageLinks: links });
    expect(Date.now() - started).toBeLessThan(5000);
    expect(result.pages).toHaveLength(4);
    expect(result.candidates.considered).toBe(60_000);
    expect(types(result).slice(0, 2)).toEqual(["services", "article"]);
  });
});
