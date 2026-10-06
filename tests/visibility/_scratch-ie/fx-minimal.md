# SEO and AEO readiness report

Site: https://fixture.example/
Scanned: 2026-10-02 09:15:00 UTC
Methodology 0.1.0-draft, scanner t, coverage 95.2%, 5 pages sampled.

This uses a draft methodology. Results are engineering calibration results, not published claims.

## Critical findings

None of the seven critical-finding checks was triggered by what the scanner could observe.

## Scores

| Score | Value | Exact | Band |
|---|---|---|---|
| Overall | 51 out of 100 | 51.24 | Some gaps |
| SEO | 54 out of 100 | 54.29 | Some gaps |
| AEO | 48 out of 100 | 48.20 | Many gaps |

Coverage: 95.2% of the available metric weight could be observed. Bands are labels for the displayed whole-number score and describe detected signals only.

## Categories

### S1 Crawlability and indexation (SEO)

Score 60 out of 100 | Coverage 100% | Weight 15

| Metric | Result | Points | What was seen | Evidence |
|---|---|---|---|---|
| S1.01 Pages are indexable | Pass | 25 / 25 | All 5 pages can be indexed. | indexable (x5) |
| S1.02 Crawlable by Googlebot and bingbot | Pass | 25 / 25 | All 5 pages are open to Googlebot and bingbot. | allowed for both (x5) |
| S1.03 Valid XML sitemap discoverable | Fail | 0 / 20 | No sitemap was found in robots.txt or at /sitemap.xml. | not found |
| S1.04 Canonical URL is consistent | Fail | 0 / 20 | All 5 pages have no canonical. | missing (x5) |
| S1.05 Page returns success directly | Pass | 10 / 10 | All 5 pages respond directly. | direct (x5) |

Guidance:

- S1.03: Consider publishing an XML sitemap that lists your main pages and referencing it with a Sitemap line in robots.txt.
- S1.04: Consider giving each page a single canonical link that points to its own preferred address on your own site.

### S2 On-page fundamentals (SEO)

Score 53.53 out of 100 | Coverage 100% | Weight 15

| Metric | Result | Points | What was seen | Evidence |
|---|---|---|---|---|
| S2.01 Title tag | Partial | 12 / 20 | Of 5 pages, 2 have a title of 20 to 65 characters, 1 has a title of 10 to 19 characters, 1 has a title of 66 to 90 characters and 1 has a title under 10 characters. | short 10 19, within 20 65 (x2), under 10, long 66 90 |
| S2.02 Titles are unique | Pass | 10 / 10 | All 5 pages with a title carry a distinct title. | all unique |
| S2.03 Meta description | Fail | 0 / 15 | All 5 pages have no meta description. | missing (x5) |
| S2.04 Descriptions are unique | Not applicable | - | Fewer than two sampled pages have a description, so uniqueness cannot be compared. | NOT APPLICABLE |
| S2.05 Single H1 | Partial | 10.5 / 15 | Of 5 pages, 3 have exactly one h1, 1 has more than one h1 and 1 has no h1. | single h1 (x3), no h1, multiple h1 |
| S2.06 Heading hierarchy | Partial | 9 / 10 | Of 5 pages, 4 have headings in order and 1 skips one or two heading levels. | ordered (x4), skips 1 2 |
| S2.07 Image alt attributes | Not applicable | - | The sampled pages contain no content images, so alt attributes are not judged. | NOT APPLICABLE (x5) |
| S2.08 Language declared | Partial | 4 / 5 | Of 5 pages, 4 declare a valid language and 1 declares no language. | valid lang (x4), missing lang |
| S2.09 Share-preview tags | Fail | 0 / 10 | All 5 pages have none of the share-preview tags. | none (x5) |

Guidance:

- S2.01: Consider giving each page one distinct title of roughly 20 to 65 characters that describes what the page is about.
- S2.03: Consider writing one meta description of roughly 70 to 160 characters per page that summarises what the page covers.
- S2.05: Consider using exactly one h1 heading per page that names the main topic of the page.
- S2.06: Consider ordering headings so that levels do not skip (for example h2 followed by h3 rather than h4), and adding h2 subheadings to longer pages.
- S2.08: Consider declaring the page language with a valid lang attribute on the html element, such as en-IE.
- S2.09: Consider adding Open Graph og:title, og:description and og:image tags, with an absolute https image address, so shared links show a clear preview.

