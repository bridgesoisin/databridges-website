---
title: Internal evidence inventory
status: blocked-source-unavailable
owner: DataBridges
last_reviewed: 2026-09-27
approval: pending
access: internal
---

# Internal Evidence Inventory

## Safety status

This file is an internal index, not public website content. The source files cited by the previous version were not present in this repository during the 2026-09-27 review. Therefore every record below is `UNVERIFIED` for publication until an authorized reviewer can access its source.

Do not restore named employers, clients, exact internal metrics or confidential operational details to this repository unless its access classification is explicitly approved.

## Evidence record contract

```yaml
schemaVersion: 1
id: EVID-EXAMPLE
title: Short internal title
contextType: DATABRIDGES_CLIENT
verificationStatus: SOURCE_UNAVAILABLE
publicationStatus: UNVERIFIED
sourceId: SOURCE-EXAMPLE
sourceLocator: controlled-location-reference
sourceOwner: null
sourceVerifiedAt: null
summary: Bounded internal summary
supports: []
limitations: []
approvalIds: []
reviewDueAt: null
withdrawnAt: null
```

### Verification status

```text
SOURCE_UNAVAILABLE
SOURCE_FOUND
SOURCE_REVIEWED
CONFLICTING
WITHDRAWN
```

Publication status uses the canonical values in `03_TECHNICAL_ARCHITECTURE.md`. `SOURCE_REVIEWED` does not by itself make evidence public.

## Source register

The following source references were cited previously but are not in this repository:

| Source ID | Previous reference | Current state | Required action |
|---|---|---|---|
| SOURCE-CAREER | `Career Deliverables Inventory.md` | unavailable | place in approved controlled storage and review relevant excerpts |
| SOURCE-FORECAST | service-desk forecasting report previously named in the pack | unavailable | confirm ownership, client permission and exact metrics |
| SOURCE-VERTICALS | `forecasting-verticals.html` | unavailable | confirm source and permitted internal use |

Do not copy entire source files into the website repository merely to satisfy a link. Store the minimum controlled excerpt or stable reference required for audit.

## Sanitised working inventory

All entries below are leads for verification, not approved claims.

| ID | Context | Working summary | Potentially supports | Source | Publication status |
|---|---|---|---|---|---|
| EVID-001 | `EMPLOYER_CONTEXT` | AI/change strategy and governance work in a public-sector digital environment | governance, operational AI, human oversight | SOURCE-CAREER | `UNVERIFIED` |
| EVID-002 | `EMPLOYER_CONTEXT` | Recurring approval or handover workflow standardized through automation | process improvement, deployed automation | SOURCE-CAREER | `UNVERIFIED` |
| EVID-003 | `EMPLOYER_CONTEXT` | Python workflow reorganized recurring meeting output and allocated actions using business rules | Python, document workflow | SOURCE-CAREER | `UNVERIFIED` |
| EVID-004 | `EMPLOYER_CONTEXT` | Historical change-ticket analysis informed operational planning | analytics, workforce planning | SOURCE-CAREER | `UNVERIFIED` |
| EVID-005 | `TEACHING` | Delivery of professional AI education covering practical use and governance | teaching, communication, adoption | SOURCE-CAREER | `UNVERIFIED` |
| EVID-006 | `DATABRIDGES_CLIENT` | Opportunity discovery for a regulated professional-services organisation | discovery, prioritization, regulated context | SOURCE-CAREER | `UNVERIFIED` |
| EVID-007 | `DATABRIDGES_CLIENT` | End-to-end workflow architecture for an SME, including selected AI-assisted steps | process design, Microsoft workflow | SOURCE-CAREER | `UNVERIFIED` |
| EVID-008 | `DATABRIDGES_CLIENT` | AI-assisted document/email support and case-workflow work in a professional-services context | augmentation, SharePoint, document workflow | SOURCE-CAREER | `UNVERIFIED` |
| EVID-009 | `DATABRIDGES_CLIENT` | Multilingual communication workflow combining language and translation services with human review | API integration, human-led communication | SOURCE-CAREER | `UNVERIFIED` |
| EVID-010 | `DATABRIDGES_CLIENT` | Noisy website and commercial data analyzed to identify process friction and repeat patterns | data cleaning, commercial analysis | SOURCE-CAREER | `UNVERIFIED` |
| EVID-011 | `EMPLOYER_CONTEXT` | Service-demand and staffing analysis used to support operational planning | forecasting, scenario analysis | SOURCE-CAREER | `UNVERIFIED` |
| EVID-012 | `EMPLOYER_CONTEXT` | OCR/search/language-model workflow extracted and summarized records with human oversight | document intelligence, Azure/Python | SOURCE-CAREER | `UNVERIFIED` |
| EVID-013 | `EMPLOYER_CONTEXT` | Large Microsoft 365 migration work involving process, reporting, training and rollout support | Microsoft delivery, change, training | SOURCE-CAREER | `UNVERIFIED` |
| EVID-014 | `DATABRIDGES_CLIENT` | Service-desk forecasting study compared baselines and forecasting approaches using repeated out-of-sample evaluation | forecasting validation, operational interpretation | SOURCE-FORECAST | `UNVERIFIED` |
| EVID-015 | `INDEPENDENT_RESEARCH` | Postgraduate study in data-intensive astrophysics using Python and machine learning | analytical foundation | SOURCE-CAREER | `UNVERIFIED` |
| EVID-016 | `INDEPENDENT_RESEARCH` | Interactive research tool compared market opportunities using explicit weighted criteria and visible judgement | research, transparent scoring | SOURCE-VERTICALS | `INTERNAL_ONLY` |

## Verification procedure

For each record:

1. locate the source in approved storage;
2. confirm the source owner and access classification;
3. review the exact passage, dataset or output;
4. distinguish work performed, result observed and interpretation;
5. record context, date, unit, population and material limitations;
6. identify confidentiality, employer/client and naming constraints;
7. assign publication status;
8. obtain a scoped approval where required;
9. set review/expiry trigger;
10. create a claim record for exact public wording.

## Quantitative evidence

Exact numbers from the previous bank are intentionally not repeated while their sources and permissions are unavailable. When restored after review, record:

- exact value and unit;
- relevant period and population;
- source location;
- method or calculation;
- whether observed, estimated or self-reported;
- uncertainty and caveats;
- approved public wording and scope.

Approximate wording does not remove the need for support.

## Context safeguards

### DataBridges client

Confirm client identity permission separately from permission to describe the work or publish results.

### Employer context

Never present as a DataBridges engagement. Confirm confidentiality and show the context publicly if used.

### Teaching

Verify current role/title wording and do not imply institutional endorsement.

### Independent research

Distinguish educational or exploratory work from production client outcomes.

## Repository handling

- Keep this file free of personal contact details and unnecessary identifying data.
- Use stable controlled references rather than local-machine paths.
- Restrict access if future entries contain non-public client or employer information.
- Do not feed this file to public content generation without publication-status filtering.
- Review Git history when removing sensitive material; deleting the current file alone may not remove prior committed copies.

## Publication gate

No record in this version is authorized for new public use. Existing public claims should be independently audited rather than assumed valid because a matching row exists here.
