# IMMORTAIL™ MVP — Deployment Guide

## Prerequisites
- Node.js 18+
- npm 8+

## Local dev
```bash
npm install
npm run dev        # http://localhost:5173
```

## Production build
```bash
npm run build      # outputs to /dist
npm run preview    # preview the build locally
```

## Deploy to Vercel
```bash
npm i -g vercel
vercel --prod
# Framework: Vite  |  Build: npm run build  |  Output: dist
```

Or connect your Git repo at vercel.com — zero-config.

## Deploy to Netlify
```bash
npm i -g netlify-cli
netlify deploy --prod --dir dist
```

Or drag the `/dist` folder into netlify.com/drop.

## Deploy to GitHub Pages
```bash
# In vite.config.js, add: base: '/repo-name/'
npm run build
# Push dist/ to gh-pages branch
```

## Environment
No `.env` required. No API keys. No backend. Fully offline.

## PWA
The manifest is at `/public/manifest.json`.
For full service worker support, add Vite PWA plugin:
```bash
npm i -D vite-plugin-pwa
```
And register it in `vite.config.js`.

## What's in the build
| File | Size (gzip) |
|---|---|
| index.html | 0.47 kB |
| index.css  | 2.16 kB |
| app JS     | 6.24 kB |
| react      | 45.21 kB |
| **Total**  | **~54 kB** |

All data stored in localStorage. Works fully offline after first load.
