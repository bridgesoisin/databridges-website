---
title: SEO & AEO Visibility Index - plan, methodology and build guide
status: draft
owner: unassigned
last_reviewed: 2026-10-02
approval: pending
methodology_version: 0.1.0-draft
implements: databridges-agent-docs-v2/07_VISIBILITY_INDEX.md (Gate 0 and Gate 1 deliverables)
---

# SEO & AEO Visibility Index: plan, methodology and build guide

> **Status: draft for human review. Nothing in this document is approved for
> build, for scanning third-party sites, or for publication.** It is the Gate 0
> (justification) and Gate 1 (methodology) deliverable that `07_VISIBILITY_INDEX.md`
> requires before any code is written. Weights, thresholds and rules below are
> proposed methodological judgements, not measured truths. Every number marked
> "proposed" needs the methodology owner's sign-off.

## Contents

0. At a glance
1. Governance position
2. Product definition
3. Staged delivery
4. Scoring methodology (normative draft)
5. Technical design
6. Experience design (public release only)
7. Verification plan
8. Build plan (work packages and ultracode execution)
9. Risks and stop conditions
10. Operating model after launch
11. Open decisions register
12. Appendices (A: AI crawler list, B: pattern lists, C: AEOReadiness mapping, D: contracts, E: example report, F: change log, G: execution record)

---

## 0. At a glance

A deterministic, transparent diagnostic that scans one public website and
reports:

- an **SEO score** (0-100), an **AEO score** (0-100) and an **overall score**
  (0-100), each published only when enough of the site could be observed;
- a **coverage** figure, so a reader knows how much of the method actually ran;
- a **per-metric table** (result, points, evidence, plain-English fix guidance);
- **critical findings** (for example "homepage is marked noindex") shown beside
  the score, never silently folded into it.

| Item | Decision in this plan |
|---|---|
| Name (internal) | Visibility Index. User-facing label is open (D-10). |
| Output | A per-site score of detectable signals. **Not a ranking, benchmark or prediction.** |
| Shape | 2 pillars (SEO, AEO), 8 categories, 52 metrics, 100 points per category |
| Scoring | Pure function of a stored snapshot. No model decides any score. |
| First build | Offline scoring core plus a local CLI run against DataBridges-owned sites |
| "Live on the website" | Stage 5 only, after Level 3 approval and a security review (section 3) |
| Not in scope | The AI tools directory (`08_AI_TOOLS_DIRECTORY.md`) is a separate experiment |

---

## 1. Governance position

### 1.1 What governs this work

Authority order is in `00_README.md`; agent rules are in `04_AGENTS.md`. The
documents that bind this plan directly:

| Document | What it requires here |
|---|---|
| `07_VISIBILITY_INDEX.md` | Stage gates 0-4. Methodology defined **before code**. Prototype only against owned or explicitly approved sites. No public profiles, rankings or outreach without a separate decision. Result-code contract and scoring formula (reused unchanged below). |
| `03_TECHNICAL_ARCHITECTURE.md` | Scanner boundary (isolated fetch worker, deterministic evaluation, evidence record, review) and the 14 scanner security requirements (section 5.5 maps each one). |
| `04_AGENTS.md` | Arbitrary-URL scanning and public scoring methodology are **Level 3** (explicit approval before implementation). Crawler code against fixed approved test targets is **Level 2**. Never push or deploy without authorization. |
| `02_INFORMATION_ARCHITECTURE.md` | `/index/*` is a reserved, non-public route namespace: no navigation, sitemap or indexing until the gate passes. |
| `09_LEAD_CAPTURE_AND_CRM.md` | Lead source `INDEX_PRIVATE_PILOT` exists. Any public lead source, analytics event or email delivery needs an amendment to that document, not a definition here. |
| `10_RELEASE_QA_AND_CHANGE_CONTROL.md` | Arbitrary URL fetching and public scoring are **high-risk** changes: explicit pre-approval and a named rollback/disable path. |
| `11_CONTENT_AND_CLAIMS_GOVERNANCE.md` | Public Index scores and methodology are protected content. Wording must be bounded and evidence-backed. |
| `12_PHASED_ROADMAP.md` / `06_BACKLOG.md` | Index work is Milestone 4, backlog DB-023 to DB-025 (P3, depends on DB-022). One high-risk experiment at a time. |

### 1.2 Where the request and the governance pack differ

Recorded here rather than resolved silently (`04_AGENTS.md`, "Before changing
code or content", item 6).

| Request | Governance position | Consequence in this plan |
|---|---|---|
| "Plan, create and build" | Methodology must exist before code. | This document is that methodology. Building starts only after it is approved (Stage 1 exit). |
| "Live on our website" | Public arbitrary-URL scanning is Level 3 plus a security review; `/index/*` is reserved; the methodology is a protected claim. | Public release is **Stage 5**. Stages 0-4 produce a working, private, owned-site tool first. |
| "Website ranking" | 07 forbids rankings, league tables, "worst" lists and sector comparison without separate approval. | The product is a **per-site score**. No ranking, leaderboard, stored third-party profile or sector average. |
| Timing | Backlog places the Index after DB-022 (Milestone 3 review) and roadmap says do not start custom platform work while offer evidence is unresolved. | An explicit owner instruction outranks sequencing, but the conflict needs a recorded decision (D-02). Recommendation: allow Stages 0-3 now because they are private, bounded and double as an audit method for the Visibility service; hold Stage 5 until DB-022 evidence exists. |

### 1.3 Permission levels by stage

| Stage | Highest level touched | Why |
|---|---|---|
| 0, 1 | Level 3 (decisions only, no code) | Methodology approval, owner and risk owner |
| 2 | Level 2 | Crawler code against fixed, approved targets; tests |
| 3 | Level 2 plus recorded consent | Scans only sites whose owners agreed in writing |
| 5 | Level 3 | Arbitrary-URL scanning, public methodology, new route, env vars, privacy text |

Approval to implement is not approval to deploy or publish.

---

## 2. Product definition

### 2.1 User promise

Help a website owner see a small set of **observable** search and AI-answer
readiness signals on their own site, understand what each one means, and decide
what to fix, without implying that fixing them guarantees ranking, traffic or
citation.

### 2.2 Target user and commercial hypothesis (hypotheses, per `01_PRODUCT_STRATEGY.md`)

- **Target user:** an owner, managing director or marketing lead at an Irish
  small or medium organisation with weak search or AI-search visibility.
- **Commercial hypothesis:** a free, private-by-default diagnostic starts
  qualified Visibility Review conversations more cheaply than content marketing.
- **Measured by:** qualified conversations attributed to the Index lead source
  (09), reported as directional only.

### 2.3 Non-goals

Inherits all of the 07 non-goals (business quality, legal compliance, guaranteed
performance, marketing effectiveness, private systems, national benchmarks) and
adds:

- ranking, comparing or naming third-party sites;
- measuring actual search positions, traffic, backlinks or domain authority;
- measuring whether any AI system actually cites a site;
- scoring a site owner's decision to opt out of AI model training;
- rendering JavaScript (version 1 reads the raw HTML a non-rendering crawler sees);
- using a language model to produce or adjust any score.

### 2.4 Naming

07 calls it the "Visibility Index". The word "Index" can imply a league table, so
the public label should be chosen deliberately (suggestion: "Visibility Check").
The reserved route namespace stays `/index/*` regardless (D-10).

### 2.5 Gate 0 justification record (to be completed by the owner)

| Field (07, Gate 0) | Proposed content | Status |
|---|---|---|
| Named product owner | - | **TBD (D-01)** |
| Target user | Section 2.2 | Proposed |
| Commercial hypothesis | Section 2.2 | Proposed |
| Maintenance budget | Proposed ceiling: 4 hours per month steady state (agent list review, corrections, quarterly methodology review) | **TBD** |
| Risk owner | - | **TBD (D-01)** |
| Stop condition | 07 stop conditions plus the pilot thresholds in section 7.6 | Proposed |

---

## 3. Staged delivery

Milestones are gates, not a calendar. Do not begin a stage because time passed;
begin it when the previous exit evidence exists.

| Stage | 07 gate | Who can see it | What it scans | Level | Exit evidence |
|---|---|---|---|---|---|
| 0 Justify | Gate 0 | Internal | Nothing | 3 (decisions) | Owner and risk owner named; D-01 to D-03 decided |
| 1 Freeze methodology | Gate 1 | Internal | Nothing | 3 (decisions) | Methodology 0.1.0 approved; AI crawler list verified (D-09); fixture expectations signed off |
| 2 Core and secure prototype | Gate 2 | Developers | Synthetic fixtures; DataBridges-owned sites through a hard allowlist | 2 | Tests green; security suite green; self-scan calibration report |
| 3 Private pilot | Gate 3 | Operator and consenting site owners (reports sent privately) | 15-25 sites with written consent | 2 + consent | Pilot thresholds (7.6) met, or a decision to revise or stop |
| 4 Decision | Gate 3 to 4 | Internal | - | Owner | Recorded: stop / keep as internal audit method / continue private / approve bounded public release |
| 5 Public self-serve | Gate 4 | Public | Any public URL a visitor enters | 3 + security review | Release gate (10), route gate (02), all Level 3 approvals, rollback path |

Stage 5 scope is a **self-assessment**: a visitor scans a URL and sees their own
result on screen. No result is stored, no profile is published, no third party
is contacted. That keeps the public-profile governance in 07 (appeals, takedown,
version history) out of scope; if the product ever stores or publishes per-site
results, that section of 07 applies in full before anything ships.

---

## 4. Scoring methodology (normative draft)

### 4.1 Principles for consistent scoring

1. **Deterministic.** The score is a pure function of
   `(snapshot, methodology version, scan timestamp)`. No randomness, no network
   access inside evaluators, no model scoring. The same snapshot always yields the
   same report.
2. **Observable only.** Every metric names the input it reads. A signal the
   scanner cannot observe is `NOT_OBSERVED`, never a failure.
3. **Versioned.** Methodology, metric definitions and data lists carry versions.
   Every report stamps them. Scores from different versions are never compared
   without re-scoring the same snapshot.
4. **Bounded.** A fixed sampling algorithm (section 4.2.3) picks at most five
   pages. Same site state, same sample.
5. **Transparent.** Every point is traceable to an evidence record and a
   published rule; a reader can recompute any category by hand from the report.
6. **Neutral on policy.** Opting out of model training is a legitimate choice
   and is not scored. Only access that affects appearing in search results and
   answers is scored.
7. **No double penalty.** One root cause is penalised once. A page whose content
   is not in the initial HTML is penalised in one metric (A1.04); the metrics
   that read its body become `NOT_OBSERVED` for that page.
8. **Heuristics are labelled.** Each metric has a basis: `STD` (published
   standard), `VENDOR` (search or AI vendor documentation), `HEUR` (DataBridges
   judgement). `HEUR` thresholds change only through a versioned release.
9. **No cross-site normalisation.** A score is never adjusted against other sites.
10. **Errors reduce coverage, never the score.**

### 4.2 Scan model

#### 4.2.1 Target input rules

- Parse with the WHATWG `URL` class only (one parser, one function).
- Scheme must be `http` or `https` (a bare host defaults to `https`).
  Reject userinfo (`user:pass@`), non-HTTP schemes, IP-literal hosts, and
  hostnames `localhost`, `*.local`, `*.internal`, `*.localhost`, `*.test`.
- Allowed ports: 80 and 443 only.
- Convert IDN hosts to punycode. Maximum URL length 2,048 characters.
- Scan exactly the host supplied. **Same site** means identical hostname after
  stripping one leading `www.` (no public-suffix dependency).
- Before the first non-robots request to any origin, fetch that origin's
  `robots.txt` and evaluate it for the scanner's own agent (`DataBridgesBot`,
  falling back to `*`). If the homepage is disallowed, stop with outcome
  `BLOCKED_BY_ROBOTS`: no score, no retry under another identity.
