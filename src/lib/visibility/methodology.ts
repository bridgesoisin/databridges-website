import { LISTS_VERSION } from "@/lib/visibility/lists";
import type {
  CategoryDefinition,
  CategoryId,
  MethodologyDefinition,
  MetricDefinitionExt,
} from "@/lib/visibility/types";

export const METHODOLOGY_VERSION = "0.1.0-draft";

export const THRESHOLDS = Object.freeze({
  categoryMinCoverage: 0.5,
  pillarMinShownWeight: 30,
  overallMinShownWeight: 70,
});

const HEUR_NOTE =
  "Heuristic: the thresholds are a DataBridges judgement and change only through a versioned release.";
const RAW_HTML_NOTE = "Reads the raw HTML only; content added by JavaScript is not seen.";
const META_PAGE_APPLIES =
  "Every sampled page that was fetched and parsed; render-dependent pages are included because this reads only the URL, headers or head.";
const URL_ONLY_PAGE_APPLIES =
  "Every sampled page, whether or not its HTML could be parsed, because this reads only the page address and the fetch record.";
const BODY_PAGE_APPLIES =
  "Every sampled page that was fetched and parsed; a render-dependent page is NOT_OBSERVED for this metric.";

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

type MetricSeed = Omit<MetricDefinitionExt, "version">;

