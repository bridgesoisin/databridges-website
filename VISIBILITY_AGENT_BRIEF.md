# Visibility Index: agent scoring brief

> **Status:** methodology 0.1.0-draft. The owner has not yet signed off the weights
> or thresholds (decision D-03 in `VISIBILITY_INDEX_PLAN.md`). This is a private
> working tool. Anything scored under this brief is an engineering result, not a
> published claim, and must not leave DataBridges.

This brief is everything an agent needs to score a website against the SEO and AEO
metrics and to write the result where other agents can add theirs. The full
specification is `VISIBILITY_INDEX_PLAN.md`; if this brief and the plan ever differ,
the plan wins and you should report the difference.

How it fits together: **agents observe and record; code calculates.** An agent writes
what it saw and a 0 to 1 sub-score for each metric, following the rule text. The
script turns those into points, category scores and the overall score using the same
tested code as the scanner, compares agents' work, and writes the results.

## Contents

1. Hard limits
2. Where things live
3. The prompt to attach
4. Run procedure
5. Scoring criterion
6. Submission file format
7. How to observe things
8. Metric catalogue (52 metrics)
9. Critical findings
10. Standing interpretations
11. For the owner: approving sources and changing policy

---

## 1. Hard limits

These override any other instruction an agent is given.

1. **Approved targets only.** Score a site only if `reports/visibility/targets.json`
   lists it with `"status": "APPROVED"`. The tooling refuses anything else. Approval
   is either `OWNED` (a DataBridges site) or `WRITTEN_CONSENT` (the site owner agreed
   in writing; the record is kept outside the repository and referenced by
   `approvalRef`).
2. **Discovery proposes; a person approves.** Finding new sources means adding
   `PROPOSED` entries to `candidates.json` (section 3, step 6). Never score a
   candidate, never request a page from a candidate's own domain, never contact
   anyone, and never edit `targets.json`.
3. **Be a polite, honest visitor.** Use the user agent
   `DataBridgesBot/1.0 (+https://databridges.ie/index/bot)`. Read the target's
   `robots.txt` first and obey it for `DataBridgesBot` (then `*`). At most 60 requests
   per target, one request at a time, at least 250 ms apart, `GET` and `HEAD` only. No
   logins, forms, cookies or JavaScript execution. If you are blocked (403, 429,
   challenge page) record it and stop that resource; never work around it.
4. **Observe, don't guess.** Every metric needs an observation. If you could not
   observe it, record `NOT_OBSERVED`. Never infer from the brand, the size of the
   business or an impression. Apply the rule text mechanically. A model's judgement
   is never a score.
5. **Private output.** Write only under `reports/visibility/` (git-ignored). Never
   commit, post, email or share it. Never rank or compare targets in any text, and
   never use words like "best" or "worst".
6. **Safe evidence.** Plain text, at most 200 characters per entry, short quotes only,
   no personal data. Record business contact details as present or absent, not as
   values.
7. **Be conservative when the rule is unclear.** Use the standing interpretations in
   section 10, and add an entry to `methodologyQuestions`.
8. **Stay independent.** Write your submission before reading any other agent's file
   for the same run. Agreement between independent agents is the quality check.
9. **Touch nothing else.** No changes to code, the plan or `package.json`. Throwaway
   files go in your temp folder, not in the repository.
10. **Never claim a check you did not run.**

## 2. Where things live

```text
reports/visibility/                      git-ignored, private
  targets.json                           owner-maintained approved targets (agents read only)
  candidates.json                        discovery queue (agents append PROPOSED entries)
  runs/<targetId>/<runId>/
      <agentId>.json                     one submission per agent per run (you create yours)
      <agentId>.claim                    optional: marks that you have started this target
  scores/<targetId>.json                 latest consensus result (written by the script)
  history/<targetId>/<runId>.json        consensus per run (script)
  index.csv                              one row per target (script)
```

- `agentId` is unique to each agent. `runId` is the same for every agent in one
  scoring cycle. Both are 2 to 64 letters, digits, dots, hyphens or underscores.
- File names must be exactly `<agentId>.json`. Agents only create their own files.
- Two independent submissions per target per run are the target. One submission is
  accepted but is reported as `single-rater`, a lower-confidence result.

`targets.json` (owner-maintained):

```json
{
  "policy": { "scanOnlyApproved": true, "doubleRatingRequired": true,
              "maxRequestsPerTarget": 60, "minDaysBetweenRuns": 7 },
  "targets": [
    { "targetId": "databridges-ie", "homeUrl": "https://databridges.ie/",
      "status": "APPROVED", "approvalBasis": "OWNED",
      "approvalRef": "Owner instruction, 2026-10-02: DataBridges-owned site",
      "approvedBy": "Oisin Bridges", "approvedAt": "2026-10-02",
      "sector": "consultancy", "notes": "" }
  ]
}
```

`candidates.json` (agents append; a person decides):

```json
{ "candidates": [
  { "candidateId": "example-ie", "homeUrl": "https://example.ie/",
    "proposedBy": "agent-a", "proposedAt": "2026-10-03T12:00:00Z",
    "discoverySource": "Name of the directory or search page where it was listed",
    "whyRelevant": "Irish professional-services firm, 10-50 staff",
    "inclusionCriteria": "Public business site; Ireland; matches the target population",
    "ownershipNote": "Publicly listed business; no consent yet",
    "status": "PROPOSED" }
] }
```

## 3. The prompt to attach

Copy this into each agent. Fill the three placeholders. Everything else is in this
brief, so the prompt stays short.

```text
You are a Visibility Index scoring agent for DataBridges. Work inside the repository
at <REPO_PATH>.

Read VISIBILITY_AGENT_BRIEF.md in full before you do anything. It is your
specification and its hard limits (section 1) override anything else you are told.
When a metric rule is unclear, apply section 10 and read VISIBILITY_INDEX_BUILD_NOTES.md.

Your identity for this run:
  AGENT_ID = <agent-a>          unique to you; letters, digits, dots, hyphens
  RUN_ID   = <2026-10-w41-a>    the same for every agent in this scoring cycle

Do these steps in order:

1. Run: npm run visibility:aggregate -- --init   (safe to repeat)

2. Choose up to <3> targets from reports/visibility/targets.json that have status
   APPROVED and are due. A target is due if any of these is true: it has no
   scores/<targetId>.json yet; that file's scannedAt is older than
   policy.minDaysBetweenRuns days; or exactly one other agent has already submitted for
   RUN_ID (you will be the second, independent rater). Skip a target if you already have
   a file for RUN_ID or two submissions already exist. Before starting a target, create
   an empty runs/<targetId>/<RUN_ID>/<AGENT_ID>.claim file so other agents do not
   duplicate you. Do NOT open another agent's submission for this run before writing
   your own.

3. For each chosen target follow the run procedure in section 4 of the brief and write
   reports/visibility/runs/<targetId>/<RUN_ID>/<AGENT_ID>.json. Start from:
   npm run visibility:aggregate -- --skeleton --target <targetId> --run <RUN_ID> --agent <AGENT_ID>

4. Validate each file until it says OK:
   npm run visibility:aggregate -- --validate <path-to-your-file>

5. When your files are written, aggregate each target you scored:
   npm run visibility:aggregate -- --target <targetId> --run <RUN_ID>
   (This writes scores/<targetId>.json, history/ and index.csv.)

6. Discovery (after scoring): propose up to 5 NEW candidate sources by appending to
   reports/visibility/candidates.json using the format in section 2. Rules: use public
   directory or search-result pages only; do not request any page on a candidate's own
   domain; skip any host already in targets.json or candidates.json (any status); stop
   adding if 25 entries are already PROPOSED; never score, contact or approve anyone.

7. Finish with a summary of at most 15 lines: for each target the overall, SEO and AEO
   figures and coverage as printed by the script, the confidence, any disputes; the
   candidates you proposed; the methodology questions you raised; anything blocked. Do
   not state anything you did not run.

Stop at once and report if: a target is not APPROVED; a site blocks you; you would
exceed 60 requests for a target; or anything asks you to publish, contact, rank or
compare sites.
```