### S3 Technical health and speed basics (SEO)

Score 46.15 out of 100 | Coverage 72.2% | Weight 10

| Metric | Result | Points | What was seen | Evidence |
|---|---|---|---|---|
| S3.01 HTTPS enforced | Partial | 10 / 20 | Plain http reaches https through a temporary redirect (HTTP 302) rather than a permanent 301 or 308. | temporary redirect to https |
| S3.02 Valid TLS certificate | Partial | 5 / 10 | The homepage certificate is valid but expires in 9 days, under the 14 days needed for full marks. | valid expires soon |
| S3.03 Mobile viewport | Fail | 0 / 15 | 0 of 5 observed pages declare a viewport with width=device-width. | no viewport tag (x5) |
| S3.04 Response compression | Not applicable | - | The homepage HTML is 714 bytes, under 1 KB, so compression does not apply. | not applicable under 1kb |
| S3.05 Server response time | Partial | 5 / 10 | The median time to first byte is 1100 ms, above 800 ms but within 1800 ms. | moderate |
| S3.06 Broken internal links | Not observed | - | Only 4 internal link targets could be observed (at least 5 are needed), so broken links are not scored. | not observed too few links |
| S3.07 No mixed content | Pass | 10 / 10 | 5 of 5 observed https pages load no http resources, 0 load only passive ones and 0 load active ones. | no mixed content (x5) |

Guidance:

- S3.01: Consider redirecting http addresses to https with a permanent (301 or 308) redirect so that only the https version of each page is served.
- S3.02: Consider checking that your TLS certificate covers the site name, is served with its full chain, and is renewed well before it expires.
- S3.03: Consider adding a viewport meta tag containing width=device-width so pages scale to mobile screens.
- S3.05: Consider reviewing hosting, caching and server-side work if the homepage is slow to start responding.

### S4 Content and internal linking (SEO)

Score 55 out of 100 | Coverage 100% | Weight 10

| Metric | Result | Points | What was seen | Evidence |
|---|---|---|---|---|
| S4.01 Content depth | Partial | 6 / 30 | 0 of 5 observed content pages have 300 or more words of main content, 2 have 150 to 299 and 3 have fewer. | words under 150 (x3), words 150 to 299 (x2) |
| S4.02 Internal link breadth | Partial | 10 / 20 | The homepage links to 4 distinct pages on the same site, fewer than the 8 needed for full marks. | targets 3 to 7 |
| S4.03 Descriptive anchor text | Partial | 17 / 20 | On average 85% of internal links on the 5 observed pages use descriptive anchor text. | descriptive share (x5) |
| S4.04 Distinct content | Pass | 10 / 10 | All 5 compared content pages have different main text. | all distinct |
| S4.05 Clean URLs | Partial | 9 / 10 | 4 of 5 sampled page addresses are clean, 1 has one violation and 0 have two or more. | no violations (x4), one violation |
| S4.06 Site navigation | Partial | 3 / 10 | 1 of 5 observed pages have a navigation block with 3 or more internal links, 1 have one with 1 or 2 and 3 have none. | no nav (x3), nav with 1 or 2 links, nav with 3 or more links |

Guidance:

- S4.01: Consider whether your main pages say enough to answer the questions a visitor would bring, and expanding thin pages where it adds genuine value.
- S4.02: Consider linking from the homepage to your main sections so visitors and crawlers can reach them directly.
- S4.03: Consider using link text that describes the destination instead of phrases such as click here or read more.
- S4.05: Consider using short, lowercase, readable addresses without spaces, underscores, session parameters or unnecessary query strings.
- S4.06: Consider adding a navigation block with links to your main sections on every page.

### A1 AI crawler access and content availability (AEO)

Score 87 out of 100 | Coverage 100% | Weight 15

| Metric | Result | Points | What was seen | Evidence |
|---|---|---|---|---|
| A1.01 AI search and answer crawlers allowed | Pass | 40 / 40 | robots.txt allows 15 of 15 combinations of AI search crawler and sampled page. | all allowed (x5) |
| A1.02 Snippet and preview eligibility | Pass | 15 / 15 | Of 5 observed pages, 5 allow full snippets, 0 limit the snippet length and 0 block snippets. | no snippet restriction (x5) |
| A1.03 llms.txt present | Fail | 0 / 5 | No llms.txt file was found at the site root. | not found |
| A1.04 Primary content in the initial HTML | Partial | 32 / 40 | 4 of 5 observed content pages have 50 or more words of main content in the raw HTML. | content in initial html (x4), thin content |

