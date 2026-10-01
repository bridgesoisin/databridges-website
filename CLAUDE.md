# DataBridges website — Claude Code guide

Marketing site for DataBridges (AI consulting, Power Platform, SharePoint automation, training for Irish SMEs and public sector). Based in Kilcock, Co. Kildare.

## Repository governance
- Read root `AGENTS.md`; it delegates to the maintained instruction source at
  `databridges-agent-docs-v2/04_AGENTS.md`.
- Revision 3 of `databridges-agent-docs-v2` is active for Milestone 0 only.
  Later milestones and experimental products require separate approval.
- Preserve unrelated working-tree changes. Do not deploy, push, publish
  protected claims, or alter legal/privacy wording without the required human
  approval.

## Model workflow (Claude Code)
- **Fable (`claude-fable-5`)** is the default (set in `.claude/settings.json`) and is used for building and iterating on the site.
- **Opus (`claude-opus-4-8`)** is the model to switch to for the monthly content/maintenance pass. Type `/model claude-opus-4-8` in Claude Code.
- The otter chatbot is intentionally **paused**. The mascot is a pure guide for
  now. The AI backend (`src/app/api/otter/route.ts`) remains disabled unless
  both `OTTER_CHAT_ENABLED=true` and an Anthropic API key are configured under
  an approved release.

## Stack
- Next.js 16 (App Router) + React 19
- Tailwind CSS v4 (config-less, tokens in `src/app/globals.css` under `@theme`)
- Deployed on Netlify via `@netlify/plugin-nextjs` (full server runtime, so Route Handlers / API routes work)

## Commands
- `npm run dev` — local dev server
- `npm run build` — production build (must run on a platform with the matching SWC binary)
- `npm run lint` — ESLint
- `npm run typecheck` — standalone TypeScript check (`tsc --noEmit`)

## Design tokens (use these, never raw hex)
- Navy `--color-navy` #0A1E3D (primary text / dark surfaces)
- Cyan `--color-cyan` #3DE0E8 (accent / CTAs)
- Yellow `--color-yellow` #FFC857 (highlight / sparkle)
- Off-white `--color-offwhite` #F8F7F4
- Fonts: Syne (headings, `.font-syne`), DM Sans (body), JetBrains Mono (`.font-jetbrains`)

## Admin panel (Decap CMS)
- `/admin` is a git-based CMS (Decap CMS, self-hosted/vendored at
  `public/admin/decap-cms.js`, not npm-installed — see `public/admin/README.md`
  for why and how to update it). Backend is `git-gateway`: saves commit
  straight to `master`, which triggers the existing Netlify auto-deploy.
- One collection: **LinkedIn Posts** (`content/linkedin.json`, loaded by
  `src/data/linkedin.ts`). The loader reads from disk at build time and is the
  single source of truth the page/component consumes — edit content through
  `/admin` or that file directly, not by hand-editing the loader.
- One-time setup (Netlify dashboard, not code): Identity → enable, set
  invite-only, enable Git Gateway, invite the admin's email. Full login only
  works once that's done; `/admin` still loads and shows Decap's UI locally
  without it.
- `next.config.ts` rewrites bare `/admin` to `/admin/index.html` (no app
  route exists for it), and `netlify.toml` has a CSP override scoped to
  `/admin/*` only for the Identity/Git Gateway API calls — the site-wide CSP
  is untouched.

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
1. Obtain approval for the public AI endpoint, its privacy notice and its
   production environment changes.
2. Add `ANTHROPIC_API_KEY` in Netlify env vars (never in the repo).
3. Set `OTTER_CHAT_ENABLED=true` and optionally set `OTTER_MODEL`.
4. Re-add a chat UI in `OtterGuide.tsx` that POSTs to `/api/otter` and renders the `answer`.

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
- Do not add `public/_redirects`. This site runs on `@netlify/plugin-nextjs` (a full
  server runtime), not a static SPA, so there is no single `index.html` to catch-all to.
  A `/* /index.html 200` rule would hijack every request (including `/sitemap.xml`,
  `/robots.txt`, `/api/otter`) before the plugin's own routing runs. This exact file was
  a known bug fixed by removal during the redesign (see `REDESIGN_ROADMAP.md` Phase 4).
- Do not run the overnight/maintenance script and an interactive Claude Code session on
  `redesign/overnight` at the same time. They will commit concurrently to the same
  branch; a fix from one session can get silently absorbed into the other's commit.