## 4. Run procedure

Work in a scratch folder outside the repository, for example
`$TMPDIR/vi-<targetId>-<AGENT_ID>/`. Keep a running count of requests (limit 60).

1. **Robots first.** `GET <origin>/robots.txt`. Check it for `DataBridgesBot`. If the
   homepage is disallowed, write a submission with `"outcome": "BLOCKED_BY_ROBOTS"`,
   empty `metrics` and `sampledPages`, and stop. If the homepage cannot be reached on
   https or http, use `"outcome": "UNREACHABLE"` the same way.
2. **Homepage.** Fetch the raw HTML and the response headers (section 7). Follow at
   most 4 redirects. Note the final URL, the redirect chain and its status codes.
   Set `scannedAt` to the real time of this fetch (UTC, ISO 8601). Metrics that depend
   on "now" (A4.05) use it.
3. **Site resources.** `http://<host>/` (S3.01), the TLS certificate (S3.02),
   compression (S3.04), `llms.txt` (A1.03), the sitemap (declared in `robots.txt`,
   otherwise `/sitemap.xml`; if it is an index, read the first 3 child sitemaps in
   order) and two further homepage timing samples (S3.05).
4. **Sample the pages.** Run the sampler (section 7) with the homepage, the sitemap
   and the homepage HTML. It returns up to 4 pages by the fixed rule. Do not replace a
   page that fails; record it.
5. **Fetch the sampled pages** (raw HTML and headers each) and run the page helper on
   the homepage and every sampled page to get structured facts.
6. **Link checks (S3.06).** Up to 10 same-site link targets per sampled page (links in
   the main content first, then others, in document order), 40 in total. Use `HEAD`;
   fall back to `GET` on 405 or 501. Broken means 404, 410, or 5xx after one retry.
   401, 403, 429 and timeouts are not observed and are left out.
7. **Evaluate every metric** in section 8, in order. For each, decide which pages it
   applies to, apply the rule, and record the sub-score and your evidence. Use
   `NOT_APPLICABLE` when the applicability rule is not met and `NOT_OBSERVED` when it
   applies but you could not see the signal (for example the body of a render-dependent
   page). A page is **render-dependent** when its main content has fewer than 50 words
   in the raw HTML and there is an empty framework root (`#root`, `#app`, `#__next`,
   `#__nuxt`, `[data-reactroot]`, `[ng-version]`) or a `<noscript>` message asking for
   JavaScript; the page helper reports this. Body metrics are `not_observed` for such
   pages and the penalty is carried once, by A1.04.
8. **Critical findings** (section 9): list the ids that apply.
9. **Write and check.** Fill in the skeleton, validate it, then aggregate. Check that
   all 52 metrics are present, every sub-score is between 0 and 1, and nothing is still
   marked TODO.

## 5. Scoring criterion

### 5.1 Structure

Two pillars, eight categories, 52 metrics. Each category's metrics add up to 100
points. Weights add up to 100.

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

### 5.2 What an agent records, and what the script derives

| You record | The script derives |
|---|---|
| Per-page metrics (scope P, CP, KO, AP): one entry per applicable page with `status` (`observed`, `not_observed`, `scan_error`, `not_applicable`) and, when observed, a page score from 0 to 1 following the rule | The metric score (mean of observed pages), points, and the result code |
| Site and homepage metrics (scope S, H): an `outcome` (`SCORED`, `NOT_APPLICABLE`, `NOT_OBSERVED`, `SCAN_ERROR`) and, when scored, a score from 0 to 1 | Points and the result code |

Result codes, derived from the score `s`: `PASS` (s = 1), `PARTIAL` (0 < s < 1),
`FAIL` (s = 0), plus `NOT_APPLICABLE`, `NOT_OBSERVED` and `SCAN_ERROR`. Points equal
the metric's maximum times `s`, rounded half up to two decimals. If fewer than half of
the applicable pages were observed, the metric is not scored: `NOT_OBSERVED`, or
`SCAN_ERROR` when any missing page was a fetch or parse failure.

### 5.3 Formulas

```text
appliedMax(c)  = sum of max points of metrics coded PASS, PARTIAL or FAIL
possibleMax(c) = sum of max points of metrics not coded NOT_APPLICABLE
coverage(c)    = appliedMax(c) / possibleMax(c)
score(c)       = points earned / appliedMax(c)                    (4 decimals)

A category is shown when coverage(c) >= 0.5.
pillar score   = sum(weight x score) / sum(weight), over the shown categories in the pillar
overall score  = sum(weight x score) / sum(weight), over all shown categories
reported coverage = sum(weight x coverage(c)) / sum(weight)
```

- A pillar score is published only if its shown categories carry at least 30 of its 50
  weight points. The overall score is published only if both pillars are published and
  the shown weight is at least 70 of 100. Otherwise it is withheld and the report says
  why.
- Scores are stored to two decimals on a 0 to 100 scale and displayed rounded half up.
- `NOT_APPLICABLE`, `NOT_OBSERVED` and `SCAN_ERROR` never lower a score. They lower
  coverage (the last two) instead.
- Bands (presentation only): 85 or more "Strong signals detected", 70 to 84 "Good
  foundations", 50 to 69 "Some gaps", under 50 "Many gaps".

### 5.4 How agents' scores are combined

Done by the script, per target and run:

- A metric **agrees** when all raters give the same result category and, for scored
  results, their scores differ by 0.1 or less. The agreed score is the mean.
- A metric that does not agree is a **dispute**. It is left unscored (`NOT_OBSERVED`) in
  the consensus and listed for a person to review. Each agent's own score is kept in
  `perAgent`.
- A critical finding is included only if more than half of the raters report it;
  otherwise it is listed as contested.
- `confidence` is `agreed` (two or more raters, agreement of at least 90%, no disputes
  or contested findings), `needs-review`, `single-rater`, or `no-score`.

## 6. Submission file format

`npm run visibility:aggregate -- --skeleton ...` writes this shape with all 52 metrics.
Fill it in; do not add or remove metrics.

```json
{
  "schemaVersion": 1,
  "methodologyVersion": "0.1.0-draft",
  "targetId": "databridges-ie",
  "homeUrl": "https://databridges.ie/",
  "runId": "2026-10-w41-a",
  "agentId": "agent-a",
  "scannedAt": "2026-10-03T12:00:00Z",
  "mode": "manual-agent",
  "outcome": "COMPLETED",
  "sampledPages": [
    { "url": "https://databridges.ie/", "type": "home", "reason": "Homepage" },
    { "url": "https://databridges.ie/services", "type": "services", "reason": "Best of 1 services candidate by depth, then path" }
  ],
  "criticalFindings": [],
  "notes": "",
  "methodologyQuestions": [{ "ref": "S2.05", "question": "What the rule did not say" }],
  "metrics": [
    {
      "metricId": "S2.01",
      "pageScores": [
        { "url": "https://databridges.ie/", "status": "observed", "score": 1 },
        { "url": "https://databridges.ie/services", "status": "observed", "score": 0.5 }
      ],
      "evidence": ["home title 58 chars", "services title 18 chars (10-19 tier)"],
      "explanation": "Homepage title is in range; the services title is slightly short."
    },
    {
      "metricId": "A1.03",
      "outcome": "SCORED",
      "score": 0,
      "evidence": ["/llms.txt returned 404"],
      "explanation": "No llms.txt file was found."
    },
    {
      "metricId": "S3.01",
      "outcome": "NOT_OBSERVED",
      "evidence": ["port 80 refused the connection"],
      "explanation": "The http variant could not be reached, so the redirect could not be tested."
    }
  ]
}
```

