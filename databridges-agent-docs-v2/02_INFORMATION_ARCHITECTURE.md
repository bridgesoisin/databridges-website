---
title: Information architecture and route migration
status: proposed
owner: unassigned
last_reviewed: 2026-09-28
approval: pending
---

# Information Architecture and Route Migration

## Principle

Navigation should reflect visitor decisions, not the internal ambition of the programme. New routes must earn their place through real content and a supported conversion path.

## Primary navigation

Use no more than six primary items:

1. Services
2. Work
3. Resources
4. About
5. Contact
6. one context-dependent CTA such as “Book a conversation”

Events may sit under Resources. FAQ may be linked contextually and from the footer. Experimental products do not enter primary navigation before their release gates pass.

## Target public routes

```text
/
/services
/services/visibility
/services/opportunity-map
/services/automation
/services/governance
/services/training
/work
/work/[case-study-slug]
/resources
/resources/[resource-slug]
/events
/faq
/about
/contact
```

Reserved, non-public experiment routes:

```text
/index/*
/tools/*
```

Do not publish or include reserved routes in navigation, sitemap or search indexing until the relevant gate is approved.

Exception (proposed 2026-10-07, takes effect when the owner merges it): `/index/bot` is a live crawler
information page. The scanner's User-Agent links to it, so a site owner who sees DataBridgesBot in their logs
can find who runs it, what it reads, how to block it and how to ask us to stop. It is `noindex`, and is not in
navigation or the sitemap. Its numbers are read from the scanner's code, and a test fails if the
User-Agent's link and the page's route drift apart.

## Existing-route migration

The repository currently includes routes that must be preserved or deliberately migrated.

| Current route | Initial treatment | Release condition |
|---|---|---|
| `/services` | retain and improve | none |
| `/seo-aeo` | retain until replacement is equivalent | redirect only after content and metadata review |
| `/work` | retain and improve incrementally | evidence review required |
| `/events` | retain | validate empty state and metadata |
| `/faq` | retain | keep visible copy and structured data aligned |
| `/about` | retain and tighten | evidence review required |
| `/contact` | retain | consent and delivery behaviour verified |
| `/admin` | internal operational route | never include in public navigation or sitemap |

Every removed or renamed public URL requires:

- destination mapping;
- permanent redirect after verification;
- canonical and sitemap update;
- internal-link update;
- structured-data review;
- post-release 404 check.

## Homepage

Keep the page to six decision-oriented sections:

1. Clear outcome-led hero and primary CTA
2. Problems DataBridges helps solve
3. Three entry offers
4. Work Decision Matrix, shown briefly
5. Selected, approved proof
6. Final CTA and expectation of what happens next

Resources, events and experimental products should not each become a homepage section by default.

## Services page

Help visitors self-select by problem:

| Visitor question | Destination |
|---|---|
| Can the right customers find and understand us? | Visibility |
| Where are time and attention being wasted? | Opportunity Map |
| Which stable work should be automated? | Automation |
| What controls do we need? | Governance |
| How do staff use this well? | Training |

Governance and training must appear as cross-cutting support, not the final steps of a forced funnel.

## Service-page contract

Every service page must contain:

- the buyer and problem;
- situations where the service is and is not suitable;
- what happens during the engagement;
- concrete outputs;
- supported proof or methodology;
- limitations and dependencies;
- an approved commercial next step.

Do not publish duration, price or outcome guarantees without approval.

## Work and proof

The Work index should launch with useful filtering only if enough approved cases exist. Each card and detail page must visibly distinguish:

- DataBridges client work;
- anonymised client work;
- prior employer context;
- independent research;
- teaching or training evidence.

Use `15_CASE_STUDY_AND_PROOF_STANDARD.md`.

## Resources

Resources exist to provide immediate value. Gating is optional, not the default.

Gate only when:

- delivery or follow-up genuinely requires an email address;
- the preview makes the exchange clear;
- access is not conditional on marketing consent;
- the data lifecycle in `09_LEAD_CAPTURE_AND_CRM.md` is implemented.

## Internal linking

Link based on the reader's next reasonable decision:

```text
Relevant proof -> matching service
Resource -> related service or conversation
Service -> proof and FAQ
Training or governance content -> matching offer
```

Avoid indiscriminate cross-linking and CTA repetition.

## Route release gate

A new route may be indexed only when it has:

- a named owner;
- a unique audience purpose;
- complete and reviewed content;
- metadata and canonical URL;
- appropriate structured data;
- accessible responsive rendering;
- a maintenance or review plan;
- no unresolved evidence or privacy blocker.
