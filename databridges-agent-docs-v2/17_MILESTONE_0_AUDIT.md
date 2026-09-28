---
title: Milestone 0 repository audit and decision log
status: working
owner: unassigned
last_reviewed: 2026-09-28
scope: milestone-0
---

# Milestone 0 Repository Audit and Decision Log

## Authority and scope

Revision 3 is approved as the working specification for Milestone 0 only. This
record does not approve deployment, publication of protected claims, legal or
privacy wording, production settings or later-milestone products.

The unrelated untracked file `.claude/settings.local.json` was present before
this work and was left untouched.

## Verified repository baseline

| Area | Verified state |
|---|---|
| Git | Branch `master`, tracking `origin/master`; implementation work remains local and uncommitted |
| Application | Next.js 16 App Router, React 19, Tailwind CSS 4 |
| Scripts | `dev`, `build`, `start`, `lint`, plus the new dependency-free `typecheck` script |
| Deployment | Netlify build runs `npm run build` with `@netlify/plugin-nextjs`; no staging configuration was found |
| CMS | Decap `git-gateway`, `publish_mode: simple`, writes directly to `master` |
| Public pages | `/`, `/about`, `/contact`, `/events`, `/faq`, `/seo-aeo`, `/services`, `/work` |
| Other public endpoints | `/admin` rewrites to the static Decap shell; `/api/otter` is a route handler and is now disabled by default |
| Content | LinkedIn entries come from `content/linkedin.json`; events come from optional `content/events/*.md` files |
| Forms | One contact form posts URL-encoded fields to the Netlify-detected static form at `/__forms.html` |
| Analytics | No analytics SDK, tag, event sender or conversion collector was found |
| Tests and CI | No unit, integration or E2E test infrastructure and no repository CI workflow were found |

## Route, SEO and structured-data audit

- all eight public pages build and return HTTP 200 locally;
- all string-literal internal route targets found in `src` resolve to an
  implemented public page;
- each public page has an explicit canonical or inherits the root canonical;
- the sitemap contains all eight public pages;
- synthetic `lastModified: new Date()` values were removed because they stated
  a modification time unrelated to content changes;
- `/admin` and `/api/` are now disallowed in robots metadata while remaining
  reachable;
- no public route was removed and no redirect was added;
- the only configured rewrite is `/admin` to `/admin/index.html`;
- FAQ visible copy and `FAQPage` JSON-LD are generated from the same `FAQS`
  array, so no content/schema mismatch was found;
- LinkedIn destinations could not be fetched by the available external checker,
  so their live status is not verified.

## Forms, consent and failure states

The styled contact form and `public/__forms.html` use the same fields:
`form-name`, `bot-field`, `name`, `email`, `organisation` and `message`.
Browser validation had been disabled without a replacement; native required and
email validation is now restored, autocomplete hints were added, and the error
message remains an assertive alert with a direct-email fallback.

Repository inspection and a local HTTP smoke test do not prove that Netlify has
registered the form or that its notification destination works. A production
or deploy-preview submission and receipt check is still required. No consent or
privacy notice appears beside the form. Adding or changing that wording is a
Level 3 legal/privacy decision and was not attempted.

## Claims audit

No evidence record in `14_EVIDENCE_AND_CASE_STUDY_BANK.md` is approved for new
public use. The following existing public content therefore remains blocked for
evidence and publication review:

- biography, education, certification, teaching and current-role wording in
  `src/app/about/page.tsx`, `src/app/page.tsx`, `src/app/faq/page.tsx` and
  `src/lib/jsonld.ts`;
- named HSE, Tusla and UCD references and exact employment dates;
- audience claims such as “most clients” and cross-Ireland availability;
- project and outcome descriptions in `src/data/vignettes.ts`, corresponding
  broadly to `EVID-001` through `EVID-015`;
- quantitative or time-bound examples, including the 2019–2026 dataset wording
  and public experience counters;
