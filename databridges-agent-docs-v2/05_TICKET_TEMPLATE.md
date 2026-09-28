---
title: Delivery ticket template
status: proposed
owner: unassigned
last_reviewed: 2026-09-28
approval: pending
---

# Delivery Ticket Template

Use the core fields for every ticket. Complete conditional sections only when they apply. A two-line styling fix should not carry the ceremony of a data migration.

## Core metadata

| Field | Value |
|---|---|
| ID | `DB-XXX` |
| Title | Outcome-focused title |
| Status | `PROPOSED / READY / IN_PROGRESS / REVIEW / BLOCKED / DONE / CANCELLED` |
| Owner | Named person |
| Priority | `P0 / P1 / P2 / P3` |
| Risk | `LOW / MEDIUM / HIGH` |
| Milestone | Identifier from `12_PHASED_ROADMAP.md` |
| Dependencies | Ticket IDs or `NONE` |
| Approval gate | `NONE / LEVEL_2_REVIEW / LEVEL_3_PREAPPROVAL` |

## Outcome

Describe what will be observably true when the ticket is complete.

## Why now

State the user, commercial, operational or risk reason. Link the relevant hypothesis or defect.

## Current behaviour and evidence

Describe the current implementation. Include files, routes, screenshots, logs, research or baseline data where useful.

## In scope

- Item

## Out of scope

- Item

## Constraints and decisions already made

- Existing pattern or technical constraint
- Approved content/claim decision
- Browser, platform or release constraint

## Acceptance criteria

Write verifiable outcomes, not implementation steps.

- [ ] Given [state], when [action], then [observable result].
- [ ] Existing affected behaviour remains correct.
- [ ] Failure and empty states are defined where relevant.

## Expected change area

List likely files or systems. This is guidance, not a prohibition on discovering a necessary adjacent change.

```text
src/...
```

## Conditional: content and public claims

- Claim introduced or changed: `YES / NO`
- Evidence IDs:
- Accessible source location:
- Publication status:
- Exact approved wording, if constrained:
- Review/approval ID:
- Review expiry or next-review date:

## Conditional: data, privacy and security

Complete for forms, analytics, APIs, integrations, crawlers or stored records.

- data collected and purpose;
- lawful/approved handling basis to be confirmed by owner where required;
- consent record and withdrawal path;
- retention/deletion behaviour;
- access and secret handling;
- abuse, injection and rate-limit controls;
- external network or URL-fetching behaviour;
- logging and redaction;
- migration and rollback implications.

## Conditional: SEO, accessibility and analytics

- indexability, canonical, sitemap and redirect impact;
- metadata and structured-data impact;
- keyboard, semantics, focus, contrast and motion expectations;
- analytics events and allowed properties;
- baseline and success measure.

## Implementation notes

Record only decisions that meaningfully constrain the solution. Allow the implementer to inspect the repository and choose the smallest coherent design.

## Validation plan

| Check | Command or method | Required? |
|---|---|---:|
| Lint | `npm run lint` | Yes for code |
| Production build | `npm run build` | Yes for code unless environment blocks it |
| Targeted automated test | Configured command | When test infrastructure exists |
| Manual behaviour | Steps and expected result | When relevant |
| Accessibility | Keyboard/tool/manual check | For UI changes |
| Responsive/visual | Named widths or screenshots | For layout changes |
| Claims review | Evidence and approval check | For public claims |

Do not mark an unavailable test as passed. Record it as unavailable and create a follow-up where the gap is material.

## Rollout and rollback

- release mechanism;
- feature flag or disable path, if relevant;
- backward/forward compatibility for data changes;
- exact rollback action;
- monitoring signal and owner.

## Completion record

- [ ] Acceptance criteria met
- [ ] Required validation passed
- [ ] Required approval recorded
- [ ] Documentation updated with the implementation
- [ ] Claims and analytics verified where applicable
- [ ] Known limitations and follow-ups recorded