Guidance:

- A1.03: Consider adding a plain-text llms.txt file at the root of the site with a heading and links to your key pages; this convention is emerging and its benefit is unconfirmed.
- A1.04: Consider making sure the main content of each page is present in the HTML the server sends, rather than being added only later by JavaScript.

### A2 Structured data and entity clarity (AEO)

Score 0 out of 100 | Coverage 100% | Weight 15

| Metric | Result | Points | What was seen | Evidence |
|---|---|---|---|---|
| A2.01 Valid JSON-LD | Fail | 0 / 15 | 0 of 5 observed pages have only valid JSON-LD, and 0 have mixed or microdata-only markup. | no json ld (x5) |
| A2.02 Organisation identity | Fail | 0 / 20 | The homepage structured data has no Organization or Person node, so no identity details were found. | no organisation node |
| A2.03 Profile links (sameAs) | Fail | 0 / 10 | The homepage structured data has no sameAs link to a profile on another site. | no profiles |
| A2.04 Identity graph coherence | Not applicable | - | No structured data on the sampled pages refers to another node by @id, so there is nothing to resolve. | no references |
| A2.05 Page-type schema | Fail | 0 / 15 | The structured data expected for the page type is complete on 0 of 4 observed pages. | no checks passed (x4) |
| A2.06 Breadcrumbs | Fail | 0 / 5 | 0 of 1 observed page below the top level have a complete BreadcrumbList. | no breadcrumb list |
| A2.07 Schema matches visible content | Not applicable | - | No sampled page is applicable to this metric. | no applicable checks (x5) |
| A2.08 Name consistency | Not applicable | - | The homepage structured data has no organisation name to compare. | no organisation name |

Guidance:

- A2.01: Consider adding JSON-LD structured data that parses as valid JSON and declares a schema.org @context and @type.
- A2.02: Consider adding Organization (or Person) structured data to the homepage with name, url, logo, contact details and a short description.
- A2.03: Consider listing your official profiles on other sites in the sameAs property of your Organization structured data.
- A2.05: Consider adding structured data that matches the page type, such as Article, FAQPage, Service or AboutPage, with the key properties filled in.
- A2.06: Consider adding BreadcrumbList structured data to pages below the top level, with a name and an item or position for each step.

### A3 Answer-ready content (AEO)

Score 71.43 out of 100 | Coverage 100% | Weight 10

| Metric | Result | Points | What was seen | Evidence |
|---|---|---|---|---|
| A3.01 Question-style headings | Partial | 5 / 10 | Of 3 assessed pages, 1 scored full marks, 1 partial and 1 zero for question-style subheadings. | questions under 10 percent, questions 25 percent or more, questions 10 to 24 percent |
| A3.02 Answer-first sections | Partial | 15 / 30 | Of 3 assessed pages, 1 scored full marks, 1 partial and 1 zero for answer-first sections. | answer first 60 percent or more, answer first 30 to 59 percent, answer first under 30 percent |
| A3.03 FAQ block present | Pass | 20 / 20 | https://fixture.example/faq has 5 question and answer pairs, which meets the 3-pair threshold. | no pairs (x3), pairs 3 or more, pairs 1 or 2 |
| A3.04 Scannable structure | Not applicable | - | No sampled page is applicable to this metric. | under 300 words (x3) |
| A3.05 Sentence and paragraph length | Pass | 10 / 10 | Of 3 assessed pages, 3 scored full marks, 0 partial and 0 zero for sentence and paragraph length. | both within limits (x3) |
| A3.06 Entity statement near the top | Not applicable | - | The homepage structured data holds no business name, locality or topic term to look for. | no reference data |

Guidance:

- A3.01: Consider writing some subheadings as the questions your readers ask.
- A3.02: Consider opening each subheading section with a short, direct answer paragraph before adding detail.

### A4 Trust, authorship and freshness (AEO)

Score 39.06 out of 100 | Coverage 80% | Weight 10

