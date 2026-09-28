---
title: Content, evidence and claims governance
status: proposed
owner: unassigned
last_reviewed: 2026-09-28
approval: pending
---

# Content, Evidence and Claims Governance

## Purpose

Ensure public wording is traceable to accessible evidence, authorized for its context and reviewed when facts change.

Publication and context enums are defined once in `03_TECHNICAL_ARCHITECTURE.md`.

## Fundamental rule

A plausible statement is not evidence. A source file is not publication permission. An anonymised statement can still be identifiable.

If the source cannot be accessed, the claim is `UNVERIFIED` regardless of how carefully it was summarized previously.

## Claim record

Every protected or quantitative public claim requires a record with:

```yaml
schemaVersion: 1
id: CLAIM-EXAMPLE
exactWording: "Approved public wording"
allowedContexts:
  - /work/example
evidenceIds:
  - EVID-EXAMPLE
publicationStatus: REQUIRES_APPROVAL
owner: null
reviewedAt: null
reviewDueAt: null
approvalId: null
approvedBy: null
approvedAt: null
limitations: []
withdrawnAt: null
withdrawalReason: null
```

Store this register only after its location and schema validator are approved. Do not create a nominal `claims.yml` that nothing validates or consumes.

## Publication-status behaviour

- `PUBLIC`: exact wording/context has accessible support and recorded approval where required.
- `PUBLIC_ANONYMISED`: public use is limited to an approved non-identifying description.
- `REQUIRES_APPROVAL`: evidence may exist, but public wording or context is not yet authorized.
- `INTERNAL_ONLY`: never use in public output.
- `UNVERIFIED`: source is missing, conflicting or insufficient; do not publish.

Named-client permission and quantitative-claim approval are separate decisions. One does not imply the other.

## Protected content

Require evidence and appropriate human review for:

- named clients or employers;
- credentials, titles and employment dates;
- metrics, time savings, accuracy, scale, ROI and causality;
- testimonials and quotations;
- legal, regulatory or compliance statements;
- security and data-processing promises;
- price, duration and availability;
- “best”, “leading” and comparison claims;
- public Index scores and methodology.

## Source requirements

An evidence source record must include:

- stable source identifier and controlled location;
- owner or custodian;
- date obtained and date last verified;
- access classification;
- relevant excerpt, page, section or query—not an entire sensitive file by default;
- limits on public use;
- checksum or version where silent source change matters;
- expiry/review trigger.

Do not store credentials, personal contact details, private correspondence or unnecessary client data in the website repository.

## Approval record

An approval must state:

- approval ID;
- approver and authority;
- exact claim or evidence item;
- permitted name/anonymisation level;
- permitted page/channel;
- approval date and review/expiry date;
- conditions and revocation route.

“Human reviewed” without these details is not an auditable approval.

## Employer and prior-work evidence

- Never imply prior employer work was delivered by DataBridges.
- Confirm contractual/confidentiality constraints before public use.
- Show a visible public context label, not merely internal metadata.
- Prefer capability/method statements over internal operational detail.
- Do not publish exact outcomes until source, causality and permission are verified.

## Quantitative claims

Preserve:

- unit and population;
- time period;
- sample and validation method;
- comparator or baseline;
- uncertainty and material limitation;
- distinction between observed, estimated and expected results;
- distinction between correlation, contribution and causation.

Do not convert ticket counts to effort, design to deployment, forecast accuracy to business outcome, or a model comparison to a universal superiority claim.

## Time-sensitive content

Set `reviewDueAt` for content such as regulation, product pricing, integrations, availability and security features. On expiry, remove, soften or visibly flag the affected fact until it is reviewed.

A review date alone is insufficient if there is no owner or stale-state behaviour.

## Corrections and withdrawal

When a claim becomes unsupported or permission is withdrawn:

1. remove or correct public wording promptly;
2. preserve the decision record;
3. update dependent pages and structured data;
4. assess cached, syndicated or campaign copies;
5. record reason, owner and date;
6. trigger review of related claims from the same evidence.

## Build and editorial enforcement

Publication tooling should fail or block when:

- a protected claim lacks required fields;
- an evidence ID is missing;
- status does not permit publication;
- required approval is absent or expired;
- a context label is missing;
- structured data contains stronger wording than the visible page.

Automation may detect and propose. It may not approve its own claim.

## Writing standard

Prefer specific, bounded language:

> Compared several forecasting approaches across repeated out-of-sample windows for a defined four-week planning horizon.

Avoid inflated language:

> Used state-of-the-art AI to predict the future.

Use the strongest statement the evidence supports, no stronger.