Rules the validator enforces: all 52 metrics exactly once; per-page metrics use
`pageScores` only; site and homepage metrics use `outcome` (and `score` only when
`SCORED`); scores from 0 to 1; `score` is `null` unless `status` is `observed`; at
most 20 evidence entries of 200 characters; an explanation that is not a placeholder;
page types from `home, services, about, faq, article, contact, legal, other`;
`mode` is `manual-agent` or `scanner`; `outcome` is `COMPLETED`, `BLOCKED_BY_ROBOTS`,
`UNREACHABLE` or `JOB_ERROR` (the last three need empty `metrics`).

## 7. How to observe things

Use a scratch folder. Prefer the repository's tested helpers for parsing so every
agent reads pages the same way.

| Need | Command |
|---|---|
| Raw HTML and headers | `curl -sS -L --max-redirs 4 --max-filesize 3000000 -A "DataBridgesBot/1.0 (+https://databridges.ie/index/bot)" -D headers.txt -o page.html "<url>"` |
| Final URL, hops, status | `curl -sS -L --max-redirs 4 -o /dev/null -A "<ua>" -w "%{url_effective} %{num_redirects} %{http_code}\n" "<url>"` |
| http to https (S3.01) | `curl -sS -o /dev/null -A "<ua>" -w "%{http_code} %{redirect_url}\n" "http://<host>/"` (301 or 308 to https is the full-score case) |
| Compression (S3.04) | `curl -sS -H "Accept-Encoding: gzip, br" -D - -o /dev/null -A "<ua>" "<url>"` and read `content-encoding` |
| Timing (S3.05) | three runs of `curl -sS -o /dev/null -A "<ua>" -w "%{time_starttransfer} %{time_appconnect}\n" "<url>"`; the figure is `time_starttransfer - time_appconnect` in ms; use the median |
| TLS (S3.02) | `echo \| openssl s_client -connect <host>:443 -servername <host> 2>/dev/null \| openssl x509 -noout -enddate`; days to expiry from `scannedAt` |
| Link status (S3.06) | `curl -sS -I -o /dev/null -A "<ua>" -w "%{http_code}\n" "<url>"` |
| Page facts (headings, links, JSON-LD, render-dependence, FAQ pairs, dates, and so on) | `npm run -s visibility:facts -- page page.html "<final-url>" --headers headers.txt` |
| Robots decisions | `npm run -s visibility:facts -- robots robots.txt "<url>" Googlebot bingbot OAI-SearchBot PerplexityBot Claude-SearchBot` (use `-` for the file when there is no robots.txt) |
| Sitemap contents | `npm run -s visibility:facts -- sitemap sitemap.xml` |
| Page sample | `npm run -s visibility:facts -- sample "<home-url>" sitemap.xml home.html` (`-` for the sitemap if none) |

`visibility:facts` runs the same extraction, robots matching and sampling code as the
scanner, offline, on files you downloaded. Do the arithmetic for page scores yourself
from the rule text; the helper only reports facts.

## 8. Metric catalogue

The rule text below is generated from the tested methodology code
(`src/lib/visibility/methodology.ts`), so it matches what the script checks. Scope
codes: **P** each sampled page; **CP** each sampled content page (home, about,
services, faq, article, other); **KO** each knowledge page (services, faq, article,
other); **AP** each article page; **H** the homepage only; **S** the site as a whole.
**Reads** `meta` means URL, headers, `<head>` or JSON-LD (evaluated even on
render-dependent pages); `body` means page content (not observed on render-dependent
pages). **Basis**: `STD` published standard, `VENDOR` search or AI vendor guidance,
`HEUR` DataBridges judgement.

### S1 Crawlability and indexation (SEO, weight 15)

#### S1.01 Pages are indexable
- **Points:** 25 | **Scope:** P (each sampled page) | **Reads:** meta | **Basis:** VENDOR | **Submit:** give one `pageScores` entry per applicable page
- **Applies to:** Every sampled page that was fetched and parsed; render-dependent pages are included because this reads only the URL, headers or head.
- **Rule:** Page score 1 if there is no noindex or none directive in meta robots, googlebot or bingbot, or in X-Robots-Tag (no agent prefix, or a googlebot or bingbot prefix); otherwise 0. Metric score is the mean page score.
- **Watch for:** An intentional noindex on a page such as a thank-you page can enter the sample and lower the score.
- **Flag for review when:** The homepage scores FAIL (this feeds critical finding CF-02).

#### S1.02 Crawlable by Googlebot and bingbot
- **Points:** 25 | **Scope:** P (each sampled page) | **Reads:** meta | **Basis:** STD | **Submit:** give one `pageScores` entry per applicable page
- **Applies to:** Every sampled page, for each of the two agents (Googlebot and bingbot).
- **Rule:** Per (agent, page) pair: 1 if robots.txt allows the URL under RFC 9309 matching, else 0. Score is allowed pairs divided by all pairs. A 4xx robots.txt response counts as allowed; a 5xx response or a timeout gives SCAN_ERROR.
- **Watch for:** A transient 5xx response on robots.txt gives SCAN_ERROR rather than a failure. Evaluates the robots.txt rules only; it does not test whether a crawler actually fetches the page.
- **Flag for review when:** The homepage scores FAIL (this feeds critical finding CF-01). The result is SCAN_ERROR because robots.txt returned a 5xx response or timed out.

#### S1.03 Valid XML sitemap discoverable
- **Points:** 20 | **Scope:** S (the site as a whole) | **Reads:** site | **Basis:** STD | **Submit:** give one `score` with an `outcome`
- **Applies to:** Always applies (site level).
- **Rule:** 1: found (robots.txt Sitemap line, else /sitemap.xml), 2xx, root urlset or sitemapindex, with at least one same-site loc. 0.5: found but malformed or with no same-site URL. 0: not found.
- **Watch for:** A sitemap served only to browsers can appear missing to the scanner.
- **Flag for review when:** The site owner reports a sitemap that the scanner could not retrieve.

#### S1.04 Canonical URL is consistent
- **Points:** 20 | **Scope:** P (each sampled page) | **Reads:** meta | **Basis:** VENDOR | **Submit:** give one `pageScores` entry per applicable page
- **Applies to:** Every sampled page that was fetched and parsed; render-dependent pages are included because this reads only the URL, headers or head.
- **Rule:** Page score 1: exactly one canonical (head or Link header) equal to the page's own normalised final URL. 0.5: exactly one, pointing to a different same-site URL. 0: missing, conflicting, cross-site or non-HTTP.
- **Watch for:** A canonical declared through an unusual mechanism may not be detected.
- **Flag for review when:** The canonical appears to be set through an unusual mechanism. The homepage canonical points to a different site (this feeds critical finding CF-06).

#### S1.05 Page returns success directly
- **Points:** 10 | **Scope:** P (each sampled page) | **Reads:** meta | **Basis:** HEUR | **Submit:** give one `pageScores` entry per applicable page
- **Applies to:** Every sampled page, whether or not its HTML could be parsed, because this reads only the page address and the fetch record.
- **Rule:** Page score 1: final 2xx with at most 1 redirect hop. 0.5: final 2xx after 2 to 3 hops. 0: final 4xx or 5xx, or more than 3 hops.
- **Watch for:** Heuristic: the thresholds are a DataBridges judgement and change only through a versioned release.