- legal interpretations and automated classifications in the EU AI Act
  checker and service/FAQ copy.

The current AI Act dates were cross-checked on 2026-09-28 against the European
Commission's [AI Act implementation
timeline](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai)
and [Regulation (EU)
2026/1744](https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=OJ%3AL_202601744).
That factual date check is not legal approval of the checker, its
classifications or the surrounding advice.

Unverified promises of a free booked call, a fixed 30-minute duration and a
one-working-day response were removed or replaced with neutral enquiry wording.
No replacement price, availability or response-time claim was invented. No
credential, employer, client or outcome claim was added or strengthened.

## Defects and dispositions

| Severity | Defect | Disposition |
|---|---|---|
| High | Existing protected claims rely on unavailable/unapproved evidence | Blocked for source access, exact claim records and human approval |
| High | Contact form has no adjacent consent/privacy notice | Blocked at Level 3; legal/privacy owner must supply approved wording and data handling basis |
| High | Decap can publish directly to production branch `master` | Existing behaviour retained; human decision required before changing workflow |
| High | EU AI Act checker makes automated legal classifications | Dates checked only; qualified legal/content approval required before treating the tool as approved guidance |
| Medium | “Book” CTAs led only to a contact form and included unverified free/duration promises | Fixed with neutral enquiry wording |
| Medium | Contact form disabled native validation with no custom replacement | Fixed by restoring browser validation and autocomplete |
| Medium | Live Netlify form registration, receipt and notification path are unverified | Blocked pending an approved deploy-preview or production delivery test |
| Medium | Dormant AI endpoint could activate merely by adding an API key | Fixed: it now also requires `OTTER_CHAT_ENABLED=true` |
| Medium | No analytics or conversion baseline exists | Recorded as zero instrumentation; vendor/events require a later decision |
| Low | Sitemap claimed every route changed at build time | Fixed by removing synthetic timestamps |
| Low | Admin and API paths were crawlable | Fixed in robots metadata |
| Low | External LinkedIn link availability could not be verified | Retained and flagged for manual/link-check review |

## Validation record

| Check | Result |
|---|---|
| `npm run lint` | PASS, exit 0 |
| `npm run typecheck` | PASS, exit 0 |
| `npm run build` in restricted sandbox | FAIL: Google Fonts could not be fetched; no code diagnostic |
| `npm run build` with approved network access | PASS, exit 0; 14 static pages generated and `/api/otter` remained dynamic |
| Local HTTP smoke test | PASS: eight public pages, `robots.txt`, `sitemap.xml`, `/admin` and `/__forms.html` returned 200 |
| Dormant API smoke test | PASS: `POST /api/otter` returned 503 with chat disabled |
| Static internal-link check | PASS: seven unique page targets checked, zero missing routes |
| Unit, integration and E2E tests | NOT AVAILABLE: no configured infrastructure |
| Live form delivery and analytics events | NOT RUN: external configuration/instrumentation absent |

## Human decisions still required

1. Assign the pack and Milestone 0 an accountable owner.
2. Decide whether internal evidence belongs in this repository and provide
   controlled access to `SOURCE-CAREER`, `SOURCE-FORECAST` and
   `SOURCE-VERTICALS`.
3. Approve, remove or rewrite each current credential, employer, client,
   audience, outcome and quantitative claim after evidence review.
4. Obtain qualified approval for EU AI Act copy and decide whether the checker
   may remain public in its current form.
5. Supply approved contact-form privacy/consent wording and document retention,
   recipient and deletion handling.
6. Authorize a deploy-preview or production form-delivery test and confirm the
   notification recipient and failure escalation.
7. Decide whether Decap direct-to-`master` publishing remains acceptable.
8. Choose whether to add CI and which existing checks it must run; separately
   decide whether a test framework is justified.
9. Decide whether analytics is needed and, if so, approve the privacy-safe
   platform, consent posture and canonical events before implementation.

Nothing in this execution was deployed, pushed, merged or published.
