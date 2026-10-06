# SEO and AEO readiness report

Site: https://fixture.example/
Scanned: 2026-10-02 09:15:00 UTC
Methodology 0.1.0-draft, scanner t, coverage 100%, 5 pages sampled.

This uses a draft methodology. Results are engineering calibration results, not published claims.

## Critical findings

None of the seven critical-finding checks was triggered by what the scanner could observe.

## Scores

| Score | Value | Exact | Band |
|---|---|---|---|
| Overall | 94 out of 100 | 93.68 | Strong signals detected |
| SEO | 95 out of 100 | 94.60 | Strong signals detected |
| AEO | 93 out of 100 | 92.75 | Strong signals detected |

Coverage: 100% of the available metric weight could be observed. Bands are labels for the displayed whole-number score and describe detected signals only.

## Categories

### S1 Crawlability and indexation (SEO)

Score 100 out of 100 | Coverage 100% | Weight 15

| Metric | Result | Points | What was seen | Evidence |
|---|---|---|---|---|
| S1.01 Pages are indexable | Pass | 25 / 25 | All 5 pages can be indexed. | indexable (x5) |
| S1.02 Crawlable by Googlebot and bingbot | Pass | 25 / 25 | All 5 pages are open to Googlebot and bingbot. | allowed for both (x5) |
| S1.03 Valid XML sitemap discoverable | Pass | 20 / 20 | A valid URL sitemap with 9 same-site addresses was found. | valid sitemap |
| S1.04 Canonical URL is consistent | Pass | 20 / 20 | All 5 pages point to their own address. | self canonical (x5) |
| S1.05 Page returns success directly | Pass | 10 / 10 | All 5 pages respond directly. | direct (x5) |

### S2 On-page fundamentals (SEO)

Score 100 out of 100 | Coverage 100% | Weight 15

| Metric | Result | Points | What was seen | Evidence |
|---|---|---|---|---|
| S2.01 Title tag | Pass | 20 / 20 | All 5 pages have a title of 20 to 65 characters. | within 20 65 (x5) |
| S2.02 Titles are unique | Pass | 10 / 10 | All 5 pages with a title carry a distinct title. | all unique |
| S2.03 Meta description | Pass | 15 / 15 | All 5 pages have a meta description of 70 to 160 characters. | within 70 160 (x5) |
| S2.04 Descriptions are unique | Pass | 5 / 5 | All 5 pages with a description carry a distinct description. | all unique |
| S2.05 Single H1 | Pass | 15 / 15 | All 5 pages have exactly one h1. | single h1 (x5) |
| S2.06 Heading hierarchy | Pass | 10 / 10 | All 5 pages have headings in order. | ordered (x5) |
| S2.07 Image alt attributes | Pass | 10 / 10 | All 4 pages give every content image an alt attribute. | all have alt (x4), NOT APPLICABLE |
| S2.08 Language declared | Pass | 5 / 5 | All 5 pages declare a valid language. | valid lang (x5) |
| S2.09 Share-preview tags | Pass | 10 / 10 | All 5 pages have all three share-preview tags. | all three (x5) |

### S3 Technical health and speed basics (SEO)

Score 100 out of 100 | Coverage 100% | Weight 10

| Metric | Result | Points | What was seen | Evidence |
|---|---|---|---|---|
| S3.01 HTTPS enforced | Pass | 20 / 20 | Plain http redirects permanently (HTTP 301) to https within 1 hop. | permanent redirect to https |
| S3.02 Valid TLS certificate | Pass | 10 / 10 | The homepage certificate is valid for this host and has 200 days left. | valid certificate |
| S3.03 Mobile viewport | Pass | 15 / 15 | 5 of 5 observed pages declare a viewport with width=device-width. | viewport width device width (x5) |
| S3.04 Response compression | Pass | 10 / 10 | The homepage HTML is served compressed (Content-Encoding: gzip). | compressed |
| S3.05 Server response time | Pass | 10 / 10 | The median time to first byte is 100 ms, within the 800 ms for full marks. | fast |
| S3.06 Broken internal links | Pass | 25 / 25 | 0 of 11 observed internal link targets returned 404, 410 or a server error. | no broken links |
| S3.07 No mixed content | Pass | 10 / 10 | 5 of 5 observed https pages load no http resources, 0 load only passive ones and 0 load active ones. | no mixed content (x5) |