### S2 On-page fundamentals (SEO, weight 15)

#### S2.01 Title tag
- **Points:** 20 | **Scope:** P (each sampled page) | **Reads:** meta | **Basis:** HEUR | **Submit:** give one `pageScores` entry per applicable page
- **Applies to:** Every sampled page that was fetched and parsed; render-dependent pages are included because this reads only the URL, headers or head.
- **Rule:** Page score 1: exactly one non-empty title of 20 to 65 characters. 0.5: exactly one of 10 to 19 or 66 to 90 characters. 0: missing, empty, multiple, under 10 or over 90.
- **Watch for:** Heuristic: the thresholds are a DataBridges judgement and change only through a versioned release. A title set client-side can leave a generic placeholder in the raw head; it is scored as observed. Non-Latin scripts change the meaning of character counts.
- **Flag for review when:** The evidence shows a generic placeholder title that JavaScript may replace.

#### S2.02 Titles are unique
- **Points:** 10 | **Scope:** S (the site as a whole) | **Reads:** site | **Basis:** VENDOR | **Submit:** give one `score` with an `outcome`
- **Applies to:** NOT_APPLICABLE if fewer than 2 sampled pages have a title.
- **Rule:** Score is distinct normalised titles divided by titled pages.
- **Watch for:** Compares only the sampled pages, not the whole site.

#### S2.03 Meta description
- **Points:** 15 | **Scope:** P (each sampled page) | **Reads:** meta | **Basis:** HEUR | **Submit:** give one `pageScores` entry per applicable page
- **Applies to:** Every sampled page that was fetched and parsed; render-dependent pages are included because this reads only the URL, headers or head.
- **Rule:** Page score 1: exactly one meta name=description of 70 to 160 characters. 0.5: exactly one of 30 to 69 or 161 to 220. 0: missing, empty, multiple, under 30 or over 220.
- **Watch for:** Heuristic: the thresholds are a DataBridges judgement and change only through a versioned release. Search engines may rewrite descriptions. Non-Latin scripts change the meaning of character counts.

#### S2.04 Descriptions are unique
- **Points:** 5 | **Scope:** S (the site as a whole) | **Reads:** site | **Basis:** VENDOR | **Submit:** give one `score` with an `outcome`
- **Applies to:** NOT_APPLICABLE if fewer than 2 sampled pages have a meta description.
- **Rule:** Score is distinct normalised descriptions divided by pages with a description (as S2.02, for descriptions).
- **Watch for:** Compares only the sampled pages, not the whole site.

#### S2.05 Single H1
- **Points:** 15 | **Scope:** P (each sampled page) | **Reads:** body | **Basis:** HEUR | **Submit:** give one `pageScores` entry per applicable page
- **Applies to:** Every sampled page that was fetched and parsed; a render-dependent page is NOT_OBSERVED for this metric.
- **Rule:** Page score 1: exactly one non-empty h1. 0.5: two or more non-empty h1 elements. 0: none.
- **Watch for:** Heuristic: the thresholds are a DataBridges judgement and change only through a versioned release. Reads the raw HTML only; content added by JavaScript is not seen.

#### S2.06 Heading hierarchy
- **Points:** 10 | **Scope:** P (each sampled page) | **Reads:** body | **Basis:** STD | **Submit:** give one `pageScores` entry per applicable page
- **Applies to:** Every sampled page that was fetched and parsed; a render-dependent page is NOT_OBSERVED for this metric.
- **Rule:** A skip is a jump of more than one level downward (for example h2 to h4). Page score 1: zero skips, and at least one h2 on pages of 300 or more words. 0.5: 1 to 2 skips. 0: 3 or more skips, or 300 or more words with no h2.
- **Watch for:** Reads the raw HTML only; content added by JavaScript is not seen.

#### S2.07 Image alt attributes
- **Points:** 10 | **Scope:** P (each sampled page) | **Reads:** body | **Basis:** STD | **Submit:** give one `pageScores` entry per applicable page
- **Applies to:** NOT_APPLICABLE if the sample has no content images. Excluded: role=presentation, aria-hidden=true, and images with a width or height attribute of 2 or less. A render-dependent page is NOT_OBSERVED.
- **Rule:** Page score is content images with an alt attribute divided by content images; an empty alt counts as an explicit decorative mark.
- **Watch for:** Reads the raw HTML only; content added by JavaScript is not seen. Checks that an alt attribute exists, not that its text is good.

#### S2.08 Language declared
- **Points:** 5 | **Scope:** P (each sampled page) | **Reads:** meta | **Basis:** STD | **Submit:** give one `pageScores` entry per applicable page
- **Applies to:** Every sampled page that was fetched and parsed; render-dependent pages are included because this reads only the URL, headers or head.
- **Rule:** Page score 1 if html lang matches ^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$; otherwise 0.
- **Watch for:** Checks the form of the language code, not that it matches the text.

#### S2.09 Share-preview tags
- **Points:** 10 | **Scope:** P (each sampled page) | **Reads:** meta | **Basis:** STD | **Submit:** give one `pageScores` entry per applicable page
- **Applies to:** Every sampled page that was fetched and parsed; render-dependent pages are included because this reads only the URL, headers or head.
- **Rule:** Page score is the number present of og:title, og:description and og:image (an absolute https URL), divided by 3.
- **Watch for:** Checks that tags are present; it does not render a preview.

### S3 Technical health and speed basics (SEO, weight 10)

#### S3.01 HTTPS enforced
- **Points:** 20 | **Scope:** S (the site as a whole) | **Reads:** site | **Basis:** VENDOR | **Submit:** give one `score` with an `outcome`
- **Applies to:** Applies once the http address has been requested; NOT_OBSERVED if port 80 refuses or times out.
- **Rule:** Request http://host/. 1: permanent redirect (301 or 308) reaching same-site https within 2 hops. 0.5: reaches https via 302 or 307. 0: serves 2xx over HTTP, or no HTTPS. When the homepage could only be fetched over http, the result is FAIL.
- **Watch for:** A closed port 80 is not a failure; it is not observed.
- **Flag for review when:** HTTPS is not served (this feeds critical finding CF-05).

#### S3.02 Valid TLS certificate
- **Points:** 10 | **Scope:** S (the site as a whole) | **Reads:** site | **Basis:** STD | **Submit:** give one `score` with an `outcome`
- **Applies to:** Always applies (site level).
- **Rule:** 1: chain valid, hostname matches, at least 14 days to expiry. 0.5: valid but under 14 days to expiry. 0: expired, mismatched, self-signed or incomplete chain. When the homepage could only be fetched over http, the result is FAIL.
- **Watch for:** If the certificate is invalid the scan continues without verification for that origin, read-only.
- **Flag for review when:** The certificate is reported invalid or expired (this feeds critical finding CF-05).

#### S3.03 Mobile viewport
- **Points:** 15 | **Scope:** P (each sampled page) | **Reads:** meta | **Basis:** VENDOR | **Submit:** give one `pageScores` entry per applicable page
- **Applies to:** Every sampled page that was fetched and parsed; render-dependent pages are included because this reads only the URL, headers or head.
- **Rule:** Page score 1 if meta name=viewport content includes width=device-width; otherwise 0.
- **Watch for:** Checks the viewport tag only; it does not test the layout on a device.

