# DataBridges website — Claude Code guide

Marketing site for DataBridges (AI consulting, Power Platform, SharePoint automation, training for Irish SMEs and public sector). Based in Kilcock, Co. Kildare.

## Model workflow (Claude Code)
- **Fable (`claude-fable-5`)** is the default (set in `.claude/settings.json`) and is used for building and iterating on the site.
- **Opus (`claude-opus-4-8`)** is the model to switch to for the monthly content/maintenance pass. Type `/model claude-opus-4-8` in Claude Code.
- The otter chatbot is intentionally **paused**: there is no Anthropic API wired yet. The mascot is a pure guide for now. The AI backend (`src/app/api/otter/route.ts`) is ready for when a key is added.

## Stack
- Next.js 16 (App Router) + React 19
- Tailwind CSS v4 (config-less, tokens in `src/app/globals.css` under `@theme`)
- Deployed on Netlify via `@netlify/plugin-nextjs` (full server runtime, so Route Handlers / API routes work)

## Commands
- `npm run dev` — local dev server
- `npm run build` — production build (must run on a platform with the matching SWC binary)
- `npm run lint` — ESLint

## Design tokens (use these, never raw hex)
- Navy `--color-navy` #0A1E3D (primary text / dark surfaces)
- Cyan `--color-cyan` #3DE0E8 (accent / CTAs)
- Yellow `--color-yellow` #FFC857 (highlight / sparkle)
- Off-white `--color-offwhite` #F8F7F4
- Fonts: Syne (headings, `.font-syne`), DM Sans (body), JetBrains Mono (`.font-jetbrains`)

## Key components
- `src/components/OtterGuide.tsx` — the otter mascot. Client component mounted globally in `layout.tsx`. Pure guide (no chatbot yet). Responsibilities:
  - Entrance wave, idle float, reading "works-at-laptop" state, chaotic-scroll "searching" state (see `VisualState`).
  - Contextual tips keyed off `data-otter-section="..."` anchors in pages, plus rotating AI-usage tips on idle.
  - Auto tips are capped at `MAX_TIPS` (5) per visitor, persisted in `localStorage` under `db_otter_tip_count`.
  - Clicking the otter opens `GUIDE_MENU` (navigation shortcuts, incl. FAQ). It never counts against the tip cap.
  - All motion is CSS in `globals.css` under "Otter guide mascot" and respects `prefers-reduced-motion`.
- `src/app/faq/page.tsx` — FAQ page optimised for SEO + AEO. Answers live in the `FAQS` array, which feeds both the visible list and the `FAQPage` JSON-LD. Keep visible answers and schema answers identical.
- `src/app/seo-aeo/page.tsx` — SEO & AEO consulting landing page and the **reference exemplar** for the target aesthetic (animated SVG graphics, scroll reveals, stat counters, tips grid, interactive tool, Service + FAQ JSON-LD). Graphics are dependency-free CSS in `globals.css` under "SEO / AEO consulting page graphics" (namespaced `.seo-*`).
- `src/components/AEOReadiness.tsx` — interactive, in-browser readiness self-check (no backend). Client component, keyboard accessible, reduced-motion safe.
- `src/app/api/otter/route.ts` — dormant AI backend for the future chatbot. Node runtime, key stays server-side, per-IP rate limited, model set via `OTTER_MODEL` (defaults to `claude-fable-5`).
- Page sections tag themselves with `data-otter-section` and `id` anchors so the otter can scroll to them.

## To wire the chatbot later
1. Add `ANTHROPIC_API_KEY` in Netlify env vars (never in the repo).
2. Optionally set `OTTER_MODEL` (Fable for voice, Sonnet for factual accuracy).
3. Re-add a chat UI in `OtterGuide.tsx` that POSTs to `/api/otter` and renders the `answer`.

## Security
- Security headers (HSTS, CSP, COOP/CORP, frame/nosniff) live in `netlify.toml`. The CSP allows `connect-src https://api.anthropic.com` for the future chatbot; tighten `script-src` with nonces if a custom server layer is added.

## Conventions
- Prefer editing tokens/CSS over inline hex.
- Keep the otter unobtrusive: frequency-cap tips, never block content, always dismissible.
- Accessibility: keep `aria-live` on tip bubbles, focus management on the chat panel, and the reduced-motion fallbacks intact.

## Overnight redesign (autonomous Fable run)
- `DESIGN_UPGRADE.md` is the durable work order for the site-wide graphics upgrade: design rules plus a checklist the agent grinds through one task at a time.
- `scripts/overnight-fable.sh` (bash) and `scripts/overnight-fable.ps1` (PowerShell) loop Claude Code headless on Fable: one task per run, build-gate + commit, and on a usage limit they sleep until the ~04:00 reset and resume. Work happens on the `redesign/overnight` branch and is never pushed.
- The per-iteration instruction is `scripts/overnight-prompt.txt`. Progress is durable in `DESIGN_UPGRADE.md` (ticked boxes + progress log), so the loop resumes cleanly after any interruption.
- The runner uses `--dangerously-skip-permissions` for unattended operation. If you run permissioned instead, add the `git`/`npm` commands to `.claude/settings.json` allowlist.

## Do not
- Do not commit secrets. `ANTHROPIC_API_KEY` lives in Netlify env vars, never in the repo.
- Do not add heavy animation libraries; CSS keyframes are sufficient here.
- Do not push the overnight branch automatically; review the diff first.
