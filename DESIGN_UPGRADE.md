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
- [ ] F1: Create `src/components/graphics/` with reusable, dependency-free
  animated components modelled on `/seo-aeo`: `AnimatedBlobs`, `RankBars`,
  `NodeGraph`, `FlowDiagram`, `StatBand` (wrapping the existing `StatCounter`),
  `NumberedFeatures`, and `LogoMarquee`. Each takes props, uses tokens, and has
  a reduced-motion fallback.
- [ ] F2: Add any shared keyframes/utility classes these components need to
  `globals.css` under a clearly commented "Graphics kit" block, namespaced
  `.gfx-*` to avoid collisions.

### Page redesigns
- [ ] P1: Redesign the Home page (`src/app/page.tsx`) — animated hero with
  `AnimatedBlobs` + a hero graphic, convert sections to use the graphics kit,
  add a numbered "how it works" feature list and a stat band. Keep all copy.
- [ ] P2: Redesign Services (`src/app/services/page.tsx`) — one animated graphic
  per service, numbered feature list, alternating graphic/text blocks.
- [ ] P3: Redesign About (`src/app/about/page.tsx`) — animated credentials/
  timeline graphic; keep the real credentials content.
- [ ] P4: Redesign Contact (`src/app/contact/page.tsx`) — dynamic accent
  graphics around the form; **do not change the form logic**.
- [ ] P5: Polish FAQ (`src/app/faq/page.tsx`) — subtle reveal motion and a small
  hero graphic; keep the `FAQPage` JSON-LD and answers identical.

### Quality passes
- [ ] Q1: Responsive audit across every page at 360/768/1280; fix overflow and
  spacing issues.
- [ ] Q2: Accessibility audit — headings, focus order, `aria`, contrast,
  reduced-motion; fix anything found.
- [ ] Q3: Performance audit — image sizing, avoid layout shift, ensure only
  transform/opacity animate; trim any unused CSS you added.
- [ ] Q4: Final pass — `npm run build` and `npm run lint` both green; update
  `sitemap.ts` and `Nav.tsx` if any routes changed; write a short summary of
  everything done to `scripts/overnight-summary.md`.

---

## Progress log
The agent appends one line per completed task here (date + task id + commit).