#### S3.04 Response compression
- **Points:** 10 | **Scope:** S (the site as a whole) | **Reads:** site | **Basis:** VENDOR | **Submit:** give one `score` with an `outcome`
- **Applies to:** NOT_APPLICABLE if the uncompressed HTML is under 1 KB.
- **Rule:** Homepage requested with Accept-Encoding: gzip, br. 1 if Content-Encoding is gzip, br or zstd; otherwise 0.
- **Watch for:** A CDN may compress differently for other resources or clients.

#### S3.05 Server response time
- **Points:** 10 | **Scope:** S (the site as a whole) | **Reads:** site | **Basis:** HEUR | **Submit:** give one `score` with an `outcome`
- **Applies to:** NOT_OBSERVED if fewer than 2 homepage samples succeeded.
- **Rule:** Median of 3 sequential homepage requests, measured after connection setup to first byte. 1: 800 ms or less. 0.5: up to 1,800 ms. 0: above.
- **Watch for:** Heuristic: the thresholds are a DataBridges judgement and change only through a versioned release. Timing differs by scanner region and time of day, so the bands are wide and the weight is low.

#### S3.06 Broken internal links
- **Points:** 25 | **Scope:** S (the site as a whole) | **Reads:** site | **Basis:** HEUR | **Submit:** give one `score` with an `outcome`
- **Applies to:** NOT_OBSERVED if fewer than 5 link targets were observed.
- **Rule:** Up to 10 same-site link targets per sampled page (main-content links first, then others, in DOM order), 40 per job. Broken = 404, 410 or 5xx after one retry. 401, 403, 429 and timeouts are unobserved and excluded. Score is 1 minus broken divided by observed.
- **Watch for:** Heuristic: the thresholds are a DataBridges judgement and change only through a versioned release. A bot challenge or geo-block can return 403 to the scanner; that is excluded and recorded as an informational finding, not a penalty. A CDN may treat HEAD differently from GET.
- **Flag for review when:** Many links are unobserved because of 403 or 429 responses.

#### S3.07 No mixed content
- **Points:** 10 | **Scope:** P (each sampled page) | **Reads:** body | **Basis:** STD | **Submit:** give one `pageScores` entry per applicable page
- **Applies to:** Applies to https pages only. A render-dependent page is NOT_OBSERVED.
- **Rule:** Page score 1 if there is no http:// subresource; 0.5 if only passive (img, audio, video); 0 if any active (script, stylesheet, iframe).
- **Watch for:** Reads the raw HTML only; content added by JavaScript is not seen.

### S4 Content and internal linking (SEO, weight 10)

#### S4.01 Content depth
- **Points:** 30 | **Scope:** CP (each sampled content page) | **Reads:** body | **Basis:** HEUR | **Submit:** give one `pageScores` entry per applicable page
- **Applies to:** Sampled content pages only (home, about, services, faq, article, other); contact and legal pages are excluded. Word counts do not apply where html lang is zh, ja, ko or th. A render-dependent page is NOT_OBSERVED.
- **Rule:** Page score 1: main content of 300 or more words. 0.5: 150 to 299. 0: under 150.
- **Watch for:** Heuristic: the thresholds are a DataBridges judgement and change only through a versioned release. Reads the raw HTML only; content added by JavaScript is not seen. Main-content extraction can pull in a mega-menu and overstate the word count.

#### S4.02 Internal link breadth
- **Points:** 20 | **Scope:** H (the homepage only) | **Reads:** body | **Basis:** HEUR | **Submit:** give one `score` with an `outcome`
- **Applies to:** Homepage only. NOT_OBSERVED if the homepage is render-dependent.
- **Rule:** Distinct same-site link targets on the homepage (nav, main, footer; excluding itself, fragments, mailto, tel and javascript). 1: 8 or more. 0.5: 3 to 7. 0: 2 or fewer.
- **Watch for:** Heuristic: the thresholds are a DataBridges judgement and change only through a versioned release. Reads the raw HTML only; content added by JavaScript is not seen.

#### S4.03 Descriptive anchor text
- **Points:** 20 | **Scope:** P (each sampled page) | **Reads:** body | **Basis:** HEUR | **Submit:** give one `pageScores` entry per applicable page
- **Applies to:** Every sampled page that was fetched and parsed; a render-dependent page is NOT_OBSERVED for this metric.
- **Rule:** Page score is same-site links with a non-empty accessible name (visible text, else aria-label, else image alt) that is not in the generic-anchor list, divided by all same-site links.
- **Watch for:** Heuristic: the thresholds are a DataBridges judgement and change only through a versioned release. Reads the raw HTML only; content added by JavaScript is not seen. Icon-only links without an accessible name count as non-descriptive.

#### S4.04 Distinct content
- **Points:** 10 | **Scope:** S (the site as a whole) | **Reads:** body | **Basis:** HEUR | **Submit:** give one `score` with an `outcome`
- **Applies to:** NOT_APPLICABLE below 2 content pages. A render-dependent page is NOT_OBSERVED.
- **Rule:** Score is 1 minus (pages in identical-text sets divided by content pages), comparing a SHA-256 of the normalised main text.
- **Watch for:** Heuristic: the thresholds are a DataBridges judgement and change only through a versioned release. Reads the raw HTML only; content added by JavaScript is not seen.

#### S4.05 Clean URLs
- **Points:** 10 | **Scope:** P (each sampled page) | **Reads:** meta | **Basis:** HEUR | **Submit:** give one `pageScores` entry per applicable page
- **Applies to:** Every sampled page, whether or not its HTML could be parsed, because this reads only the page address and the fetch record.
- **Rule:** Violations: uppercase in the path, a space or %20, an underscore, a path over 100 characters, a query string, or a session-style parameter (sid, phpsessid, jsessionid, sessionid). Page score 1: none. 0.5: one. 0: two or more.
- **Watch for:** Heuristic: the thresholds are a DataBridges judgement and change only through a versioned release.

#### S4.06 Site navigation
- **Points:** 10 | **Scope:** P (each sampled page) | **Reads:** body | **Basis:** HEUR | **Submit:** give one `pageScores` entry per applicable page
- **Applies to:** Every sampled page that was fetched and parsed; a render-dependent page is NOT_OBSERVED for this metric.
- **Rule:** Page score 1: a nav or role=navigation block containing 3 or more same-site links. 0.5: one containing 1 to 2. 0: none.
- **Watch for:** Heuristic: the thresholds are a DataBridges judgement and change only through a versioned release. Reads the raw HTML only; content added by JavaScript is not seen.

### A1 AI crawler access and content availability (AEO, weight 15)

#### A1.01 AI search and answer crawlers allowed
- **Points:** 40 | **Scope:** P (each sampled page) | **Reads:** meta | **Basis:** VENDOR | **Submit:** give one `pageScores` entry per applicable page
- **Applies to:** Every sampled page, for each of OAI-SearchBot, PerplexityBot and Claude-SearchBot, whether or not the page itself could be fetched. If robots.txt could not be read (a 5xx response or a timeout) the result is SCAN_ERROR, as for S1.02.
- **Rule:** Per (agent, page) pair: 1 if allowed by RFC 9309 matching, else 0. Score is allowed pairs divided by all pairs.
- **Watch for:** Opting out of model-training crawlers is a legitimate choice and is not scored. User-initiated agents are informational because vendors state they may not apply robots.txt. The agent list is reviewed periodically and can change between releases.
- **Flag for review when:** A score change is caused by an update to the AI crawler list. All three agents are disallowed for the homepage (this feeds critical finding CF-03).

