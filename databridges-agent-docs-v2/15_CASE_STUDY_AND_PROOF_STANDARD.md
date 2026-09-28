---
title: Case study and proof standard
status: proposed
owner: unassigned
last_reviewed: 2026-09-28
approval: pending
---

# Case Study and Proof Standard

## Purpose

Show relevant capability with enough evidence and limitation for a reader to understand what was actually done. A case study is not a CV entry, sales adjective or reconstructed client claim.

Use the canonical metadata contract in `03_TECHNICAL_ARCHITECTURE.md` and the approval rules in `11_CONTENT_AND_CLAIMS_GOVERNANCE.md`.

## Publication gate

A case may publish only when:

- every material claim maps to accessible evidence;
- publication status permits the exact wording and context;
- required client/employer and quantitative approvals are recorded;
- limitations and contribution boundaries are included;
- a visible public context label is present;
- the record passes schema validation.

`REQUIRES_APPROVAL`, `INTERNAL_ONLY` and `UNVERIFIED` are not publishable states.

## Visible context labels

Use plain public language such as:

- DataBridges client work
- Anonymised DataBridges client work
- Prior employer experience
- Independent research
- Teaching and training

Do not rely on internal metadata to prevent misattribution.

## Required structure

### 1. Reader relevance

State who may recognize the problem and why it matters.

### 2. Context

Give the minimum information needed to understand constraints. Avoid unnecessary organizational detail.

### 3. Problem and baseline

Describe the prior state with a supported baseline where one exists. If no reliable baseline exists, say so.

### 4. Role and scope

State what DataBridges or the individual actually did and did not do. Distinguish discovery, design, prototype, implementation, deployment and ongoing operation.

### 5. Method

Explain the material process, data and evaluation method. Include rejected options when they demonstrate judgement.

### 6. Human and system responsibilities

For AI or automation, show where people review, decide, communicate, override and remain accountable.

### 7. Result or implication

Use one of these explicitly:

- observed result;
- client/employer-reported result;
- analytical finding;
- expected benefit not yet measured;
- recommendation only.

Do not present expected benefits as achieved outcomes.

### 8. Evidence

Link each protected statement to an Evidence ID and, through the evidence register, an accessible source and approval.

### 9. Limitations

State what the work does not establish, missing data, restricted applicability and remaining risk.

### 10. Relevant next step

Use a restrained CTA that matches the demonstrated capability. Do not force a sales CTA onto sensitive employer or research material.

## Evidence quality assessment

Do not use one simplistic hierarchy. Assess evidence across four dimensions:

| Dimension | Weak | Strong |
|---|---|---|
| Directness | inferred or recalled | direct source/output |
| Verification | unreviewed | independently or reproducibly checked |
| Relevance | loosely related | directly supports the public wording |
| Permission | unclear | scoped approval recorded |

A precise metric with unclear permission is not publishable. A deployed workflow without a quantified result may still be strong implementation evidence.

## Quantitative proof

Include, as applicable:

- exact unit and period;
- sample/population;
- calculation and source;
- baseline/comparator;
- validation method;
- uncertainty or observed variation;
- limitations and causal boundary.

Examples of prohibited transformations:

- ticket volume -> technician effort;
- model error metric -> financial return;
- design/prototype -> deployed outcome;
- contribution -> sole cause;
- one client result -> universal expectation.

## Forecasting and analytical cases

State:

- history and target variable;
- forecast horizon;
- validation windows and leakage controls;
- baseline comparators;
- metric definition;
- result variation, not only the best number;
- operational decision supported;
- limitations and monitoring plan.

Model brand names are implementation detail, not the outcome.

## AI and automation cases

State:

- original process and burden;
- why work was protected, augmented, automated or simplified;
- system boundaries and data sensitivity;
- human review and exception handling;
- failure/recovery path;
- deployment state;
- observed versus expected benefit;
- ongoing owner and monitoring where operational.

## Discovery cases

An opportunity map is not an implementation. Show problems examined, decision criteria, prioritized opportunities, risks, rejected ideas and the reason for the recommendation.

## Anonymisation review

Removing a name is not sufficient. Consider whether sector, location, dates, scale, technology, unusual events or exact numbers could identify the organisation when combined.

## Structured data and summaries

Card copy, metadata, social previews and structured data must not be stronger than the full case. Generate them from the same approved record where practical.

## Final checklist

- [ ] Schema is valid
- [ ] Visible context label is accurate
- [ ] Source evidence is accessible
- [ ] Publication and approval records permit use
- [ ] Named-client decision is explicit
- [ ] Scope and personal contribution are clear
- [ ] Deployment state is accurate
- [ ] Quantitative claims preserve unit, method and caveat
- [ ] Employer work is not presented as DataBridges work
- [ ] Human accountability is clear
- [ ] Limitations are material, not ceremonial
- [ ] Sensitive and re-identifying detail is removed
- [ ] Summaries and structured data match the approved claim
- [ ] Review/expiry trigger is recorded