| Metric | Result | Points | What was seen | Evidence |
|---|---|---|---|---|
| A4.01 About page discoverable | Pass | 15 / 15 | The homepage links to https://fixture.example/about, which returned HTTP 200. | homepage links to working about |
| A4.02 Contact information visible | Partial | 11.25 / 15 | The homepage shows 2 of 4 contact signals (email, phone, address, contact-page link). | 2 signals |
| A4.03 Author attribution | Fail | 0 / 15 | Of 1 assessed page, 0 scored full marks, 0 partial and 1 zero for author attribution. | no author signal |
| A4.04 Dates on articles | Fail | 0 / 10 | Of 1 assessed page, 0 scored full marks, 0 partial and 1 zero for published and modified dates. | no dates |
| A4.05 Freshness | Not observed | - | No valid date was found in the sitemap, the structured data or the time elements. | no valid date |
| A4.06 Privacy policy linked | Fail | 0 / 10 | The homepage has no link to a page whose address looks like a privacy policy. | no privacy link |
| A4.07 External references | Partial | 5 / 15 | Of 3 assessed pages, 1 scored full marks, 0 partial and 2 zero for outbound references. | no outbound link in main (x2), outbound link in main |

Guidance:

- A4.02: Consider showing your contact details clearly on the homepage, such as an email address, phone number, postal address or a link to a contact page.
- A4.03: Consider showing the author's name on each article, both as a visible byline and in structured data.
- A4.04: Consider showing a published date and a last-updated date on articles, in the page and in structured data.
- A4.06: Consider linking to your privacy policy from the homepage.
- A4.07: Consider linking to relevant outside sources where they help the reader.

## Informational signals

These are reported and not scored. Opting out of model training is a legitimate choice.

Training and data-collection crawlers:

| Agent | robots.txt policy for the homepage |
|---|---|
| GPTBot | allowed |
| ClaudeBot | allowed |
| Google-Extended | allowed |
| Applebot-Extended | allowed |
| CCBot | allowed |
| Amazonbot | allowed |
| Bytespider | allowed |
| meta-externalagent | allowed |

User-initiated agents (vendors may not apply robots.txt to these):

| Agent | robots.txt policy for the homepage |
|---|---|
| ChatGPT-User | allowed |
| Claude-User | allowed |
| Perplexity-User | allowed |

- Scanner challenged or blocked: no
- Scanner region: not recorded
- JSON-LD types detected: none
- Homepage HTML size: 714 bytes
- Homepage redirects: 0

## Scan facts

- Scan date and time (UTC): 2026-10-02 09:15:00 UTC
- Methodology version: 0.1.0-draft
- Scanner version: t
- Report version: 1
- Outcome: Completed
- Coverage: 95.2%
- Pages sampled: 5
- Snapshot hash (SHA-256): ec1c243cf9a9c4293fd30a13498c9f14feecca46a95691dd342c49c37f3b3973
- List versions: AI crawler list 1.0.0-draft, pattern lists 1.0.0-draft
- Lists unverified or past their review date: AI crawler list, page-type and wording pattern lists

Pages sampled:

| Page | Type | Fetch result | Note |
|---|---|---|---|
| https://fixture.example/ | home | Read |  |
| https://fixture.example/services | services | Read |  |
| https://fixture.example/about | about | Read |  |
| https://fixture.example/faq | faq | Read |  |
| https://fixture.example/news/summer\_opening\_hours | article | Read |  |

## Limitations

- Reads the raw HTML only; content added by JavaScript is not seen or scored.
- Samples the homepage and up to four other pages chosen by a fixed rule, so results describe those pages and not every page on the site.
- Scores are signals of readiness only. They do not compare this site with others and do not predict search results or whether any AI system will mention the site.
- Does not measure search positions, traffic, backlinks, domain authority, Core Web Vitals, whether any AI system cites the site, content accuracy or quality, accessibility conformance, legal compliance or off-site reputation.
- Several thresholds are DataBridges judgements (heuristics) and may change in a later methodology version.
- Server response time is measured from one scanner location at one moment and varies with region and time of day.
- Methodology 0.1.0-draft is a draft that the methodology owner has not signed off, so results are engineering calibration results and not published claims.
- The AI crawler list is unverified against vendor documentation or past its review date, so crawler treatment may be out of date.
- The page-type and wording pattern lists have no recorded review date.

## Correction route

To report an error or ask for a correction, contact oisin@databridges.ie and quote the snapshot hash above.