#### A1.02 Snippet and preview eligibility
- **Points:** 15 | **Scope:** P (each sampled page) | **Reads:** meta | **Basis:** VENDOR | **Submit:** give one `pageScores` entry per applicable page
- **Applies to:** Every sampled page that was fetched and parsed; render-dependent pages are included because this reads only the URL, headers or head.
- **Rule:** Page score 1: no nosnippet, no max-snippet:0 and no none (meta or X-Robots-Tag). 0.5: max-snippet between 1 and 49. 0: nosnippet, max-snippet:0 or none.
- **Watch for:** Snippet limits can be a deliberate choice for some content.

#### A1.03 llms.txt present
- **Points:** 5 | **Scope:** S (the site as a whole) | **Reads:** site | **Basis:** HEUR | **Submit:** give one `score` with an `outcome`
- **Applies to:** Always applies (site level).
- **Rule:** 1: /llms.txt returns 2xx text with at least one heading line starting '# ' and at least one link. 0.5: exists but has no recognisable structure. 0: not found.
- **Watch for:** Heuristic: the thresholds are a DataBridges judgement and change only through a versioned release. llms.txt is an emerging convention with no confirmed retrieval benefit, so it carries few points.
- **Flag for review when:** Before each release, re-verify the status of the llms.txt convention.

#### A1.04 Primary content in the initial HTML
- **Points:** 40 | **Scope:** CP (each sampled content page) | **Reads:** meta | **Basis:** VENDOR | **Submit:** give one `pageScores` entry per applicable page
- **Applies to:** Sampled content pages only (home, about, services, faq, article, other). Evaluated on render-dependent pages, because this metric carries their penalty. Word counts do not apply where html lang is zh, ja, ko or th.
- **Rule:** Page score 1 if main content has 50 or more words in the raw HTML; 0 otherwise (thin or render-dependent).
- **Watch for:** Reads the raw HTML only; content added by JavaScript is not seen. A genuinely short page can score 0 without being render-dependent.
- **Flag for review when:** The homepage is render-dependent (this feeds critical finding CF-04).

### A2 Structured data and entity clarity (AEO, weight 15)

#### A2.01 Valid JSON-LD
- **Points:** 15 | **Scope:** P (each sampled page) | **Reads:** meta | **Basis:** VENDOR | **Submit:** give one `pageScores` entry per applicable page
- **Applies to:** Every sampled page that was fetched and parsed; render-dependent pages are included because this reads only the URL, headers or head.
- **Rule:** Page score 1: at least one block, all parse, each with a schema.org @context and @type or @graph. 0.5: at least one valid and one invalid block, or microdata or RDFa only (itemscope seen). 0: none, or none valid.
- **Watch for:** JSON-LD injected only by client-side JavaScript is invisible to a non-rendering crawler and scores as absent.

#### A2.02 Organisation identity
- **Points:** 20 | **Scope:** H (the homepage only) | **Reads:** meta | **Basis:** STD | **Submit:** give one `score` with an `outcome`
- **Applies to:** Homepage only. Reads the first Organization-family node (a Person node is accepted for sole traders).
- **Rule:** Points out of 20: name and url present (8), logo or image (4), at least one of telephone, email, address or contactPoint (4), non-empty description (4). Score is points divided by 20; no such node scores 0.
- **Watch for:** Checks which properties are present, not whether they are accurate.

#### A2.03 Profile links (sameAs)
- **Points:** 10 | **Scope:** H (the homepage only) | **Reads:** meta | **Basis:** HEUR | **Submit:** give one `score` with an `outcome`
- **Applies to:** Homepage only.
- **Rule:** Distinct absolute https URLs on other hosts. 1: 2 or more. 0.5: one. 0: none. Targets are not fetched.
- **Watch for:** Heuristic: the thresholds are a DataBridges judgement and change only through a versioned release. The linked profiles are not fetched or checked.

#### A2.04 Identity graph coherence
- **Points:** 10 | **Scope:** S (the site as a whole) | **Reads:** site | **Basis:** STD | **Submit:** give one `score` with an `outcome`
- **Applies to:** NOT_APPLICABLE if there are no references.
- **Rule:** A reference is an object holding only @id. It resolves if a node with that @id and other properties exists on the same page or on the homepage. Score is resolved divided by references.
- **Watch for:** Only the sampled pages are searched for definitions.

#### A2.05 Page-type schema
- **Points:** 15 | **Scope:** P (each sampled page) | **Reads:** meta | **Basis:** STD | **Submit:** give one `pageScores` entry per applicable page
- **Applies to:** NOT_APPLICABLE if no sampled page has an expectation for its type.
- **Rule:** Page score is checks passed divided by checks. Article: an Article-family node, headline, datePublished and author.name. FAQ: FAQPage, at least 2 Question nodes, each with acceptedAnswer.text. Services: a Service, Product or OfferCatalog node with name and description. About: an AboutPage, ProfilePage or Person node.
- **Watch for:** FAQ checks are kept as an answer-structure and entity-clarity signal, not a rich-result prediction.

#### A2.06 Breadcrumbs
- **Points:** 5 | **Scope:** P (each sampled page) | **Reads:** meta | **Basis:** VENDOR | **Submit:** give one `pageScores` entry per applicable page
- **Applies to:** Pages with a path depth of 2 or more. NOT_APPLICABLE if no sampled page qualifies.
- **Rule:** Page score 1 if a BreadcrumbList has at least 2 items, each with name and with item or position; otherwise 0.
- **Watch for:** Breadcrumbs may be unnecessary on some small sites.

#### A2.07 Schema matches visible content
- **Points:** 15 | **Scope:** P (each sampled page) | **Reads:** body | **Basis:** HEUR | **Submit:** give one `pageScores` entry per applicable page
- **Applies to:** NOT_APPLICABLE if no check applies on any sampled page. A render-dependent page is NOT_OBSERVED.
- **Rule:** Applicable checks per page: the Organization name appears in the visible text or title; each FAQ Question text appears in the visible text; an Article headline equals or is contained in the h1 or title (normalised). Page score is passed divided by applicable.
- **Watch for:** Heuristic: the thresholds are a DataBridges judgement and change only through a versioned release. Reads the raw HTML only; content added by JavaScript is not seen.

#### A2.08 Name consistency
- **Points:** 10 | **Scope:** H (the homepage only) | **Reads:** meta | **Basis:** HEUR | **Submit:** give one `score` with an `outcome`
- **Applies to:** NOT_APPLICABLE if there is no JSON-LD organisation name.
- **Rule:** Compare the JSON-LD organisation name, og:site_name and the title. 1: the JSON-LD name equals og:site_name and appears in the title. 0.5: one of the two holds. 0: neither.
- **Watch for:** Heuristic: the thresholds are a DataBridges judgement and change only through a versioned release.

### A3 Answer-ready content (AEO, weight 10)

#### A3.01 Question-style headings
- **Points:** 10 | **Scope:** KO (each sampled knowledge page (services, faq, article, other)) | **Reads:** body | **Basis:** HEUR | **Submit:** give one `pageScores` entry per applicable page
- **Applies to:** Applies only where html lang starts with en (otherwise NOT_APPLICABLE). Knowledge pages only (services, faq, article, other); at least 3 subheadings (h2 and h3 in main content) are needed. A render-dependent page is NOT_OBSERVED.
- **Rule:** A question ends with ? or starts with a word in the question-starter list. Page score 1: 25% or more of subheadings are questions. 0.5: 10% to 24%. 0: under 10%.
- **Watch for:** Heuristic: the thresholds are a DataBridges judgement and change only through a versioned release. Reads the raw HTML only; content added by JavaScript is not seen. This is a proxy for being easy to quote and can reward formulaic writing.

