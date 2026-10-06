# SEO and AEO readiness report

Site: https://fixture.example/
Scanned: 2026-10-02 09:15:00 UTC
Methodology 0.1.0-draft, scanner t, coverage 60.6%, 5 pages sampled.

This uses a draft methodology. Results are engineering calibration results, not published claims.

## Critical findings

These are shown beside the scores. They do not change the scores.

- **CF-04**: Detected: the homepage looks built by JavaScript, so its content is not in the raw HTML this scan reads; its body content was not scored.

## Scores

| Score | Value | Exact | Band |
|---|---|---|---|
| Overall | Withheld | - | - |
| SEO | 87 out of 100 | 86.77 | Strong signals detected |
| AEO | 65 out of 100 | 65.00 | Some gaps |

- Overall score withheld. Too little of the site could be observed: at least 70 of the 100 weight points must come from categories with enough data.

Coverage: 60.6% of the available metric weight could be observed. Bands are labels for the displayed whole-number score and describe detected signals only.

## Categories

### S1 Crawlability and indexation (SEO)

Score 92 out of 100 | Coverage 100% | Weight 15

| Metric | Result | Points | What was seen | Evidence |
|---|---|---|---|---|
| S1.01 Pages are indexable | Pass | 25 / 25 | All 5 pages can be indexed. | indexable (x5) |
| S1.02 Crawlable by Googlebot and bingbot | Pass | 25 / 25 | All 5 pages are open to Googlebot and bingbot. | allowed for both (x5) |
| S1.03 Valid XML sitemap discoverable | Pass | 20 / 20 | A valid URL sitemap with 7 same-site addresses was found. | valid sitemap |
| S1.04 Canonical URL is consistent | Partial | 12 / 20 | Of 5 pages, 1 points to its own address and 4 point to a different page on the same site. | self canonical, other same site (x4) |
| S1.05 Page returns success directly | Pass | 10 / 10 | All 5 pages respond directly. | direct (x5) |

Guidance:

- S1.04: Consider giving each page a single canonical link that points to its own preferred address on your own site.

### S2 On-page fundamentals (SEO)

Score 81.54 out of 100 | Coverage 65% | Weight 15

| Metric | Result | Points | What was seen | Evidence |
|---|---|---|---|---|
| S2.01 Title tag | Pass | 20 / 20 | All 5 pages have a title of 20 to 65 characters. | within 20 65 (x5) |
| S2.02 Titles are unique | Partial | 2 / 10 | The 5 pages with a title carry 1 distinct title. | duplicates found |
| S2.03 Meta description | Pass | 15 / 15 | All 5 pages have a meta description of 70 to 160 characters. | within 70 160 (x5) |
| S2.04 Descriptions are unique | Partial | 1 / 5 | The 5 pages with a description carry 1 distinct description. | duplicates found |
| S2.05 Single H1 | Not observed | - | Only 0 of 5 applicable pages could be observed (fewer than half), so this metric is not scored. | NOT OBSERVED (x5) |
| S2.06 Heading hierarchy | Not observed | - | Only 0 of 5 applicable pages could be observed (fewer than half), so this metric is not scored. | NOT OBSERVED (x5) |
| S2.07 Image alt attributes | Not observed | - | Only 0 of 5 applicable pages could be observed (fewer than half), so this metric is not scored. | NOT OBSERVED (x5) |
| S2.08 Language declared | Pass | 5 / 5 | All 5 pages declare a valid language. | valid lang (x5) |
| S2.09 Share-preview tags | Pass | 10 / 10 | All 5 pages have all three share-preview tags. | all three (x5) |

Guidance:

- S2.02: Consider checking that each page has its own title rather than a title shared with other pages.
- S2.04: Consider writing a distinct meta description for each page instead of reusing the same text.

### S3 Technical health and speed basics (SEO)

Not enough data to show a score (coverage 45%, minimum 50%); left out of the aggregate scores | Weight 10

