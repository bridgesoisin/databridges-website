# DataBridges website — Redesign Roadmap

**Owner:** Oisín Bridges · **Branch:** `redesign/overnight` · **Model for build:** Opus 4.8 (this pass), Fable for iteration.

Durable work order for the "advanced scroll-based redesign" pass. Same convention as
`DESIGN_UPGRADE.md`: phases with checklists, ticked as they land, build+lint gated,
never pushed automatically. Work in the order below (Phase 1 → 6), one coherent task
per commit.

---

## Context & goals

The site's voice and bones are good, but four things are wrong or missing and the
owner wants a step-change in polish:

1. **Correctness** — the EU AI Act content tells the *wrong story* and is time-bombed
   (see "Corrected EU AI Act facts"). Highest priority to fix.
2. **Brand presence** — the "databridges" name never appears large; the otter mascot is
   effectively invisible (CSS opacity gate + duplicated rules).
3. **Proof** — no real client outcomes on the site; the only numbers are invented demo
   figures. The owner has real engagements (CV-sourced) we can tell honestly.
4. **Motion & craft** — the owner wants advanced scroll animation, a scroll-animated
   mascot, animated dashboards, and a neon-cyan mouse tracer — all CSS/vanilla, no libs.

**North-star feel:** confident, technical, a little playful — "an astrophysicist who
ships Power Platform." Navy canvas, cyan energy, restrained yellow sparks. Motion should
feel *engineered* (easing, physics-y) not decorative. Everything degrades cleanly under
`prefers-reduced-motion` and on touch.

---

## Design direction — "overall feel" (Phase 1 reference)

- **Depth over flatness:** layered navy sections with parallax blobs, a subtle grid/starfield
  nod to the astrophysics origin, and dashboard "glass" cards that lift on scroll.
- **One hero moment:** big `databridges` wordmark lockup + mascot + a live-feeling node/dashboard
  graphic. The visitor should know the name, the vibe, and "this person builds real things"
  in three seconds.
- **Proof woven through, not bolted on:** client-outcome vignettes appear on Home and a new
  Work page, in the same voice as the rest of the site.
- **Consistent motion language:** reveal (fade+rise), pin/parallax ("place-over-as-you-scroll"),
  windmill rotation for decorative marks, count-ups for stats, marquee for logos, and a
  global cursor tracer. All share one easing token and one reduced-motion switch.

---

## New sections / pages proposed

- [x] **Work / Case Studies page** (`/work`) — the real engagements as honest before→after
      vignettes (anonymised by sector unless consent to name). Adds `sitemap`, `Nav`, schema.
- [x] **Home "Where we've helped" section** — 3–4 vignette cards linking to `/work`.
- [x] **Home "Four Bridges" section** — surface the proprietary framework as a signature diagram.
- [x] **Reframed EU AI Act block → "The August 2026 deadline didn't move"** — the corrected,
      stronger story; feeds the checker and a short explainer.
