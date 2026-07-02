# DataBridges — site-wide design upgrade brief

This is the durable work order for the overnight redesign. The runner
(`scripts/overnight-fable.sh` / `.ps1`) feeds this file to Claude Code (Fable)
one task at a time. **Do exactly one unchecked task per invocation, to its
definition of done, then tick its box and stop.**

## Goal
Make the whole site feel dynamic, aesthetic and graphics-rich, on par with:
- https://ventriloc.ca/en/data-visualization/
- https://ventriloc.ca/en/data-agents/

The already-built **`/seo-aeo` page is the in-repo reference exemplar**. Match
its quality and patterns: animated SVG graphics, scroll reveals, stat counters,
numbered feature lists, alternating graphic/text blocks, tidy CTAs.

## Non-negotiable rules
- **No new heavy dependencies.** Graphics are hand-built SVG + CSS keyframes in
  `globals.css`. No animation libraries, no canvas frameworks.
- **Use design tokens**, never raw hex: navy `#0A1E3D`, cyan `#3DE0E8`,
  yellow `#FFC857`, off-white `#F8F7F4`. Fonts: Syne (headings), DM Sans (body).
- **Every animation respects `prefers-reduced-motion: reduce`** with a calm
  fallback.
- **Accessibility:** logical heading order (one h1/page), `aria-label`s on
  decorative SVG set to `aria-hidden`, visible focus states, AA contrast.
- **Performance:** animate only `transform`/`opacity`; no layout thrash; keep
  images sized; no cumulative layout shift.
- **Responsive:** every section works at 360px, 768px and 1280px.
- Keep all existing content, routes, JSON-LD and the OtterGuide intact.
- Preserve `data-otter-section` anchors (add sensible ones to new sections).

## Definition of done (applies to every task)
1. The change is implemented and visually matches the exemplar quality.
2. `npm run build` passes.
3. `npm run lint` passes (fix all warnings you introduce).
4. Reduced-motion and mobile (360px) both verified in the code.
5. The task's checkbox below is ticked and the work is committed.

---

## Backlog (grind top to bottom, one per run)

### Foundations (build these first — later pages reuse them)
- [x] F1: Create `src/components/graphics/` with reusable, dependency-free
  animated components modelled on `/seo-aeo`: `AnimatedBlobs`, `RankBars`,
  `NodeGraph`, `FlowDiagram`, `StatBand` (wrapping the existing `StatCounter`),
  `NumberedFeatures`, and `LogoMarquee`. Each takes props, uses tokens, and has
  a reduced-motion fallback.
- [x] F2: Add any shared keyframes/utility classes these components need to
  `globals.css` under a clearly commented "Graphics kit" block, namespaced
  `.gfx-*` to avoid collisions.

### Page redesigns
- [x] P1: Redesign the Home page (`src/app/page.tsx`) — animated hero with
  `AnimatedBlobs` + a hero graphic, convert sections to use the graphics kit,
  add a numbered "how it works" feature list and a stat band. Keep all copy.
- [x] P2: Redesign Services (`src/app/services/page.tsx`) — one animated graphic
  per service, numbered feature list, alternating graphic/text blocks.
- [x] P3: Redesign About (`src/app/about/page.tsx`) — animated credentials/
  timeline graphic; keep the real credentials content.
- [x] P4: Redesign Contact (`src/app/contact/page.tsx`) — dynamic accent
  graphics around the form; **do not change the form logic**.
- [x] P5: Polish FAQ (`src/app/faq/page.tsx`) — subtle reveal motion and a small
  hero graphic; keep the `FAQPage` JSON-LD and answers identical.

### Quality passes
- [x] Q1: Responsive audit across every page at 360/768/1280; fix overflow and
  spacing issues.
- [x] Q2: Accessibility audit — headings, focus order, `aria`, contrast,
  reduced-motion; fix anything found.
- [ ] Q3: Performance audit — image sizing, avoid layout shift, ensure only
  transform/opacity animate; trim any unused CSS you added.
- [ ] Q4: Final pass — `npm run build` and `npm run lint` both green; update
  `sitemap.ts` and `Nav.tsx` if any routes changed; write a short summary of
  everything done to `scripts/overnight-summary.md`.

