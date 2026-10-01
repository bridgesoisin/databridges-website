# DataBridges website — automated test coverage plan

No test runner exists in this repo today (`package.json` has no test
dependency or script). This is a plan, not an implementation — nothing here
is installed yet. Phase 1 is the highest-value, lowest-cost place to start;
later phases are optional depending on how much the site keeps growing.

## Why bother, on a marketing site

Most of the site is static content with nothing to regress. Three places
aren't: `EUAIActChecker`, `AEOReadiness`, and `ContactForm` all have real
branching logic that a copy edit or a refactor could silently break, and a
broken contact form or a wrong compliance answer costs more than most bugs
on this site would. Scope is deliberately narrow — this is not a push for
full coverage.

## Tooling

| Layer | Tool | Why |
|---|---|---|
| Pure functions | Vitest | Fast, no browser, works with the existing TS config with minimal setup |
| Component behaviour | Vitest + React Testing Library + jsdom | Tests state/interaction without a real browser |
| Critical flows | Playwright | The only way to catch a page that 500s or a build-time regression unit tests can't see |

Not proposing Jest — Vitest is faster, needs less config alongside Next 16 +
TypeScript, and is the more common pairing going forward.

## Phase 1 — pure function unit tests (do this first)

Zero DOM, zero mocking, highest signal-to-effort ratio.

- [ ] `npm install -D vitest`, add `"test": "vitest run"` script.
- [ ] `src/components/EUAIActChecker.tsx` → extract `getResult` and
      `transparencyCountdown` are already standalone functions; test them
      directly:
  - `getResult`: every combination that should produce `high-risk`, `transparency`,
    and `neither` result types, including the case where a selection matches
    both a high-risk and transparency use.
  - `transparencyCountdown`: countdown shrinks correctly as "now" approaches
    `TRANSPARENCY_DATE`, and reads sensibly once the date has passed (this
    function is the one most likely to silently go wrong — the EU AI Act
    dates have already needed one correction, see `[[eu-ai-act-corrected-timeline]]`
    in project memory).
- [ ] `src/components/AEOReadiness.tsx` → `tier(pct)`: boundary tests at each
      tier threshold (0%, just-below/at/just-above each cutoff, 100%).

## Phase 2 — component behaviour (React Testing Library)

- [ ] `npm install -D @testing-library/react @testing-library/user-event jsdom @testing-library/jest-dom`, configure Vitest `environment: "jsdom"`.
- [ ] `EUAIActChecker`: step through the wizard (`handleNext`/`handleBack`/`canAdvance`)
      — can't advance without a required answer, back button returns to the
      prior step with the answer still selected, final step renders the
      correct result copy for a scripted set of answers.
- [ ] `AEOReadiness`: toggling items updates the percentage and tier label
      correctly; toggling the same item twice returns to the original state.
- [ ] `ContactForm`: mock `fetch` —
  - submit with required fields → `status` goes `idle → submitting → success`,
    success view renders, `db:contact-success` event fires (OtterGuide listens
    for this).
  - mocked `fetch` rejection → lands in the `error` state and shows the
    `mailto:` fallback.
  - `?success=true` in the URL renders the success view without ever
    submitting (the Netlify static-redirect path).
  - the honeypot field (`name="bot-field"`) is present, hidden, and outside
    the tab order (`tabIndex={-1}`) — this is the one thing standing between
    the form and spam, so its markup shouldn't be able to drift silently.

## Phase 3 — critical-path smoke tests (Playwright)

Only add these once Phase 1–2 are in and stable; Playwright is the most
expensive to maintain, so keep this list short and about paths that would be
genuinely bad to break silently.

- [ ] `npm init playwright@latest` (adds its own config).
- [ ] Homepage loads, hero renders, no console errors.
- [ ] Every top-level nav link (Footer) resolves to a 200, not a 404 — this
      would have caught the dangling `/events` link immediately if it were
      ever left behind after a page removal.
- [ ] `/contact` — fill the form, submit, see the success state (hit Netlify's
      real `/__forms.html` endpoint in CI only if there's a safe test-mode
      target; otherwise mock the route in Playwright and assert the
      client-side state transition instead of a real submission).
- [ ] `/seo-aeo` → AEOReadiness tool is interactive and keyboard-operable
      (tab to a checkbox, space to toggle, score updates).
- [ ] `/services` → EU AI Act checker completes end-to-end for one scripted
      path and shows a result.

## What NOT to test

Explicitly out of scope — would cost more to maintain than the bugs they'd
catch on a site this size:

- Visual/pixel regression on any page (design will keep changing; CSS-only
  components like `ScrollReveal`, `CursorTracer`, `AnimatedBlobs` are
  cosmetic, not logic).
- The dormant `src/app/api/otter/route.ts` — no point testing a disabled
  feature; add tests when/if it's switched on (see `CLAUDE.md` → "To wire
  the chatbot later").
- Decap CMS / `/admin` — third-party vendored code, not ours to test.
- Content correctness (LinkedIn posts, FAQ copy, EU AI Act dates) — that's a
  content/editorial review problem, not a test-suite problem; the monthly
  Opus maintenance pass covers that (see `CLAUDE.md` → Model workflow).

## CI

Once Phase 1 exists: add `npm run test` (and `typecheck` + `lint`, which
already exist but aren't wired to CI either) to a GitHub Actions workflow on
every PR. Playwright (Phase 3) can run in the same workflow if fast enough,
or as a separate nightly job if it starts slowing PRs down.

## Effort estimate

- Phase 1: ~1–2 hours. Do this regardless of whether Phases 2–3 happen.
- Phase 2: ~half a day, mostly `ContactForm`'s mocked-fetch paths.
- Phase 3: ~half a day for the initial suite, plus ongoing maintenance as
  pages change — budget for this before committing to it.
