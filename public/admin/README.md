# Admin (Decap CMS)

This is the editing panel at `/admin` for **LinkedIn Posts** and **Events**.
It's a vendored (self-hosted) copy of Decap CMS, not an npm dependency — see
below for why, and how to update it.

## Files here

- `index.html` — the page shell. Loads `decap-cms.js` and reads `config.yml`
  (via `<base href="/admin/">`, needed because `/admin` is served through a
  rewrite in `next.config.ts`, not a real directory).
- `config.yml` — defines the two collections (LinkedIn Posts, Events), their
  fields, and where content/media get written in the repo.
- `decap-cms.js` (+ its `.LICENSE.txt`) — the pre-built Decap CMS bundle,
  downloaded directly from `https://unpkg.com/decap-cms@<version>/dist/decap-cms.js`.

## Why vendored instead of `npm install decap-cms-app`

At the time this was set up, `decap-cms-app` (the npm package meant for
bundling into your own app) had a broken dependency chain — a stray pnpm
`catalog:` reference in one of its transitive dependencies that plain `npm
install` can't resolve (`EUNSUPPORTEDPROTOCOL`). `decap-cms` (the
"batteries-included" package meant for exactly this drop-in-a-script-tag
use case) doesn't have that problem, so its pre-built file is downloaded
directly instead. This also keeps the CMS self-hosted rather than
CDN-loaded, so `/admin` works within the site's normal CSP
(`script-src 'self'`) with no exceptions needed there.

If `decap-cms-app` installs cleanly via npm in the future, switching to it
is a reasonable simplification, but not required.

## Updating to a newer Decap version

```bash
curl -sL "https://unpkg.com/decap-cms@<NEW_VERSION>/dist/decap-cms.js" -o public/admin/decap-cms.js
curl -sL "https://unpkg.com/decap-cms@<NEW_VERSION>/dist/decap-cms.js.LICENSE.txt" -o public/admin/decap-cms.js.LICENSE.txt
```

Then reload `/admin` locally and check the browser console for a clean
`decap-cms <NEW_VERSION>` log line with no errors before committing.