| Metric | Result | Points | What was seen | Evidence |
|---|---|---|---|---|
| S3.01 HTTPS enforced | Not observed | - | The http version of the site could not be reached (CONNECT\_REFUSED), so redirection to https was not observed. | not observed port 80 |
| S3.02 Valid TLS certificate | Pass | 10 / 10 | The homepage certificate is valid for this host and has 60 days left. | valid certificate |
| S3.03 Mobile viewport | Pass | 15 / 15 | 5 of 5 observed pages declare a viewport with width=device-width. | viewport width device width (x5) |
| S3.04 Response compression | Pass | 10 / 10 | The homepage HTML is served compressed (Content-Encoding: gzip). | compressed |
| S3.05 Server response time | Pass | 10 / 10 | The median time to first byte is 280 ms, within the 800 ms for full marks. | fast |
| S3.06 Broken internal links | Not observed | - | Only 0 internal link targets could be observed (at least 5 are needed), so broken links are not scored. | not observed too few links |
| S3.07 No mixed content | Not observed | - | Only 0 of 5 applicable pages could be observed (fewer than half), so this metric is not scored. | not observed render dependent (x5) |

### S4 Content and internal linking (SEO)

Not enough data to show a score (coverage 10%, minimum 50%); left out of the aggregate scores | Weight 10

| Metric | Result | Points | What was seen | Evidence |
|---|---|---|---|---|
| S4.01 Content depth | Not observed | - | Only 0 of 5 applicable pages could be observed (fewer than half), so this metric is not scored. | not observed render dependent (x5) |
| S4.02 Internal link breadth | Not observed | - | The page is render-dependent (its content is added by JavaScript), so its body is not read. | not observed render dependent |
| S4.03 Descriptive anchor text | Not observed | - | Only 0 of 5 applicable pages could be observed (fewer than half), so this metric is not scored. | not observed render dependent (x5) |
| S4.04 Distinct content | Not observed | - | Only 0 of 5 content pages could be read, and at least 2 are needed to compare their text. | too few readable pages, not observed render dependent (x5) |
| S4.05 Clean URLs | Pass | 10 / 10 | 5 of 5 sampled page addresses are clean, 0 have one violation and 0 have two or more. | no violations (x5) |
| S4.06 Site navigation | Not observed | - | Only 0 of 5 applicable pages could be observed (fewer than half), so this metric is not scored. | not observed render dependent (x5) |

### A1 AI crawler access and content availability (AEO)

Score 55 out of 100 | Coverage 100% | Weight 15

| Metric | Result | Points | What was seen | Evidence |
|---|---|---|---|---|
| A1.01 AI search and answer crawlers allowed | Pass | 40 / 40 | robots.txt allows 15 of 15 combinations of AI search crawler and sampled page. | all allowed (x5) |
| A1.02 Snippet and preview eligibility | Pass | 15 / 15 | Of 5 observed pages, 5 allow full snippets, 0 limit the snippet length and 0 block snippets. | no snippet restriction (x5) |
| A1.03 llms.txt present | Fail | 0 / 5 | No llms.txt file was found at the site root. | not found |
| A1.04 Primary content in the initial HTML | Fail | 0 / 40 | 0 of 5 observed content pages have 50 or more words of main content in the raw HTML. | render dependent (x5) |

Guidance:

- A1.03: Consider adding a plain-text llms.txt file at the root of the site with a heading and links to your key pages; this convention is emerging and its benefit is unconfirmed.
- A1.04: Consider making sure the main content of each page is present in the HTML the server sends, rather than being added only later by JavaScript.

### A2 Structured data and entity clarity (AEO)

Score 75 out of 100 | Coverage 84.2% | Weight 15

| Metric | Result | Points | What was seen | Evidence |
|---|---|---|---|---|
| A2.01 Valid JSON-LD | Pass | 15 / 15 | 5 of 5 observed pages have only valid JSON-LD, and 0 have mixed or microdata-only markup. | all blocks valid (x5) |
| A2.02 Organisation identity | Pass | 20 / 20 | The homepage organisation node earns 20 of 20 identity points. | organisation node scored |
| A2.03 Profile links (sameAs) | Partial | 5 / 10 | The homepage structured data links to one profile on another site. | one profile |
| A2.04 Identity graph coherence | Pass | 10 / 10 | 5 of 5 @id references point to a node defined on the same page or the homepage. | all references resolve |
| A2.05 Page-type schema | Fail | 0 / 15 | The structured data expected for the page type is complete on 0 of 3 observed pages. | no checks passed (x3) |
| A2.06 Breadcrumbs | Not applicable | - | No sampled page is applicable to this metric. |  |
| A2.07 Schema matches visible content | Not observed | - | Only 0 of 5 applicable pages could be observed (fewer than half), so this metric is not scored. | render dependent (x5) |
| A2.08 Name consistency | Pass | 10 / 10 | The organisation name matches og:site\_name and appears in the title. | name consistent |

