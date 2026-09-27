---
title: Lead, consent, CRM and analytics contract
status: proposed
owner: DataBridges
last_reviewed: 2026-09-27
approval: pending
---

# Lead, Consent, CRM and Analytics Contract

## Principle

Collect the minimum data needed to deliver the requested action and manage a proportionate commercial relationship. A resource request is not blanket marketing permission.

## Architecture decision

Begin with the existing contact mechanism or a managed form service that can provide reliable delivery, spam control and auditable consent. Add a custom database, CRM adapter or email automation only after an ADR shows why the simpler system is insufficient.

## Canonical lead sources

```text
CONTACT
VISIBILITY_SERVICE
OPPORTUNITY_MAP
AUTOMATION_SERVICE
GOVERNANCE_SERVICE
TRAINING_SERVICE
RESOURCE
EVENT
INDEX_PRIVATE_PILOT
TOOLS_PILOT
```

Store a source plus a more specific `sourceDetail` rather than creating a new enum for every resource.

## Canonical data contract

```typescript
type ConsentRecord = {
  marketingAllowed: boolean
  capturedAt: string | null
  captureSource: string
  noticeVersion: string
  wordingVersion: string
  withdrawnAt: string | null
}

type LeadRecord = {
  schemaVersion: 1
  id: string
  email: string
  firstName?: string
  company?: string
  website?: string
  source: LeadSource
  sourceDetail?: string
  landingPage: string
  firstTouchAt: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  consent: ConsentRecord
  lifecycleState:
    | "NEW"
    | "DELIVERED"
    | "QUALIFIED"
    | "UNQUALIFIED"
    | "CUSTOMER"
    | "SUPPRESSED"
    | "DELETED"
  externalIds?: Record<string, string>
  createdAt: string
  updatedAt: string
}
```

Normalize email for duplicate matching without overwriting the submitted value blindly. Define merge ownership before synchronizing multiple systems.

## Form rules

For ordinary resources, request only email unless another field has a defined purpose. First name, company and website should be optional unless essential to the requested service.

Every form must provide:

- clear purpose and destination;
- link to the applicable privacy information;
- separate, unticked marketing choice;
- success, failure and retry behaviour;
- accessible errors and status messaging;
- abuse protection appropriate to risk;
- no sensitive values in analytics or URLs.

## Delivery versus marketing

Sending the requested resource or enquiry acknowledgement is transactional. Promotional follow-up requires the approved marketing condition and an unsubscribe/withdrawal route.

Maintain a suppression record so withdrawal is not undone by a later import. Decisions about lawful basis, required notices and retention must be approved by the responsible owner; this technical document does not make legal determinations.

## Canonical analytics events

```text
page_view
service_view
work_case_view
resource_view
resource_form_start
resource_form_submit
resource_delivery_success
resource_delivery_failure
contact_submit
booking_click
event_view
index_pilot_view
tool_pilot_view
```

Allowed properties should be an explicit allowlist such as route, content ID, service ID, source and campaign. Never send name, email, company, website, free text, full referrer query strings or stable lead identifiers to analytics.

## Reliability contract

Any integration must define:

- idempotency key for submissions;
- validation and normalized duplicate handling;
- retry policy with a maximum attempt count;
- durable failure visibility or dead-letter process;
- user-facing delivery fallback;
- reconciliation between website and CRM;
- alert owner;
- deletion and suppression synchronization;
- redacted logs and secret rotation.

“Form submitted” is not success if delivery or storage silently failed.

## Data lifecycle

Before storing leads, approve and document:

- system of record;
- roles with access;
- field-level purpose;
- retention period by lifecycle state;
- deletion, correction and export process;
- backup implications;
- CRM/email-provider deletion synchronization;
- incident and breach escalation owner.

Do not retain abandoned form contents or raw free text merely because the system can.

## Conversion reporting

Measure only where data quality supports it:

```text
qualified visit -> meaningful CTA
CTA -> successful submission
submission -> qualified conversation
conversation -> proposal
proposal -> won work
won work -> delivery economics by offer/source
```

Report attribution as directional when identity, cookie consent or cross-device limitations make it incomplete.