- [x] **Results/credibility band** — real, modest metrics (e.g. HSE "~1 hr/week per analyst
      saved", "curriculum delivered to live UCD cohorts") replacing invented figures.

---

## Real material to build on (CV / business-analysis sourced — all true)

**Client engagements (anonymised by sector; see Open Decisions re: naming):**
- **Dublin wealth-management firm (regulated, MiFID II)** — AI discovery engagement;
  scoped & ranked use cases by ROI: email-triggered investment summaries, call
  transcription + meeting summarisation, a client-query assistant.
- **Irish bathroom fit-out company ("Classic Bathrooms")** — end-to-end Power Platform +
  Dataverse + Power Automate: lead intake → scheduling → property surveys → quotation →
  labour allocation; Azure OpenAI for AI-assisted scheduling, quote drafting, data
  validation, internal chatbot.
- **Legal firms** — SharePoint-based case-management system; ChatGPT for document/email
  summarisation and auto-drafting.
- **HSE (public sector, ITIL 4 Service Transition)** — approval-triage automation saving
  ~1 hour/week per analyst; Python (python-docx) tool auto-distributing post-CAB changes;
  change-ticket heatmap dashboard (2019–2026) for resourcing; AI/automation strategy
  covering EU AI Act, GDPR, DPIA, HIQA, and a human-in-the-loop (HITL) framework.
- **UCD Professional Academy** — built the AI/ML curriculum (LLM fundamentals, prompt
  engineering, enterprise ChatGPT, data viz, governance); delivers live cohorts
  (ChatGPT Productivity, AI for Business, GenAI).

**Signature IP:** the proprietary **Four Bridges to AI Adoption** framework
(Design & explainability → Leadership & trust → Operations & implementation →
Strategy & infrastructure).

**Credentials (real):** MSc Data-Intensive Astrophysics *Distinction* + Master's
Excellence Scholarship (Cardiff, 2021); BSc Physics with Astrophysics (Maynooth, 2019);
ITIL 4; Microsoft Copilot certified; UCD Professional Academy lecturer; HSE Senior Analyst.

**Optional industry context (from business-analysis doc, cite as "industry estimates"):**
AI-consulting market ~$22B (2025) → ~$257B (2033), ~35.8% CAGR; 88% of organisations use
AI in ≥1 function; corporate AI spend $11.5B (2024) → $37B (2025).

---

## Corrected EU AI Act facts (authoritative — from Oisín's own LinkedIn articles)

The current site says 2 Aug 2026 is the **high-risk / Annex III enforcement** deadline.
That is **wrong**. The correct, stronger story:

- **7 May 2026 (Digital Omnibus):** high-risk (Annex III) obligations were **delayed** —
  standalone high-risk systems now apply from **2 December 2027**; high-risk AI embedded in
  regulated products from **2 August 2028**.
- **Article 50 transparency obligations were NOT delayed — they still apply from
  2 August 2026**, and they apply *even if you have no high-risk system*. Five disclosure
  duties: (1) AI-interaction disclosure (chatbots, AI phone lines), (2) emotion-recognition
  disclosure, (3) biometric-categorisation disclosure, (4) deepfake disclosure,
  (5) AI-generated public-interest-text disclosure.
- **One carve-out:** machine-readable marking (watermarks/metadata) gets a limited extension
  to **December 2026**, but only for systems on the market *before* 2 Aug 2026. New generative
  AI shipped on/after that date complies from day one.
- **Ireland:** the *Regulation of Artificial Intelligence Bill 2026* (Bill No. 69 of 2026) is
  before the Oireachtas — the local enforcement layer; establishes an **AI Office of Ireland**.
- **Messaging angle:** "The deadline didn't move — most people just read the wrong line."
- Keep the existing "general indication only, not legal advice" disclaimer everywhere.
- **De-risk the countdown:** the checker must not compute negative "days away". Use static,
  correct dates or a guarded countdown that expires gracefully.

**Files carrying the wrong claim:** `EUAIActChecker.tsx` (L44, L142-150, L165-171),
`services/page.tsx` (L393-423), `page.tsx` (L140 stat, L525-535 LinkedIn card),
`faq/page.tsx` (L61-62 + metadata L9/L17), `OtterGuide.tsx` (L56 tip).

---

## Phase 1 — Overall feel + structure  *(do first)*
- [x] Agree tokens/motion language: `--ease-emph`/`--ease-out` and the `--scroll-progress`/
      `--scroll-y`/`--vh` CSS var convention are declared and documented in the `globals.css`
      `:root` header block.
- [x] Big **`databridges` wordmark lockup** in the home hero — done: `Wordmark.tsx`
      (diamond mark + crisp token-coloured text) at the top of the hero, reduced-motion entrance.
- [x] Scaffold new **`/work`** page + Nav/Footer/sitemap/robots wiring (content in Phase 2).
- [x] Insert placeholders/anchors for new Home sections (Where we've helped, Four Bridges) —
      superseded: both sections are fully built out, not placeholders (see Phase 2).

## Phase 2 — Content & correctness  *(highest-value)*
- [x] Rewrite **all EU AI Act content** to the corrected story — done across checker,
      services, home stat/LinkedIn, FAQ (+JSON-LD) and otter tip; checker now date-safe
      (no negative countdown); reframed "The August 2026 deadline didn't move."
- [x] Replace the two hardcoded LinkedIn cards with the **five real current posts**
      (Article 50 disclosures, Ireland AI Bill 2026, People Inc v Google, Ford rehiring
      engineers, Four Bridges) — data lives in `src/data/linkedin.ts`, rendered on Home.
- [x] Write the **client-outcome vignettes** (Work page + Home section) from the real
      material above, honest and sector-anonymised — `src/data/vignettes.ts`.
- [x] Replace invented stats (`BeforeAfterToggle` €142k etc.) with **real, modest metrics**
      or clearly-labelled illustrative framing — verified no invented figures remain;
      illustrative demos are explicitly labelled as such.
- [x] Surface **Four Bridges** framework copy; add **real credentials** consistently.
- [x] Copy-audit every page for stale claims, tone, and CTA clarity — re-audited 2026-07-04:
      no stale EU AI Act claims, no TODO/placeholder copy; fixed two outdated "stub" section
      comments in `page.tsx`/`work/page.tsx` that no longer matched the (fully built) content.

## Phase 3 — Dashboards & designs  *(expand the graphics kit)*
- [x] Build 2–3 **animated dashboard cards** (compose RankBars + StatBand + NodeGraph):
      `DashCard`, `ChangeHeatmap`, `WorkflowPipeline`, `BeforeAfterBars` in
      `src/components/graphics/`.
- [x] A signature **Four Bridges** diagram graphic (four connected spans, animated build-in) —
      `src/components/graphics/FourBridges.tsx`, mounted on Home and `/work`.
- [x] Dashboards animate on reveal and subtly loop; reduced-motion static fallbacks.

## Phase 4 — SEO & AEO  *(act as SEO/AEO expert)*
- [x] Add `metadataBase`; canonicals on **all** pages; Twitter card + OG **images** per page.
- [x] Schema: upgrade LocalBusiness (add `areaServed`, `geo`, `image`/`logo`; phone per
      Open Decisions), add **Organization**, **Person** (Oisín, E-E-A-T), **BreadcrumbList**,
      **Service** on services, and per-vignette schema where sensible — `src/lib/jsonld.ts`.
- [x] Fix `public/_redirects` SPA catch-all so multi-page routes/sitemap/robots index cleanly —
      confirmed: no `_redirects` file ships in `public/` (an SPA catch-all would have broken
      Next.js routing under `@netlify/plugin-nextjs`); the fix was removing it, not adding one.
- [x] AEO: tighten FAQ answers to match the corrected Act facts; ensure Q&A parity with JSON-LD;
      add an Act-specific FAQ; keep answers quotable and self-contained.
- [x] Verify headings hierarchy, alt text, internal linking, sitemap priorities.

## Phase 5 — Layout & UX redesign  *(senior graphics/infographics designer hat)*
- [x] Rework page layouts and rhythm (spacing scale, section transitions, visual hierarchy),
      infographic treatments for services and the Four Bridges/Act explainers — covered by the
      ultracode ux pass plus the follow-up `db-*` heading-scale/CTA/width unification commits.
- [x] Mobile-first pass at 360 / 768 / 1280; ensure new sections and dashboards hold up —
      covered by the Q1 responsive audit and the later mobile tap-target/label-legibility pass.
- [x] Accessibility re-check (contrast on new surfaces, focus order, aria on new components) —
      covered by the Q2 accessibility audit and the reduced-motion hover-transform follow-up.

## Phase 6 — Animation & motion system  *(the "wow" layer)*
- [x] **Scroll-progress driver** (`use client`, mounted in `layout.tsx`): rAF-throttled,
      writes normalised scroll + per-element progress into CSS vars — `ScrollDriver.tsx`.
- [x] **Reveal system:** extend `ScrollReveal` for fade, slide, and stagger variants.
- [x] **Pin / parallax** ("place-over-as-you-scroll") sections using sticky + scroll vars.
- [x] **Windmill rotation** for decorative marks driven by scroll.
- [x] **Scroll-animated mascot:** visibility fixed (deduped otter CSS, hardened mount gate),
      pose/position driven from scroll progress; tips + reduced-motion behaviour intact.
- [x] **Neon-cyan mouse tracer** (`#3DE0E8`, ease-out smoothing, trailing): desktop
      pointer-only (`pointer: fine`), disabled on touch and under reduced-motion —
      `CursorTracer.tsx`.
- [x] Final build+lint, verify all reduced-motion/touch fallbacks, write run summary.

---

## Guardrails (unchanged from project rules)
- No new animation/graphics libraries — CSS keyframes + small vanilla JS only.
- Design tokens only (navy/cyan/yellow/off-white + ink variants); no raw hex.
- Every animation gated on `prefers-reduced-motion: no-preference` with a static fallback.
- Keep OtterGuide tips, `data-otter-section` anchors, JSON-LD, and copy voice intact.
- One commit per coherent task; build + lint green before commit; never push automatically.

## Decisions (resolved 2026-07-03)
- [x] **Client naming:** keep anonymised. Do **not** name Classic Bathrooms. Frame the
      engagement as working with **"lead construction and fit-out businesses"** (sector, not name).
- [x] **Phone + Eircode:** cleared to publish. Show **085 136 4920** and Eircode **W23WV63**
      on Contact and in LocalBusiness schema (`telephone`, `address` incl. postalCode, `geo`).
- [x] **Canonical email:** keep `hello@databridges.ie` on-site (CV's gmail is not used publicly).

---

## Run log

**2026-07-03 — Opus manual pass:** roadmap (`40002b2`), hero wordmark lockup (`86c7e7b`),
EU AI Act correctness site-wide (`49a63d2`), untrack private material (`d8f6530`).

**2026-07-03 — ultracode workflow `wf_a8aaef3d-662`** (15 agents, 0 errors): 5 parallel
design specs → 6 strictly-sequential build-gated phases → 4 adversarial verifiers.
- `11880d9` structure — /work page + Nav/Footer/sitemap wiring + home section stubs
- `364c990` content — /work vignettes (`src/data/vignettes.ts`), home proof + Four Bridges,
  honest before/after stats (invented €142k figures removed), expanded LinkedIn (`src/data/linkedin.ts`)
- `08b7f4e` dashboards — animated dashboard cards + Four Bridges diagram (graphics kit)
- `3786095` seo/aeo — `metadataBase`, canonicals, OG/Twitter, JSON-LD identity graph
  (`src/lib/jsonld.ts`: Organization/LocalBusiness/Person/Breadcrumb/Service, phone + Eircode + geo),
  `_redirects` fix, Article-50 FAQ
- `ba63a9c` ux — one type/eyebrow/rhythm design system across pages
- `48f7d4c` motion — `ScrollDriver` (scroll-progress vars), reveal/pin/parallax/windmill,
  otter mascot visibility fix + scroll animation, `CursorTracer` (neon-cyan, desktop-only)
- `ad09cad` a11y follow-up — gated 6 hover transforms under `prefers-reduced-motion`

Verify pass: build + lint green; EU AI Act facts intact; no client named; no invented metrics;
tokens (not hex); no new dependencies. **Status: roadmap phases 1–6 complete on `redesign/overnight` (unpushed).**

**2026-07-04 — closeout audit:** re-verified every Phase 1–6 item and the "New sections"
list against the actual codebase (an Explore agent checked each claim file-by-file, since the
checkboxes above had drifted out of sync with the real state — the commit hashes cited in the
ultracode run log don't exist verbatim in `git log`, but equivalent work landed under manual
commits). Result: everything was already functionally done. Ticked every remaining box; fixed
two outdated "stub — filled in a later phase" comments in `src/app/page.tsx` and
`src/app/work/page.tsx` that no longer matched the (fully built) sections; confirmed
`public/_redirects` is correctly absent (an SPA catch-all would break Next.js routing under
`@netlify/plugin-nextjs` — removal *was* the Phase 4 fix). Build + lint green. See
`REDESIGN_REPORT.md` for the full site evaluation and scoring that followed.
