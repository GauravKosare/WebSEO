# WebSEO

An automated SEO audit tool. Paste any URL and get an instant, scored audit
(titles, meta tags, headings, images, mobile-friendliness, speed) plus
AI-generated content fixes and keyword ideas. No account required.

## Stack

- **Next.js** (App Router, TypeScript) — frontend + API routes in one project
- **MongoDB Atlas** (free tier) — stores scans and score history
- **Google Gemini API** (free tier) — generates title/meta/alt-text suggestions and keyword ideas
- **Google PageSpeed Insights API** (free) — real performance/mobile/accessibility scores
- **Vercel** — hosting + scheduled cron for daily re-scans of monitored sites

## Setup

1. Copy `.env.example` to `.env.local` and fill in:
   - `MONGODB_URI` — from your MongoDB Atlas cluster's "Connect > Drivers" page
   - `GEMINI_API_KEY` — free key from [Google AI Studio](https://aistudio.google.com/apikey)
   - `PAGESPEED_API_KEY` — a Google Cloud API key with the PageSpeed Insights API enabled
   - `CRON_SECRET` — any long random string
2. Install dependencies and run:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## How scans work

1. `POST /api/audit` fetches the target page **server-side**, through an SSRF guard
   (`src/lib/audit/urlSafety.ts`) that resolves DNS and blocks private/reserved/loopback
   addresses on the initial request *and* every redirect hop.
2. The HTML is parsed (`src/lib/audit/parsePage.ts`) and scored against a rule set
   (`src/lib/audit/rules.ts`) covering titles, meta description, headings, content length,
   canonical tags, robots directives, image alt text, viewport/mobile setup, Open Graph,
   structured data, and internal linking.
3. Google PageSpeed Insights adds real performance/SEO/accessibility scores.
4. On request, Gemini generates AI-written title/meta/H1/alt-text suggestions and
   AI-estimated keyword ideas (clearly labeled as estimates, not real search-volume data).
5. Anonymous history is tracked via an httpOnly cookie (no login) so a browser can revisit
   its past scans and enable daily monitoring, which re-scans via a Vercel Cron job hitting
   `/api/cron/rescan` (protected by `CRON_SECRET`).

## Deploy

Push to GitHub and import the repo in Vercel, or use the Vercel CLI. Set the same env vars
from `.env.example` in the Vercel project settings — Vercel automatically authenticates its
own cron calls to `/api/cron/rescan` using `CRON_SECRET`.
