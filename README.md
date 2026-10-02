# DataBridges website

Marketing site for DataBridges — AI consulting, Power Platform and SharePoint
automation, and AI training for Irish SMEs and the public sector. Based in
Kilcock, Co. Kildare.

## Stack

- [Next.js 16](https://nextjs.org) (App Router) + React 19
- Tailwind CSS v4 (config-less, design tokens in `src/app/globals.css` under `@theme`)
- Deployed on [Netlify](https://netlify.com) via `@netlify/plugin-nextjs` (full server runtime — Route Handlers / API routes work)

## Getting started

```bash
npm install
npm run dev
