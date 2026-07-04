# DataBridges website — evaluation report

**Reviewed at:** commit `6b4f56f` on `redesign/overnight` · 2026-07-04
**Build status:** `npm run build` and `npm run lint` both green (7 static routes + 1 dynamic API route).

This is a post-redesign evaluation of the whole site: every checklist item in
`DESIGN_UPGRADE.md` and `REDESIGN_ROADMAP.md`, live behaviour in a browser
(desktop/tablet/mobile viewports, console/network, interactions), and a code-level
pass over components, accessibility, SEO and content. One real bug was found and
fixed during this review (below); everything else is scored as currently shipped.

---

## Scores

| Dimension | Score | Notes |
|---|---|---|
| Design & visual | 9 / 10 | Strong, consistent brand system; bespoke graphics kit; one structural bug found + fixed |
| UX & navigation | 8 / 10 | Clear IC, CTAs correctly routed, otter guide adds real value; small content-clarity nit |
| Performance | 7 / 10 | Clean motion/JS discipline, but image optimisation is disabled site-wide |
| Accessibility | 9 / 10 | Thorough, verified ARIA/contrast/focus/reduced-motion work holds up under a fresh audit |
| SEO & AEO | 9 / 10 | Full JSON-LD graph, correct EU AI Act facts, sitemap/robots correct |
| Content & copy | 8 / 10 | Honest, jargon-free, real vignettes; one small stat-framing ambiguity |
| Code quality | 8 / 10 | Strictly typed, no dead code, clean separation; one process risk (see below) |
| Responsiveness | 9 / 10 | Verified 375–1280px live; purpose-built mobile fallback for the signature diagram |
| **Overall** | **8.4 / 10** | Close to production-ready; a small, concrete punch list below |

---

## What this review actually did

The redesign had two work-order files: `DESIGN_UPGRADE.md` (fully ticked) and
`REDESIGN_ROADMAP.md` (functionally complete, but most checkboxes had never been
ticked, making it look unfinished). Every claim in both files was verified against
the real codebase rather than trusted at face value:

- `/work` page, Nav/Footer/sitemap wiring, home "Where we've helped" and "Four
  Bridges" sections, the 5 real LinkedIn posts, the honest vignettes, the SEO/JSON-LD
  graph, the motion system (`ScrollDriver`, `CursorTracer`, reveal/parallax) — all
  confirmed present and working, not stubs. Checkboxes were brought in line with
  reality and two outdated "stub — filled in a later phase" comments were removed
  from `src/app/page.tsx` and `src/app/work/page.tsx` (they no longer matched the
  fully-built sections they sat above).
- Live-browsed all 7 routes (`/`, `/services`, `/work`, `/about`, `/faq`, `/contact`,
  `/seo-aeo`) at 375px, 900–1100px and 1280px. No console errors, no failed network
  requests, no horizontal overflow.

### Bug found and fixed: the Four Bridges diagram

`src/components/graphics/FourBridges.tsx` — the site's signature "Four Bridges to AI
Adoption" diagram — had a genuine geometry defect: span titles ("Design &
explainability", "Operations & implementation") were wider than the 140-unit arch
span they sat under, at **any** viewport ≥640px wide (a viewBox-relative overflow,
not a specific breakpoint), causing adjacent labels to visually collide. This was
invisible unless you scrolled to that exact section and looked closely, which is
presumably why it survived the prior responsive/accessibility audits.

Fixed with a balanced two-line word-wrap (`wrapBalanced`/`wrapIfNeeded` in the same
file) that only wraps text once it's actually too wide for its slot, applied to both
the title and the sub-caption. Verified on both mountings (Home and `/work`, light
and dark tone) and at mobile width (where the component already had a separate,
well-built DOM-list fallback that was unaffected).

---

## Findings by dimension

### Design & visual — 9/10
- Consistent token system (navy/cyan/yellow/off-white + AA "ink" variants), Syne/DM
  Sans/JetBrains type system, dependency-free SVG graphics kit (blobs, node graphs,
  flow diagrams, dashboards, the Four Bridges diagram) — all on-brand and reused
  cleanly across pages.
- The otter mascot is a genuinely distinctive, memorable brand device and is used
  consistently (entrance, idle float, contextual tips) without being obtrusive.
- Minor: the otter's tip bubble can crowd the hero sub-copy on the narrowest phones
  during the entrance tip — not broken, just tight.

### UX & navigation — 8/10
- Clear 6-item nav, one consistent primary CTA pattern, primary CTAs correctly route
  to `/contact` (fixed from `mailto:` in an earlier pass, and further polished this
  branch).
- Otter guide's contextual tips are frequency-capped and dismissible; FAQ, Four
  Bridges and the honest vignettes give real depth for a visitor deciding whether to
  reach out.
- Minor content-clarity nit (see Content, below) affects UX slightly, since the
  homepage stat band is often the first thing read.

### Performance — 7/10
- Fonts load with `display: swap`; only 5 components are client components
  (`EUAIActChecker`, `AEOReadiness`, `ContactForm`, `OtterGuide`,
  `BeforeAfterToggle`) and each has a real reason to be one; everything else stays a
  server component.
- All keyframe animation touches only `transform`/`opacity`; `tabular-nums` on stat
  counters avoids layout jitter; no unbounded `transition-all` left in the codebase.
- **`next.config.ts` sets `images: { unoptimized: true }`** — this disables
  `next/image`'s automatic AVIF/WebP conversion and responsive `srcset` generation
  site-wide. `@netlify/plugin-nextjs` supports Netlify's own Image CDN, so this
  looks like a leftover default rather than a deliberate choice. Worth revisiting
  since it directly affects LCP on image-heavy pages (headshot, OG images).
