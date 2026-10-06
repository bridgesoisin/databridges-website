# Visibility Index: run the private batch from VS Code

The runner finds company websites, measures technical SEO/AEO signals, asks
Codex and Claude to check numerical consistency and select a strength and an
improvement, and saves a private draft ranked dataset. No per-site approval or
chat monitoring is needed. The agents do not independently verify the scanner's
observations. Scores describe sampled technical readiness, not search positions,
AI citations, business quality or legal compliance.

## First-time setup

1. Open the normal DataBridges folder in VS Code. Use its PowerShell terminal.
2. Dependencies must be installed. If needed, stop this project's dev server with
   Ctrl+C in its own terminal, then run `npm ci`. Do not terminate unrelated Node
   processes. A failed install leaves vitest/tsx unavailable; fix that first.
3. Install/sign in to the Codex CLI and Claude Code once. Existing subscription
   sign-ins are used; no paid API-key fallback is configured. These runs consume
   your plan allowances. Use `codex login` and `claude auth login` if needed.
4. Check setup:

   ```powershell
   Set-Location 'C:\Users\oisin\Documents\databridges-website'
   npm run visibility:batch -- --check
   ```

   Both providers must show available and authenticated as true. If a CLI is
   installed but its required security flags are unsupported, upgrade that CLI.
5. Start the resumable loop:

   ```powershell
   npm run visibility:batch -- --run
   ```

Keep the laptop awake and the terminal running. Closing VS Code or sleeping the
laptop stops the process; rerun the same command to continue saved work. The
runner waits automatically after usage limits, does not bypass authentication,
and stops at its time/call/candidate limits. It cannot run while the computer is off.
For a small first batch, use `--run --target-count 3` before initialisation.
The target cannot be silently changed after the database exists.

## Scope and limits

- Owner consent is not required for this operator-approved private batch.
- Initial scope: up to 50 Irish professional-services corporate websites on root
  .ie domains. Personal profiles, sole traders, uncertain incorporation, unrelated
  sectors and known restrictions are excluded. .com Irish businesses are excluded
  in this version; this is a conservative, biased sample, not a national benchmark.
- Discovery is model-assisted, then URL/scope screened. A visible corporate marker
  is an admission heuristic, not proof of incorporation or permission to crawl.
- At most 200 admitted candidates, 20 discovery rounds, 220 agent calls, two scan
  attempts and two review attempts per provider per site, 12 hours per invocation.
- The fetcher's existing per-site 60-request/20-second/byte/redirect/concurrency
  limits, DNS/private-address guards and robots rules remain. Ambient extra-host
  settings cannot widen a batch's per-site allowlist. No authentication, forms,
  JavaScript rendering, access-control bypass or outbound sales messages.
- Usage-limit pauses last 15 minutes and repeat within saved call/time budgets.
  Authentication failures stop for one-time sign-in repair, not per-site approval.
- A batch never rescans an already assessed site. Seven-day cooldown is reserved
  for a separately approved future refresh implementation, not a running scheduler.

## Files and scoring

Private outputs (git-ignored):

- `reports/visibility/autonomous/database.json`: candidates, status, numeric
  measurements, versioned scores and tip-ID reviews. No HTML, source excerpts,
  contacts, names, addresses, page paths, biographies or raw model prose are saved.
- `reports/visibility/autonomous/ranked-draft.json`: derived ranking and fixed
  technical tips. Its publicationStatus is REQUIRES_APPROVAL.
- `batch.lock`: prevents two coordinators writing simultaneously. STOP requests a
  safe pause. Temporary agent results are deleted after schema validation.

The 52 metrics and eight category weights remain defined in methodology.ts;
scoring.ts calculates category, pillar, overall and coverage figures unchanged.
Unobserved data are not zero. Eligibility for the draft ranking additionally
requires coverage >=90%, all eight categories shown, both pillar/overall scores,
and confirmed commentary reviews from BOTH providers. JavaScript shells and
challenge pages are withheld. Ties share rank using stored two-decimal scores.
Strong in both pillars means SEO and AEO each >=85, not “best business”.

One strength uses a passed metric; one improvement uses a failed/partial metric.
Text comes from the fixed technical catalogue, never copied website/model prose.
No strength/improvement is invented when none is observed. Contact/author metrics
and experimental llms.txt are not used as lead-generation tips. Non-eligible results
are still retained privately; target completion does not guarantee 50 rankable sites.
No leaderboard is hosted and no public metadata, privacy notice or legal wording
is changed by this implementation. Public release is a separate decision.

## Optional controls (not required monitoring)

```powershell
npm run visibility:batch -- --status
npm run visibility:batch -- --stop
npm run visibility:batch -- --clear-stop
npm run visibility:batch -- --run
```

If a process crashed and a lock remains, `--unlock-stale` removes it only when its
recorded PID is no longer alive. Do not delete an active lock or run concurrent
coordinators. No automatic destructive reset command is provided.

## Safeguards are not a legal guarantee

Public websites can contain personal data even when the intended output is purely
technical. Transient fetching/search-service processing still happens. Domain and
company classification can be wrong; consent would not erase other obligations.
Respect site restrictions and rights, retain minimal data and review methodology,
privacy, terms and correction handling before publication. No automation can
guarantee that every output or use is lawful. The draft dataset is not legal clearance.

CLI references: [Codex non-interactive runs](https://learn.chatgpt.com/docs/non-interactive-mode)
and [Claude Code headless runs](https://code.claude.com/docs/en/headless).

## Verification and current startup state — 2026-10-04

Offline runner, model-output validation, resume, rate-limit backoff, privacy
projection, blocked-site handling and saved-budget tests pass. The whole test
suite passed, with 15 intentionally skipped fixture expectations. Lint,
typecheck and portable-pack generation passed. These tests mock model invocations;
a real dual-provider scan has not yet run.

Local startup preflight found Codex installed/signed in and Claude installed but
not signed in. The private database is initialised with target 50, zero agent
calls and no sites, in AUTH_REQUIRED state. Run `claude auth login` once, then the
normal `--run` command. No sites have been scored, posted or contacted.

The local production website build failed in Turbopack's DM Sans Google-font
handling (`next/font/google queries have exactly one entry`). App/font code is
unchanged by this batch work. The private CLI is independently typechecked/tested;
website deployment remains unverified and unapproved.
