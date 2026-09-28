---
title: DataBridges website operating specification
status: proposed
owner: unassigned
last_reviewed: 2026-09-28
approval: pending
milestone_0_status: active
milestone_0_approved: 2026-09-28
---

# DataBridges Website Operating Specification

## Purpose

This pack defines how the existing `databridges-website` repository should evolve. It is an operating specification, not proof that every proposed product or system should be built.

Revision 3 is approved as the working specification for Milestone 0 only. The
pack remains proposed for later milestones and is not publication, deployment
or protected-claim approval. The current repository, explicit user instructions
and production configuration remain authoritative where this pack has not been
activated.

## Authority order

When instructions conflict, use this order:

1. explicit instruction from the user or designated DataBridges owner;
2. applicable law, contract, privacy obligation or approved security policy;
3. root repository instructions such as `AGENTS.md` and `CLAUDE.md`;
4. an approved ticket or decision record;
5. normative documents in this pack;
6. existing implementation patterns;
7. suggestions and examples.

Do not silently resolve a material conflict. Record it and obtain a decision.

## Current repository baseline

The redesign must start from the repository that exists:

- Next.js 16 App Router under `src/app`;
- React 19 and Tailwind CSS 4;
- Netlify deployment using `@netlify/plugin-nextjs`;
- production branch currently named `master`;
- Decap CMS currently capable of committing content to `master`;
- existing public routes including `/services`, `/seo-aeo`, `/work`, `/events`, `/faq`, `/about` and `/contact`;
- no established automated test suite or staging environment at the time of this review.

A future ticket may change these facts. Documentation must be updated in the same change.

## Product model

The website has three jobs:

1. explain the consultancy clearly;
2. prove relevant capability without overstating evidence;
3. create qualified, consent-respecting commercial conversations.

Public data products are optional growth experiments. They are not prerequisites for a credible consultancy website.

## Service model

The service capabilities are:

- Visibility: help suitable organisations improve search and AI-search readiness.
- Improvement: diagnose operational friction and decide what should change.
- Automation: implement stable, worthwhile workflow improvements.
- Governance: apply appropriate controls before and during AI adoption.
- Training: build the capability required to use and govern systems well.

These capabilities are not a mandatory linear customer journey. Governance and training are cross-cutting and may be the first engagement.

## Work Decision Matrix

The methodology uses two decision dimensions:

- how much human judgement, accountability or relationship value the work contains;
- how suitable the process is for reliable automation.

This produces four treatments: `PROTECT`, `AUGMENT`, `AUTOMATE` and `SIMPLIFY_OR_ELIMINATE`.

Urgency and importance affect priority. They do not determine whether work is automatable. The canonical method is in `13_DATABRIDGES_AI_WORK_PHILOSOPHY.md`.

## Normative document map

| Decision area | Source |
|---|---|
| Commercial strategy and validation | `01_PRODUCT_STRATEGY.md` |
| Routes, navigation and migration | `02_INFORMATION_ARCHITECTURE.md` |
| Repository and data architecture | `03_TECHNICAL_ARCHITECTURE.md` |
| Coding-agent behaviour | `04_AGENTS.md` |
| Ticket contract | `05_TICKET_TEMPLATE.md` |
| Prioritised work | `06_BACKLOG.md` |
| Visibility Index experiment | `07_VISIBILITY_INDEX.md` |
| AI Tools Directory experiment | `08_AI_TOOLS_DIRECTORY.md` |
| Leads, consent and analytics | `09_LEAD_CAPTURE_AND_CRM.md` |
| Release and QA | `10_RELEASE_QA_AND_CHANGE_CONTROL.md` |
| Claims and publication controls | `11_CONTENT_AND_CLAIMS_GOVERNANCE.md` |
| Stage gates | `12_PHASED_ROADMAP.md` |
| Work Decision Matrix | `13_DATABRIDGES_AI_WORK_PHILOSOPHY.md` |
| Internal evidence inventory | `14_EVIDENCE_AND_CASE_STUDY_BANK.md` |
| Public proof format | `15_CASE_STUDY_AND_PROOF_STANDARD.md` |
| Pack revision record | `16_DOCS_CHANGE_SUMMARY.md` |

Normative definitions must exist in one document only. Other documents should link to them instead of restating enums, event names or rules.

## Execution record

`17_MILESTONE_0_AUDIT.md` records the verified Milestone 0 repository baseline,
implemented fixes and open decisions. It is evidence of execution, not a new
normative source.

## Delivery priorities

1. Correct inaccurate or risky current-site content.
2. Establish measurable positioning and conversion baselines.
3. Clarify service pages and proof.
4. Improve lead handling using the smallest reliable system.
5. Validate demand before building custom infrastructure.
6. Run private pilots before considering public data products.

## Activation checklist

Before this pack becomes active:

- [ ] a human owner approves the strategy and risk posture;
- [x] `04_AGENTS.md` is installed as the authoritative target of a root `AGENTS.md` pointer;
- [x] root instructions are reconciled with `CLAUDE.md` for Milestone 0;
- [ ] missing evidence sources are supplied through an access-controlled location;
- [ ] current route and redirect inventory is approved;
- [x] available validation commands are documented;
- [ ] public claims are reviewed against accessible sources;
- [ ] sensitive internal evidence is confirmed appropriate for this repository.

Do not label the pack canonical before these checks are complete.
