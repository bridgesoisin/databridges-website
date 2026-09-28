---
title: AI tools directory experiment
status: experimental
owner: unassigned
last_reviewed: 2026-09-28
approval: required-before-build
---

# AI Tools Directory Experiment

## Decision status

The directory is optional. It should proceed only if a small editorial pilot demonstrates differentiated user value and affordable maintenance.

## User promise

Help a defined audience decide whether a tool fits a real work problem, what should remain human-led, and what risks or administrative burden the tool introduces.

The directory must not become a generic catalogue, scraped SEO inventory or substitute for vendor due diligence.

## Pilot

Manually curate 20–30 tools for one or two validated audiences. Measure:

- useful visits and onward actions;
- user questions the profiles actually answer;
- editorial time per record and per review cycle;
- frequency of material vendor changes;
- ability to verify tier-, region- and date-specific claims;
- whether the content generates qualified consulting demand.

Stop if the content is indistinguishable from vendor summaries or cannot be maintained.

## Canonical record

```typescript
type ToolWorkflowState =
  | "DISCOVERED"
  | "VERIFYING"
  | "READY_FOR_EDITORIAL"
  | "PUBLISHED"
  | "NEEDS_REVIEW"
  | "ARCHIVED"

type ToolClaimSource = {
  url: string
  publisher: string
  retrievedAt: string
  supports: string[]
  appliesToTier?: string
  appliesToRegion?: string
}

type AIToolRecord = {
  schemaVersion: 1
  id: string
  slug: string
  name: string
  officialUrl: string
  description: string
  categories: string[]
  useCases: string[]
  bestFor: string[]
  limitations: string[]
  avoidWhen: string[]
  humanRole: string
  integrations: string[]
  pricingSummary: string | null
  pricingReviewedAt: string | null
  dataHandlingNotes: string | null
  securityNotes: string | null
  practicalNotes: string
  alternatives: string[]
  sources: ToolClaimSource[]
  workflowState: ToolWorkflowState
  reviewedAt: string | null
  reviewDueAt: string | null
  reviewedBy: string | null
  approvalId: string | null
  affiliateRelationship: string | null
}
```

Use strings for serialized dates. Do not use an optional date for a field required at publication.

## Publication requirements

A record cannot be `PUBLISHED` without:

- official identity and URL;
- concise original description;
- supported use cases, limitations and audience fit;
- explicit human role where judgement matters;
- date- and tier-qualified pricing wording where included;
- relevant data/security caveats without compliance guarantees;
- sources tied to material factual claims;
- reviewer, review date, due date and approval ID;
- disclosure of any affiliate or commercial relationship.

Vendor documentation is evidence of what the vendor states, not independent proof that a security or performance claim is true.

## Review workflow

```text
Discovery
-> source verification
-> original editorial assessment
-> human review
-> approval record
-> publication
-> scheduled or event-driven review
-> update, flag or archive
```

Discovery and automation may propose records. They may not publish them.

Review frequency should reflect volatility. Pricing and feature availability may need shorter cycles than stable descriptive content. When the due date passes, remove or visibly flag time-sensitive claims until reviewed.

## Taxonomy rules

- Keep categories controlled and few enough to browse.
- Add a filter only when enough published records support it.
- Do not index arbitrary filter combinations.
- Treat “augmentation” and “automation” as contextual judgements, not permanent properties of a tool.
- Record product tier and region whenever they materially change a claim.

## Editorial independence

- No payment may buy a better assessment.
- Sponsored or affiliate relationships must be visible.
- Vendors may propose factual corrections but may not approve DataBridges judgement.
- Logos and brand assets require an approved usage basis.
- Archive products that cannot be verified or maintained.

## Release gate

Public release requires a named editorial owner, demonstrated maintenance capacity, approved taxonomy, working stale-content behaviour, accessible source display and evidence that the pilot serves a real audience better than a small set of conventional guides.
