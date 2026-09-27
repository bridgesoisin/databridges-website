---
title: DataBridges Work Decision Matrix
status: proposed
owner: DataBridges
last_reviewed: 2026-09-27
approval: pending
---

# DataBridges Work Decision Matrix

## Core principle

> Use technology to remove avoidable burden while preserving human judgement, accountability and relationships.

The objective is better work and better outcomes, not maximum automation.

## Step 0: challenge the work

Before placing work in a matrix, ask:

1. What outcome or obligation does this work serve?
2. Does a real user, customer, control or decision depend on it?
3. Can the work be removed, combined or simplified first?

Work with no defensible purpose should not be automated merely because it repeats.

## The two decision dimensions

### Human criticality

How much does the value or accountability depend on human judgement, trust, empathy, negotiation, creativity, teaching, leadership or a meaningful relationship?

This describes the task, not the worth of the person doing it.

### Automation suitability

How reliably can the work be specified, tested, monitored and reversed?

Consider:

- process stability and clear ownership;
- frequency and volume;
- structured, available and permitted data;
- exception rate and edge cases;
- consequence of error;
- reversibility and recovery;
- security and privacy;
- monitoring and escalation;
- expected benefit after implementation and maintenance cost.

## Matrix

| | Lower automation suitability | Higher automation suitability |
|---|---|---|
| **Higher human criticality** | **PROTECT** | **AUGMENT** |
| **Lower human criticality** | **SIMPLIFY OR ELIMINATE** | **AUTOMATE** |

The matrix is a structured conversation, not an automatic decision. Risk controls may override the apparent quadrant.

## PROTECT

Use when human presence is central and the process cannot be reliably systematized without damaging value.

Examples may include sensitive conversations, negotiation, leadership, coaching, novel judgement and relationship repair.

Technology may reduce scheduling, retrieval or administrative burden around the interaction. It should not impersonate or displace the accountable relationship.

## AUGMENT

Use when human judgement remains essential but repeatable preparation, retrieval, analysis or documentation can be reliably assisted.

Examples:

- prepare context before an important meeting;
- summarize records for human review;
- compare options while a person makes the decision;
- draft material that an accountable professional verifies and sends.

The design must show where the human reviews, decides, communicates and can override.

## AUTOMATE

Use when the task has low human-critical value and a stable, testable process with proportionate failure impact.

Examples may include validated routing, standard file handling, repeatable notifications and deterministic transformations.

Automation still requires an owner, monitoring, exception path, access controls and evidence that it saves more effort than it creates.

## SIMPLIFY OR ELIMINATE

Use when work has low human-critical value but is too irregular, low-volume or poorly defined to automate sensibly.

Possible actions:

- stop the work;
- remove duplicate approvals or reports;
- reduce variants;
- change policy or ownership;
- standardize the process before reconsidering automation.

Do not call a person's role low value. Describe the avoidable task or burden precisely.

## Risk gate

Before implementing augmentation or automation, ask:

1. What happens when it is wrong, late or unavailable?
2. Who is affected and who remains accountable?
3. Can a person detect and reverse the failure?
4. Is the data permitted, accurate and appropriately protected?
5. Are high-impact decisions kept under suitable human oversight?
6. How will performance and drift be monitored?

High automation suitability does not justify autonomous operation when consequences are disproportionate.

## Priority overlay

Importance and urgency determine sequence and response—not quadrant.

```text
High importance + high urgency -> address first with proportionate controls
High importance + low urgency -> schedule and protect capacity
Low importance + high urgency -> challenge, delegate, simplify or automate
Low importance + low urgency -> question whether it should exist
```

An important urgent task can still be automated if it is suitable and safe. A low-importance urgent task may be eliminated rather than automated.

## Decision record

For each material opportunity, record:

```text
Outcome served:
Current burden and baseline:
Should the work exist?:
Human-critical elements:
Automation-suitability evidence:
Risk and exception path:
Decision: PROTECT / AUGMENT / AUTOMATE / SIMPLIFY_OR_ELIMINATE
Owner:
Expected benefit:
Measure and review date:
```

## Outcome review

Measure whether the intervention:

- reduced avoidable effort or delay;
- improved quality or consistency;
- preserved or improved human experience;
- introduced exceptions, new administration or hidden risk;
- released capacity that was used for a valuable purpose.

If the system moves burden elsewhere or degrades the relationship it was meant to support, the intervention has not succeeded.

## Public use

On the homepage, present the four treatments and two dimensions briefly. Use the full assessment on Improvement/Opportunity Map pages and in workshops. Do not present the matrix as a scientific scoring system or force every service, tool and case study into a quadrant.