#### A3.02 Answer-first sections
- **Points:** 30 | **Scope:** KO (each sampled knowledge page (services, faq, article, other)) | **Reads:** body | **Basis:** HEUR | **Submit:** give one `pageScores` entry per applicable page
- **Applies to:** Knowledge pages only (services, faq, article, other); at least 3 subheadings are needed. A render-dependent page is NOT_OBSERVED.
- **Rule:** For each subheading, the first p before the next heading of the same or higher level is an answer block if it has 15 to 70 words and at most 3 sentences. Page score 1 if 60% or more of subheadings qualify, 0.5 if 30% to 59%, else 0.
- **Watch for:** Heuristic: the thresholds are a DataBridges judgement and change only through a versioned release. Reads the raw HTML only; content added by JavaScript is not seen. This is a proxy for being easy to quote and can reward formulaic writing.
- **Flag for review when:** A page scores 0 but a reviewer judges it clearly answer-first.

#### A3.03 FAQ block present
- **Points:** 20 | **Scope:** S (the site as a whole) | **Reads:** body | **Basis:** HEUR | **Submit:** give one `score` with an `outcome`
- **Applies to:** Always applies (site level). A render-dependent page is NOT_OBSERVED.
- **Rule:** Pairs are detected as details plus summary, dl with dt and dd, or a question-form heading followed by a paragraph. 1: at least one sampled page with 3 or more pairs. 0.5: 1 to 2 pairs at most. 0: none.
- **Watch for:** Heuristic: the thresholds are a DataBridges judgement and change only through a versioned release. Reads the raw HTML only; content added by JavaScript is not seen.

#### A3.04 Scannable structure
- **Points:** 15 | **Scope:** KO (each sampled knowledge page (services, faq, article, other)) | **Reads:** body | **Basis:** HEUR | **Submit:** give one `pageScores` entry per applicable page
- **Applies to:** NOT_APPLICABLE for pages under 300 words. Knowledge pages only (services, faq, article, other). A render-dependent page is NOT_OBSERVED.
- **Rule:** Page score 1 if main content has a list of 3 or more items, or a table with a header cell and at least 2 rows; otherwise 0.
- **Watch for:** Heuristic: the thresholds are a DataBridges judgement and change only through a versioned release. Reads the raw HTML only; content added by JavaScript is not seen. This is a proxy for being easy to quote and can reward formulaic writing.

#### A3.05 Sentence and paragraph length
- **Points:** 10 | **Scope:** KO (each sampled knowledge page (services, faq, article, other)) | **Reads:** body | **Basis:** HEUR | **Submit:** give one `pageScores` entry per applicable page
- **Applies to:** Applies only where html lang starts with en (otherwise NOT_APPLICABLE). Knowledge pages only (services, faq, article, other). A render-dependent page is NOT_OBSERVED.
- **Rule:** Page score 1: median sentence 24 words or fewer AND median paragraph 100 words or fewer. 0.5: one bound exceeded. 0: both exceeded.
- **Watch for:** Heuristic: the thresholds are a DataBridges judgement and change only through a versioned release. Reads the raw HTML only; content added by JavaScript is not seen. Sentence splitting is approximate; wide thresholds absorb abbreviation errors.

#### A3.06 Entity statement near the top
- **Points:** 15 | **Scope:** H (the homepage only) | **Reads:** body | **Basis:** HEUR | **Submit:** give one `score` with an `outcome`
- **Applies to:** Homepage only. A check applies only if its reference data exists in the JSON-LD. NOT_APPLICABLE if none apply. NOT_OBSERVED if the homepage is render-dependent.
- **Rule:** Within the first 200 words of homepage main content: (a) the business name (JSON-LD organisation name, else og:site_name) appears; (b) a locality or area from the JSON-LD address or areaServed appears; (c) a term from knowsAbout or serviceType appears. Score is passed divided by applicable.
- **Watch for:** Heuristic: the thresholds are a DataBridges judgement and change only through a versioned release. Reads the raw HTML only; content added by JavaScript is not seen. This is a proxy for being easy to quote and can reward formulaic writing.

### A4 Trust, authorship and freshness (AEO, weight 10)

#### A4.01 About page discoverable
- **Points:** 15 | **Scope:** H (the homepage only) | **Reads:** body | **Basis:** HEUR | **Submit:** give one `score` with an `outcome`
- **Applies to:** Homepage only. NOT_OBSERVED if the homepage is render-dependent.
- **Rule:** 1: the homepage links to a same-site URL matching the about-page patterns that returns 2xx. 0.5: such a URL appears only in the sitemap or a sampled page. 0: none.
- **Watch for:** Heuristic: the thresholds are a DataBridges judgement and change only through a versioned release. Path patterns are English-centric.

#### A4.02 Contact information visible
- **Points:** 15 | **Scope:** H (the homepage only) | **Reads:** body | **Basis:** HEUR | **Submit:** give one `score` with an `outcome`
- **Applies to:** Homepage only. NOT_OBSERVED if the homepage is render-dependent.
- **Rule:** Signals: a mailto link or email text; a tel link or JSON-LD telephone; address text of 10 or more characters or JSON-LD address; a link matching the contact-page patterns. 0 signals: 0. 1 signal: 0.5. 2 signals: 0.75. 3 or more: 1.
- **Watch for:** Heuristic: the thresholds are a DataBridges judgement and change only through a versioned release. Path patterns are English-centric.

#### A4.03 Author attribution
- **Points:** 15 | **Scope:** AP (each sampled article page) | **Reads:** body | **Basis:** HEUR | **Submit:** give one `pageScores` entry per applicable page
- **Applies to:** Article pages only. NOT_APPLICABLE if no article page was sampled. A render-dependent page is NOT_OBSERVED.
- **Rule:** Page score 1 if there is a visible byline (rel=author, itemprop=author, a byline or author class, or 'By ' within the first 400 characters) or a JSON-LD author name; otherwise 0.
- **Watch for:** Heuristic: the thresholds are a DataBridges judgement and change only through a versioned release. Reads the raw HTML only; content added by JavaScript is not seen. Bylines vary widely in markup and may not all be detected.

#### A4.04 Dates on articles
- **Points:** 10 | **Scope:** AP (each sampled article page) | **Reads:** body | **Basis:** HEUR | **Submit:** give one `pageScores` entry per applicable page
- **Applies to:** As A4.03: article pages only; NOT_APPLICABLE if no article page was sampled. A render-dependent page is NOT_OBSERVED.
- **Rule:** Page score 0.5 for a published date (datePublished, or a time datetime in the byline or header) plus 0.5 for a modified date (dateModified).
- **Watch for:** Heuristic: the thresholds are a DataBridges judgement and change only through a versioned release. Reads the raw HTML only; content added by JavaScript is not seen. Dates can be generated automatically and may not reflect real editing.

#### A4.05 Freshness
- **Points:** 20 | **Scope:** S (the site as a whole) | **Reads:** site | **Basis:** HEUR | **Submit:** give one `score` with an `outcome`
- **Applies to:** NOT_OBSERVED if no valid date is found. Dates later than the scan time plus one day are ignored.
- **Rule:** latest is the newest valid date among sitemap lastmod, JSON-LD dateModified and datePublished, and time datetime on sampled pages. Age is scan time minus latest. 1: 180 days or less. 0.5: 181 to 365 days. 0: over 365 days. Sitemap lastmod is ignored as evidence if all values are identical across 5 or more URLs (a build-time stamp).
- **Watch for:** Heuristic: the thresholds are a DataBridges judgement and change only through a versioned release. Dates can be generated automatically and may not reflect real editing.
- **Flag for review when:** The evidence names an auto-generated date source.