const METRIC_SEEDS: MetricSeed[] = [
  {
    id: "S1.01",
    categoryId: "S1",
    name: "Pages are indexable",
    maxPoints: 25,
    scope: "P",
    reads: "meta",
    basis: "VENDOR",
    evidenceType: "OBSERVED",
    description:
      "Whether each sampled page is open to indexing, based on robots meta tags and X-Robots-Tag headers.",
    applicabilityRule: META_PAGE_APPLIES,
    evaluationRule:
      "Page score 1 if there is no noindex or none directive in meta robots, googlebot or bingbot, or in X-Robots-Tag (no agent prefix, or a googlebot or bingbot prefix); otherwise 0. Metric score is the mean page score.",
    limitations: [
      "An intentional noindex on a page such as a thank-you page can enter the sample and lower the score.",
    ],
    humanReviewWhen: ["The homepage scores FAIL (this feeds critical finding CF-02)."],
    fixGuidance:
      "Consider checking whether any robots meta tag or X-Robots-Tag header marks a page as noindex or none, and removing the directive from pages you want search engines to index.",
  },
  {
    id: "S1.02",
    categoryId: "S1",
    name: "Crawlable by Googlebot and bingbot",
    maxPoints: 25,
    scope: "P",
    reads: "meta",
    basis: "STD",
    evidenceType: "DERIVED",
    description:
      "Whether robots.txt allows Googlebot and bingbot to crawl each sampled page.",
    applicabilityRule:
      "Every sampled page, for each of the two agents (Googlebot and bingbot).",
    evaluationRule:
      "Per (agent, page) pair: 1 if robots.txt allows the URL under RFC 9309 matching, else 0. Score is allowed pairs divided by all pairs. A 4xx robots.txt response counts as allowed; a 5xx response or a timeout gives SCAN_ERROR.",
    limitations: [
      "A transient 5xx response on robots.txt gives SCAN_ERROR rather than a failure.",
      "Evaluates the robots.txt rules only; it does not test whether a crawler actually fetches the page.",
    ],
    humanReviewWhen: [
      "The homepage scores FAIL (this feeds critical finding CF-01).",
      "The result is SCAN_ERROR because robots.txt returned a 5xx response or timed out.",
    ],
    fixGuidance:
      "Consider reviewing the robots.txt rules that apply to Googlebot, bingbot and the wildcard group, and removing any Disallow rule that blocks pages you want to appear in search results.",
  },
  {
    id: "S1.03",
    categoryId: "S1",
    name: "Valid XML sitemap discoverable",
    maxPoints: 20,
    scope: "S",
    reads: "site",
    basis: "STD",
    evidenceType: "OBSERVED",
    description:
      "Whether a well-formed XML sitemap listing same-site URLs can be found from robots.txt or at /sitemap.xml.",
    applicabilityRule: "Always applies (site level).",
    evaluationRule:
      "1: found (robots.txt Sitemap line, else /sitemap.xml), 2xx, root urlset or sitemapindex, with at least one same-site loc. 0.5: found but malformed or with no same-site URL. 0: not found.",
    limitations: ["A sitemap served only to browsers can appear missing to the scanner."],
    humanReviewWhen: [
      "The site owner reports a sitemap that the scanner could not retrieve.",
    ],
    fixGuidance:
      "Consider publishing an XML sitemap that lists your main pages and referencing it with a Sitemap line in robots.txt.",
  },
  {
    id: "S1.04",
    categoryId: "S1",
    name: "Canonical URL is consistent",
    maxPoints: 20,
    scope: "P",
    reads: "meta",
    basis: "VENDOR",
    evidenceType: "OBSERVED",
    description:
      "Whether each sampled page declares exactly one canonical URL that matches its own address.",
    applicabilityRule: META_PAGE_APPLIES,
    evaluationRule:
      "Page score 1: exactly one canonical (head or Link header) equal to the page's own normalised final URL. 0.5: exactly one, pointing to a different same-site URL. 0: missing, conflicting, cross-site or non-HTTP.",
    limitations: ["A canonical declared through an unusual mechanism may not be detected."],
    humanReviewWhen: [
      "The canonical appears to be set through an unusual mechanism.",
      "The homepage canonical points to a different site (this feeds critical finding CF-06).",
    ],
    fixGuidance:
      "Consider giving each page a single canonical link that points to its own preferred address on your own site.",
  },
  {
    id: "S1.05",
    categoryId: "S1",
    name: "Page returns success directly",
    maxPoints: 10,
    scope: "P",
    reads: "meta",
    basis: "HEUR",
    evidenceType: "OBSERVED",
    description:
      "Whether each sampled page responds with success directly or after only a few redirects.",
    applicabilityRule: URL_ONLY_PAGE_APPLIES,
    evaluationRule:
      "Page score 1: final 2xx with at most 1 redirect hop. 0.5: final 2xx after 2 to 3 hops. 0: final 4xx or 5xx, or more than 3 hops.",
    limitations: [HEUR_NOTE],
    humanReviewWhen: [],
    fixGuidance:
      "Consider linking to the final address of each page and shortening redirect chains so a page responds directly or after a single redirect.",
  },
  {
    id: "S2.01",
    categoryId: "S2",
    name: "Title tag",
    maxPoints: 20,
    scope: "P",
    reads: "meta",
    basis: "HEUR",
    evidenceType: "OBSERVED",
    description: "Whether each sampled page has one title of a sensible length.",
    applicabilityRule: META_PAGE_APPLIES,
    evaluationRule:
      "Page score 1: exactly one non-empty title of 20 to 65 characters. 0.5: exactly one of 10 to 19 or 66 to 90 characters. 0: missing, empty, multiple, under 10 or over 90.",
    limitations: [
      HEUR_NOTE,
      "A title set client-side can leave a generic placeholder in the raw head; it is scored as observed.",
      "Non-Latin scripts change the meaning of character counts.",
    ],
    humanReviewWhen: [
      "The evidence shows a generic placeholder title that JavaScript may replace.",
    ],
    fixGuidance:
      "Consider giving each page one distinct title of roughly 20 to 65 characters that describes what the page is about.",
  },
  {
    id: "S2.02",
    categoryId: "S2",
    name: "Titles are unique",
    maxPoints: 10,
    scope: "S",
    reads: "site",
    basis: "VENDOR",
    evidenceType: "DERIVED",
    description: "Whether the sampled pages carry different titles from one another.",
    applicabilityRule: "NOT_APPLICABLE if fewer than 2 sampled pages have a title.",
    evaluationRule:
      "Score is distinct normalised titles divided by titled pages.",
    limitations: [
      "Compares only the sampled pages, not the whole site.",
    ],
    humanReviewWhen: [],
    fixGuidance:
      "Consider checking that each page has its own title rather than a title shared with other pages.",
  },
  {
    id: "S2.03",
    categoryId: "S2",
    name: "Meta description",
    maxPoints: 15,
    scope: "P",
    reads: "meta",
    basis: "HEUR",
    evidenceType: "OBSERVED",
    description: "Whether each sampled page has one meta description of a sensible length.",
    applicabilityRule: META_PAGE_APPLIES,
    evaluationRule:
      "Page score 1: exactly one meta name=description of 70 to 160 characters. 0.5: exactly one of 30 to 69 or 161 to 220. 0: missing, empty, multiple, under 30 or over 220.",
    limitations: [
      HEUR_NOTE,
      "Search engines may rewrite descriptions.",
      "Non-Latin scripts change the meaning of character counts.",
    ],
    humanReviewWhen: [],
    fixGuidance:
      "Consider writing one meta description of roughly 70 to 160 characters per page that summarises what the page covers.",
  },
  {
    id: "S2.04",
    categoryId: "S2",
    name: "Descriptions are unique",
    maxPoints: 5,
    scope: "S",
    reads: "site",
    basis: "VENDOR",
    evidenceType: "DERIVED",
    description:
      "Whether the sampled pages carry different meta descriptions from one another.",
    applicabilityRule:
      "NOT_APPLICABLE if fewer than 2 sampled pages have a meta description.",
    evaluationRule:
      "Score is distinct normalised descriptions divided by pages with a description (as S2.02, for descriptions).",
    limitations: ["Compares only the sampled pages, not the whole site."],
    humanReviewWhen: [],
    fixGuidance:
      "Consider writing a distinct meta description for each page instead of reusing the same text.",
  },
  {
    id: "S2.05",
    categoryId: "S2",
    name: "Single H1",
    maxPoints: 15,
    scope: "P",
    reads: "body",
    basis: "HEUR",
    evidenceType: "OBSERVED",
    description: "Whether each sampled page has one main h1 heading.",
    applicabilityRule: BODY_PAGE_APPLIES,
    evaluationRule:
      "Page score 1: exactly one non-empty h1. 0.5: two or more non-empty h1 elements. 0: none.",
    limitations: [HEUR_NOTE, RAW_HTML_NOTE],
    humanReviewWhen: [],
    fixGuidance:
      "Consider using exactly one h1 heading per page that names the main topic of the page.",
  },
  {
    id: "S2.06",
    categoryId: "S2",
    name: "Heading hierarchy",
    maxPoints: 10,
    scope: "P",
    reads: "body",
    basis: "STD",
    evidenceType: "DERIVED",
    description: "Whether headings descend in order without skipping levels.",
    applicabilityRule: BODY_PAGE_APPLIES,
    evaluationRule:
      "A skip is a jump of more than one level downward (for example h2 to h4). Page score 1: zero skips, and at least one h2 on pages of 300 or more words. 0.5: 1 to 2 skips. 0: 3 or more skips, or 300 or more words with no h2.",
    limitations: [RAW_HTML_NOTE],
    humanReviewWhen: [],
    fixGuidance:
      "Consider ordering headings so that levels do not skip (for example h2 followed by h3 rather than h4), and adding h2 subheadings to longer pages.",
  },
  {
    id: "S2.07",
    categoryId: "S2",
    name: "Image alt attributes",
    maxPoints: 10,
    scope: "P",
    reads: "body",
    basis: "STD",
    evidenceType: "DERIVED",
    description: "Whether content images carry an alt attribute.",
    applicabilityRule:
      "NOT_APPLICABLE if the sample has no content images. Excluded: role=presentation, aria-hidden=true, and images with a width or height attribute of 2 or less. A render-dependent page is NOT_OBSERVED.",
    evaluationRule:
      "Page score is content images with an alt attribute divided by content images; an empty alt counts as an explicit decorative mark.",
    limitations: [
      RAW_HTML_NOTE,
      "Checks that an alt attribute exists, not that its text is good.",
    ],
    humanReviewWhen: [],
    fixGuidance:
      "Consider adding an alt attribute to each content image that describes it, and an empty alt attribute for purely decorative images.",
  },
  {
    id: "S2.08",
    categoryId: "S2",
    name: "Language declared",
    maxPoints: 5,
    scope: "P",
    reads: "meta",
    basis: "STD",
    evidenceType: "OBSERVED",
    description: "Whether each sampled page declares a valid language on the html element.",
    applicabilityRule: META_PAGE_APPLIES,
    evaluationRule:
      "Page score 1 if html lang matches ^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$; otherwise 0.",
    limitations: ["Checks the form of the language code, not that it matches the text."],
    humanReviewWhen: [],
    fixGuidance:
      "Consider declaring the page language with a valid lang attribute on the html element, such as en-IE.",
  },
  {
    id: "S2.09",
    categoryId: "S2",
    name: "Share-preview tags",
    maxPoints: 10,
    scope: "P",
    reads: "meta",
    basis: "STD",
    evidenceType: "OBSERVED",
    description:
      "Whether each sampled page carries the Open Graph tags used for link previews.",
    applicabilityRule: META_PAGE_APPLIES,
    evaluationRule:
      "Page score is the number present of og:title, og:description and og:image (an absolute https URL), divided by 3.",
    limitations: ["Checks that tags are present; it does not render a preview."],
    humanReviewWhen: [],
    fixGuidance:
      "Consider adding Open Graph og:title, og:description and og:image tags, with an absolute https image address, so shared links show a clear preview.",
  },
  {
    id: "S3.01",
    categoryId: "S3",
    name: "HTTPS enforced",
    maxPoints: 20,
    scope: "S",
    reads: "site",
    basis: "VENDOR",
    evidenceType: "OBSERVED",
    description: "Whether the http version of the site redirects to https.",
    applicabilityRule:
      "Applies once the http address has been requested; NOT_OBSERVED if port 80 refuses or times out.",
    evaluationRule:
      "Request http://host/. 1: permanent redirect (301 or 308) reaching same-site https within 2 hops. 0.5: reaches https via 302 or 307. 0: serves 2xx over HTTP, or no HTTPS. When the homepage could only be fetched over http, the result is FAIL.",
    limitations: [
      "A closed port 80 is not a failure; it is not observed.",
    ],
    humanReviewWhen: [
      "HTTPS is not served (this feeds critical finding CF-05).",
    ],
    fixGuidance:
      "Consider redirecting http addresses to https with a permanent (301 or 308) redirect so that only the https version of each page is served.",
  },
  {
    id: "S3.02",
    categoryId: "S3",
    name: "Valid TLS certificate",
    maxPoints: 10,
    scope: "S",
    reads: "site",
    basis: "STD",
    evidenceType: "OBSERVED",
    description: "Whether the site presents a valid, unexpired TLS certificate for its hostname.",
    applicabilityRule: "Always applies (site level).",
    evaluationRule:
      "1: chain valid, hostname matches, at least 14 days to expiry. 0.5: valid but under 14 days to expiry. 0: expired, mismatched, self-signed or incomplete chain. When the homepage could only be fetched over http, the result is FAIL.",
    limitations: [
      "If the certificate is invalid the scan continues without verification for that origin, read-only.",
    ],
    humanReviewWhen: [
      "The certificate is reported invalid or expired (this feeds critical finding CF-05).",
    ],
    fixGuidance:
      "Consider checking that your TLS certificate covers the site name, is served with its full chain, and is renewed well before it expires.",
  },
  {
    id: "S3.03",
    categoryId: "S3",
    name: "Mobile viewport",
    maxPoints: 15,
    scope: "P",
    reads: "meta",
    basis: "VENDOR",
    evidenceType: "OBSERVED",
    description: "Whether each sampled page declares a mobile-friendly viewport.",
    applicabilityRule: META_PAGE_APPLIES,
    evaluationRule:
      "Page score 1 if meta name=viewport content includes width=device-width; otherwise 0.",
    limitations: ["Checks the viewport tag only; it does not test the layout on a device."],
    humanReviewWhen: [],
    fixGuidance:
      "Consider adding a viewport meta tag containing width=device-width so pages scale to mobile screens.",
  },
  {
    id: "S3.04",
    categoryId: "S3",
    name: "Response compression",
    maxPoints: 10,
    scope: "S",
    reads: "site",
    basis: "VENDOR",
    evidenceType: "OBSERVED",
    description: "Whether the homepage HTML is served compressed.",
    applicabilityRule: "NOT_APPLICABLE if the uncompressed HTML is under 1 KB.",
    evaluationRule:
      "Homepage requested with Accept-Encoding: gzip, br. 1 if Content-Encoding is gzip, br or zstd; otherwise 0.",
    limitations: ["A CDN may compress differently for other resources or clients."],
    humanReviewWhen: [],
    fixGuidance:
      "Consider enabling gzip or Brotli compression for HTML responses on your web server or CDN.",
  },
  {
    id: "S3.05",
    categoryId: "S3",
    name: "Server response time",
    maxPoints: 10,
    scope: "S",
    reads: "site",
    basis: "HEUR",
    evidenceType: "DERIVED",
    description: "How quickly the homepage starts to respond, as a median of three requests.",
    applicabilityRule:
      "NOT_OBSERVED if fewer than 2 homepage samples succeeded.",
    evaluationRule:
      "Median of 3 sequential homepage requests, measured after connection setup to first byte. 1: 800 ms or less. 0.5: up to 1,800 ms. 0: above.",
    limitations: [
      HEUR_NOTE,
      "Timing differs by scanner region and time of day, so the bands are wide and the weight is low.",
    ],
    humanReviewWhen: [],
    fixGuidance:
      "Consider reviewing hosting, caching and server-side work if the homepage is slow to start responding.",
  },
  {
    id: "S3.06",
    categoryId: "S3",
    name: "Broken internal links",
    maxPoints: 25,
    scope: "S",
    reads: "site",
    basis: "HEUR",
    evidenceType: "DERIVED",
    description: "Whether internal links found on the sampled pages lead to working pages.",
    applicabilityRule:
      "NOT_OBSERVED if fewer than 5 link targets were observed.",
    evaluationRule:
      "Up to 10 same-site link targets per sampled page (main-content links first, then others, in DOM order), 40 per job. Broken = 404, 410 or 5xx after one retry. 401, 403, 429 and timeouts are unobserved and excluded. Score is 1 minus broken divided by observed.",
    limitations: [
      HEUR_NOTE,
      "A bot challenge or geo-block can return 403 to the scanner; that is excluded and recorded as an informational finding, not a penalty.",
      "A CDN may treat HEAD differently from GET.",
    ],
    humanReviewWhen: [
      "Many links are unobserved because of 403 or 429 responses.",
    ],
    fixGuidance:
      "Consider fixing or removing internal links that lead to pages returning 404, 410 or server errors.",
  },
  {
    id: "S3.07",
    categoryId: "S3",
    name: "No mixed content",
    maxPoints: 10,
    scope: "P",
    reads: "body",
    basis: "STD",
    evidenceType: "OBSERVED",
    description: "Whether https pages load any resources over plain http.",
    applicabilityRule:
      "Applies to https pages only. A render-dependent page is NOT_OBSERVED.",
    evaluationRule:
      "Page score 1 if there is no http:// subresource; 0.5 if only passive (img, audio, video); 0 if any active (script, stylesheet, iframe).",
    limitations: [RAW_HTML_NOTE],
    humanReviewWhen: [],
    fixGuidance:
      "Consider loading images, scripts, stylesheets and frames over https so that https pages contain no http resources.",
  },
  {
    id: "S4.01",
    categoryId: "S4",
    name: "Content depth",
    maxPoints: 30,
    scope: "CP",
    reads: "body",
    basis: "HEUR",
    evidenceType: "DERIVED",
    description: "Whether the main content of each content page has a reasonable amount of text.",
    applicabilityRule:
      "Sampled content pages only (home, about, services, faq, article, other); contact and legal pages are excluded. Word counts do not apply where html lang is zh, ja, ko or th. A render-dependent page is NOT_OBSERVED.",
    evaluationRule:
      "Page score 1: main content of 300 or more words. 0.5: 150 to 299. 0: under 150.",
    limitations: [
      HEUR_NOTE,
      RAW_HTML_NOTE,
      "Main-content extraction can pull in a mega-menu and overstate the word count.",
    ],
    humanReviewWhen: [],
    fixGuidance:
      "Consider whether your main pages say enough to answer the questions a visitor would bring, and expanding thin pages where it adds genuine value.",
  },
  {
    id: "S4.02",
    categoryId: "S4",
    name: "Internal link breadth",
    maxPoints: 20,
    scope: "H",
    reads: "body",
    basis: "HEUR",
    evidenceType: "DERIVED",
    description: "How many distinct same-site pages the homepage links to.",
    applicabilityRule:
      "Homepage only. NOT_OBSERVED if the homepage is render-dependent.",
    evaluationRule:
      "Distinct same-site link targets on the homepage (nav, main, footer; excluding itself, fragments, mailto, tel and javascript). 1: 8 or more. 0.5: 3 to 7. 0: 2 or fewer.",
    limitations: [HEUR_NOTE, RAW_HTML_NOTE],
    humanReviewWhen: [],
    fixGuidance:
      "Consider linking from the homepage to your main sections so visitors and crawlers can reach them directly.",
  },
  {
    id: "S4.03",
    categoryId: "S4",
    name: "Descriptive anchor text",
    maxPoints: 20,
    scope: "P",
    reads: "body",
    basis: "HEUR",
    evidenceType: "DERIVED",
    description: "Whether internal links use descriptive text instead of generic phrases.",
    applicabilityRule: BODY_PAGE_APPLIES,
    evaluationRule:
      "Page score is same-site links with a non-empty accessible name (visible text, else aria-label, else image alt) that is not in the generic-anchor list, divided by all same-site links.",
    limitations: [
      HEUR_NOTE,
      RAW_HTML_NOTE,
      "Icon-only links without an accessible name count as non-descriptive.",
    ],
    humanReviewWhen: [],
    fixGuidance:
      "Consider using link text that describes the destination instead of phrases such as click here or read more.",
  },
  {
    id: "S4.04",
    categoryId: "S4",
    name: "Distinct content",
    maxPoints: 10,
    scope: "S",
    reads: "body",
    basis: "HEUR",
    evidenceType: "DERIVED",
    description: "Whether the sampled content pages carry different main text from one another.",
    applicabilityRule:
      "NOT_APPLICABLE below 2 content pages. A render-dependent page is NOT_OBSERVED.",
    evaluationRule:
      "Score is 1 minus (pages in identical-text sets divided by content pages), comparing a SHA-256 of the normalised main text.",
    limitations: [HEUR_NOTE, RAW_HTML_NOTE],
    humanReviewWhen: [],
    fixGuidance:
      "Consider making sure each page has its own main content rather than repeating the same text on several addresses.",
  },
  {
    id: "S4.05",
    categoryId: "S4",
    name: "Clean URLs",
    maxPoints: 10,
    scope: "P",
    reads: "meta",
    basis: "HEUR",
    evidenceType: "OBSERVED",
    description: "Whether page addresses are short and readable.",
    applicabilityRule: URL_ONLY_PAGE_APPLIES,
    evaluationRule:
      "Violations: uppercase in the path, a space or %20, an underscore, a path over 100 characters, a query string, or a session-style parameter (sid, phpsessid, jsessionid, sessionid). Page score 1: none. 0.5: one. 0: two or more.",
    limitations: [HEUR_NOTE],
    humanReviewWhen: [],
    fixGuidance:
      "Consider using short, lowercase, readable addresses without spaces, underscores, session parameters or unnecessary query strings.",
  },
  {
    id: "S4.06",
    categoryId: "S4",
    name: "Site navigation",
    maxPoints: 10,
    scope: "P",
    reads: "body",
    basis: "HEUR",
    evidenceType: "OBSERVED",
    description: "Whether each sampled page has a navigation block with same-site links.",
    applicabilityRule: BODY_PAGE_APPLIES,
    evaluationRule:
      "Page score 1: a nav or role=navigation block containing 3 or more same-site links. 0.5: one containing 1 to 2. 0: none.",
    limitations: [HEUR_NOTE, RAW_HTML_NOTE],
    humanReviewWhen: [],
    fixGuidance:
      "Consider adding a navigation block with links to your main sections on every page.",
  },
  {
    id: "A1.01",
    categoryId: "A1",
    name: "AI search and answer crawlers allowed",
    maxPoints: 40,
    scope: "P",
    reads: "meta",
    basis: "VENDOR",
    evidenceType: "DERIVED",
    description:
      "Whether robots.txt allows the crawlers that build AI search and answer indexes to reach each sampled page.",
    applicabilityRule:
      "Every sampled page, for each of OAI-SearchBot, PerplexityBot and Claude-SearchBot, whether or not the page itself could be fetched. If robots.txt could not be read (a 5xx response or a timeout) the result is SCAN_ERROR, as for S1.02.",
    evaluationRule:
      "Per (agent, page) pair: 1 if allowed by RFC 9309 matching, else 0. Score is allowed pairs divided by all pairs.",
    limitations: [
      "Opting out of model-training crawlers is a legitimate choice and is not scored.",
      "User-initiated agents are informational because vendors state they may not apply robots.txt.",
      "The agent list is reviewed periodically and can change between releases.",
    ],
    humanReviewWhen: [
      "A score change is caused by an update to the AI crawler list.",
      "All three agents are disallowed for the homepage (this feeds critical finding CF-03).",
    ],
    fixGuidance:
      "Consider reviewing robots.txt for rules that block OAI-SearchBot, PerplexityBot or Claude-SearchBot from pages you want to appear in AI-generated answers; blocking model-training crawlers is a separate choice and is not scored.",
  },
  {
    id: "A1.02",
    categoryId: "A1",
    name: "Snippet and preview eligibility",
    maxPoints: 15,
    scope: "P",
    reads: "meta",
    basis: "VENDOR",
    evidenceType: "OBSERVED",
    description:
      "Whether snippet-limiting directives restrict how much of a page can be shown in results and answers.",
    applicabilityRule: META_PAGE_APPLIES,
    evaluationRule:
      "Page score 1: no nosnippet, no max-snippet:0 and no none (meta or X-Robots-Tag). 0.5: max-snippet between 1 and 49. 0: nosnippet, max-snippet:0 or none.",
    limitations: [
      "Snippet limits can be a deliberate choice for some content.",
    ],
    humanReviewWhen: [],
    fixGuidance:
      "Consider checking whether nosnippet, max-snippet or none directives limit how much of a page can be shown in search results and answers, and relaxing them where that suits your goals.",
  },
  {
    id: "A1.03",
    categoryId: "A1",
    name: "llms.txt present",
    maxPoints: 5,
    scope: "S",
    reads: "site",
    basis: "HEUR",
    evidenceType: "OBSERVED",
    description: "Whether an llms.txt file with recognisable structure is published.",
    applicabilityRule: "Always applies (site level).",
    evaluationRule:
      "1: /llms.txt returns 2xx text with at least one heading line starting '# ' and at least one link. 0.5: exists but has no recognisable structure. 0: not found.",
    limitations: [
      HEUR_NOTE,
      "llms.txt is an emerging convention with no confirmed retrieval benefit, so it carries few points.",
    ],
    humanReviewWhen: [
      "Before each release, re-verify the status of the llms.txt convention.",
    ],
    fixGuidance:
      "Consider adding a plain-text llms.txt file at the root of the site with a heading and links to your key pages; this convention is emerging and its benefit is unconfirmed.",
  },
  {
    id: "A1.04",
    categoryId: "A1",
    name: "Primary content in the initial HTML",
    maxPoints: 40,
    scope: "CP",
    reads: "meta",
    basis: "VENDOR",
    evidenceType: "OBSERVED",
    description:
      "Whether the main content of each content page is present in the raw HTML a non-rendering crawler receives.",
    applicabilityRule:
      "Sampled content pages only (home, about, services, faq, article, other). Evaluated on render-dependent pages, because this metric carries their penalty. Word counts do not apply where html lang is zh, ja, ko or th.",
    evaluationRule:
      "Page score 1 if main content has 50 or more words in the raw HTML; 0 otherwise (thin or render-dependent).",
    limitations: [
      RAW_HTML_NOTE,
      "A genuinely short page can score 0 without being render-dependent.",
    ],
    humanReviewWhen: [
      "The homepage is render-dependent (this feeds critical finding CF-04).",
    ],
    fixGuidance:
      "Consider making sure the main content of each page is present in the HTML the server sends, rather than being added only later by JavaScript.",
  },
  {
    id: "A2.01",
    categoryId: "A2",
    name: "Valid JSON-LD",
    maxPoints: 15,
    scope: "P",
    reads: "meta",
    basis: "VENDOR",
    evidenceType: "OBSERVED",
    description: "Whether each sampled page carries well-formed JSON-LD structured data.",
    applicabilityRule: META_PAGE_APPLIES,
    evaluationRule:
      "Page score 1: at least one block, all parse, each with a schema.org @context and @type or @graph. 0.5: at least one valid and one invalid block, or microdata or RDFa only (itemscope seen). 0: none, or none valid.",
    limitations: [
      "JSON-LD injected only by client-side JavaScript is invisible to a non-rendering crawler and scores as absent.",
    ],
    humanReviewWhen: [],
    fixGuidance:
      "Consider adding JSON-LD structured data that parses as valid JSON and declares a schema.org @context and @type.",
  },
  {
    id: "A2.02",
    categoryId: "A2",
    name: "Organisation identity",
    maxPoints: 20,
    scope: "H",
    reads: "meta",
    basis: "STD",
    evidenceType: "DERIVED",
    description:
      "How completely the homepage structured data describes the organisation behind the site.",
    applicabilityRule:
      "Homepage only. Reads the first Organization-family node (a Person node is accepted for sole traders).",
    evaluationRule:
      "Points out of 20: name and url present (8), logo or image (4), at least one of telephone, email, address or contactPoint (4), non-empty description (4). Score is points divided by 20; no such node scores 0.",
    limitations: ["Checks which properties are present, not whether they are accurate."],
    humanReviewWhen: [],
    fixGuidance:
      "Consider adding Organization (or Person) structured data to the homepage with name, url, logo, contact details and a short description.",
  },
  {
    id: "A2.03",
    categoryId: "A2",
    name: "Profile links (sameAs)",
    maxPoints: 10,
    scope: "H",
    reads: "meta",
    basis: "HEUR",
    evidenceType: "DERIVED",
    description:
      "How many profiles on other sites the homepage structured data links to with sameAs.",
    applicabilityRule: "Homepage only.",
    evaluationRule:
      "Distinct absolute https URLs on other hosts. 1: 2 or more. 0.5: one. 0: none. Targets are not fetched.",
    limitations: [HEUR_NOTE, "The linked profiles are not fetched or checked."],
    humanReviewWhen: [],
    fixGuidance:
      "Consider listing your official profiles on other sites in the sameAs property of your Organization structured data.",
  },
  {
    id: "A2.04",
    categoryId: "A2",
    name: "Identity graph coherence",
    maxPoints: 10,
    scope: "S",
    reads: "site",
    basis: "STD",
    evidenceType: "DERIVED",
    description:
      "Whether @id references in structured data point to nodes that are defined.",
    applicabilityRule: "NOT_APPLICABLE if there are no references.",
    evaluationRule:
      "A reference is an object holding only @id. It resolves if a node with that @id and other properties exists on the same page or on the homepage. Score is resolved divided by references.",
    limitations: ["Only the sampled pages are searched for definitions."],
    humanReviewWhen: [],
    fixGuidance:
      "Consider making sure every @id reference in your structured data points to a node that is defined on the same page or on the homepage.",
  },
  {
    id: "A2.05",
    categoryId: "A2",
    name: "Page-type schema",
    maxPoints: 15,
    scope: "P",
    reads: "meta",
    basis: "STD",
    evidenceType: "DERIVED",
    description:
      "Whether article, FAQ, service and about pages carry structured data suited to their type.",
    applicabilityRule:
      "NOT_APPLICABLE if no sampled page has an expectation for its type.",
    evaluationRule:
      "Page score is checks passed divided by checks. Article: an Article-family node, headline, datePublished and author.name. FAQ: FAQPage, at least 2 Question nodes, each with acceptedAnswer.text. Services: a Service, Product or OfferCatalog node with name and description. About: an AboutPage, ProfilePage or Person node.",
    limitations: [
      "FAQ checks are kept as an answer-structure and entity-clarity signal, not a rich-result prediction.",
    ],
    humanReviewWhen: [],
    fixGuidance:
      "Consider adding structured data that matches the page type, such as Article, FAQPage, Service or AboutPage, with the key properties filled in.",
  },
  {
    id: "A2.06",
    categoryId: "A2",
    name: "Breadcrumbs",
    maxPoints: 5,
    scope: "P",
    reads: "meta",
    basis: "VENDOR",
    evidenceType: "OBSERVED",
    description: "Whether pages below the top level carry breadcrumb structured data.",
    applicabilityRule:
      "Pages with a path depth of 2 or more. NOT_APPLICABLE if no sampled page qualifies.",
    evaluationRule:
      "Page score 1 if a BreadcrumbList has at least 2 items, each with name and with item or position; otherwise 0.",
    limitations: ["Breadcrumbs may be unnecessary on some small sites."],
    humanReviewWhen: [],
    fixGuidance:
      "Consider adding BreadcrumbList structured data to pages below the top level, with a name and an item or position for each step.",
  },
  {
    id: "A2.07",
    categoryId: "A2",
    name: "Schema matches visible content",
    maxPoints: 15,
    scope: "P",
    reads: "body",
    basis: "HEUR",
    evidenceType: "DERIVED",
    description:
      "Whether names, questions and headlines in structured data also appear in the visible page.",
    applicabilityRule:
      "NOT_APPLICABLE if no check applies on any sampled page. A render-dependent page is NOT_OBSERVED.",
    evaluationRule:
      "Applicable checks per page: the Organization name appears in the visible text or title; each FAQ Question text appears in the visible text; an Article headline equals or is contained in the h1 or title (normalised). Page score is passed divided by applicable.",
    limitations: [HEUR_NOTE, RAW_HTML_NOTE],
    humanReviewWhen: [],
    fixGuidance:
      "Consider making sure the names, questions and headlines in your structured data also appear in the visible text of the page.",
  },
  {
    id: "A2.08",
    categoryId: "A2",
    name: "Name consistency",
    maxPoints: 10,
    scope: "H",
    reads: "meta",
    basis: "HEUR",
    evidenceType: "DERIVED",
    description:
      "Whether the organisation name is used consistently in structured data, og:site_name and the title.",
    applicabilityRule: "NOT_APPLICABLE if there is no JSON-LD organisation name.",
    evaluationRule:
      "Compare the JSON-LD organisation name, og:site_name and the title. 1: the JSON-LD name equals og:site_name and appears in the title. 0.5: one of the two holds. 0: neither.",
    limitations: [HEUR_NOTE],
    humanReviewWhen: [],
    fixGuidance:
      "Consider using the same business name in your structured data, og:site_name and page titles.",
  },
  {
    id: "A3.01",
    categoryId: "A3",
    name: "Question-style headings",
    maxPoints: 10,
    scope: "KO",
    reads: "body",
    basis: "HEUR",
    evidenceType: "DERIVED",
    description: "How many subheadings are phrased as questions.",
    applicabilityRule:
      "Applies only where html lang starts with en (otherwise NOT_APPLICABLE). Knowledge pages only (services, faq, article, other); at least 3 subheadings (h2 and h3 in main content) are needed. A render-dependent page is NOT_OBSERVED.",
    evaluationRule:
      "A question ends with ? or starts with a word in the question-starter list. Page score 1: 25% or more of subheadings are questions. 0.5: 10% to 24%. 0: under 10%.",
    limitations: [
      HEUR_NOTE,
      RAW_HTML_NOTE,
      "This is a proxy for being easy to quote and can reward formulaic writing.",
    ],
    humanReviewWhen: [],
    fixGuidance:
      "Consider writing some subheadings as the questions your readers ask.",
  },
  {
    id: "A3.02",
    categoryId: "A3",
    name: "Answer-first sections",
    maxPoints: 30,
    scope: "KO",
    reads: "body",
    basis: "HEUR",
    evidenceType: "DERIVED",
    description:
      "Whether sections open with a short, direct answer paragraph under each subheading.",
    applicabilityRule:
      "Knowledge pages only (services, faq, article, other); at least 3 subheadings are needed. A render-dependent page is NOT_OBSERVED.",
    evaluationRule:
      "For each subheading, the first p before the next heading of the same or higher level is an answer block if it has 15 to 70 words and at most 3 sentences. Page score 1 if 60% or more of subheadings qualify, 0.5 if 30% to 59%, else 0.",
    limitations: [
      HEUR_NOTE,
      RAW_HTML_NOTE,
      "This is a proxy for being easy to quote and can reward formulaic writing.",
    ],
    humanReviewWhen: [
      "A page scores 0 but a reviewer judges it clearly answer-first.",
    ],
    fixGuidance:
      "Consider opening each subheading section with a short, direct answer paragraph before adding detail.",
  },
  {
    id: "A3.03",
    categoryId: "A3",
    name: "FAQ block present",
    maxPoints: 20,
    scope: "S",
    reads: "body",
    basis: "HEUR",
    evidenceType: "DERIVED",
    description: "Whether any sampled page presents question and answer pairs.",
    applicabilityRule:
      "Always applies (site level). A render-dependent page is NOT_OBSERVED.",
    evaluationRule:
      "Pairs are detected as details plus summary, dl with dt and dd, or a question-form heading followed by a paragraph. 1: at least one sampled page with 3 or more pairs. 0.5: 1 to 2 pairs at most. 0: none.",
    limitations: [HEUR_NOTE, RAW_HTML_NOTE],
    humanReviewWhen: [],
    fixGuidance:
      "Consider adding a visible FAQ section with at least three question and answer pairs where it suits the page.",
  },
  {
    id: "A3.04",
    categoryId: "A3",
    name: "Scannable structure",
    maxPoints: 15,
    scope: "KO",
    reads: "body",
    basis: "HEUR",
    evidenceType: "DERIVED",
    description: "Whether longer pages use lists or tables to organise information.",
    applicabilityRule:
      "NOT_APPLICABLE for pages under 300 words. Knowledge pages only (services, faq, article, other). A render-dependent page is NOT_OBSERVED.",
    evaluationRule:
      "Page score 1 if main content has a list of 3 or more items, or a table with a header cell and at least 2 rows; otherwise 0.",
    limitations: [
      HEUR_NOTE,
      RAW_HTML_NOTE,
      "This is a proxy for being easy to quote and can reward formulaic writing.",
    ],
    humanReviewWhen: [],
    fixGuidance:
      "Consider using lists or tables for steps, options or comparisons on longer pages.",
  },
  {
    id: "A3.05",
    categoryId: "A3",
    name: "Sentence and paragraph length",
    maxPoints: 10,
    scope: "KO",
    reads: "body",
    basis: "HEUR",
    evidenceType: "DERIVED",
    description: "Whether typical sentences and paragraphs are of a readable length.",
    applicabilityRule:
      "Applies only where html lang starts with en (otherwise NOT_APPLICABLE). Knowledge pages only (services, faq, article, other). A render-dependent page is NOT_OBSERVED.",
    evaluationRule:
      "Page score 1: median sentence 24 words or fewer AND median paragraph 100 words or fewer. 0.5: one bound exceeded. 0: both exceeded.",
    limitations: [
      HEUR_NOTE,
      RAW_HTML_NOTE,
      "Sentence splitting is approximate; wide thresholds absorb abbreviation errors.",
    ],
    humanReviewWhen: [],
    fixGuidance:
      "Consider shortening very long sentences and paragraphs so key points are easy to read and quote.",
  },
  {
    id: "A3.06",
    categoryId: "A3",
    name: "Entity statement near the top",
    maxPoints: 15,
    scope: "H",
    reads: "body",
    basis: "HEUR",
    evidenceType: "DERIVED",
    description:
      "Whether the opening of the homepage states who the business is, where it works and what it does.",
    applicabilityRule:
      "Homepage only. A check applies only if its reference data exists in the JSON-LD. NOT_APPLICABLE if none apply. NOT_OBSERVED if the homepage is render-dependent.",
    evaluationRule:
      "Within the first 200 words of homepage main content: (a) the business name (JSON-LD organisation name, else og:site_name) appears; (b) a locality or area from the JSON-LD address or areaServed appears; (c) a term from knowsAbout or serviceType appears. Score is passed divided by applicable.",
    limitations: [
      HEUR_NOTE,
      RAW_HTML_NOTE,
      "This is a proxy for being easy to quote and can reward formulaic writing.",
    ],
    humanReviewWhen: [],
    fixGuidance:
      "Consider stating early on the homepage who you are, where you work and what you do, using the same names and terms as your structured data.",
  },
  {
    id: "A4.01",
    categoryId: "A4",
    name: "About page discoverable",
    maxPoints: 15,
    scope: "H",
    reads: "body",
    basis: "HEUR",
    evidenceType: "OBSERVED",
    description: "Whether the homepage links to an About page that loads.",
    applicabilityRule:
      "Homepage only. NOT_OBSERVED if the homepage is render-dependent.",
    evaluationRule:
      "1: the homepage links to a same-site URL matching the about-page patterns that returns 2xx. 0.5: such a URL appears only in the sitemap or a sampled page. 0: none.",
    limitations: [
      HEUR_NOTE,
      "Path patterns are English-centric.",
    ],
    humanReviewWhen: [],
    fixGuidance:
      "Consider linking to an About page from the homepage and checking that it loads.",
  },
  {
    id: "A4.02",
    categoryId: "A4",
    name: "Contact information visible",
    maxPoints: 15,
    scope: "H",
    reads: "body",
    basis: "HEUR",
    evidenceType: "DERIVED",
    description: "Whether the homepage shows ways to contact the business.",
    applicabilityRule:
      "Homepage only. NOT_OBSERVED if the homepage is render-dependent.",
    evaluationRule:
      "Signals: a mailto link or email text; a tel link or JSON-LD telephone; address text of 10 or more characters or JSON-LD address; a link matching the contact-page patterns. 0 signals: 0. 1 signal: 0.5. 2 signals: 0.75. 3 or more: 1.",
    limitations: [
      HEUR_NOTE,
      "Path patterns are English-centric.",
    ],
    humanReviewWhen: [],
    fixGuidance:
      "Consider showing your contact details clearly on the homepage, such as an email address, phone number, postal address or a link to a contact page.",
  },
  {
    id: "A4.03",
    categoryId: "A4",
    name: "Author attribution",
    maxPoints: 15,
    scope: "AP",
    reads: "body",
    basis: "HEUR",
    evidenceType: "OBSERVED",
    description: "Whether article pages name their author.",
    applicabilityRule:
      "Article pages only. NOT_APPLICABLE if no article page was sampled. A render-dependent page is NOT_OBSERVED.",
    evaluationRule:
      "Page score 1 if there is a visible byline (rel=author, itemprop=author, a byline or author class, or 'By ' within the first 400 characters) or a JSON-LD author name; otherwise 0.",
    limitations: [
      HEUR_NOTE,
      RAW_HTML_NOTE,
      "Bylines vary widely in markup and may not all be detected.",
    ],
    humanReviewWhen: [],
    fixGuidance:
      "Consider showing the author's name on each article, both as a visible byline and in structured data.",
  },
  {
    id: "A4.04",
    categoryId: "A4",
    name: "Dates on articles",
    maxPoints: 10,
    scope: "AP",
    reads: "body",
    basis: "HEUR",
    evidenceType: "OBSERVED",
    description: "Whether article pages show when they were published and updated.",
    applicabilityRule:
      "As A4.03: article pages only; NOT_APPLICABLE if no article page was sampled. A render-dependent page is NOT_OBSERVED.",
    evaluationRule:
      "Page score 0.5 for a published date (datePublished, or a time datetime in the byline or header) plus 0.5 for a modified date (dateModified).",
    limitations: [
      HEUR_NOTE,
      RAW_HTML_NOTE,
      "Dates can be generated automatically and may not reflect real editing.",
    ],
    humanReviewWhen: [],
    fixGuidance:
      "Consider showing a published date and a last-updated date on articles, in the page and in structured data.",
  },
  {
    id: "A4.05",
    categoryId: "A4",
    name: "Freshness",
    maxPoints: 20,
    scope: "S",
    reads: "site",
    basis: "HEUR",
    evidenceType: "DERIVED",
    description: "How recently the site shows evidence of being updated.",
    applicabilityRule:
      "NOT_OBSERVED if no valid date is found. Dates later than the scan time plus one day are ignored.",
    evaluationRule:
      "latest is the newest valid date among sitemap lastmod, JSON-LD dateModified and datePublished, and time datetime on sampled pages. Age is scan time minus latest. 1: 180 days or less. 0.5: 181 to 365 days. 0: over 365 days. Sitemap lastmod is ignored as evidence if all values are identical across 5 or more URLs (a build-time stamp).",
    limitations: [
      HEUR_NOTE,
      "Dates can be generated automatically and may not reflect real editing.",
    ],
    humanReviewWhen: [
      "The evidence names an auto-generated date source.",
    ],
    fixGuidance:
      "Consider reviewing whether your key pages carry accurate dates and are revisited regularly, and avoiding dates that do not reflect real updates.",
  },
  {
    id: "A4.06",
    categoryId: "A4",
    name: "Privacy policy linked",
    maxPoints: 10,
    scope: "H",
    reads: "body",
    basis: "HEUR",
    evidenceType: "OBSERVED",
    description:
      "Whether the homepage links to a privacy policy page; this records presence only.",
    applicabilityRule:
      "Homepage only. NOT_OBSERVED if the homepage is render-dependent.",
    evaluationRule:
      "1 if the homepage links to a same-site URL matching the privacy-page patterns; otherwise 0. This makes no compliance claim.",
    limitations: [
      HEUR_NOTE,
      "Presence only; this is not a legal or compliance assessment.",
      "Path patterns are English-centric.",
    ],
    humanReviewWhen: [],
    fixGuidance:
      "Consider linking to your privacy policy from the homepage.",
  },
  {
    id: "A4.07",
    categoryId: "A4",
    name: "External references",
    maxPoints: 15,
    scope: "KO",
    reads: "body",
    basis: "HEUR",
    evidenceType: "OBSERVED",
    description: "Whether knowledge pages link out to other sites.",
    applicabilityRule:
      "Knowledge pages only (services, faq, article, other). A render-dependent page is NOT_OBSERVED.",
    evaluationRule:
      "Page score 1 if main content has at least one outbound link to another site (http or https, not rel=sponsored or ugc, not a share link); otherwise 0. Presence only, with no judgement of authority.",
    limitations: [
      HEUR_NOTE,
      RAW_HTML_NOTE,
      "Presence only; the authority of the linked sites is not assessed.",
    ],
    humanReviewWhen: [],
    fixGuidance:
      "Consider linking to relevant outside sources where they help the reader.",
  },
];

