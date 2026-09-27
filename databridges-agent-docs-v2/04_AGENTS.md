---
title: Repository agent instructions
status: proposed
owner: DataBridges
last_reviewed: 2026-09-27
approval: pending
---

# DataBridges Repository Agent Instructions

This file is the source for a future root `AGENTS.md`. Do not maintain independent versions. Generate or copy it during pack activation and add a review check that detects drift.

## Authority

Follow the authority order in `00_README.md`. An explicit user instruction may supersede a ticket or proposed document. Legal, privacy, contractual and security obligations still apply.

## Before changing code or content

1. Read the request and applicable ticket.
2. Inspect the current implementation and root repository instructions.
3. Check Git status and preserve unrelated user changes.
4. Identify affected routes, data, claims and deployment behaviour.
5. Reuse existing patterns when they remain appropriate.
6. Report a material contradiction rather than silently choosing one.

## Scope

- Make the smallest coherent change that satisfies the approved outcome.
- Do not change unrelated files or reformat broad areas without need.
- Do not add a dependency without a concrete reason and maintenance assessment.
- Do not restructure the repository merely to match a proposed diagram.
- Do not invent infrastructure, environments, credentials or tests that do not exist.

## Protected claims and evidence

Do not invent or materially strengthen:

- client or employer outcomes;
- testimonials, credentials or employment details;
- quantitative results, ROI or causality;
- legal, regulatory, security or compliance claims;
- price, duration or availability;
- named-client permission;
- Visibility Index scores or methodology.

Use only evidence whose source is accessible and whose publication status permits the proposed wording. `REQUIRES_APPROVAL`, `INTERNAL_ONLY` and `UNVERIFIED` evidence cannot be published without the required decision.

## Human-centred system design

For AI or automation work, explicitly consider:

- whether the work should exist;
- human judgement, accountability and relationship value;
- process stability, volume and exceptions;
- failure impact and reversibility;
- data sensitivity and access;
- monitoring and escalation;
- how released capacity will be used.

Do not classify work from importance and urgency alone. Use `13_DATABRIDGES_AI_WORK_PHILOSOPHY.md`.

## Accessibility and content

- Preserve keyboard access, semantic structure, focus visibility and reduced-motion behaviour.
- Do not rely on colour alone.
- Keep visible FAQ content and structured data consistent.
- Use existing design tokens. Current accent token is cyan, not an invented parallel teal system.
- Avoid unnecessary animation and new visual dependencies.

## Security and privacy

- Validate untrusted input on the server where applicable.
- Keep secrets out of client bundles, logs and commits.
- Do not send form contents or personal data to analytics.
- Rate-limit and abuse-protect public write endpoints.
- Treat arbitrary URL fetching as a high-risk capability subject to `03_TECHNICAL_ARCHITECTURE.md`.
- Do not alter retention, deletion, authentication, consent or production environment variables without the required approval.

## Permission levels

### Level 1: implement and submit for normal review

- styling and layout;
- accessible component changes;
- tests;
- copy using already-approved evidence;
- internal refactoring with no public contract change.

### Level 2: implement, but require human review before merge

- APIs and server-side handlers;
- analytics events;
- SEO templates and structured data;
- database queries without schema change;
- CRM/email integrations;
- crawler code against fixed, approved test targets;
- publication-ready case-study copy.

### Level 3: obtain explicit approval before implementation

- schema migrations or destructive data behaviour;
- authentication, payments or account access;
- privacy/legal text or consent policy;
- production environment variables or deployment;
- arbitrary-URL scanning;
- public scoring methodology or public business profiles;
- named-client publication;
- new quantitative public claims.

Approval to implement is not approval to deploy or publish.

## Branch and deployment rules

- The current production branch is `master`.
- Use a feature/fix branch for code work unless explicitly instructed otherwise.
- Never push or deploy without authorization.
- Use the Netlify deploy preview for review when available.
- Treat direct Decap CMS commits as the existing content-workflow exception, not the model for code changes.

## Validation

Run the checks the repository actually provides and those relevant to the change.

Current baseline:

```text
npm run lint
npm run build
```

Run TypeScript, unit, integration, E2E, accessibility or visual tests only when the corresponding configured command or approved tool exists. Absence of a test system is a limitation to report, not a reason to claim tests passed.

## Completion report

Report:

1. outcome achieved;
2. files changed;
3. important decisions and assumptions;
4. checks run and exact results;
5. checks not available or not run, with reason;
6. public claims or evidence IDs affected;
7. privacy, data or migration impact;
8. known limitations and required human decisions.

Never claim completion, approval, publication or deployment that did not occur.
