---
title: Visibility Index experiment specification
status: experimental
owner: unassigned
last_reviewed: 2026-09-27
approval: required-before-build
---

# Visibility Index Experiment Specification

## Decision status

The Visibility Index is an unapproved experiment. This document does not authorize arbitrary crawling, public business profiles, rankings or outreach.

## Research question

Can a transparent website diagnostic help a defined type of organisation understand a small set of observable visibility problems better than a conventional audit, without creating misleading comparisons or coercive sales pressure?

If the answer is not demonstrated in a private pilot, stop.

## Non-goals

The Index does not measure:

- business quality, customer service or legal compliance;
- guaranteed search or AI-system performance;
- overall marketing effectiveness;
- private systems or non-public content;
- a statistically representative national benchmark unless a suitable sampling design is separately approved.

## Stage gates

### Gate 0: justification

Require a named product owner, target user, commercial hypothesis, maintenance budget, risk owner and stop condition.

### Gate 1: methodology

Before code, define each metric's:

- observable input;
- applicability rule;
- evaluator and threshold;
- awarded and maximum points;
- evidence captured;
- known failure modes;
- category and weight;
- human-review trigger.

### Gate 2: secure prototype

Run only against DataBridges-owned or explicitly approved test sites. Complete the scanner security requirements in `03_TECHNICAL_ARCHITECTURE.md`.

### Gate 3: private pilot

Use a small, documented sample. Keep results private. Measure disagreement, false detection, missing data, maintenance time and whether users find the output useful.

### Gate 4: publication decision

Public release requires explicit approval after methodology, security, privacy, brand/reputation and correction-process review. Private usefulness does not imply public-ranking justification.

## Methodology contract

```typescript
type MetricResultCode =
  | "PASS"
  | "PARTIAL"
  | "FAIL"
  | "NOT_APPLICABLE"
  | "NOT_OBSERVED"
  | "SCAN_ERROR"

type EvidenceType = "OBSERVED" | "DERIVED" | "MODEL_ASSISTED"

type MetricDefinition = {
  id: string
  version: number
  categoryId: string
  description: string
  applicabilityRule: string
  evaluationRule: string
  maxPoints: number
  evidenceType: EvidenceType
  limitations: string[]
  humanReviewWhen: string[]
}

type MetricResult = {
  metricId: string
  metricVersion: number
  result: MetricResultCode
  points: number | null
  maxPoints: number | null
  evidence: unknown
  explanation: string
  reviewedBy: string | null
}
```

`NOT_APPLICABLE` is excluded from the denominator. `NOT_OBSERVED` is not automatically a failure unless the published rule says the signal should be observable. `SCAN_ERROR` must never reduce a score.

## Scoring

For each category:

```text
category score = awarded points / applicable maximum points
```

Overall score:

```text
sum(category score × category weight) / sum(applicable category weights)
```

Publish coverage alongside any score. Do not publish an overall score when coverage is below an approved threshold. Weights, thresholds and rules are versioned methodological judgements, not measured truths.

Do not compare or rank sectors until the methodology owner demonstrates that the measures and coverage are comparable.

## Evidence and model use

Code applies the published scoring rule. A model may classify or explain only where the metric explicitly permits `MODEL_ASSISTED` evidence. Store model/version and a review trigger. Never ask a model for an ungrounded score.

## Sampling and selection

Record:

- target population and sector definition;
- inclusion/exclusion criteria;
- discovery source;
- selection date;
- duplicate and ownership handling;
- known coverage bias;
- whether the sample supports description, comparison or neither.

A commercially selected convenience sample must not be described as an Irish benchmark.

## Public-governance requirements

Before any public profile exists, define:

- representative verification;
- free correction, rescan, appeal and takedown channels;
- response and adjudication ownership;
- version history and stale-result expiry;
- handling of ownership changes and dead domains;
- a clear distinction between factual corrections and methodological disagreement;
- audit trail for edits and decisions;
- wording and selection review by an appropriately qualified owner.

Businesses must not be able to overwrite observed evidence, but DataBridges must correct demonstrably wrong data promptly.

## Commercial independence

Scoring and corrections must not depend on buying a service. Sales staff must not control appeal outcomes. Outreach must not imply that payment is required to repair, suppress or improve a public score.

If this separation is not credible for a small operator, keep the product private and use it as an audit method rather than a public ranking system.

## Safe public language

Prefer descriptions of detected website signals. Avoid humiliating labels, “worst” lists and claims about the underlying business. Display scan date, methodology version, coverage, limitations and correction route next to any result.

## Stop conditions

Stop or keep private if:

- disagreement or scan-error rates undermine trust;
- meaningful sector comparison cannot be justified;
- correction workload is not supportable;
- security controls cannot be isolated adequately;
- public publication creates disproportionate reputational or privacy risk;
- the diagnostic does not produce user value beyond an ordinary private audit.