- If the homepage cannot be fetched over `https`, try `http`. If that works,
  continue and record S3.01 and S3.02 as `FAIL`. If both fail, outcome
  `UNREACHABLE`: no score.

#### 4.2.2 Resources fetched

| Resource | Request | Used by | Proposed cap |
|---|---|---|---|
| `robots.txt` (per origin) | GET | S1.02, A1.01, sitemap hints, own-agent check | 512 KiB parsed, no retry |
| Homepage | GET final URL | all homepage metrics | 3 MB decompressed |
| Sitemap(s) | GET declared, else `/sitemap.xml`; if an index, first 3 children in document order | S1.03, A4.05, sampling | 2 MB each, 5,000 `<loc>` parsed |
| Sampled pages | GET, up to 4 | all page metrics | 3 MB each |
| `/llms.txt` | GET | A1.03 | 256 KB |
| HTTP variant | GET `http://host/`, headers only | S3.01 | headers only |
| Link checks | HEAD, fall back to GET on 405/501 | S3.06 | headers only, 40 URLs per job |
| Timing samples | 2 extra homepage GETs (first reused) | S3.05 | first byte only |

#### 4.2.3 Page sampling (deterministic)

1. `homeUrl` is the final homepage URL after redirects.
2. Candidates are the union of (a) every `<loc>` from the discovered sitemap(s)
   and (b) every same-site `<a href>` on the homepage.
3. Normalise each (4.2.5), then drop: other sites, non-HTTP schemes, URLs whose
   path ends in an extension in `NON_HTML_EXT`, paths matching `UTILITY_EXCLUDE`
   (Appendix B), duplicates, and the homepage itself.
4. Classify each candidate by path using `PAGE_TYPE_PATTERNS` (Appendix B).
   `depth` is the number of non-empty path segments.
5. For each type in the fixed order `services, about, faq, article, other`,
   select the candidate of that type with the smallest `(depth, path)` where
   `path` compares lexicographically. `article` requires `depth >= 2` under an
   article-pattern prefix. Fill remaining slots (up to 4 in total) from the best
   unselected candidates of any non-excluded type by `(depth, path)`. Types
   `contact` and `legal` are never sampled.
6. Fetch the selected pages. A page that fails is **not replaced** (replacement
   would make the sample depend on transient errors); it is recorded and counted
   in coverage.

Sorting by `(depth, path)` removes dependence on sitemap or link order, so a
site that has not changed produces the same sample on every scan.

#### 4.2.4 Page types and scope codes

Types: `home`, `services`, `about`, `faq`, `article`, `contact`, `legal`, `other`.

| Code | Meaning |
|---|---|
| `P` | each sampled page (homepage plus up to 4) |
| `CP` | each sampled content page: `home, about, services, faq, article, other` |
| `KO` | knowledge pages: `services, faq, article, other` |
| `AP` | article pages only |
| `H` | homepage only |
| `S` | site-level (a resource or a derived value across pages) |

Suffix `meta` means the metric reads only URL, headers, `<head>` or JSON-LD and
is evaluated even for render-dependent pages. Suffix `body` means it reads page
body content.

#### 4.2.5 Normalisation and extraction rules

- **URL normalisation:** lowercase scheme and host; drop default ports and
  fragments; resolve dot segments; strip a trailing slash except at the root;
  upper-case percent-encoding hex; keep the query string unchanged.
- **Text normalisation:** Unicode NFKC; replace NBSP with a space; remove
  zero-width characters; collapse whitespace; trim; compare case-insensitively
  using `toLowerCase()` (locale-independent).
- **Visible text:** exclude `script, style, noscript, template, svg, head`,
  elements with the `hidden` attribute, and inline `display:none` or
  `visibility:hidden`.
- **Main content:** first match of `main`, then `[role=main]`, then a single
  `article`; otherwise `body` minus `header, nav, footer, aside` and
  `[role=banner|navigation|contentinfo|complementary]` and elements whose `id` or
  `class` matches `cookie|consent|banner|popup|modal`. This is a heuristic and
  is recorded as such in evidence.
- **Word count:** split normalised text on whitespace; a token counts if it holds
  at least one Unicode letter or number. For `lang` of `zh`, `ja`, `ko` or `th`,
  every word-count metric is `NOT_APPLICABLE`.
- **Sentences:** split on `[.!?]+` followed by whitespace. Wide thresholds absorb
  abbreviation errors. English-only metrics apply when `<html lang>` starts with `en`.
- **JSON-LD:** parse each `<script type="application/ld+json">` with strict
  `JSON.parse`; flatten `@graph`; index nodes by `@id`.
- **Dates:** accept ISO 8601 and W3C datetime only; ignore any date later than
  scan time plus one day.

#### 4.2.6 Render-dependent pages

A page is **render-dependent** when its main-content word count in the raw HTML
is below 50 **and** at least one marker is present: an empty framework root
(`#root`, `#app`, `#__next`, `#__nuxt`, `[data-reactroot]`, `[ng-version]`) or a
`<noscript>` message matching `enable javascript|requires javascript|javascript
(is )?(required|disabled)`.

For a render-dependent page, every `body` metric is `NOT_OBSERVED` for that
page: the scanner cannot see rendered content, so it does not guess. The page is
penalised once, in A1.04, and critical finding CF-04 is raised. Coverage falls
accordingly, which can suppress the overall score (4.3.5). That is intended:
"we could not see your content" is more honest than a misleading number.

### 4.3 Result codes, formulas and publication rules

#### 4.3.1 Result codes

The contract (`MetricResultCode`, `EvidenceType`, `MetricDefinition`,
`MetricResult`) is defined only in `07_VISIBILITY_INDEX.md` and is used here
unchanged. Treatment in the formulas:

| Code | Meaning in this method | Points | In denominator | In coverage |
|---|---|---|---|---|
| `PASS` | metric score `s` = 1 | max | yes | observed |
| `PARTIAL` | 0 < `s` < 1 | max x `s` | yes | observed |
| `FAIL` | `s` = 0 | 0 | yes | observed |
| `NOT_APPLICABLE` | applicability rule not met | null | no | excluded from both |
| `NOT_OBSERVED` | applicable but not observable (render-dependent page, port 80 closed, own-agent robots block) | null | no | counts as unobserved |
| `SCAN_ERROR` | fetch or parse failure on the scanner side | null | no | counts as unobserved |

#### 4.3.2 Metric score

- **Per-page metrics** (`P`, `CP`, `KO`, `AP`): each applicable observed page gets
  a page score `s_p` in [0, 1], defined in the metric's rule. The metric score is
  the mean of `s_p`. If fewer than half of the applicable pages were observed the
  metric is `SCAN_ERROR` (or `NOT_OBSERVED` where the rule says so).
- **Site-level and homepage metrics** (`S`, `H`): a single `s` from the rule.
- `points = round2(maxPoints x s)`, rounding half up to two decimals.
- Code: `s` = 1 gives `PASS`, `s` = 0 gives `FAIL`, anything else `PARTIAL`
  (comparison tolerance 1e-9).

#### 4.3.3 Category score and coverage

For category `c`:

```text
appliedMax(c)   = sum of maxPoints of metrics coded PASS, PARTIAL or FAIL
possibleMax(c)  = sum of maxPoints of metrics not coded NOT_APPLICABLE
coverage(c)     = appliedMax(c) / possibleMax(c)          (excluded if possibleMax = 0)
score(c)        = sum of points / appliedMax(c)           (rounded to 4 decimals)
```

A category is **shown** when `coverage(c) >= 0.5` (proposed). Otherwise it
displays "not enough data" and is left out of the aggregates.

#### 4.3.4 Pillar and overall score

With category weights `w` (section 4.4) and `shown` meaning categories shown:

```text
pillar score  = sum over shown categories in pillar of w x score(c)
                / sum over shown categories in pillar of w
overall score = sum over shown categories of w x score(c)
                / sum over shown categories of w
reported coverage = sum over categories of w x coverage(c) / sum of w
```

Scores are stored to two decimals on a 0-100 scale and displayed rounded half up.
Aggregates use the four-decimal category scores, so a reader can reproduce them
from the displayed table.

#### 4.3.5 When a score is withheld

- A **pillar** score is published only if its shown categories carry at least 30
  of its 50 weight points (proposed).
- The **overall** score is published only if both pillar scores are published and
  the shown weight is at least 70 of 100 (proposed).
- If a score is withheld the report says why and shows the observed metrics anyway.
- Outcomes `BLOCKED_BY_ROBOTS`, `UNREACHABLE` and any job-level error produce
  **no score** and a plain explanation.

#### 4.3.6 Worked example

**Metric S2.01 (title tag), five sampled pages.** Page scores
`[1, 1, 0.5, 1, 0]` (two clean, one 18 characters long, one with no title,
one good): mean = 3.5 / 5 = 0.70, so `points = 20 x 0.70 = 14.00`, code `PARTIAL`.

**Aggregation.** Suppose the eight category scores are:

| Category | Weight | Score | Weight x score |
|---|---:|---:|---:|
| S1 Crawlability | 15 | 0.80 | 12.00 |
| S2 On-page | 15 | 0.70 | 10.50 |
| S3 Technical | 10 | 0.90 | 9.00 |
| S4 Content and linking | 10 | 0.60 | 6.00 |
| A1 AI crawler access | 15 | 0.75 | 11.25 |
| A2 Structured data | 15 | 0.40 | 6.00 |
| A3 Answer-ready content | 10 | 0.50 | 5.00 |
| A4 Trust and freshness | 10 | 0.65 | 6.50 |

```text
SEO pillar = (12.00 + 10.50 + 9.00 + 6.00) / 50 = 0.75   -> 75
AEO pillar = (11.25 + 6.00 + 5.00 + 6.50) / 50   = 0.575  -> 57.5, displayed 58
Overall    = (37.50 + 28.75) / 100               = 0.6625 -> 66.25, displayed 66
```

**Coverage example.** If the homepage is render-dependent and A3's six metrics
(100 points) are all `NOT_OBSERVED`, then `coverage(A3) = 0`, A3 is hidden, shown
weight is 90, and the overall is computed over the other seven categories. Both
pillars still pass the 30-point rule (SEO 50, AEO 40), so the overall is
published with a coverage figure below 100% and critical finding CF-04.

### 4.4 Categories and weights

Weights sum to 100 and are a methodological judgement (proposed). Each category's
metrics sum to 100 points.

| Pillar | Category | Weight | Metrics |
|---|---|---:|---:|
| SEO (50) | S1 Crawlability and indexation | 15 | 5 |
| SEO | S2 On-page fundamentals | 15 | 9 |
| SEO | S3 Technical health and speed basics | 10 | 7 |
| SEO | S4 Content and internal linking | 10 | 6 |
| AEO (50) | A1 AI crawler access and content availability | 15 | 4 |
| AEO | A2 Structured data and entity clarity | 15 | 8 |
| AEO | A3 Answer-ready content | 10 | 6 |
| AEO | A4 Trust, authorship and freshness | 10 | 7 |

### 4.5 Metric catalogue