### S4 Content and internal linking (SEO)

Score 73 out of 100 | Coverage 100% | Weight 10

| Metric | Result | Points | What was seen | Evidence |
|---|---|---|---|---|
| S4.01 Content depth | Partial | 3 / 30 | 0 of 5 observed content pages have 300 or more words of main content, 1 have 150 to 299 and 4 have fewer. | words under 150 (x4), words 150 to 299 |
| S4.02 Internal link breadth | Pass | 20 / 20 | The homepage links to 10 distinct pages on the same site, which meets the 8 needed for full marks. | targets 8 or more |
| S4.03 Descriptive anchor text | Pass | 20 / 20 | On average 100% of internal links on the 5 observed pages use descriptive anchor text. | descriptive share (x5) |
| S4.04 Distinct content | Pass | 10 / 10 | All 5 compared content pages have different main text. | all distinct |
| S4.05 Clean URLs | Pass | 10 / 10 | 5 of 5 sampled page addresses are clean, 0 have one violation and 0 have two or more. | no violations (x5) |
| S4.06 Site navigation | Pass | 10 / 10 | 5 of 5 observed pages have a navigation block with 3 or more internal links, 0 have one with 1 or 2 and 0 have none. | nav with 3 or more links (x5) |

Guidance:

- S4.01: Consider whether your main pages say enough to answer the questions a visitor would bring, and expanding thin pages where it adds genuine value.

### A1 AI crawler access and content availability (AEO)

Score 100 out of 100 | Coverage 100% | Weight 15

| Metric | Result | Points | What was seen | Evidence |
|---|---|---|---|---|
| A1.01 AI search and answer crawlers allowed | Pass | 40 / 40 | robots.txt allows 15 of 15 combinations of AI search crawler and sampled page. | all allowed (x5) |
| A1.02 Snippet and preview eligibility | Pass | 15 / 15 | Of 5 observed pages, 5 allow full snippets, 0 limit the snippet length and 0 block snippets. | no snippet restriction (x5) |
| A1.03 llms.txt present | Pass | 5 / 5 | An llms.txt file with a heading and at least one link is published. | structured |
| A1.04 Primary content in the initial HTML | Pass | 40 / 40 | 5 of 5 observed content pages have 50 or more words of main content in the raw HTML. | content in initial html (x5) |

### A2 Structured data and entity clarity (AEO)

Score 95 out of 100 | Coverage 100% | Weight 15

| Metric | Result | Points | What was seen | Evidence |
|---|---|---|---|---|
| A2.01 Valid JSON-LD | Pass | 15 / 15 | 5 of 5 observed pages have only valid JSON-LD, and 0 have mixed or microdata-only markup. | all blocks valid (x5) |
| A2.02 Organisation identity | Pass | 20 / 20 | The homepage organisation node earns 20 of 20 identity points. | organisation node scored |
| A2.03 Profile links (sameAs) | Pass | 10 / 10 | The homepage structured data links to 2 profiles on other sites. | two or more profiles |
| A2.04 Identity graph coherence | Pass | 10 / 10 | 1 of 1 @id reference points to a node defined on the same page or the homepage. | all references resolve |
| A2.05 Page-type schema | Pass | 15 / 15 | The structured data expected for the page type is complete on 3 of 3 observed pages. | all checks passed (x3), json ld beyond scanner limits |
| A2.06 Breadcrumbs | Fail | 0 / 5 | 0 of 1 observed page below the top level have a complete BreadcrumbList. | no breadcrumb list |
| A2.07 Schema matches visible content | Pass | 15 / 15 | Names, questions and headlines from the structured data all appear in the visible text on 3 of 3 observed pages. | all checks passed (x3), no applicable checks (x2) |
| A2.08 Name consistency | Pass | 10 / 10 | The organisation name matches og:site\_name and appears in the title. | name consistent |

Guidance:

- A2.06: Consider adding BreadcrumbList structured data to pages below the top level, with a name and an item or position for each step.

### A3 Answer-ready content (AEO)

Score 86.27 out of 100 | Coverage 100% | Weight 10

