# ADR-001: private, bounded, resumable Visibility Index batch

Date: 2026-10-04. Status: implementation decision; publication not approved.

The owner requests unattended discovery and scoring by Codex and Claude and
explicitly drops consent-only admission. We reuse the SSRF-safe scanner and fixed
52-metric methodology. Models discover company candidates and choose technical
tips; they cannot edit code, change scores, execute shells or contact businesses.

Use a single-writer, atomic JSON database under git-ignored reports, rather than a
new hosted database or dependency. It is suitable for this 50-site private batch,
not concurrent multi-machine operation. A process lock, saved call budget,
attempt counters, stop file and rate-limit backoff make the queue resumable.
Adding sites outside this versioned cohort or a new batch needs a policy decision.

Provider launch and queue orchestration live in scripts/visibility, outside the
network-confined scanner library. The existing confinement test remains unchanged;
only fetch.ts may open scanner network connections. Provider capabilities and
temporary-workspace isolation are tested independently.

Retain only root company URLs, source origins, numeric observations, hashes and
fixed technical guidance. Raw page content and potentially personal values are
transient scanner inputs, never stored in the batch database or sent to reviewers.
Discovery services necessarily process public search information; no promise of
zero personal-data processing or legal risk is made. Corporate identity and source
credibility are heuristically screened, not legally certified.

The legacy manual aggregator remains separate. Its free-text evidence and CSV
are NOT used for the draft ranking. The new ranked-draft.json is derived from
the safe database using the unchanged methodology plus stricter observation and
dual-commentary-review gates. No hosted endpoint, leaderboard or outreach exists
as part of this implementation. Release requires privacy/security/methodology,
correction-process and reputation review followed by explicit deployment approval.
