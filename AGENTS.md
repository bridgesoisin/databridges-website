# DataBridges repository instructions

The authoritative agent instructions for this repository live in
`databridges-agent-docs-v2/04_AGENTS.md`. Read that file in full before changing
code, content, configuration or documentation.

This root file is intentionally a pointer, not a copy. Update the authoritative
file when the instructions change so two manually maintained versions cannot
drift.

For Milestone 0, revision 3 of `databridges-agent-docs-v2` is an approved working
specification only. It is not approval to deploy, publish protected claims,
change legal or privacy wording, or start later-milestone products.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