Column key: **Pts** = maximum points. **Scope** = scope code from 4.2.4.
**Basis** = `STD`, `VENDOR` or `HEUR`. "Rule" gives the metric score `s`
(or page score `s_p`); anything not listed scores 0. Evidence recorded for every
metric: the observed value(s) compared, the source URL(s), the rule branch that
fired, and a plain-English explanation, with each string capped at 200 characters
and escaped. All evidence is `OBSERVED` or `DERIVED`; version 1 has no
`MODEL_ASSISTED` metric.

#### S1 Crawlability and indexation (weight 15)

| ID | Metric | Pts | Scope | Rule | Basis |
|---|---|---:|---|---|---|
| S1.01 | Pages are indexable | 25 | P meta | 1 if no `noindex` or `none` directive in `meta` robots/googlebot/bingbot or in `X-Robots-Tag` (no agent prefix, or a googlebot/bingbot prefix) | VENDOR |
| S1.02 | Crawlable by Googlebot and bingbot | 25 | P meta, per agent | Per (agent, page) pair: 1 if allowed by `robots.txt` under RFC 9309 matching. `s` = allowed pairs / all pairs. A 4xx robots response = allowed. A 5xx or timeout = `SCAN_ERROR` | STD |
| S1.03 | Valid XML sitemap discoverable | 20 | S | 1: found (robots `Sitemap:` line, else `/sitemap.xml`), 2xx, root `urlset` or `sitemapindex`, at least one same-site `<loc>`. 0.5: found but malformed or no same-site URL. 0: not found | STD |
| S1.04 | Canonical URL is consistent | 20 | P meta | 1: exactly one canonical (head or `Link` header) equal to the page's own normalised final URL. 0.5: exactly one, pointing to a different same-site URL. 0: missing, conflicting, cross-site or non-HTTP | VENDOR |
| S1.05 | Page returns success directly | 10 | P meta | 1: final 2xx with at most 1 redirect hop. 0.5: final 2xx after 2-3 hops. 0: final 4xx/5xx or more than 3 hops | HEUR |

Failure modes and review triggers: intentional `noindex` on a thank-you page
that slipped into the sample; transient 5xx on `robots.txt`; canonical set only
through an unusual mechanism; sitemap served only to browsers. Human review when
S1.01 or S1.02 returns `FAIL` on the homepage (they feed CF-01 and CF-02).

#### S2 On-page fundamentals (weight 15)

| ID | Metric | Pts | Scope | Rule | Basis |
|---|---|---:|---|---|---|
| S2.01 | Title tag | 20 | P meta | 1: exactly one non-empty `<title>` of 20-65 characters. 0.5: exactly one of 10-19 or 66-90 characters. 0: missing, empty, multiple, under 10 or over 90 | HEUR |
| S2.02 | Titles are unique | 10 | S | `s` = distinct normalised titles / titled pages. `NOT_APPLICABLE` if fewer than 2 titled pages | VENDOR |
| S2.03 | Meta description | 15 | P meta | 1: exactly one `meta name=description` of 70-160 characters. 0.5: exactly one of 30-69 or 161-220. 0: missing, empty, multiple, under 30 or over 220 | HEUR |
| S2.04 | Descriptions are unique | 5 | S | As S2.02 for descriptions | VENDOR |
| S2.05 | Single H1 | 15 | P body | 1: exactly one non-empty `<h1>`. 0.5: two or more non-empty. 0: none | HEUR |
| S2.06 | Heading hierarchy | 10 | P body | A skip is a jump of more than one level downward (for example h2 to h4). 1: zero skips, and at least one `<h2>` on pages of 300 or more words. 0.5: 1-2 skips. 0: 3 or more skips, or 300+ words with no `<h2>` | STD |
| S2.07 | Image alt attributes | 10 | P body | `s_p` = content images with an `alt` attribute (empty `alt` counts as an explicit decorative mark) / content images. Excluded: `role=presentation`, `aria-hidden=true`, images with width or height attribute of 2 or less. `NOT_APPLICABLE` if no content images in the sample | STD |
| S2.08 | Language declared | 5 | P meta | 1 if `<html lang>` matches `^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$` | STD |
| S2.09 | Share-preview tags | 10 | P meta | `s_p` = present of `og:title`, `og:description`, `og:image` (absolute https URL) / 3 | STD |

Failure modes: titles set client-side so the raw `<head>` holds a generic
placeholder (scored as observed, noted in evidence); non-Latin scripts change the
meaning of character counts; search engines may rewrite descriptions. Length
thresholds are `HEUR` and the first candidates for tuning after the pilot.

#### S3 Technical health and speed basics (weight 10)

| ID | Metric | Pts | Scope | Rule | Basis |
|---|---|---:|---|---|---|
| S3.01 | HTTPS enforced | 20 | S | Request `http://host/`. 1: permanent redirect (301/308) reaching same-site https within 2 hops. 0.5: reaches https via 302/307. 0: serves 2xx over HTTP, or no HTTPS. `NOT_OBSERVED` if port 80 refuses or times out | VENDOR |
| S3.02 | Valid TLS certificate | 10 | S | 1: chain valid, hostname matches, at least 14 days to expiry. 0.5: valid but under 14 days. 0: expired, mismatched, self-signed or incomplete chain | STD |
| S3.03 | Mobile viewport | 15 | P meta | 1 if `meta name=viewport` content includes `width=device-width` | VENDOR |
| S3.04 | Response compression | 10 | S | Homepage requested with `Accept-Encoding: gzip, br`. 1 if `Content-Encoding` is gzip, br or zstd. `NOT_APPLICABLE` if the uncompressed HTML is under 1 KB | VENDOR |
| S3.05 | Server response time | 10 | S | Median of 3 sequential homepage requests, measured after connection setup to first byte. 1: 800 ms or less. 0.5: up to 1,800 ms. 0: above. Fewer than 2 successful samples: `NOT_OBSERVED` | HEUR |
| S3.06 | Broken internal links | 25 | S | Check up to 10 same-site link targets per sampled page (main-content links first, then others, in DOM order), 40 per job. Broken = 404, 410, or 5xx after one retry. 401, 403, 429 and timeouts are unobserved and excluded. `s` = 1 - broken / observed. Fewer than 5 observed links: `NOT_OBSERVED` | HEUR |
| S3.07 | No mixed content | 10 | P body | On https pages: 1 if no `http://` subresource; 0.5 if only passive (`img`, `audio`, `video`); 0 if any active (`script`, stylesheet, `iframe`) | STD |

Failure modes: bot challenges or geo-blocks returning 403 to a scanner hosted
outside Ireland (recorded as informational finding CF-07, not a penalty);
timing differs by region and time of day, so S3.05 uses wide bands and low
weight; a CDN may treat HEAD differently from GET. If the certificate is invalid
the scan continues without verification for that origin, read-only, because
fetched content is untrusted anyway.

#### S4 Content and internal linking (weight 10)

| ID | Metric | Pts | Scope | Rule | Basis |
|---|---|---:|---|---|---|
| S4.01 | Content depth | 30 | CP body | 1: main content of 300 or more words. 0.5: 150-299. 0: under 150 | HEUR |
| S4.02 | Internal link breadth | 20 | H body | Distinct same-site link targets on the homepage (nav, main, footer; excluding itself, fragments, `mailto`, `tel`, `javascript`). 1: 8 or more. 0.5: 3-7. 0: 2 or fewer | HEUR |
| S4.03 | Descriptive anchor text | 20 | P body | `s_p` = same-site links with a non-empty accessible name (visible text, else `aria-label`, else image `alt`) not in `GENERIC_ANCHORS` / all same-site links | HEUR |
| S4.04 | Distinct content | 10 | S | `s` = 1 - (pages in identical-text sets / content pages), comparing a SHA-256 of normalised main text. `NOT_APPLICABLE` below 2 content pages | HEUR |
| S4.05 | Clean URLs | 10 | P meta | Violations: uppercase in path, space or `%20`, underscore, path over 100 characters, a query string, or a session-style parameter (`sid`, `phpsessid`, `jsessionid`, `sessionid`). 1: none. 0.5: one. 0: two or more | HEUR |
| S4.06 | Site navigation | 10 | P body | 1: a `<nav>` or `role=navigation` containing 3 or more same-site links. 0.5: one with 1-2. 0: none | HEUR |

Failure modes: main-content extraction can pull in a mega-menu; icon-only links
without accessible names count as non-descriptive (and are also an accessibility
defect); short legitimate pages (contact, legal) are excluded from `CP`.

#### A1 AI crawler access and content availability (weight 15)

| ID | Metric | Pts | Scope | Rule | Basis |
|---|---|---:|---|---|---|
| A1.01 | AI search and answer crawlers allowed | 40 | P meta, per agent | Agents: `OAI-SearchBot`, `PerplexityBot`, `Claude-SearchBot` (Appendix A). Per (agent, page): 1 if allowed by RFC 9309 matching. `s` = allowed pairs / all pairs | VENDOR |
| A1.02 | Snippet and preview eligibility | 15 | P meta | 1: no `nosnippet`, no `max-snippet:0`, no `none` (meta or `X-Robots-Tag`). 0.5: `max-snippet` between 1 and 49. 0: `nosnippet`, `max-snippet:0` or `none` | VENDOR |
| A1.03 | `llms.txt` present | 5 | S | 1: `/llms.txt` 2xx text with at least one `# ` heading line and one link. 0.5: exists but no recognisable structure. 0: not found | HEUR |
| A1.04 | Primary content in the initial HTML | 40 | CP | 1 if main content has 50 or more words in the raw HTML. 0 otherwise (thin or render-dependent). This is the one metric that carries the penalty for render-dependent pages | VENDOR |

Notes: classic search access (Googlebot, bingbot) is scored once, in S1.02, to
avoid double counting. Opt-outs from model-training crawlers are informational
(4.8), not scored. User-initiated agents are informational because vendors state
they may not apply `robots.txt`. `llms.txt` is an emerging convention with no
confirmed retrieval benefit, so it is capped at 5 points; re-verify before each
release. Review trigger: any score change caused by an Appendix A list update.

#### A2 Structured data and entity clarity (weight 15)

| ID | Metric | Pts | Scope | Rule | Basis |
|---|---|---:|---|---|---|
| A2.01 | Valid JSON-LD | 15 | P meta | 1: at least one block, all parse, each with a schema.org `@context` and `@type` or `@graph`. 0.5: at least one valid and one invalid block, or microdata/RDFa only (`itemscope` seen). 0: none, or none valid | VENDOR |
| A2.02 | Organisation identity | 20 | H meta | From the first Organization-family node (Appendix B; `Person` accepted for sole traders): `name` and `url` present (8), `logo` or `image` (4), at least one of `telephone`, `email`, `address`, `contactPoint` (4), non-empty `description` (4). `s` = points / 20 | STD |
| A2.03 | Profile links (`sameAs`) | 10 | H meta | Distinct absolute https URLs on other hosts. 1: 2 or more. 0.5: one. 0: none. Targets are not fetched | HEUR |
| A2.04 | Identity graph coherence | 10 | S | A reference is an object holding only `@id`. It resolves if a node with that `@id` and other properties exists on the same page or on the homepage. `s` = resolved / references. `NOT_APPLICABLE` if none | STD |
| A2.05 | Page-type schema | 15 | P meta | `s_p` = checks passed / checks. `article`: Article-family node, `headline`, `datePublished`, `author.name`. `faq`: `FAQPage`, at least 2 `Question`, each with `acceptedAnswer.text`. `services`: Service/Product/OfferCatalog node with `name` and `description`. `about`: `AboutPage`, `ProfilePage` or `Person` node. `NOT_APPLICABLE` if no sampled page has an expectation | STD |
| A2.06 | Breadcrumbs | 5 | P meta | Pages with path depth of 2 or more: 1 if a `BreadcrumbList` has at least 2 items each with `name` and `item` or `position`. `NOT_APPLICABLE` if no such page | VENDOR |
| A2.07 | Schema matches visible content | 15 | P body | Applicable checks per page: Organization `name` appears in visible text or title; each FAQ `Question` text appears in visible text; Article `headline` equals or is contained in the H1 or title (normalised). `s_p` = passed / applicable. `NOT_APPLICABLE` if none | HEUR |
| A2.08 | Name consistency | 10 | H meta | Compare the JSON-LD organisation `name`, `og:site_name` and `<title>`. 1: JSON-LD name equals `og:site_name` and appears in the title. 0.5: one of the two holds. 0: neither. `NOT_APPLICABLE` if no JSON-LD organisation name | HEUR |