- `CursorTracer`, `ScrollDriver` and `OtterGuide` are mounted globally in
  `layout.tsx` on every route; each is small and gated (reduced-motion, `pointer:
  fine` for the tracer), so this is a minor, not urgent, item.

### Accessibility — 9/10
- Re-verified (not just trusted from the prior audit log) on a fresh sample:
  `EUAIActChecker` (`aria-pressed`, dynamic progressbar labels), `AEOReadiness`
  (`role="progressbar"` with `aria-valuenow/min/max`), `ContactForm` (every field has
  a real `<label htmlFor>`), `OtterGuide` (`aria-expanded`, `aria-live="polite"` tip
  bubble, Escape-to-close with refocus) — all hold up.
- Two-tone focus ring (cyan outline + navy halo) gives ≥3:1 contrast on both light
  and dark surfaces; AA "ink" colour variants are used correctly for cyan/yellow text
  on light backgrounds; 44px minimum tap targets are consistent; reduced-motion
  fallbacks are gated correctly throughout.
- No skipped heading levels, one `<h1>` per page, skip-to-content link present.

### SEO & AEO — 9/10
- `metadataBase` + per-page canonical + OG/Twitter images on every route.
- `src/lib/jsonld.ts` provides a proper identity graph (Organization, Person,
  WebSite, BreadcrumbList, Service, FAQPage) cross-referenced with `@id`s.
- `sitemap.ts`/`robots.ts` are correct and consistent with the 7 real routes.
- The EU AI Act content — the single highest-risk correctness issue identified at
  the start of this redesign — is now accurate and consistent everywhere it
  appears (checker, services, FAQ + JSON-LD, home, otter tip): Article 50
  transparency duties from 2 Aug 2026, high-risk obligations delayed to
  2027/2028, no negative-countdown risk in the checker.
- The dedicated `/seo-aeo` page and the in-browser `AEOReadiness` tool double as
  live proof of the service being sold.

### Content & copy — 8/10
- Vignettes are honest, sector-anonymised, explicitly framed as "where a number is
  genuinely ours, we quote it — where it isn't, we won't invent one," which is a
  strong trust signal given the invented-stats problem this redesign explicitly set
  out to fix.
- Voice is consistent (plain, a little wry, no jargon) across all 7 pages.
- **Minor ambiguity:** the homepage stat band says `"5+"` / "Years consulting"
  (`page.tsx:128`), while the About-teaser copy says Oisín "spent four years
  analysing data inside the HSE and Tusla" (`page.tsx:569`) before founding
  DataBridges. These aren't necessarily contradictory (4 years public sector +
  years consulting since founding could total 5+), but read together they ask the
  visitor to do arithmetic instead of just trusting the number. Worth a one-line
  clarification (e.g. "5+ years across public sector and private consulting") once
  the real timeline is confirmed — not changed here since it's a factual claim
  about the founder, not a copy-editing call.

### Code quality — 8/10
- Fully typed, no `any`, no dead code or unused exports found across all 29
  components in a targeted sweep; graphics-kit components are appropriately
  distinct rather than duplicated.
- Clean separation of concerns: graphics kit vs. page composition vs. data
  (`src/data/vignettes.ts`, `src/data/linkedin.ts`) vs. schema (`src/lib/jsonld.ts`).
- **Process risk, not a code risk:** during this review, a second autonomous Claude
  Code process was independently running and committing to this exact branch
  concurrently (the sanctioned overnight/maintenance script per `CLAUDE.md`). It
  landed 2 commits mid-review, and one of my own uncommitted fixes (the Four Bridges
  wrap fix) got folded into its unrelated "remove em dashes" commit rather than
  being attributed to its own commit. Nothing was lost, but it's a real hazard —
  added a guardrail note to `CLAUDE.md` against running both at once.

### Responsiveness — 9/10
- Verified live (not just re-reading the prior Q1 audit) at 375px, 900–1100px and
  1280px across Home, Services, Work, About, Contact, FAQ: no horizontal overflow,
  nav/hero/forms/diagrams all reflow correctly.
- The Four Bridges diagram has a genuinely well-built mobile pattern: the in-SVG
  labels are hidden below `sm` (where they'd be illegibly small) and replaced by a
  real, ordered DOM list carrying the same four stage names — not just a shrunk
  font.
- 44px minimum tap targets and fluid Tailwind grid/breakpoint usage throughout; no
  hardcoded pixel widths found that would break at unusual viewport sizes.

---

## Recommendations (priority order)

1. **Reconsider `images: { unoptimized: true }` in `next.config.ts`.** Netlify's
   Next.js plugin supports the Image CDN; enabling optimisation should improve LCP
   on image-heavy pages at no extra cost, unless there's a specific reason (e.g.
   Netlify plan limits) it was turned off.
2. **Clarify the "5+ years consulting" vs. "four years at HSE/Tusla" framing** on
   the home page so the two numbers read as additive rather than ambiguous — needs
   the real founding/consulting timeline confirmed with Oisín first.
3. **Don't run the overnight/maintenance script and an interactive session on
   `redesign/overnight` at the same time** — now documented in `CLAUDE.md`.
4. **Minor polish:** check the otter's tip-bubble width/position against the
   narrowest supported phones (< 360px) so it never crowds hero copy during the
   entrance tip.

## What's NOT in this report

This review didn't include: a Lighthouse/PageSpeed run, cross-browser testing
(Safari/Firefox specifically), or real screen-reader testing (VoiceOver/NVDA) —
the accessibility score is based on code-level ARIA/contrast/focus verification,
which is necessary but not a substitute for testing with actual assistive tech.