Guidance:

- A2.03: Consider listing your official profiles on other sites in the sameAs property of your Organization structured data.
- A2.05: Consider adding structured data that matches the page type, such as Article, FAQPage, Service or AboutPage, with the key properties filled in.

### A3 Answer-ready content (AEO)

Not enough data to show a score (coverage 0%, minimum 50%); left out of the aggregate scores | Weight 10

| Metric | Result | Points | What was seen | Evidence |
|---|---|---|---|---|
| A3.01 Question-style headings | Not observed | - | Only 0 of 3 applicable pages could be observed (fewer than half), so this metric is not scored. | render dependent (x3) |
| A3.02 Answer-first sections | Not observed | - | Only 0 of 3 applicable pages could be observed (fewer than half), so this metric is not scored. | render dependent (x3) |
| A3.03 FAQ block present | Not observed | - | Only 0 of 5 applicable pages could be observed (fewer than half), so this metric is not scored. | render dependent (x5) |
| A3.04 Scannable structure | Not observed | - | Only 0 of 3 applicable pages could be observed (fewer than half), so this metric is not scored. | render dependent (x3) |
| A3.05 Sentence and paragraph length | Not observed | - | Only 0 of 3 applicable pages could be observed (fewer than half), so this metric is not scored. | render dependent (x3) |
| A3.06 Entity statement near the top | Not observed | - | The main content is not in the initial HTML (render-dependent), so the page body was not read. | render dependent |

### A4 Trust, authorship and freshness (AEO)

Not enough data to show a score (coverage 26.7%, minimum 50%); left out of the aggregate scores | Weight 10

| Metric | Result | Points | What was seen | Evidence |
|---|---|---|---|---|
| A4.01 About page discoverable | Not observed | - | The main content is not in the initial HTML (render-dependent), so the page body was not read. | render dependent |
| A4.02 Contact information visible | Not observed | - | The main content is not in the initial HTML (render-dependent), so the page body was not read. | render dependent |
| A4.03 Author attribution | Not applicable | - | No article page was sampled. | no pages in scope |
| A4.04 Dates on articles | Not applicable | - | No article page was sampled. | no pages in scope |
| A4.05 Freshness | Pass | 20 / 20 | The newest valid date is 2026-09-22 (sitemap lastmod), 10 days before the scan. | age 180 days or less |
| A4.06 Privacy policy linked | Not observed | - | The main content is not in the initial HTML (render-dependent), so the page body was not read. | render dependent |
| A4.07 External references | Not observed | - | Only 0 of 3 applicable pages could be observed (fewer than half), so this metric is not scored. | render dependent (x3) |

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
- JSON-LD types detected: Organization, WebSite
- Homepage HTML size: 2089 bytes
- Homepage redirects: 0

## Scan facts

- Scan date and time (UTC): 2026-10-02 09:15:00 UTC
- Methodology version: 0.1.0-draft
- Scanner version: t
- Report version: 1
- Outcome: Completed
- Coverage: 60.6%
- Pages sampled: 5
- Snapshot hash (SHA-256): a109614e12f00aa112809ced0343089768ba5e065e53e06d1e9987c57ce23d0a
- List versions: AI crawler list 1.0.0-draft, pattern lists 1.0.0-draft
- Lists unverified or past their review date: AI crawler list, page-type and wording pattern lists

Pages sampled:

| Page | Type | Fetch result | Note |
|---|---|---|---|
| https://fixture.example/ | home | Read | Built by JavaScript; body content not read |
| https://fixture.example/services | services | Read | Built by JavaScript; body content not read |
| https://fixture.example/about | about | Read | Built by JavaScript; body content not read |
| https://fixture.example/faq | faq | Read | Built by JavaScript; body content not read |
| https://fixture.example/pricing | other | Read | Built by JavaScript; body content not read |

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
- 5 sampled pages are built by JavaScript, so their body content was not read.
- One or more scores are withheld because too little of the site could be observed; the observed metrics are still shown.

## Correction route

To report an error or ask for a correction, contact oisin@databridges.ie and quote the snapshot hash above.
