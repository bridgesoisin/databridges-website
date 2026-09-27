---
title: Prioritised implementation backlog
status: working
owner: DataBridges
last_reviewed: 2026-09-27
approval: pending
---

# Prioritised Implementation Backlog

This is a prioritised index, not a substitute for delivery tickets. An item becomes `READY` only after it is expanded with `05_TICKET_TEMPLATE.md`, assigned an owner and given verifiable acceptance criteria.

## Priority definitions

- `P0`: current safety, trust or production blocker;
- `P1`: required for the next approved milestone;
- `P2`: useful after evidence supports it;
- `P3`: experiment or optional enhancement.

## Milestone 0: authority and risk baseline

| ID | Priority | Outcome | Depends on | Risk |
|---|---:|---|---|---|
| DB-001 | P0 | Approve, amend or reject this operating pack and name its owner | None | Medium |
| DB-002 | P0 | Decide whether internal evidence is permitted in this repository; move or redact it if not | DB-001 | High |
| DB-003 | P0 | Supply accessible evidence sources and mark every evidence record verified or unavailable | DB-002 | High |
| DB-004 | P0 | Reconcile root instructions and install a non-divergent `AGENTS.md` | DB-001 | Medium |
| DB-005 | P0 | Audit current public claims, forms, privacy text, CTAs and broken routes | DB-003 | High |
| DB-006 | P1 | Document the current analytics/conversion baseline or explicitly record that none exists | None | Low |
| DB-007 | P1 | Add a documented typecheck/test strategy and CI decision | DB-001 | Medium |

Exit: instructions are active, sensitive evidence is controlled, and no known critical trust defect remains unowned.

## Milestone 1: proposition and route foundation

| ID | Priority | Outcome | Depends on | Risk |
|---|---:|---|---|---|
| DB-008 | P1 | Validate primary audience, buyer problem and entry offer through existing sales evidence or interviews | DB-006 | Medium |
| DB-009 | P1 | Approve the target route and redirect map for existing URLs | DB-005, DB-008 | Medium |
| DB-010 | P1 | Define approved offer names, scope, owner and commercial CTA | DB-008 | Medium |
| DB-011 | P1 | Implement build-time validation for case-study and claim metadata | DB-003 | Medium |
| DB-012 | P1 | Establish reusable accessible page/CTA patterns using current design tokens | DB-009 | Low |

Exit: one target audience and offer are supported by evidence; route migration is explicit; content contracts can fail safely.

## Milestone 2: core consultancy experience

| ID | Priority | Outcome | Depends on | Risk |
|---|---:|---|---|---|
| DB-013 | P1 | Rewrite the homepage around problems, entry offers, approved proof and one primary CTA | DB-010, DB-012 | Medium |
| DB-014 | P1 | Improve `/services` and add only approved service detail routes | DB-009, DB-010, DB-012 | Medium |
| DB-015 | P1 | Publish the first approved case study and visibly label its context | DB-003, DB-011 | High |
| DB-016 | P2 | Refine About copy to relevant, verified capability rather than chronology | DB-003 | Medium |
| DB-017 | P1 | Verify contact/enquiry delivery, consent language, failure states and anti-abuse controls | DB-005 | High |
| DB-018 | P2 | Pilot one genuinely useful resource, ungated unless email delivery is necessary | DB-010, DB-017 | Medium |

Exit: a visitor can understand the offer, inspect approved proof and complete a reliable commercial next step.

## Milestone 3: measurement and lead operations

| ID | Priority | Outcome | Depends on | Risk |
|---|---:|---|---|---|
| DB-019 | P1 | Implement the minimal canonical analytics events with privacy-safe properties | DB-006, DB-017 | Medium |
| DB-020 | P2 | Select the smallest suitable CRM/form architecture using an ADR | DB-017 | High |
| DB-021 | P2 | Add reliable CRM/email synchronization only if volume or workflow evidence justifies it | DB-020 | High |
| DB-022 | P2 | Review conversion and lead quality; decide what to improve or remove | DB-013 through DB-021 | Low |

Exit: qualified demand and conversion can be measured without an unnecessary custom platform.

## Milestone 4: optional product experiments

| ID | Priority | Outcome | Depends on | Risk |
|---|---:|---|---|---|
| DB-023 | P3 | Approve a Visibility Index research question, threat model and publication-risk owner | DB-022 | High |
| DB-024 | P3 | Run a private Index pilot against owned or explicitly approved targets | DB-023 | High |
| DB-025 | P3 | Make a documented stop/private/public decision for the Index | DB-024 | High |
| DB-026 | P3 | Pilot a manually maintained set of 20–30 AI tools and measure maintenance effort and user value | DB-022 | Medium |
| DB-027 | P3 | Make a documented stop/private/public decision for the tools directory | DB-026 | Medium |

No public profile, ranking, arbitrary-URL scanner or large tool import is authorized by its presence in this backlog.

## Continuous release work

Every implementation ticket includes relevant accessibility, security, SEO, responsive, analytics and rollback checks. Do not defer these into a final hardening phase.

## Backlog hygiene

At each milestone review:

- close or cancel work whose hypothesis failed;
- split work that cannot be reviewed safely as one change;
- remove unowned items;
- update dependencies and risk;
- avoid adding implementation detail before an item is likely to be funded.
