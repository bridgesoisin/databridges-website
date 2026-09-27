---
title: Technical architecture
status: proposed
owner: DataBridges
last_reviewed: 2026-09-27
approval: pending
---

# Technical Architecture

## Architectural rule

Evolve the existing application. Do not impose a speculative greenfield structure.

## Current platform

- Next.js 16 App Router and React 19
- application code under `src/app`, `src/components`, `src/data` and `src/lib`
- Tailwind CSS 4 tokens in `src/app/globals.css`
- Netlify deployment via `@netlify/plugin-nextjs`
- Decap CMS for selected content
- Git branch currently named `master`
- local, Netlify deploy-preview and production environments

There is no assumed staging environment, database, queue, CRM, email provider or automated test framework. Adding one requires a ticket and, where material, an ADR.

## Incremental repository shape

Use existing directories and add only what approved work needs:

```text
src/
  app/
  components/
  data/
  lib/
content/
public/
docs/                 # create only when ADRs or durable technical docs exist
tests/                # create with the first approved test framework
AGENTS.md              # generated or copied from 04_AGENTS.md during activation
```

Do not move current code merely to match a diagram.

## Content storage decisions

Use repository-controlled content for stable editorial material such as service pages, resources and approved case studies. Use a database only when records require concurrent updates, workflow state, querying or operational retention beyond Git content.

Do not put confidential evidence or personal data in a public website repository.

## Canonical publication types

Use these values everywhere:

```typescript
type PublicationStatus =
  | "PUBLIC"
  | "PUBLIC_ANONYMISED"
  | "REQUIRES_APPROVAL"
  | "INTERNAL_ONLY"
  | "UNVERIFIED"

type ContextType =
  | "DATABRIDGES_CLIENT"
  | "EMPLOYER_CONTEXT"
  | "INDEPENDENT_RESEARCH"
  | "TEACHING"
```

Canonical case-study metadata:

```typescript
type CaseStudyMeta = {
  schemaVersion: 1
  id: string
  slug: string
  title: string
  summary: string
  contextType: ContextType
  publicationStatus: PublicationStatus
  evidenceIds: string[]
  services: string[]
  technologies?: string[]
  claimsReviewedAt: string | null // ISO 8601 date
  approvalId: string | null
  clientNamePublicationApproved: boolean
}
```

Example frontmatter uses the same names and values:

```yaml
schemaVersion: 1
id: CASE-EXAMPLE
slug: example-case
title: Example case
summary: Concise, approved summary.
contextType: DATABRIDGES_CLIENT
publicationStatus: REQUIRES_APPROVAL
evidenceIds:
  - EVID-EXAMPLE
services:
  - improvement
claimsReviewedAt: null
approvalId: null
clientNamePublicationApproved: false
```

Validate frontmatter at build time before publishing case pages.

## Lead architecture

Start with the smallest system that reliably delivers enquiries and records consent. Prefer an established form/CRM service over a custom database until volume or workflow requirements justify custom infrastructure.

The canonical lead, consent, source and analytics contracts live only in `09_LEAD_CAPTURE_AND_CRM.md`.

## Visibility scanner boundary

If the private Index pilot is approved, keep scanning separate from page rendering:

```text
approved target
-> isolated fetch worker
-> safe extraction
-> deterministic metric evaluation
-> evidence record
-> quality review
-> private report
```

Public publication is a later, separate decision.

## Scanner security requirements

Before any network scanner runs:

- allow only `http` and `https` with explicit ports;
- normalize and parse URLs with one trusted implementation;
- resolve and reject loopback, private, link-local, reserved and metadata IP ranges for IPv4 and IPv6;
- re-resolve and revalidate every redirect hop;
- mitigate DNS rebinding and mixed-address responses;
- restrict outbound network access where the platform permits;
- enforce connection, response and total-job timeouts;
- cap redirects, pages, depth, response bytes and decompressed bytes;
- permit only expected content types;
- never submit forms, authenticate or execute downloaded content;
- isolate any browser/JavaScript renderer separately;
- sanitize stored evidence before rendering it;
- use a descriptive user agent and rate limits;
- respect applicable crawl restrictions and record failures without bypassing them.

Security review is required before a prototype receives arbitrary user URLs.

## Environments and deployment

Current flow:

```text
Local -> feature branch -> pull request -> Netlify deploy preview -> human review -> master -> production
```

Decap CMS commits directly to `master` are a documented exception and should be reviewed as an operational risk. Do not document staging until a real staging environment exists.

## Observability and operations

Any new server-side workflow must define:

- owner and support path;
- structured error logging without sensitive values;
- health/failure signal;
- retry and idempotency policy where relevant;
- data retention and deletion behaviour;
- backup or recovery requirement;
- cost or usage limit;
- rollback or disable mechanism.

## ADR threshold

Create an ADR when a decision introduces or replaces a database, CRM, authentication system, payment system, queue, scanner runtime, analytics platform, content system or deployment environment. Minor component choices do not require an ADR.