| Metric | Result | Points | What was seen | Evidence |
|---|---|---|---|---|
| A3.01 Question-style headings | Fail | 0 / 10 | Of 1 assessed page, 0 scored full marks, 0 partial and 1 zero for question-style subheadings. | questions under 10 percent, fewer than 3 subheadings (x2) |
| A3.02 Answer-first sections | Pass | 30 / 30 | Of 1 assessed page, 1 scored full marks, 0 partial and 0 zero for answer-first sections. | answer first 60 percent or more, fewer than 3 subheadings (x2) |
| A3.03 FAQ block present | Pass | 20 / 20 | https://fixture.example/faq has 4 question and answer pairs, which meets the 3-pair threshold. | pairs 1 or 2, no pairs (x3), pairs 3 or more |
| A3.04 Scannable structure | Not applicable | - | No sampled page is applicable to this metric. | under 300 words (x3) |
| A3.05 Sentence and paragraph length | Partial | 8.33 / 10 | Of 3 assessed pages, 2 scored full marks, 1 partial and 0 zero for sentence and paragraph length. | sentence limit exceeded, both within limits (x2) |
| A3.06 Entity statement near the top | Pass | 15 / 15 | 3 of 3 applicable entity checks (name, locality, topic) were found in the first 200 words of the homepage. | 3 of 3 checks passed |

Guidance:

- A3.01: Consider writing some subheadings as the questions your readers ask.
- A3.05: Consider shortening very long sentences and paragraphs so key points are easy to read and quote.

### A4 Trust, authorship and freshness (AEO)

Score 85 out of 100 | Coverage 100% | Weight 10

| Metric | Result | Points | What was seen | Evidence |
|---|---|---|---|---|
| A4.01 About page discoverable | Pass | 15 / 15 | The homepage links to https://fixture.example/about, which returned HTTP 200. | homepage links to working about |
| A4.02 Contact information visible | Pass | 15 / 15 | The homepage shows 4 of 4 contact signals (email, phone, address, contact-page link). | 4 signals |
| A4.03 Author attribution | Pass | 15 / 15 | Of 1 assessed page, 1 scored full marks, 0 partial and 0 zero for author attribution. | visible byline |
| A4.04 Dates on articles | Pass | 10 / 10 | Of 1 assessed page, 1 scored full marks, 0 partial and 0 zero for published and modified dates. | published and modified |
| A4.05 Freshness | Pass | 20 / 20 | The newest valid date is 2026-09-20 (sitemap lastmod), 12 days before the scan. | age 180 days or less |
| A4.06 Privacy policy linked | Pass | 10 / 10 | The homepage links to https://fixture.example/privacy, which looks like a privacy policy address. | privacy link found |
| A4.07 External references | Fail | 0 / 15 | Of 3 assessed pages, 0 scored full marks, 0 partial and 3 zero for outbound references. | no outbound link in main (x3) |

Guidance:

- A4.07: Consider linking to relevant outside sources where they help the reader.

## Informational signals

These are reported and not scored. Opting out of model training is a legitimate choice.

Training and data-collection crawlers:

| Agent | robots.txt policy for the homepage |
|---|---|
| GPTBot | disallowed |
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
- JSON-LD types detected: Answer, Article, FAQPage, Person, PostalAddress, ProfessionalService, Question, Service, Thing
- Homepage HTML size: 276444 bytes
- Homepage redirects: 0

## Scan facts

- Scan date and time (UTC): 2026-10-02 09:15:00 UTC
- Methodology version: 0.1.0-draft
- Scanner version: t
- Report version: 1
- Outcome: Completed
- Coverage: 100%
- Pages sampled: 5
- Snapshot hash (SHA-256): 4195ac00e8d8f8ec765f106886a7d8110bb3d7c8d65749ad305aabf95a3f23e7
- List versions: AI crawler list 1.0.0-draft, pattern lists 1.0.0-draft
- Lists unverified or past their review date: AI crawler list, page-type and wording pattern lists

Pages sampled:

| Page | Type | Fetch result | Note |
|---|---|---|---|
| https://fixture.example/ | home | Read |  |
| https://fixture.example/services | services | Read |  |
| https://fixture.example/about | about | Read |  |
| https://fixture.example/faq | faq | Read |  |
| https://fixture.example/blog/field-notes | article | Read |  |

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