---

## Progress log
The agent appends one line per completed task here (date + task id + commit).

- 2026-07-02 — F1 — graphics kit components (`AnimatedBlobs`, `RankBars`, `NodeGraph`, `FlowDiagram`, `StatBand`, `NumberedFeatures`, `LogoMarquee`) complete; fixed `StatCounter` set-state-in-effect lint error and excluded `.claude/` worktrees from ESLint so the gate is green.
- 2026-07-02 — P1 — Home page redesigned with the graphics kit: hero now two-column with `AnimatedBlobs` + `NodeGraph` hub graphic (HeroWords sizes retuned to fit the column, `whitespace-nowrap` dropped so 360px never overflows); `StatBand` with the four credibility stats directly after the hero; `LogoMarquee` technology strip; pain-point cards got `.gfx-card` hover lift + equal heights; new "How it works" section (`FlowDiagram` Chat→Map→Build→Train + 4-item `NumberedFeatures`, `data-otter-section="how-it-works"`); about-teaser and LinkedIn cards wrapped in `ScrollReveal`. All copy, JSON-LD and anchors kept. Build + lint green.
- 2026-07-02 — P2 — Services page redesigned: navy hero with `AnimatedBlobs`, falling `RankBars` ("hours lost to manual admin") and anchor chips to the four services; each service is now an alternating text/graphic block (graphic panel is navy `rounded-3xl` with a JetBrains caption, sides alternate via `reverse`) — AI Consulting gets `NodeGraph`, Power Platform a bespoke dashboard SVG (KPI chips + rising `.gfx-bar`s + yellow trend line), SharePoint a `FlowDiagram` Request→Approve→Notify with integration chips, Training a bespoke presenter-to-team fan SVG (`.gfx-ring`/`.gfx-node`/`.gfx-link`); "What You Get" converted from check bullets to a numbered two-column list; new yellow footer CTA ("Not sure which one you need?"); `data-otter-section` anchors added per section. All copy, ids and the EU AI Act callout kept. Build + lint green.
- 2026-07-02 — P3 — About page redesigned: navy hero now two-column with `AnimatedBlobs` and a bespoke "constellation bridge" SVG (scattered twinkling stars, dashed `.gfx-flow` arc, `.gfx-link` suspenders, pulsing `.gfx-node` stars, yellow `.gfx-ring` apex — astrophysics → DataBridges motif) with a JetBrains caption; story section keeps the three acts verbatim but threads them on a gradient cyan→yellow line with act dots, each act in a staggered `ScrollReveal`, headshot gets a rotated cyan offset frame and `md:sticky`; the eight credentials (content unchanged) reordered chronologically into an animated vertical timeline — gradient spine, pulsing SVG node per entry (white halo masks the line), cards alternate sides at md+ and collapse to a single left-spine column at 360px, `.gfx-card` hover lift; CTA gains subtle corner blobs and `ScrollReveal`. Anchors added: `about-hero`, `about-story`, `credentials`, `footer-cta` (reuses the existing otter tip). All copy and credentials kept; reduced-motion falls back to static graphics via the `.gfx-*` gates. Build + lint green.
- 2026-07-02 — P4 — Contact page redesigned around the untouched `ContactForm`: navy hero now two-column with `AnimatedBlobs` and a bespoke "message in flight" SVG (tiny form card → dashed `.gfx-flow` arc with a paper plane → reply bubble with a yellow tick, plus a `.gfx-ring` clock for the one-working-day promise) with a JetBrains caption; the form sits in a white card framed by a rotated cyan offset border, a pulsing yellow sparkle (top-right) and a cyan dot-grid accent (bottom-left), all `aria-hidden`/`pointer-events-none`; contact details converted to `.gfx-card` white cards with a cyan left rule; new "What happens next" `FlowDiagram` (Send→Read→Reply) in the details column; both columns in staggered `ScrollReveal`. Anchors added: `contact-hero`, `contact-form`. Form logic, all copy and links unchanged; reduced-motion falls back to static via the `.gfx-*`/`.scroll-reveal` gates; accents kept within the page gutter at 360px. Build + lint green.
- 2026-07-02 — P5 — FAQ polished: navy hero now two-column with `AnimatedBlobs` and a bespoke "questions → answer" SVG (three floating `?` bubbles at falling opacity, dashed `.gfx-flow` arc to an answer bubble with a yellow tick inside a pulsing `.gfx-ring`, ambient `.gfx-node` dots) with a JetBrains caption; FAQ cards keep their staggered `ScrollReveal` and gain `.gfx-card` hover lift, a cyan left rule and an `aria-hidden` JetBrains `01`–`11` index; CTA gains corner `AnimatedBlobs` + `ScrollReveal` (matching About). `FAQS` strings and the `FAQPage` JSON-LD untouched; heading order (h1→h2→h3) and both `data-otter-section` anchors kept; all new motion rides the `.gfx-*`/`.scroll-reveal` reduced-motion gates; hero collapses to one column with `max-w-sm` graphic at 360px. Build + lint green.
- 2026-07-02 — Q1 — responsive audit at 360/768/1280 across Home, Services, About, Contact, FAQ, /seo-aeo, Nav and Footer. Fixed: `BeforeAfterToggle` "Before" spreadsheet cells were non-shrinkable flex items (long strings like `=SUM(B2:B47) ← DO NOT DELETE` blew past 360px and misaligned the header row) — every cell now `min-w-0 truncate` so columns shrink evenly and ellipsize; "After" KPI cards (`14hrs/week` at text-2xl can't fit a third of a 312px card) now stack `grid-cols-1 sm:grid-cols-3`; "After" clean table gains `gap-2` + `truncate` spans and `text-xs sm:text-sm` so Department/Operations don't collide at 360; `StatBand` now lays even counts ≥4 as `lg:grid-cols-4` so the home band is one row at 1280 instead of 2×2; contact grid `gap-16` relaxed to `gap-12 lg:gap-16` so the details column (FlowDiagram) isn't starved at 768. Heroes, timelines, marquee, accent graphics and all `.gfx-*` pieces verified clean at all three widths (overflow-hidden heroes clip blobs; graphics capped `max-w-sm`/`max-w-xs` on mobile). Build + lint green.
- 2026-07-02 — Q2 — accessibility audit across all pages + shared components. Contrast: new AA "ink" tokens (`--color-cyan-ink` #0E7A83, `--color-yellow-ink` #8A6100) for accent text on light surfaces — bright cyan/yellow text on white was ~1.5:1; swapped every informative cyan/yellow label, link and card title on white/off-white to the ink variants (eyebrows, "Show me how/Full story/Learn more/Read on LinkedIn/Talk to Oisín" links, pain-card titles, KPI values, contact/detail labels, SEO/AEO chips, active nav link on the scrolled white bar); big decorative numerals stay bright cyan (aria-hidden, WCAG-exempt). Also bumped failing tints: hero footnote white/40→60, hero sub grey-mid→gray-300, "Free Tool" + checker notes/disclaimer navy/40-60→70+, marquee chips navy/60→70, footer bottom bar gray-500→400, LinkedIn attribution + form placeholders gray-400→500, AEO readiness % now navy. Focus: two-tone focus ring (cyan outline + navy halo) visible on light and dark; closed mobile nav overlay now `visibility: hidden` so its links leave the tab order/AT tree. Reduced motion: `scroll-behavior: smooth` gated on no-preference, `.toggle-panel` transition disabled, `.seo-bar` rise added to the seo reduce block. ARIA: EU-checker option buttons expose `aria-pressed`, Before/After hidden panel `aria-hidden`, LogoMarquee `role="list"` moved onto the track so listitems are direct children, otter avatar image alt="" (button already labelled, alt said "Open" even when open), seo-aeo tip numerals aria-hidden. Headings verified one-h1-per-page, no skipped levels. Build + lint green.
- 2026-07-02 — F2 — "Graphics kit" block added to `globals.css` (`.gfx-*` namespaced): blob drift, staggered bar rise, node pulse + hub ring, travelling-dash links/flow, card hover lift, seamless marquee loop with fade mask; all motion gated on `prefers-reduced-motion: no-preference` with static fallbacks (bars full height, solid links, marquee wraps to rows, faint ring). Build + lint green.