Notes: Google reduced FAQ rich-result eligibility in 2023, so the `FAQPage`
checks are kept as an answer-structure and entity-clarity signal, not a
rich-result prediction (re-verify before publishing the methodology). JSON-LD
injected only by client-side JavaScript is invisible to a non-rendering crawler,
so it correctly scores as absent. Visible text and structured data must say the
same thing (see `04_AGENTS.md`, Accessibility and content); A2.07 measures that.

#### A3 Answer-ready content (weight 10)

All A3 metrics read body content. A3.01 and A3.05 apply only when `<html lang>`
starts with `en` (`NOT_APPLICABLE` otherwise).

| ID | Metric | Pts | Scope | Rule | Basis |
|---|---|---:|---|---|---|
| A3.01 | Question-style headings | 10 | KO body | Subheadings are `h2` and `h3` in main content (at least 3 needed). A question ends with `?` or starts with a word in `QUESTION_STARTERS`. 1: 25% or more are questions. 0.5: 10-24%. 0: under 10% | HEUR |
| A3.02 | Answer-first sections | 30 | KO body | For each subheading, the first `<p>` before the next heading of the same or higher level is an answer block if it has 15-70 words and at most 3 sentences. `s_p`: 1 if 60% or more of subheadings qualify, 0.5 if 30-59%, else 0 (at least 3 subheadings needed) | HEUR |
| A3.03 | FAQ block present | 20 | S | Question and answer pairs detected as `<details>` plus `<summary>`, `<dl>` with `<dt>/<dd>`, or a question-form heading followed by a paragraph. 1: at least one sampled page with 3 or more pairs. 0.5: 1-2 pairs at most. 0: none | HEUR |
| A3.04 | Scannable structure | 15 | KO body | 1 if main content has a list of 3 or more items, or a `<table>` with a header cell and at least 2 rows. `NOT_APPLICABLE` for pages under 300 words | HEUR |
| A3.05 | Sentence and paragraph length | 10 | KO body | Median sentence 24 words or fewer AND median paragraph 100 words or fewer: 1. One bound exceeded: 0.5. Both: 0 | HEUR |
| A3.06 | Entity statement near the top | 15 | H body | Within the first 200 words of homepage main content: (a) the business name (JSON-LD organisation `name`, else `og:site_name`) appears; (b) a locality or area from the JSON-LD `address` or `areaServed` appears; (c) a term from `knowsAbout` or `serviceType` appears. A check applies only if its reference data exists in the JSON-LD. `s` = passed / applicable. `NOT_APPLICABLE` if none apply | HEUR |

Failure modes: every A3 rule is a heuristic proxy for "easy to quote". They can
reward formulaic writing, so they are low weight (10 of 100 overall), reviewed
each quarter, and phrased in the report as signals, not quality judgements.
Human review when a page scores 0 on A3.02 but a reviewer judges it clearly
answer-first.

#### A4 Trust, authorship and freshness (weight 10)

| ID | Metric | Pts | Scope | Rule | Basis |
|---|---|---:|---|---|---|
| A4.01 | About page discoverable | 15 | H body | 1: homepage links to a same-site URL matching `ABOUT_PATTERNS` that returns 2xx. 0.5: such a URL appears only in the sitemap or a sampled page. 0: none | HEUR |
| A4.02 | Contact information visible | 15 | H body | Signals: `mailto:` link or email text; `tel:` link or JSON-LD `telephone`; `<address>` text of 10 or more characters or JSON-LD `address`; a link matching `CONTACT_PATTERNS`. 0 signals: 0. 1: 0.5. 2: 0.75. 3 or more: 1 | HEUR |
| A4.03 | Author attribution | 15 | AP body | 1 if a visible byline (`rel=author`, `itemprop=author`, class `byline` or `author`, or "By " within the first 400 characters) or JSON-LD `author.name`. `NOT_APPLICABLE` if no article page sampled | HEUR |
| A4.04 | Dates on articles | 10 | AP body | 0.5 for a published date (`datePublished` or a `<time datetime>` in the byline/header) plus 0.5 for a modified date (`dateModified`). `NOT_APPLICABLE` as A4.03 | HEUR |
| A4.05 | Freshness | 20 | S | `latest` = newest valid date among sitemap `lastmod`, JSON-LD `dateModified` and `datePublished`, and `<time datetime>` on sampled pages. Age = scan time minus `latest`. 1: 180 days or less. 0.5: 181-365. 0: over 365. No valid date: `NOT_OBSERVED`. Sitemap `lastmod` is ignored as evidence if all values are identical across 5 or more URLs (build-time stamp) | HEUR |
| A4.06 | Privacy policy linked | 10 | H body | 1 if the homepage links to a same-site URL matching `PRIVACY_PATTERNS`. This records presence only and makes no compliance claim | HEUR |
| A4.07 | External references | 15 | KO body | 1 if main content has at least one outbound link to another site (http/https, not `rel=sponsored` or `ugc`, not a share link). Presence only, no judgement of authority | HEUR |

Failure modes: dates can be auto-generated; bylines vary widely in markup; path
patterns are English-centric. Review trigger: A4.05 evidence names an
auto-generated source.

### 4.6 Critical findings (shown beside the score, never altering it)

A weighted average can look healthy while a single blocker defeats the whole
site. Findings are derived deterministically from metric evidence and displayed
above the scores in neutral wording ("Detected: ...").

| ID | Trigger |
|---|---|
| CF-01 | `robots.txt` disallows `/` for the `*` group (or the Googlebot group) |
| CF-02 | Homepage carries `noindex` (meta or header) |
| CF-03 | All three AI search/answer crawlers are disallowed for the homepage |
| CF-04 | Homepage is render-dependent (4.2.6) |
| CF-05 | HTTPS not served, or certificate invalid or expired |
| CF-06 | Homepage canonical points to a different site |
| CF-07 | The scanner was challenged or blocked (403, 429, 503 with challenge markup); results may be incomplete and AI crawlers may face similar rules |

### 4.7 Score bands and wording

Bands are presentation only, never stored as claims, and shown only with a
published score.

| Score | Label |
|---|---|
| 85-100 | Strong signals detected |
| 70-84 | Good foundations |
| 50-69 | Some gaps |
| Under 50 | Many gaps |

Required next to every result: scan date and time (UTC), methodology version,
coverage, pages sampled, a limitations summary, and the correction route
(`oisin@databridges.ie`). Avoid "ranks", "grade", "worst", "you will be cited",
"AI visibility score" and any claim about the underlying business. Fix guidance
is written as "Consider ..." with no outcome promises.

### 4.8 Informational signals (reported, not scored)

- Training-crawler policy: `GPTBot`, `ClaudeBot`, `Google-Extended`,
  `Applebot-Extended`, `CCBot` and others (Appendix A), shown neutrally as
  "allowed" or "disallowed".
- User-initiated agent policy: `ChatGPT-User`, `Claude-User`, `Perplexity-User`.
- Scanner challenged or blocked (CF-07), and the scanner region used for timing.
- JSON-LD types detected, HTML size, number of redirects.

### 4.9 Deliberately not measured

Search positions, traffic, backlinks, domain authority, Core Web Vitals (field or
lab), whether any AI system cites the site, content accuracy or quality,
accessibility conformance, GDPR or other legal compliance, off-site reputation or
mentions, rendered (JavaScript) content, and any cross-site or sector benchmark.
Candidates for a later methodology version, each needing its own approval:
PageSpeed/CrUX data, a rendered-DOM pass in an isolated runtime, and citation
tracking.

### 4.10 Methodology change control

- Any change to a rule, threshold, weight, list or applicability condition bumps
  the methodology version (semantic: patch for wording, minor for list or
  threshold changes, major for weights or structure) and the metric `version`.
- Every change updates the golden fixtures, re-runs the calibration set, and adds
  a row to the change log (Appendix F) with the reason and expected score impact.
- Published scores are never silently recomputed under a new version.
- AI crawler and pattern lists carry `reviewDueAt` (proposed: 30 days for the
  AI crawler list, 90 days for the rest). When overdue, the report flags the list
  as stale rather than failing.

---

## 5. Technical design

Evolve the existing application; add only what approved work needs
(`03_TECHNICAL_ARCHITECTURE.md`).

### 5.1 Architecture

```text
Stages 2-4 (no public surface)
  CLI (scripts/visibility-scan.ts)
    -> fetch layer (SSRF-safe, allowlisted to owned/consented hosts)
    -> ScanSnapshot (bounded, in memory / local file)
    -> evaluateSnapshot()  [pure]  -> scoreReport() [pure]
    -> JSON + Markdown report on disk (never committed)

Stage 5 (public, after approvals)
  Browser /index form --POST url--> Netlify Function (isolated worker)
        validate URL -> rate limit -> kill switch -> fetch layer (every hop validated)
        -> ScanSnapshot -> evaluateSnapshot() -> scoreReport()
  Browser <-- JSON report (derived values only; no raw bodies or headers) --
```

Rules: the evaluators and scoring code never perform I/O, so they run unchanged
in the CLI, the function and the tests. The function is a standalone Netlify
Function rather than a Next.js route handler so it has its own memory, timeout and
rate-limit configuration and is isolated from page rendering (03); the existing
`src/app/api/otter/route.ts` pattern is not reused for this reason. Verify
current Netlify function limits (timeout, memory, rate limiting) at build time
rather than assuming them.

### 5.2 Repository layout (additive; nothing moves)

```text
src/lib/visibility/
  methodology.ts        categories, metrics, weights, thresholds (single source of truth)
  lists.ts              AI agents, page patterns, word lists (versioned, with reviewDueAt)
  types.ts              contracts (Appendix D)
  url.ts                the one URL parser and normaliser
  extract.ts            HTML to {head facts, main content, headings, links, JSON-LD}
  robots.ts             RFC 9309 matching wrapper
  evaluate/             pure evaluators, one file per category
  scoring.ts            formulas in 4.3
  report.ts             ScanReport assembly, critical findings, wording
netlify/functions/visibility-scan.ts     (Stage 5 only)
scripts/visibility-scan.ts               CLI (Stages 2-4)
src/app/index/...                        UI (Stage 5 only; reserved namespace)
tests/visibility/fixtures/<name>/        synthetic sites + expected.json
```

### 5.3 Fetch rules and limits (all values proposed)

| Parameter | Value |
|---|---|
| Agent string | `DataBridgesBot/1.0 (+https://databridges.ie/index/bot)` |
| Connect timeout | 3 s |
| Per-request timeout | 8 s (socket idle and total) |
| Job timeout | 20 s, then stop fetching and evaluate what was observed |
| Redirects per resource | 4 maximum, each hop re-validated |
| Requests per job | 60 hard cap |
| Concurrency | 3 total, 2 per host; at least 250 ms between request starts to one host |
| Response size | 1 MB on the wire, 3 MB decompressed (stream with a byte counter, abort) |
| Header size | 32 KB |
| JSON-LD | 256 KB per block, 20 blocks per page, nesting depth 32 |
| HTML | 3 MB; stop evaluation beyond 100,000 elements |
| Retries | one retry after 1 s on 5xx or timeout for pages, sitemaps and links; none for `robots.txt` |
| Cookies and credentials | never stored or sent |
| Methods | `GET` and `HEAD` only; no forms; no JavaScript execution |