#### A4.06 Privacy policy linked
- **Points:** 10 | **Scope:** H (the homepage only) | **Reads:** body | **Basis:** HEUR | **Submit:** give one `score` with an `outcome`
- **Applies to:** Homepage only. NOT_OBSERVED if the homepage is render-dependent.
- **Rule:** 1 if the homepage links to a same-site URL matching the privacy-page patterns; otherwise 0. This makes no compliance claim.
- **Watch for:** Heuristic: the thresholds are a DataBridges judgement and change only through a versioned release. Presence only; this is not a legal or compliance assessment. Path patterns are English-centric.

#### A4.07 External references
- **Points:** 15 | **Scope:** KO (each sampled knowledge page (services, faq, article, other)) | **Reads:** body | **Basis:** HEUR | **Submit:** give one `pageScores` entry per applicable page
- **Applies to:** Knowledge pages only (services, faq, article, other). A render-dependent page is NOT_OBSERVED.
- **Rule:** Page score 1 if main content has at least one outbound link to another site (http or https, not rel=sponsored or ugc, not a share link); otherwise 0. Presence only, with no judgement of authority.
- **Watch for:** Heuristic: the thresholds are a DataBridges judgement and change only through a versioned release. Reads the raw HTML only; content added by JavaScript is not seen. Presence only; the authority of the linked sites is not assessed.
## 9. Critical findings

Critical findings sit beside the score; they never change it. List the ids that apply
in `criticalFindings`. Use neutral wording in any notes ("Detected: ...").

| ID | Trigger |
|---|---|
| CF-01 | `robots.txt` disallows `/` for the `*` group (or the Googlebot group) |
| CF-02 | Homepage carries `noindex` (meta or header) |
| CF-03 | All three AI search and answer crawlers (`OAI-SearchBot`, `PerplexityBot`, `Claude-SearchBot`) are disallowed for the homepage |
| CF-04 | Homepage is render-dependent |
| CF-05 | HTTPS is not served, or the certificate is invalid or expired |
| CF-06 | Homepage canonical points to a different site |
| CF-07 | The scanner was challenged or blocked (403, 429 or 503 with a challenge marker); results may be incomplete |

Informational, never scored: whether training crawlers (`GPTBot`, `ClaudeBot`,
`Google-Extended`, `Applebot-Extended`, `CCBot`) are allowed. Record it in `notes` as
"allowed" or "disallowed" without comment. Opting out of model training is a legitimate
choice and is not scored.

## 10. Standing interpretations

Where the plan's wording is ambiguous the agents building the scanner applied the
cautious reading below. Use the same ones so that independent agents agree. They stay
in force until the owner decides otherwise (D-03). Add a `methodologyQuestions` entry
whenever you rely on one.

1. **S1.04.** A canonical in the head and one in the `Link` header that agree count as
   one canonical.
2. **S1.02 and A1.01.** A 5xx or timeout on `robots.txt` is `scan_error`, never a
   penalty. A 4xx means allowed.
3. **A3.01 and A3.02.** A page with fewer than 3 qualifying subheadings is
   `not_applicable` for that page.
4. **S2.05 and S2.06.** Count non-empty `<h1>` across the whole document for S2.05. Use
   headings inside the main content only for S2.06.
5. **S4.02.** Count same-site links from every location, not just nav, main and footer.
6. **S4.03.** Leave fragment-only links (`#top`) out of both the numerator and the
   denominator.
7. **Non-space-delimited languages (`zh`, `ja`, `ko`, `th`).** S4.01, A1.04, A3.02,
   A3.04, A3.05, A3.06 and the 300-word clause of S2.06 are `NOT_APPLICABLE`. Such a
   page is render-dependent only if it has an empty framework root or a JavaScript
   `<noscript>` message (the page helper reports this). Mention it in `notes` if CF-04
   would follow, because it may be a false alarm.
8. **A4.01.** If the About link was neither sampled nor link-checked, request it once
   with `HEAD`. If its status is still unknown, record `NOT_OBSERVED`.
9. **Pages that failed.** A sampled page that returned 4xx or 5xx, or failed to fetch,
   is scored only by S1.05 and the URL-only metrics. For every other per-page metric it
   is `not_observed` (or `scan_error` for a fetch failure).
10. **A3.03.** Count every `<details>` plus `<summary>` pair and every `<dl>` pair. A
    heading followed by a paragraph counts only when the heading is a question.
11. **A3.05.** Take sentences and paragraphs from `<p>` elements inside the main
    content only (not headings, list items or table cells).
12. **A2.02.** If several Organization-family nodes exist, use the shallowest, then the
    earliest in the document.
13. **Render-dependent pages.** S4.04 and A3.03 read page text, so they are
    `NOT_OBSERVED` for these pages. A1.04 is the one metric that is still evaluated, and
    it scores 0.
14. **Unscored metrics.** When fewer than half of the applicable pages were observed,
    record `not_observed` per page if any missing page is render-dependent,
    robots-blocked or not HTML, and `scan_error` only when every missing page was a
    fetch or HTTP failure.
15. **Runs that did not complete.** `BLOCKED_BY_ROBOTS`, `UNREACHABLE` and `JOB_ERROR`
    submissions have no metrics and no critical findings, even if `robots.txt` blocks
    everyone.
16. **CF-07.** Raise it only when a request returned 403, 429 or 503 and the response
    carried a challenge marker (a `cf-mitigated: challenge` header, or text such as "Just
    a moment", "Attention Required", "verify you are human" or "captcha"). There is no
    official marker list yet.

The full list of questions and the cautious readings applied is in
`VISIBILITY_INDEX_BUILD_NOTES.md`.

## 11. For the owner: approving sources and changing policy

**Approving a candidate.** Open `reports/visibility/candidates.json`, pick an entry,
and get the site owner's written consent (or confirm it is yours). Keep that consent
outside the repository. Then add the site to `targets.json` with `"status": "APPROVED"`,
`"approvalBasis": "WRITTEN_CONSENT"` (or `"OWNED"`) and an `approvalRef` that points to
the consent record. Mark the candidate entry `"status": "APPROVED"` or `"REJECTED"`.
Agents never do this.

**Why agents do not score what they discover.** Scoring a site nobody has approved is
arbitrary-URL scanning. `databridges-agent-docs-v2/04_AGENTS.md` makes that a Level 3
decision (explicit approval and a security review first), and
`databridges-agent-docs-v2/07_VISIBILITY_INDEX.md` limits prototypes and pilots to
owned or explicitly approved sites. The tooling therefore refuses unapproved targets.
If you decide to allow it, record that decision (D-04 in the plan) and change the
tooling on purpose; editing the prompt is not enough.

**Reviewing results.**
- `reports/visibility/index.csv` has one row per target: scores, coverage, number of
  raters, agreement rate, confidence, dispute count and critical findings.
- `scores/<targetId>.json` has every metric with its evidence, each agent's own
  scores, and any disputes that need a person.
- A `needs-review` or `single-rater` result is not a settled score. Look at the disputed
  metrics and decide which reading is right; if the rule was the problem, raise it as a
  methodology question rather than overriding a score by hand.

**Running agents.**
- Give each agent a unique `AGENT_ID` and the same `RUN_ID` for one cycle. Two
  independent agents per target is the aim.
- Run only a few at a time. A full manual score of one site is a long task and uses a
  lot of your plan allowance.
- Everything under `reports/` is git-ignored and may hold third-party information.
  Never commit or share it, and delete it when it is no longer needed.
- Scores are signals of readiness, not rankings or predictions. Do not publish them or
  compare sites until the methodology is signed off and the public-release gates in
  the plan have passed.
