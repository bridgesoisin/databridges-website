---
title: Release, QA and change control
status: proposed
owner: unassigned
last_reviewed: 2026-09-28
approval: pending
---

# Release, QA and Change Control

## Current delivery model

The production branch is `master`.

```text
feature or fix branch
-> pull request
-> configured checks
-> Netlify deploy preview
-> human review
-> merge to master
-> Netlify production deployment
-> post-release verification
```

Do not document or depend on `main`, `develop` or staging until they exist.

## CMS exception

Decap CMS currently commits selected content directly to `master`. Treat this as an explicit operational exception:

- restrict CMS access;
- keep collections narrowly scoped;
- validate content at build time;
- retain Git history for recovery;
- review whether editorial workflow or preview branches are warranted;
- never use the CMS path for code, secrets or sensitive evidence.

## Change classes

### Low risk

Copy, styling or component changes with no protected claim, data, route or public contract impact.

### Medium risk

Routes, structured data, analytics, APIs, forms, integrations or publication-ready evidence.

### High risk

Authentication, payments, schema migrations, deletion, consent/privacy behaviour, arbitrary URL fetching, public scoring, named clients, quantitative claims or production configuration.

High-risk changes require explicit preapproval and a named rollback/disable path.

## Validation baseline

Current configured commands:

```text
npm run lint
npm run build
```

If a ticket adds an automated test system, add a stable package script and update this document in the same change. Do not report an absent unit, integration or E2E suite as passing.

## Pull-request evidence

Every code pull request should record:

- linked ticket and intended outcome;
- risk class;
- material files/routes changed;
- screenshots or preview links for UI work;
- exact checks run and results;
- claims/evidence impact;
- data, privacy and migration impact;
- rollback or disable method;
- unresolved limitation or approval.

## QA by change type

### UI and content

- responsive layout at representative narrow, medium and wide widths;
- keyboard order, focus visibility and accessible names;
- reduced-motion behaviour where animation changes;
- semantic heading structure and non-colour cues;
- approved claims and context labels;
- no unexpected overflow or layout shift.

### Routes and SEO

- status code and redirect behaviour;
- title, description, canonical and sitemap;
- index/noindex decision;
- structured data matches visible content;
- existing inbound route is preserved or redirected;
- links and 404 handling.

### Forms and integrations

- validation, abuse protection and accessible errors;
- success, failure, retry and duplicate submission;
- transactional delivery and consent separation;
- analytics allowlist contains no personal values;
- downstream failure is observable;
- deletion/suppression behaviour where applicable.

### Data changes

- forward and backward compatibility;
- backup or export requirement;
- migration rehearsal on non-production data;
- rollback versus roll-forward decision;
- access and retention changes;
- post-release integrity check.

### Scanner or external fetch work

- all controls in `03_TECHNICAL_ARCHITECTURE.md`;
- approved fixed targets before arbitrary inputs;
- security review and resource limits;
- malformed URL, redirect, DNS and oversized-response tests;
- disable switch and cost limit.

## Release gate

Before merge to `master`:

- [ ] acceptance criteria met;
- [ ] configured required checks passed;
- [ ] deploy preview reviewed when available;
- [ ] required Level 2/3 review recorded;
- [ ] claims and evidence approved where applicable;
- [ ] migration and rollback reviewed where applicable;
- [ ] documentation reflects the implemented state.

Before or immediately after production release:

- [ ] named owner is available for high-risk changes;
- [ ] critical path smoke-tested;
- [ ] error/health signal checked;
- [ ] rollback trigger and action remain valid;
- [ ] release result recorded.

## Production authority

Agents may prepare changes and report readiness. They must not push, merge, alter production configuration, publish protected claims or deploy without explicit authorization.

## Rollback principles

- Code/content-only releases should identify the last known-good commit.
- Data migrations need an explicit roll-forward/rollback strategy; reverting code alone may be unsafe.
- External emails, analytics events and public crawls are not undone by Git reversal.
- Public claim corrections should preserve an audit trail rather than silently rewriting history.

## Architecture decision records

Store material ADRs under `docs/decisions/` only after that directory is created by an approved ticket.

```markdown
# ADR-XXX: Decision

- Status: proposed / accepted / superseded
- Owner:
- Date:
- Review date:

## Context
## Options and evidence
## Decision
## Consequences and risks
## Rollback or revisit trigger
```

## Hotfixes

A hotfix may reduce ceremony but not authority. Record the incident, exact change, checks possible under the circumstances, approver, production result and required follow-up.
