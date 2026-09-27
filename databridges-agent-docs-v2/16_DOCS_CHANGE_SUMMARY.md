---
title: Documentation redesign record
status: proposed
owner: DataBridges
last_reviewed: 2026-09-27
approval: pending
revision: 3
---

# Documentation Redesign Record

## Scope

On 2026-09-27, the 17-file website documentation pack was redesigned after an adversarial consistency and implementation-readiness review.

This revision changes documentation only. It does not approve public claims, publish routes, create infrastructure, install root `AGENTS.md`, deploy code or authorize the experimental products.

## Problems addressed

The previous pack:

- called documents canonical before they were installed or approved;
- contradicted the actual `master`/Netlify/Decap workflow;
- described a greenfield repository rather than `src/app` and the current stack;
- required tests and staging that did not exist;
- contained incompatible case-study and analytics contracts;
- treated a service taxonomy as a compulsory customer journey;
- used importance and urgency as proxies for automation suitability;
- planned public scoring and outreach before risk and methodology gates;
- referenced missing evidence sources while treating summaries as usable proof;
- provided a large feature backlog without ownership, metrics or stop conditions.

## Material redesigns

### `00_README.md`

Added authority order, current-repository baseline, normative document map and activation checklist. Pack status is `proposed`, not canonical.

### `01_PRODUCT_STRATEGY.md`

Converted positioning copy into a testable commercial strategy with audience hypotheses, buyer problems, offer architecture, commercial measurements and expansion gates.

### `02_INFORMATION_ARCHITECTURE.md`

Reduced navigation, preserved current routes, added migration rules and kept experimental products out of public IA until approved.

### `03_TECHNICAL_ARCHITECTURE.md`

Aligned architecture with Next.js under `src`, Netlify and Decap. Added one canonical case-study contract, real environments, operational requirements and a materially stronger scanner boundary.

### `04_AGENTS.md`

Added authority precedence, dirty-worktree preservation, actual branch/check rules, clearer permission timing and evidence safeguards.

### `05_TICKET_TEMPLATE.md`

Added owner, status, priority, risk, milestone and approval metadata. Made specialist sections conditional and validation honest about unavailable tests.

### `06_BACKLOG.md`

Replaced 74 mostly title-only items with 27 dependency-aware outcomes across four gated milestones and continuous release work.

### `07_VISIBILITY_INDEX.md`

Reclassified the Index as an unapproved experiment. Added private-first gates, scoring/missing-data rules, sampling discipline, conflict-of-interest safeguards and stop conditions.

### `08_AI_TOOLS_DIRECTORY.md`

Reclassified the directory as an editorial experiment. Added a coherent record schema, pilot size, source qualification, review ownership, affiliate disclosure and maintenance release gate.

### `09_LEAD_CAPTURE_AND_CRM.md`

Made simple managed delivery the default. Added auditable consent, withdrawal/suppression, canonical events, privacy-safe properties, idempotency, retry and data-lifecycle requirements.

### `10_RELEASE_QA_AND_CHANGE_CONTROL.md`

Aligned release flow with `master` and Netlify deploy previews, documented the CMS exception and made QA continuous and change-specific.

### `11_CONTENT_AND_CLAIMS_GOVERNANCE.md`

Added exact claim, source and approval records; expiry and withdrawal behaviour; build enforcement; and explicit handling for unavailable evidence.

### `12_PHASED_ROADMAP.md`

Replaced a feature sequence with outcome gates, validation evidence, portfolio constraints and explicit stop/private/public experiment decisions.

### `13_DATABRIDGES_AI_WORK_PHILOSOPHY.md`

Replaced urgency/importance as automation axes with human criticality and automation suitability. Urgency and importance are now a priority overlay.

### `14_EVIDENCE_AND_CASE_STUDY_BANK.md`

Removed named and exact restricted details from the working inventory, marked unavailable-source records `UNVERIFIED`, and added source, verification and repository-handling controls.

### `15_CASE_STUDY_AND_PROOF_STANDARD.md`

Aligned the standard with the canonical schema, required visible context labels and replaced a one-dimensional evidence hierarchy with directness, verification, relevance and permission.

## Deliberately deferred

- exact offer names, prices and duration;
- numeric conversion targets before a baseline;
- CRM, email, analytics and database vendors;
- staging environment and automated-test framework;
- public Index methodology weights and thresholds;
- public AI Tools Directory launch;
- named or quantitative case-study claims.

These are decisions requiring evidence or ownership, not documentation gaps to fill by invention.

## Required human decisions

1. Approve, amend or reject this revision.
2. Decide whether internal evidence belongs in this repository.
3. Provide controlled access to the missing evidence sources.
4. Choose the primary audience/problem/entry-offer hypothesis to validate.
5. Approve route migration and offer naming.
6. Decide whether to install `04_AGENTS.md` as the root instruction source.
7. Assign owners to lead operations and any product experiment.
8. Decide whether Decap direct-to-`master` publishing remains acceptable.
9. Fund and choose the test/CI baseline.

## Activation and versioning

When approved:

- change pack status from `proposed` to `active` where appropriate;
- record approver, date and revision;
- install the root agent instructions without creating two manually maintained sources;
- update `CLAUDE.md` where the new operating rules supersede it;
- create the first milestone tickets;
- record future material changes here or in an ADR, not as an untraceable rewrite.

Until then, this revision is a proposal and must not be treated as publication approval.