const CATEGORY_SEEDS: {
  id: CategoryId;
  pillar: "SEO" | "AEO";
  name: string;
  weight: number;
}[] = [
  { id: "S1", pillar: "SEO", name: "Crawlability and indexation", weight: 15 },
  { id: "S2", pillar: "SEO", name: "On-page fundamentals", weight: 15 },
  { id: "S3", pillar: "SEO", name: "Technical health and speed basics", weight: 10 },
  { id: "S4", pillar: "SEO", name: "Content and internal linking", weight: 10 },
  { id: "A1", pillar: "AEO", name: "AI crawler access and content availability", weight: 15 },
  { id: "A2", pillar: "AEO", name: "Structured data and entity clarity", weight: 15 },
  { id: "A3", pillar: "AEO", name: "Answer-ready content", weight: 10 },
  { id: "A4", pillar: "AEO", name: "Trust, authorship and freshness", weight: 10 },
];

export const METRICS: readonly MetricDefinitionExt[] = deepFreeze(
  METRIC_SEEDS.map((seed): MetricDefinitionExt => ({ ...seed, version: 1 }))
);

export const CATEGORIES: readonly CategoryDefinition[] = deepFreeze(
  CATEGORY_SEEDS.map(
    (c): CategoryDefinition => ({
      ...c,
      metricIds: METRICS.filter((m) => m.categoryId === c.id).map((m) => m.id),
    })
  )
);

export const METHODOLOGY: MethodologyDefinition = deepFreeze({
  version: METHODOLOGY_VERSION,
  categories: [...CATEGORIES],
  metrics: [...METRICS],
  thresholds: { ...THRESHOLDS },
  listVersions: { aiAgents: LISTS_VERSION, patterns: LISTS_VERSION },
});

const METRICS_BY_ID: ReadonlyMap<string, MetricDefinitionExt> = new Map(
  METRICS.map((m) => [m.id, m])
);
const CATEGORIES_BY_ID: ReadonlyMap<string, CategoryDefinition> = new Map(
  CATEGORIES.map((c) => [c.id, c])
);

export function getMetricDefinition(id: string): MetricDefinitionExt {
  const found = METRICS_BY_ID.get(id);
  if (!found) throw new RangeError(`Unknown metric id: ${id}`);
  return found;
}

export function getCategory(id: string): CategoryDefinition {
  const found = CATEGORIES_BY_ID.get(id);
  if (!found) throw new RangeError(`Unknown category id: ${id}`);
  return found;
}

export function metricsForCategory(id: string): MetricDefinitionExt[] {
  const category = getCategory(id);
  return category.metricIds.map((metricId) => getMetricDefinition(metricId));
}