### 5.4 Fetch implementation approach (no new dependency)

Use Node's `http`/`https` modules with a custom `lookup` so the connection goes
to the exact address that was validated, and `net.BlockList` for range checks:

1. Resolve once with `dns.lookup(host, { all: true })`.
2. If **any** returned address is blocked, reject the whole host (covers
   mixed-address responses).
3. Pass a `lookup` function that returns only the validated address, so there is
   no second resolution and no DNS-rebinding window. Keep the original hostname
   for the `Host` header and TLS SNI/certificate verification.
4. Follow redirects manually; repeat steps 1-3 on every hop.

Blocked ranges (deny list plus a requirement that IPv6 be global unicast):
IPv4 `0.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10`, `127.0.0.0/8`,
`169.254.0.0/16` (includes the cloud metadata address), `172.16.0.0/12`,
`192.0.0.0/24`, `192.0.2.0/24`, `192.168.0.0/16`, `198.18.0.0/15`,
`198.51.100.0/24`, `203.0.113.0/24`, `224.0.0.0/4`, `240.0.0.0/4`; IPv6 `::/128`,
`::1/128`, `fc00::/7`, `fe80::/10`, `ff00::/8`, `2001:db8::/32`, `64:ff9b::/96`,
`2002::/16`, `2001::/32`, plus unwrapping of IPv4-mapped (`::ffff:a.b.c.d`)
addresses before checking.

### 5.5 Mapping to the 03 scanner security requirements

| 03 requirement | Control | Test |
|---|---|---|
| Only `http`/`https` with explicit ports | Scheme and port allowlist (80, 443) in `url.ts` | `file:`, `gopher:`, `ftp:`, ports 22, 25, 6379, 5432 rejected |
| One trusted URL parser | WHATWG `URL`, a single `parseTarget()` | Userinfo tricks (`good.com@evil`), IDN homographs, decimal/octal/hex IPs rejected |
| Reject loopback, private, link-local, reserved, metadata IPs (v4 and v6) | `net.BlockList` per 5.4 | Every blocked range, IPv4-mapped IPv6, `169.254.169.254` |
| Revalidate every redirect hop | Manual redirect loop | Redirect to a private address, to a non-HTTP scheme, redirect loop |
| DNS rebinding and mixed addresses | Single resolution, validated-address `lookup`, reject if any address blocked | Test resolver returning public then private; mixed A records |
| Restrict outbound network where the platform permits | Not available on Netlify (verify at build time); compensated by code controls. Residual risk recorded in the security review | Documented, not tested |
| Connection, response and job timeouts | 3 s / 8 s / 20 s | Slow-loris (trickling) responses, hanging connect |
| Cap redirects, pages, depth, bytes, decompressed bytes | Limits in 5.3; depth is always 0 (sample only, no crawling) | Gzip bomb, oversized body, 10-hop redirect chain |
| Only expected content types | Allowlist per resource kind | `application/octet-stream` HTML, images, PDFs |
| No forms, auth or executing downloads | `GET`/`HEAD` only, no cookie jar, parse-only | Review of code paths |
| Isolate any browser or JS renderer | None in version 1; any future renderer is a separate runtime with its own ADR | N/A |
| Sanitise stored evidence before rendering | Plain-text evidence, 200-character cap, control characters stripped, rendered as React text nodes, never as HTML | Hostile fixture with script tags and RTL-override characters |
| Descriptive agent and rate limits | Agent string in 5.3; abuse controls in 5.6 | Header assertion; limiter test |
| Respect crawl restrictions, record failures without bypassing | Own-agent `robots.txt` check before any other request to an origin; block yields `NOT_OBSERVED` or `BLOCKED_BY_ROBOTS` | Fixture that disallows `DataBridgesBot` |

Additional hazards handled: XML (sitemap) read with bounded string extraction of
`<loc>` and the five predefined entities only, so no DTD or entity expansion;
JSON-LD size and depth caps; regular expressions kept linear-time; a hard
allowlist of hosts in Stages 2-3 so an accidental arbitrary scan is impossible
until Stage 5 removes it (removal is itself a Level 3 change). Treat any future
use of a model on fetched text as prompt-injection-exposed and isolate it.

### 5.6 Abuse prevention and cost (Stage 5)

- **Per IP:** 5 scans per hour, 20 per day. **Per target host:** 3 per hour and
  1 concurrent, so the tool cannot be used to hammer someone else's site.
  **Global:** daily cap. All proposed.
- **Shared counter store required.** The in-memory limiter in `route.ts` is
  per-instance and does not hold across serverless instances (its own comment
  says so). Options: a platform rate-limit feature (verify availability on the
  current plan), Netlify Blobs counters, or a hosted Redis. A new store needs an
  ADR (D-07).
- **Kill switch:** environment variable `VISIBILITY_SCAN_ENABLED` (default
  false) checked first on every request. Changing production environment
  variables needs approval (`04_AGENTS.md`).
- Optional bot challenge if abuse appears; it adds a third-party script, CSP
  changes and a privacy notice, so decide only with evidence.
- The function never returns fetched bodies or arbitrary headers: derived
  values only, strings capped at 200 characters.

### 5.7 Privacy, data and analytics

| Item | Treatment |
|---|---|
| Input | The URL of a public site the visitor chooses. Not stored. |
| Results | Returned to the requester only; not stored; no profile, no history |
| Logs | Hostname hashed (truncated SHA-256), counts, durations, methodology version, error codes. No full URLs, no bodies, no IPs beyond platform defaults |
| Email delivery | Out of scope for the first public release (needs a provider and an ADR; D-14). On-screen, print and JSON/Markdown download instead |
| Leads | Optional later. Request email only; separate unticked marketing choice; transactional delivery separate from marketing (09). Pilot source `INDEX_PRIVATE_PILOT` exists; a public source and any new analytics events need an amendment to 09 |
| Analytics | Only allowlisted properties. Never send the scanned URL, domain, email or any free text |
| Privacy notice | New wording needs the responsible owner's approval; this plan does not make a legal determination (D-08) |

### 5.8 Operations checklist required by 03

| 03 item | Plan |
|---|---|
| Owner and support path | Product owner (D-01); support via `oisin@databridges.ie` |
| Structured error logging without sensitive values | Error codes only, hashed hostname |
| Health and failure signal | Daily count of scans, `SCAN_ERROR` rate and median duration; alert if error rate exceeds 25% over a day |
| Retry and idempotency | Scans are read-only and safe to repeat; retry rules in 5.3 |
| Retention and deletion | No result retention; logs follow platform retention (to be confirmed) |
| Backup or recovery | None needed (stateless); methodology data lives in git |
| Cost or usage limit | Global daily cap plus kill switch (5.6) |
| Rollback or disable | Set `VISIBILITY_SCAN_ENABLED=false`; revert the merge; remove the route from the sitemap |

### 5.9 Dependencies (assess each before adding, per `04_AGENTS.md`)

| Package | Why | Alternative | Decision |
|---|---|---|---|
| `cheerio` (parse5-based) | Spec-compliant HTML parsing and selectors; server-side only | `parse5` directly with a hand-written traversal | Recommended; assess at WP-3 |
| `robots-parser` | RFC 9309 matching is subtle (wildcards, `$`, longest match, group merging) | In-house matcher against the RFC examples | Prefer the package if it passes the RFC fixtures; otherwise write it in-house |
| `vitest` (dev) | Already the proposed runner in `TEST_PLAN.md` | `node --test` | Align with `TEST_PLAN.md`; needs approval (D-06) |
| `tsx` (dev) | Run the TypeScript CLI | Node type stripping (Node 24 locally; Netlify's Node version is configured separately) | Optional |

No new dependency is needed for fetching, IP validation or sitemap parsing.

### 5.10 Environments and release flow

Feature branch, pull request, configured checks, Netlify deploy preview, human
review, merge to `master` (`10_RELEASE_QA_AND_CHANGE_CONTROL.md`). Never push or
merge without authorization. Scan reports and any snapshot of a third-party site
are never committed (they contain third-party data); the repository holds only
synthetic fixtures and snapshots of DataBridges-owned sites. `reports/` goes in
`.gitignore` when the CLI lands.

---

## 6. Experience design (public release only)

### 6.1 Routes (reserved namespace)

`/index` (the tool), `/index/methodology` (the full method, once approved),
`/index/bot` (scanner information and opt-out). Until Gate 4: every page sets
`robots: { index: false }`, `robots.ts` disallows `/index/`, `sitemap.ts` omits
them, and no navigation links to them (02).

### 6.2 States

`idle`, `validating`, `scanning` (progress by named stage), `complete`,
`partial` (score withheld, observed metrics shown), `blocked` (own-agent
`robots.txt` block or WAF challenge), `error`, `disabled` (kill switch). Each has
defined copy, an accessible announcement and a retry path.

### 6.3 Report layout

1. Critical findings (if any), neutral wording.
2. Scores: overall, SEO, AEO with band labels and coverage; withheld scores
   explain why.
3. Category cards with metric tables (status icon plus text, never colour alone),
   evidence and "Consider ..." guidance.
4. Scan facts: date and time (UTC), methodology version, scanner version, pages
   sampled, snapshot hash, limitations, correction route.
5. A separate, visually distinct next-step panel ("Get a full audit"). Results
   never depend on it, and there is no urgency framing.

### 6.4 Accessibility and design

- `<form>` with a labelled `type=url` input (`inputmode=url`,
  `autocomplete=url`, `spellcheck=false`); errors announced via `aria-live`.
- Progress and completion announced; focus moves to the results heading on
  completion; all controls keyboard operable; reduced-motion respected.
- Use existing tokens (navy, cyan, yellow, off-white) and patterns
  (`ScrollReveal`, `AnimatedBlobs`, the `AEOReadiness` score bar). No new
  animation or visual dependency.
- Print stylesheet and a JSON/Markdown download.
- Tool page structured data must match visible content and make no ranking or
  outcome claim.

### 6.5 Relationship to the existing AEO self-check

`src/components/AEOReadiness.tsx` (seven manual checkboxes) stays as the no-scan
fallback and as a teaching aid. Appendix C maps its items to metrics and shows
which cannot be measured automatically.

---

## 7. Verification plan

### 7.1 Test layers

| Layer | What it proves | When |
|---|---|---|
| Unit and golden fixtures | Each metric returns the expected result on synthetic sites; scoring formulas match the worked examples | Every change to `src/lib/visibility` |
| Determinism | Same snapshot run 10 times yields byte-identical reports | CI/local, every change |
| Security suite | SSRF, redirect, DNS, size and timeout controls (7.3) | Stage 2 and every fetch-layer change |
| Self-scan calibration | The tool agrees with what we know about databridges.ie (7.4) | Stage 2, then each methodology release |
| Stability | Live re-scans vary only where expected (7.5) | Stage 2 and Stage 3 |
| Pilot | Human review agrees with the tool (7.6) | Stage 3 |
| Accessibility and responsive | Keyboard, screen reader, narrow/medium/wide layouts | Stage 5 |

Absent infrastructure is a limitation to report, not a pass: there is no test
runner today (`TEST_PLAN.md`).

### 7.2 Golden fixtures (synthetic, committed)

Each fixture is a small static site plus `expected.json` holding every metric
result, category score and critical finding.

| Fixture | Expectation |
|---|---|
| `fx-strong` | Overall 95 or above; no critical findings |
| `fx-minimal` | Valid but sparse; known partial scores |
| `fx-spa-shell` | CF-04; body metrics `NOT_OBSERVED`; A1.04 = 0; overall withheld on coverage |
| `fx-noindex-home` | CF-02; S1.01 FAIL |
| `fx-robots-block-all` | CF-01 and CF-03 |
| `fx-robots-block-ai-only` | A1.01 = 2/3 of pairs; training agents shown as informational |
| `fx-robots-rfc-matching` | RFC 9309 cases: longest match, allow wins ties, `*` and `$`, group merging, 4xx/5xx handling |
| `fx-canonical-variants` | Each S1.04 branch |
| `fx-duplicate-titles` | S2.02, S2.04, S4.04 branches |
| `fx-jsonld-broken` | Invalid JSON, dangling `@id`, microdata only |
| `fx-faq-mismatch` | A2.05 and A2.07: `FAQPage` text differs from visible text |
| `fx-stale` | A4.05 branches, including identical `lastmod` values |
| `fx-non-english`, `fx-cjk` | Applicability rules for A3.01, A3.05 and word-count metrics |
| `fx-hostile` | Oversized and deeply nested JSON-LD, huge attributes, RTL-override and zero-width characters; no crash, bounded time |

Changing a rule means changing the expected file in the same commit, which makes
every scoring change visible in review.

### 7.3 Security suite

Run against a local test server and a stub resolver, never the open internet:
loopback v4/v6 (`127.0.0.1`, `::1`, `::ffff:127.0.0.1`); RFC 1918 ranges;
link-local and the metadata address; carrier-grade NAT, reserved and
documentation ranges; decimal, octal and hex IP encodings; userinfo tricks; IDN
lookalikes; non-HTTP schemes and disallowed ports; redirects to private
addresses and to other schemes; redirect loops and over-long chains; DNS that
returns a public then a private address; mixed A records; gzip and brotli
bombs; oversized and trickling responses; wrong content types; very large
headers; a target whose `robots.txt` disallows `DataBridgesBot`. Each must end
in the documented outcome with no outbound request to a blocked address.

### 7.4 Self-scan calibration (pre-registered)

Before the first scan of `databridges.ie`, record expected results from the
repository (state at 2026-10-02) so a mismatch is investigated as either a
scanner bug or a site change, not explained away afterwards.

| Expectation | Basis in the repository | Check |
|---|---|---|
| A1.03 = FAIL | No `llms.txt` under `public/` | Confirm live |
| S1.03 = PASS | `src/app/robots.ts` declares a sitemap; `sitemap.ts` exists | Confirm live |
| A1.01 = 3 of 3 agents allowed | `robots.ts` allows `/` for `*` and disallows only `/admin` and `/api/` | Confirm live |
| S2.08 = PASS | `src/app/layout.tsx` sets `<html lang="en-IE">` | Confirm live |
| A2.02 high | `src/lib/jsonld.ts` defines an organisation node with name, url, logo, contact fields, `sameAs` | Confirm the homepage actually embeds it |
| A2.05 = PASS on `/faq` | `/faq` emits `FAQPage` JSON-LD (see `CLAUDE.md`) | Confirm live |

Record the first scan as a baseline report and keep the calibration log.

### 7.5 Test-retest stability protocol

Re-scan three stable owned sites 10 times each within 24 hours. Proposed
acceptance: every content-derived metric identical in all runs; overall score
range 2 points or less; only S3.05 (timing) allowed to vary between bands.

### 7.6 Private pilot protocol (Stage 3 / Gate 3)

Selection record (07, "Sampling and selection"): target population (Irish
SMEs, per the hypothesis), inclusion and exclusion criteria, discovery source,
selection date, ownership and duplicate handling, known coverage bias, and the
statement that the sample supports **description only**, never comparison or an
Irish benchmark.

Consent: written permission from each site owner before scanning, recorded with
date and wording; results delivered privately; no result shared elsewhere.

Review: a reviewer who has not seen the tool output independently rates every
metric on 5 sites and 10 randomly chosen metrics on each remaining site.

Proposed thresholds (owner to approve):

| Measure | Threshold |
|---|---|
| Sites | 15-25 |
| Metric-level agreement with the reviewer | 90% or more for at least 90% of metrics; any metric below 90% is revised or dropped |
| Results overturned by review (false detection) | 5% or less of `PASS`/`FAIL` results |
| Job-level failures (no score) | 10% or less of scans |
| Metric-level `SCAN_ERROR` | 5% or less of evaluations |
| Weighted coverage of 70% or more | On at least 90% of successful scans |
| Test-retest | As 7.5 |
| Usefulness | 70% or more of participants say findings were clear and at least one was new and actionable |
| Maintenance | At or under the budget in 2.5 |

Fail any of these and the default is revise or stop, not proceed (07 stop
conditions).

### 7.7 Validation commands

Baseline for every code change: `npm run lint`, `npm run build`,
`npm run typecheck`. Add `npm test` (Vitest) only after the runner is approved
and installed; do not report tests as passing before then. Report exact results
in the completion report (`04_AGENTS.md`).

---

## 8. Build plan (work packages)

Sizing is relative (S/M/L). Branches are feature or fix branches off `master`.
No work package pushes, merges or deploys without authorization.

| WP | Title | Stage | Level | Size | Depends on |
|---|---|---|---|---|---|
| WP-0 | Approvals and Gate 0 record | 0 | 3 (decisions) | S | none |
| WP-1 | Methodology review and freeze (0.1.0) | 1 | 3 (decisions) | M | WP-0 |
| WP-2 | Test infrastructure (Vitest) | 2 | 1-2 | S | D-06 |
| WP-3 | Scoring core: contracts, methodology data, extraction, evaluators, scoring, fixtures | 2 | 2 | L | WP-1, WP-2 |
| WP-4 | Fetch layer with SSRF controls and the owned-host allowlist; security suite | 2 | 2 (high-risk class) | L | WP-3 |
| WP-5 | CLI, report output, self-scan calibration | 2 | 2 | M | WP-3, WP-4 |
| WP-6 | Private pilot operations | 3 | 2 + consent | M | WP-5, D-11 |
| WP-7 | Gate 3 decision record | 4 | Owner | S | WP-6 |
| WP-8 | Public-release prerequisites | 5 | 3 | M | WP-7 |
| WP-9 | Public self-serve build | 5 | 3 | L | WP-8 |
| WP-10 | Launch, monitor, operate | 5 | 3 | S | WP-9 |

### Ultracode execution (multi-agent run)

On 2026-10-02 the business owner instructed: adapt this plan for ultracode and
run it. That instruction is treated as authorisation to carry out **WP-2 to WP-5
(Stage 2, private prototype) only**. It does not approve Stage 3 onward, public
release, deployment, or any item in the Level 3 column of section 1.3. D-02
(sequencing) and D-06 (Vitest and the section 5.9 dependency assessments) are
recorded as decided for this run only; D-01 and D-03 remain open, so methodology
0.1.0 is still a draft awaiting owner sign-off, and every score produced by the
prototype is an engineering calibration result, not a published claim.

**Authorisation boundary**

| The run may | The run may not (needs a separate approval) |
|---|---|
| Work on branch `feat/visibility-index-prototype` and commit locally | Push, merge, deploy or open a pull request |
| Add `src/lib/visibility/`, `scripts/visibility-scan.ts`, `tests/visibility/` and the dev tooling in 5.9 | Add a public route, navigation link, sitemap entry or Netlify Function |
| Scan `databridges.ie` and `www.databridges.ie` through the guarded fetch layer | Scan any other host over the network (tests use local servers and a stub resolver) |
| Report methodology questions it finds | Change a weight, threshold, rule or list in section 4 or Appendix A/B on its own authority |
| Add `reports/` to `.gitignore` | Edit `07_VISIBILITY_INDEX.md` or any other governance document, change production configuration, or add environment variables |

**Run rules (the contract every agent receives)**

1. This plan is the specification and the authority. Agents do not edit it. A
   contradiction, ambiguity or unmeasurable rule is returned as a structured
   *methodology question*; the orchestrator records it in Appendix G afterwards.
   Where the plan is ambiguous, implement the more conservative reading
   (more `NOT_OBSERVED`, fewer penalties) and flag it.
2. Disjoint file ownership: no two agents edit the same file in the same phase.
3. **Independent expectations.** Fixture expectations are written from sections
   4 and 7.2 only, by an agent that has not read the evaluator code. Expected
   results are never produced by running the implementation, otherwise the tests
   would only confirm the code against itself.
4. Evaluators and scoring are pure: no I/O, no `Date.now()`, no randomness; the
   scan time is a parameter.
5. Network access exists only inside the guarded fetch layer (5.4), only to
   allowlisted hosts. Tests use local servers and an injected resolver.
6. Each agent runs only its own tests while others are still writing. Whole
   project checks (`lint`, `typecheck`, `test`, `build`) run only at the gates.
7. No secrets, no third-party data, no scan reports are committed.
8. Agents return structured results (files written, tests run and results, open
   questions); they do not claim a check passed that they did not run.

**Workflow map** (one workflow per phase, orchestrator reads each result before
launching the next)

| Workflow | Phases | Purpose |
|---|---|---|
| Foundations (inline) | branch, tooling, contracts | Branch, `vitest`, `cheerio`, `robots-parser`, `tsx`, `types.ts`, `test` script, `.gitignore` |
| 1 Build | Core, Evaluators, Fixtures and integration, Reconcile | Build WP-3 and WP-4 in parallel with disjoint ownership; independent fixtures; failures adjudicated against the plan text |
| 2 Verify | Security panel, Fidelity audit, Governance check, Fix loop, Completeness critic | Adversarial review of the fetch layer (three lenses), metric-by-metric audit against section 4.5, 03/04 compliance, loop until two clean rounds |
| Calibrate (inline) | CLI self-scan, test-retest, gates | WP-5: scan `databridges.ie`, compare with 7.4, run 7.5, then lint, typecheck, test and build |

**Agent roster (Workflow 1)**

| Agent | Owns | Done when |
|---|---|---|
| core-extract | `extract.ts`, `text.ts` | Page facts per 4.2.5 and 4.2.6 (render-dependence, main content, headings, links, images, JSON-LD) with unit tests |
| core-robots-sitemap | `robots.ts`, `sitemap-parse.ts`, `sample.ts` | RFC 9309 matching, sitemap extraction, page typing and the deterministic sampler (4.2.3) pass their tests |
| core-fetch | `url.ts`, `net-guard.ts`, `fetch.ts` | Every control in 5.5 implemented; the 7.3 suite passes against local servers and a stub resolver |
| core-methodology | `lists.ts`, `methodology.ts`, `scoring.ts` | All 52 metrics and 8 categories defined with the exact points and weights; formulas in 4.3 pass the 4.3.6 worked examples |
| eval-s1-s2, eval-s3-s4, eval-a1-a2, eval-a3-a4 | `evaluate/<category>.ts` | Every metric in the category implemented per 4.5, with evidence strings and per-metric tests |
| fixtures | `tests/visibility/fixtures/**` | The fixtures in 7.2 (15 directories) with hand-derived `expected.json` |
| integrate | `evaluate/index.ts`, `report.ts`, `scan.ts`, `scripts/visibility-scan.ts` | Snapshot, evaluation, report and CLI wired; hard allowlist enforced |

**Reconcile rule.** When a fixture or test fails, an adjudicator reads the plan
text and decides whether the implementation or the expectation departs from it,
then fixes that side only. If the plan itself is ambiguous, the conservative
reading is applied and a methodology question is raised.

**Run stop conditions.** Stop the affected area and record why if: any step would
need to contact a non-allowlisted host; a security-panel lens confirms a bypass of
a 5.5 control that is not fixed within two fix rounds; a contradiction changes
scoring semantics and cannot be resolved conservatively; or the whole-project
checks cannot be made green. Never weaken a control or a test to proceed.

**Execution record.** Outcomes, commands run with exact results, and methodology
questions are recorded in Appendix G when the run finishes.

### WP-0 Approvals and Gate 0 record
- [ ] Product owner and risk owner named (D-01).
- [ ] Sequencing decision recorded (D-02).
- [ ] Section 2.5 completed, including maintenance budget and stop condition.

### WP-1 Methodology review and freeze
- [ ] Methodology owner reviews sections 4.2-4.10; weights, thresholds, coverage
      rules and band labels approved or amended (D-03).
- [ ] AI crawler list (Appendix A) checked against current vendor documentation,
      with source and date recorded (D-09).
- [ ] Fixture expectations (7.2) reviewed.
- [ ] `07_VISIBILITY_INDEX.md` updated if the additive fields in Appendix D are
      accepted; this plan then links to it rather than restating.

### WP-2 Test infrastructure
- [ ] Vitest added per `TEST_PLAN.md` Phase 1 with a `test` script.
- [ ] Dependency assessments recorded (5.9).

### WP-3 Scoring core
- [ ] Every metric in 4.5 implemented as a pure evaluator with evidence and
      explanation strings.
- [ ] Formulas in 4.3 implemented; the two worked examples in 4.3.6 pass as tests.
- [ ] All fixtures in 7.2 pass; determinism test passes.
- [ ] No I/O, `Date.now()` or randomness inside evaluators (time is a parameter).

### WP-4 Fetch layer and security suite
- [ ] All controls in 5.5 implemented; every test in 7.3 passes.
- [ ] Hard allowlist limits scans to approved hosts (initially `databridges.ie`
      and `www.databridges.ie`); changing it needs approval.
- [ ] Limits in 5.3 enforced and tested; no new dependency was needed.
- [ ] Security review recorded before any non-allowlisted host is ever scanned.

### WP-5 CLI and calibration
- [ ] `scripts/visibility-scan.ts` writes JSON and Markdown reports to an ignored
      directory.
- [ ] Self-scan of `databridges.ie` compared with 7.4; every mismatch explained
      and recorded.
- [ ] Test-retest (7.5) passes.

### WP-6 Private pilot
- [ ] Selection record and consent wording approved (D-11).
- [ ] Reports delivered privately with the version, coverage, limitations and
      correction route.
- [ ] Reviewer ratings, usefulness survey and maintenance time logged.

### WP-7 Gate 3 decision
- [ ] Thresholds in 7.6 evaluated; decision recorded using the milestone review
      template in `12_PHASED_ROADMAP.md`.

### WP-8 Public-release prerequisites (Level 3)
- [ ] Explicit approval to scan arbitrary URLs and a completed security review
      (D-04).
- [ ] Public methodology page copy approved as a protected claim (D-05).
- [ ] Privacy notice approved (D-08); `09` amended for any public lead source or
      analytics event.
- [ ] Rate-limit store decided with an ADR (D-07); cost ceiling and kill-switch
      owner named (D-13).
- [ ] Correction and appeal ownership defined (D-12).
- [ ] Route release gate in `02` satisfied: owner, audience purpose, reviewed
      content, metadata, structured data, accessible rendering, maintenance plan.

### WP-9 Public self-serve build
- [ ] Netlify Function, UI, `/index/methodology` and `/index/bot` implemented.
- [ ] Kill switch and abuse controls working; deploy preview reviewed.
- [ ] Accessibility, responsive and security checks recorded.
- [ ] `robots.ts`, `sitemap.ts`, navigation and metadata set per the release decision.

### WP-10 Launch and operate
- [ ] Release gate in `10` completed; named owner available at launch.
- [ ] Post-release smoke test, health signal and rollback trigger verified.
- [ ] Review calendar created (section 10).

---

## 9. Risks and stop conditions

| Risk | Mitigation | Stop or revisit trigger |
|---|---|---|
| Scanner abused as a proxy or for server-side request forgery | Section 5.4-5.6; hard allowlist until Stage 5; kill switch | Any bypass found in review or testing |
| Hammering a third-party site | Per-host limits, polite spacing, robots compliance | Complaint or a limiter failure |
| Results distrusted (false detections) | Pilot agreement thresholds; evidence on every metric | Thresholds in 7.6 missed twice |
| Gaming (optimising to the score) | Heuristics are `HEUR`, low weight, reviewed quarterly | Evidence of formulaic content harming quality |
| Reputational harm from a wrong or harsh result | Private by default, neutral wording, no profiles, correction route | Any complaint without a resolution path |
| Maintenance burden (agent lists, thresholds, vendor changes) | Cadence in section 10; stale-list flags | Effort exceeds the budget in 2.5 |
| Third-party blocking and WAFs | `SCAN_ERROR` never lowers a score; coverage gating; CF-07 | Scan-error rate undermines trust |
| Terms-of-use or legal exposure of scanning | Respect `robots.txt`, descriptive agent, bounded requests; owner review of terms (Level 3) | Owner or legal concern |
| Cost spikes | Caps and kill switch | Spend above the ceiling (D-13) |
| Misreading as ranking or prediction | Wording rules (4.7); limitations beside every score | Any use of ranking language |
| Commercial pressure on scoring | Score independent of buying; no outreach to scanned sites; sales cannot decide corrections (07) | Any dependency of results on a purchase |
| Scope creep (rendering, LLM scoring, benchmarks, stored profiles) | Deferred list in 4.9 | Any proposal without its own gate and approval |
| Portfolio overload | One high-risk experiment at a time (12) | Core delivery or site reliability suffers |

Stop, or keep private, under any 07 stop condition: disagreement or scan-error
rates undermine trust; sector comparison cannot be justified; correction
workload is unsupportable; security isolation is inadequate; publication creates
disproportionate reputational or privacy risk; or the output adds nothing beyond
an ordinary private audit.

---

## 10. Operating model after launch

| Activity | Cadence | Owner |
|---|---|---|
| AI crawler list re-verification against vendor documentation | Monthly (30-day `reviewDueAt`) | Product owner |
| Pattern and word lists review | Quarterly | Product owner |
| Methodology review (thresholds, weights, vendor guidance changes) | Quarterly and on any major search or AI-vendor announcement | Methodology owner |
| Correction requests | Acknowledge within 2 working days, resolve within 5 (proposed; D-12) | Named owner, not sales |
| Health review (scan volume, `SCAN_ERROR` rate, duration, cost) | Weekly for the first month, then monthly | Product owner |
| Calibration rerun | On every methodology release | Developer |
| Gate review | At each milestone, using the review template in `12` | Product owner |

A factual correction (wrong data) is distinct from a methodological
disagreement; both are logged, and neither depends on buying a service.

---

## 11. Open decisions register

| ID | Decision | Needed by | Owner | Recommendation |
|---|---|---|---|---|
| D-01 | Name the product owner and the risk owner | Stage 0 | Business owner | Required before anything else |
| D-02 | Run Stages 0-3 before DB-022 evidence, or wait? | Stage 0 | Business owner | Proceed through Stage 3 (private, bounded); hold Stage 5 until DB-022. **Decided for the Stage 2 run only by the 2026-10-02 instruction to run the plan.** |
| D-03 | Approve methodology 0.1.0, including weights, thresholds and coverage rules | Stage 1 | Methodology owner | Approve with the pilot able to tune `HEUR` thresholds |
| D-04 | Approve arbitrary-URL scanning and a security review (Level 3) | Stage 5 | Business owner | Defer until Gate 3 passes |
| D-05 | Approve publishing the methodology (protected claim) | Stage 5 | Business owner | Publish only with `/index/methodology` live |
| D-06 | Approve Vitest and the dependency assessments | Stage 2 | Business owner | Approve (aligns with `TEST_PLAN.md`). **Treated as approved for the Stage 2 run by the 2026-10-02 instruction; assessments recorded in Appendix G.** |
| D-07 | Rate-limit and counter store (ADR) | Stage 5 | Product owner | Prefer a platform feature if available, else Netlify Blobs |
| D-08 | Privacy notice and handling basis for scan inputs | Stage 5 | Responsible owner | Human or legal sign-off; no technical determination |
| D-09 | Verify the AI crawler list against vendor documentation | Stage 1 | Product owner | Required before freeze |
| D-10 | Public name and label ("Visibility Check" vs "Visibility Index") | Stage 5 | Business owner | Prefer a name that does not imply a league table |
| D-11 | Pilot participant selection and consent wording | Stage 3 | Product owner | Written consent before any scan |
| D-12 | Correction and appeal ownership and response times | Stage 5 | Business owner | Owner-run, independent of sales |
| D-13 | Cost ceiling and kill-switch owner | Stage 5 | Business owner | Set before launch |
| D-14 | Email delivery of reports | After Stage 5 | Business owner | No in the first release (needs provider ADR and 09 changes) |

---

## 12. Appendices

### Appendix A: AI crawler list, version 1 (draft, to be verified against vendor documentation before freeze)

Each entry in `lists.ts` carries `token`, `operator`, `purpose`, `docsUrl`,
`verifiedAt` and `reviewDueAt`. URLs and dates are filled in at verification (D-09).

| Token | Operator | Purpose | Treatment |
|---|---|---|---|
| `Googlebot` | Google | Search (also feeds Google's AI search features) | Scored in S1.02 |
| `bingbot` | Microsoft | Search (feeds Bing and Copilot answers) | Scored in S1.02 |
| `OAI-SearchBot` | OpenAI | Search index for ChatGPT search | Scored in A1.01 |
| `PerplexityBot` | Perplexity | Search index | Scored in A1.01 |
| `Claude-SearchBot` | Anthropic | Search quality | Scored in A1.01 |
| `GPTBot` | OpenAI | Model training | Informational |
| `ClaudeBot` | Anthropic | Model training | Informational |
| `Google-Extended` | Google | Robots token for model use (not a separate crawler) | Informational |
| `Applebot-Extended` | Apple | Robots token for model use | Informational |
| `CCBot` | Common Crawl | Open web corpus | Informational |
| `Amazonbot`, `Bytespider`, `meta-externalagent` | Amazon, ByteDance, Meta | Crawling and model use | Informational |
| `ChatGPT-User`, `Claude-User`, `Perplexity-User` | OpenAI, Anthropic, Perplexity | User-initiated fetches (vendors may not apply `robots.txt`) | Informational |

### Appendix B: Pattern and word lists (version 1, draft)

```text
NON_HTML_EXT        .pdf .jpg .jpeg .png .gif .webp .svg .ico .css .js .json .xml
                    .zip .gz .mp3 .mp4 .webm .doc .docx .xls .xlsx .ppt .pptx .txt

UTILITY_EXCLUDE     /login /signin /sign-in /register /signup /account /my-account
(path prefixes)     /cart /basket /checkout /wp-admin /wp-login /admin /search
                    /thank /thanks /cdn-cgi /api /feed /tag /category /author /page/<n>

PAGE_TYPE_PATTERNS  (first match wins, case-insensitive, on the path)
  services          ^/(services?|solutions?|what-we-do|offerings?|products?)(/|$)
  about             ^/(about|about-us|who-we-are|our-story|team|company)(/|$)
  faq               ^/(faq|faqs|questions|help)(/|$)
  contact           ^/(contact|contact-us|get-in-touch|enquir[a-z]*)(/|$)
  legal             ^/(privacy|privacy-policy|terms|cookies?|legal|disclaimer)(/|$)
  article           ^/(blog|news|insights|articles?|resources|journal|posts?)/.+
  home              path is "/"
  other             anything else

ABOUT_PATTERNS      the about pattern above
CONTACT_PATTERNS    the contact pattern above
PRIVACY_PATTERNS    ^/(privacy|privacy-policy|privacy-notice|data-protection)(/|$)

GENERIC_ANCHORS     click here, here, read more, learn more, more, link, this, details,
                    continue, view, click, read, find out more, see more, go

QUESTION_STARTERS   what, why, how, when, where, who, which, can, do, does, did, is,
                    are, was, were, should, will, would, could, may, might

SPA_ROOT_SELECTORS  #root, #app, #__next, #__nuxt, [data-reactroot], [ng-version]

ORG_TYPES           Organization, Corporation, LocalBusiness, ProfessionalService, NGO,
                    EducationalOrganization, GovernmentOrganization, MedicalBusiness,
                    Store, Restaurant, FinancialService, LegalService, AccountingService,
                    RealEstateAgent, TravelAgency, HomeAndConstructionBusiness
                    (extend only through a versioned change with a fixture)
```

### Appendix C: Mapping from the `AEOReadiness` self-check

| Self-check item | Automated metric(s) | Note |
|---|---|---|
| Each page answers one question in its first paragraph | A3.02 | Heuristic proxy |
| Structured data (FAQ, Article, Organization) | A2.01-A2.08 | Fully observable |
| Headings written as real questions | A3.01 | English only |
| Pages updated in the last 6 months | A4.05 | `NOT_OBSERVED` if no dates |
| Business name, location and services stated consistently | A2.08, A3.06 | Partial |
| Fast on mobile and passes Core Web Vitals | S3.03, S3.04, S3.05 | Core Web Vitals are not measured (4.9) |
| Mentioned on other trusted sites | none | Off-site; cannot be observed from the site |

### Appendix D: Contracts (additive; moves into `07` if accepted)

`MetricResultCode`, `EvidenceType`, `MetricDefinition` and `MetricResult` are
defined in `07_VISIBILITY_INDEX.md` and used unchanged. Proposed additions:

```typescript
type MetricBasis = "STD" | "VENDOR" | "HEUR"
type MetricScope = "P" | "CP" | "KO" | "AP" | "H" | "S"
type MetricReads = "meta" | "body" | "site"

type MetricDefinitionExt = MetricDefinition & {
  basis: MetricBasis
  scope: MetricScope
  reads: MetricReads
  fixGuidance: string            // reviewed advice; never promises an outcome
}

type CategoryDefinition = {
  id: "S1" | "S2" | "S3" | "S4" | "A1" | "A2" | "A3" | "A4"
  pillar: "SEO" | "AEO"
  name: string
  weight: number
  metricIds: string[]
}

type MethodologyDefinition = {
  version: string                // for example "0.1.0"
  categories: CategoryDefinition[]
  metrics: MetricDefinitionExt[]
  thresholds: {
    categoryMinCoverage: number  // 0.5
    pillarMinShownWeight: number // 30
    overallMinShownWeight: number // 70
  }
  listVersions: { aiAgents: string; patterns: string }
}

type FetchRecord = {
  url: string
  finalUrl: string
  status: number | null
  redirectChain: string[]
  headers: Record<string, string>    // allowlisted headers only
  contentType: string | null
  bytes: number
  bodyHash: string | null            // SHA-256 of the body
  body: string | null                // in memory for evaluation; never returned to a client
  error: { code: string; message: string } | null
  fetchedAt: string
  durationMs: number
}

type ScanSnapshot = {
  snapshotVersion: 1
  scannerVersion: string
  inputUrl: string
  homeUrl: string
  scannedAt: string                  // evaluation time parameter
  sampling: { url: string; type: string; reason: string }[]
  records: FetchRecord[]
}

type ScanReport = {
  reportVersion: 1
  methodologyVersion: string
  scannerVersion: string
  scannedAt: string
  snapshotHash: string
  homeUrl: string
  coverage: number
  scores: {
    overall: number | null
    seo: number | null
    aeo: number | null
    categories: Record<string, { score: number | null; coverage: number; shown: boolean }>
  }
  criticalFindings: { id: string; summary: string }[]
  metrics: MetricResult[]
  informational: Record<string, unknown>
  limitations: string[]
  correctionRoute: string
}
```

### Appendix E: Example report (abbreviated)

```json
{
  "reportVersion": 1,
  "methodologyVersion": "0.1.0",
  "scannedAt": "2026-10-02T09:15:00Z",
  "homeUrl": "https://example.ie/",
  "coverage": 0.93,
  "scores": { "overall": 66, "seo": 75, "aeo": 58 },
  "criticalFindings": [],
  "metrics": [
    {
      "metricId": "S2.01",
      "metricVersion": 1,
      "result": "PARTIAL",
      "points": 14.0,
      "maxPoints": 20,
      "evidence": [
        { "url": "https://example.ie/", "chars": 42, "s_p": 1 },
        { "url": "https://example.ie/about", "chars": 18, "s_p": 0.5 }
      ],
      "explanation": "3 of 5 pages have a title within the target length; 1 is too short; 1 is missing.",
      "reviewedBy": null
    }
  ],
  "limitations": [
    "Reads the raw HTML only; JavaScript-rendered content is not scored.",
    "Scores are signals of readiness, not a ranking or a prediction."
  ],
  "correctionRoute": "oisin@databridges.ie"
}
```

### Appendix F: Change log

| Date | Version | Change | Author |
|---|---|---|---|
| 2026-10-02 | 0.1.0-draft | First draft of plan and methodology | drafted with Claude Code; pending owner review |
| 2026-10-02 | 0.1.0-draft | Added the ultracode execution section (section 8) and Appendix G; recorded D-02 and D-06 as decided for the Stage 2 run only | drafted with Claude Code; pending owner review |
| 2026-10-03 | 0.1.0-draft | Recorded the paused Stage 2 run in Appendix G; no methodology rule, weight, threshold or list changed | drafted with Claude Code; pending owner review |

### Appendix G: Execution record and methodology questions

**Status at 2026-10-03: Stage 2 run PAUSED, mostly built.** The run was
interrupted twice by the account usage limit (5-hour window), then run in
checkpointed waves, and stopped deliberately after the evaluator wave because
the weekly allowance had reached 94%. No part of the public release (Stage 5)
was started. Nothing has been pushed, merged or deployed. All work is on the
local branch `feat/visibility-index-prototype`.

**Built and verified**

| Area | Files (under `src/lib/visibility/`) | Evidence |
|---|---|---|
| Contracts (reviewed independently) | `types.ts` | `tsc` clean |
| Shared lists and URL normalisation | `lists.ts`, `normalise.ts` | `normalise.test.ts` |
| Text and HTML extraction | `text.ts`, `extract.ts` | `text.test.ts` (53), `extract.test.ts` (164), including hostile input |
| Robots, sitemap, sampler | `robots.ts`, `sitemap-parse.ts`, `sample.ts` | 85 + 42 + 64 tests; RFC 9309 table of 188 cases |
| Guarded fetch layer | `url.ts`, `net-guard.ts`, `fetch.ts` | Security suite of 8 files (about 500 tests): SSRF ranges, redirects, rebinding, size and time caps, TLS, production-seam checks |
| Methodology and scoring | `methodology.ts`, `scoring.ts` | 52 metrics and 8 categories encoded; both worked examples in 4.3.6 reproduced exactly (81 + 23 tests) |
| Fixtures | `tests/visibility/fixtures/` (15 directories) | Authored independently from the plan text; **not yet executed** because the runner does not exist |
| Evaluation context | `context.ts` | `context.test.ts` |
| Metric evaluators (all 52 metrics) | `evaluate/seo-crawl.ts`, `seo-onpage.ts`, `seo-technical.ts`, `seo-content.ts`, `aeo-access.ts`, `aeo-structured.ts`, `aeo-answers.ts`, `aeo-trust.ts` | Eight test files, about 1,100 tests, one case per rule branch plus boundary values |
| Agent submissions and consensus | `aggregate.ts`, `aggregate-fs.ts`, `scripts/visibility-aggregate.ts`, `scripts/visibility-facts.ts` | `aggregate.test.ts` (31): validation, scoring, multi-agent consensus, the approved-target guard |
| Standalone agent pack | `scripts/build-visibility-pack.ts`, `VISIBILITY_AGENT_BRIEF.md` | Built to `reports/visibility-pack.zip` and exercised end to end from a clean folder |

Commands run on 2026-10-03 (exact results): `npx vitest run` gave 27 test
files, 2,335 tests, all passing; `npx tsc --noEmit --incremental false` gave no
errors; `npm run lint` gave no output (clean, after `reports/**` was added to the
ESLint ignores because it holds generated bundles). `npm run build` was last run
earlier in this pause, before the evaluators were added, and not re-run.

**Not built (the engine cannot yet score a site by itself)**

- `evaluate/index.ts` (the pure `evaluateSnapshot`), `report.ts`, `scan.ts` (the
  scan orchestration), the fixture runner and determinism test, and
  `scripts/visibility-scan.ts` (the `visibility:scan` npm script has not been
  added yet). Until these exist, scores come from agents following the brief,
  with `aggregate.ts` doing the arithmetic.
- reconcile loop against the 15 fixtures
- Workflow 2 (security panel, fidelity audit, governance check, completeness critic)
- WP-5 calibration: the self-scan of `databridges.ie` and the test-retest run (7.4, 7.5)

**Deviations from the plan**

- `robots-parser` was installed, tested against RFC 9309 and **failed three
  requirements**, so an in-house matcher is used and the dependency was
  removed (5.9 anticipated this).
- Vitest 3.x was installed instead of the latest major because the latest
  requires a newer `@types/node` than the project's `^20`.
- `normalise.ts` is a separate module from `url.ts` (shared by extraction,
  sampling and fetching); both use the WHATWG `URL` class only.

**Dependency assessments (5.9)**

| Package | Used for | Assessment |
|---|---|---|
| `cheerio` 1.x | HTML parsing in `extract.ts` | Runtime dependency, server-side only; `npm audit --omit=dev` reports 0 vulnerabilities |
| `vitest` 3.x (dev) | Tests | Dev only; `npm audit` reports 7 findings (2 moderate, 5 high) in dev tooling, not in shipped code; not yet triaged |
| `tsx` (dev) | Intended CLI runner | Dev only; unused until the CLI exists |

**Open items for the methodology owner.** The agents raised 142 methodology
questions (many duplicates of the same ambiguity) and left 80 hand-off notes.
They are recorded in full in `VISIBILITY_INDEX_BUILD_NOTES.md`. The ones most
likely to change scores if decided differently: heading scope for S2.05/S2.06
(document-wide or main only); which metrics count as word-count metrics for
CJK languages; whether a CJK page that uses an app-shell marker should raise
CF-04; how to label a metric when most pages are unobserved for mixed reasons;
the CF-07 challenge-marker list; and whether `question-form` applies to all
three FAQ-pair mechanisms in A3.03. Until D-03 is decided, every score the
prototype produces is an engineering result, not a published claim.

**To resume:** see the resume instructions at the top of
`VISIBILITY_INDEX_BUILD_NOTES.md`. Remaining phases, in order: Integrate,
Reconcile (run the 15 fixtures and adjudicate), Verify, then calibration.
