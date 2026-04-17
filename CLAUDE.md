# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project

**soma-chat** — An embeddable RAG chatbot widget that any website owner can install. The chatbot scrapes the site's public content, indexes it into a vector database, and answers visitor questions. Free tier (10 pages) with "Powered by SOMA Studio" branding. Open source (MIT).

**Live:** https://chatbot.somastudio.xyz
**Repo:** https://github.com/soma-studio/soma-chat

## Stack

- **Framework:** Next.js 16 (App Router), TypeScript strict
- **Styling:** Tailwind CSS 4
- **Scraping:** Cheerio (static/SSR sites)
- **LLM & Embeddings:** Mistral AI (`mistral-small-latest` + `mistral-embed`)
- **Vector DB:** Qdrant Cloud (AWS eu-west-1)
- **Site Registry:** Qdrant collection `soma_chat_registry` (payload-only, no vectors)
- **Widget:** Vanilla JS, Shadow DOM, ~15 KB
- **Deployment:** Vercel (Hobby plan)
- **Fonts:** Manrope + Geist Mono (via next/font)

## Architecture

The product has three layers:

1. **Pipeline** (scrape → chunk → embed → Qdrant): Can be triggered via CLI (`scripts/pipeline.ts`) or via the web API (`POST /api/pipeline`). The web API uses SSE to stream progress events to the client. Each site gets its own Qdrant collection named `soma_chat_{siteId}`.

2. **Chat API** (`POST /api/chat`): Receives a `siteId` + `message`, searches the corresponding Qdrant collection, builds a RAG prompt, and returns the LLM response with sources. CORS enabled for cross-origin widget usage.

3. **Widget** (`public/widget.js`): Vanilla JS file loaded via a `<script>` tag on the client's site. Creates a Shadow DOM chat panel. Supports two modes: floating (normal) and embedded (`SOMA_CHAT_AUTO_OPEN` flag for the preview iframe).

On Vercel, intermediate files (scraped pages, chunks) are written to `/tmp` and cleaned up after indexing. The site registry is stored in a Qdrant collection (`soma_chat_registry`) since `/tmp` is ephemeral.

## Key Directories

```
src/
  app/
    page.tsx              → Landing page (URL form → SSE terminal → snippet)
    layout.tsx            → Root layout, Geist fonts, metadata
    api/
      chat/route.ts       → POST /api/chat (RAG query, CORS)
      pipeline/route.ts   → POST /api/pipeline (SSE stream)
      site/[id]/route.ts  → GET /api/site/:id (site config for widget)
  lib/
    scraper.ts            → Generic website scraper (BFS crawl, cheerio)
    chunker.ts            → Heading-based text chunker (500 token max)
    indexer.ts            → Qdrant indexer (mistral-embed, batched)
    pipeline.ts           → Orchestrator (scrape → chunk → index → register)
    rag.ts                → RAG pipeline (embed → search → LLM)
    mistral.ts            → Mistral AI client (embed + chat)
    qdrant.ts             → Qdrant search client
    sites.ts              → Site registry (Qdrant-backed, async)
    constants.ts          → FREE_TIER limits
  types/
    index.ts              → All TypeScript interfaces
scripts/
  scrape.ts               → CLI wrapper for scraper
  chunk.ts                → CLI wrapper for chunker
  index.ts                → CLI wrapper for indexer
  pipeline.ts             → CLI wrapper for full pipeline
public/
  widget.js               → Embeddable chat widget (vanilla JS, Shadow DOM)
data/                     → Local dev data (scraped pages, chunks). Gitignored.
```

## Commands

```bash
npm run dev              # Start dev server (Next.js + Turbopack)
npm run build            # Production build
npm run pipeline -- --url <url> --site-id <id> --max-pages <n>  # Full pipeline
npm run scrape -- --url <url> --site-id <id>                    # Scrape only
npm run chunk -- --site-id <id>                                 # Chunk only
npm run index -- --site-id <id>                                 # Index only
npx tsc --noEmit         # Type check
```

## Free Tier Limits

| Parameter | Value |
|-----------|-------|
| Max pages | 10 |
| Max crawl depth | 3 |
| Max sites per day | 20 |
| Chat rate limit | 20 req/min per site |
| Branding | Required ("Powered by SOMA Studio") |

## RAG Configuration

| Parameter | Value |
|-----------|-------|
| Embedding model | mistral-embed (1024 dimensions) |
| LLM model | mistral-small-latest |
| Chunk size | 500 tokens max, 100 min, 50 overlap |
| Search limit | 4 chunks |
| Score threshold | 0.50 (Qdrant), 0.55 (source display) |
| Max displayed sources | 2 |
| Source filter | Relative threshold: 80% of top score |

## Widget

Embedded via:

```html
<script src="https://chatbot.somastudio.xyz/widget.js" data-site-id="SITE_ID"></script>
```

Optional attributes:
- `data-color="#3b82f6"` — Accent color (default blue)

Embedded mode (for preview iframe):
- Set `window.SOMA_CHAT_AUTO_OPEN = true` before loading the widget
- Widget fills container, hides floating button, auto-opens panel

## VoiceWidget

Floating voice assistant shipped on the landing page in Session G (commit `5fc3553`). Component: `src/components/ui/VoiceWidget.tsx` (copied from somastudio-site). Embedded via iframe from `voice.somastudio.xyz` with `autoConnect` URL param. Mounted in `src/app/layout.tsx` after `SpeedInsights`; excluded from `/admin` path. Uses `NEXT_PUBLIC_SITE_URL` for cross-origin requests (must be `https://chatbot.somastudio.xyz` in production).

## Vercel Deployment

- Filesystem is read-only except `/tmp`
- Intermediate files written to `/tmp/soma-chat-data/` and cleaned up after indexing
- Site registry stored in Qdrant (`soma_chat_registry` collection), NOT in filesystem
- Function timeout: 60s (Hobby plan). Pipeline completes in ~20s for 10 pages.
- `NEXT_PUBLIC_SITE_URL` must be `https://chatbot.somastudio.xyz` in production

## Environment Variables

```
MISTRAL_API_KEY=           # Mistral AI API key
QDRANT_URL=                # Qdrant Cloud instance URL
QDRANT_API_KEY=            # Qdrant Cloud API key (JWT)
ADMIN_SECRET=              # Admin secret for protected routes
NEXT_PUBLIC_SITE_URL=      # Widget script origin (https://chatbot.somastudio.xyz in prod)
SUPABASE_URL=              # Supabase project URL (same as somastudio-site)
SUPABASE_SERVICE_ROLE_KEY= # Supabase service role key (server only)
```

## SEO / Analytics

The production build ships a full SEO + AEO stack. Descriptive map of what exists and where.

### Google Analytics 4
GA4 measurement ID `G-F8R3JD2DCT` is injected via `src/components/GoogleAnalytics.tsx` (client component, `next/script` with `afterInteractive`). Mounted in `src/app/layout.tsx`; route-change page views fire from `usePathname`.

### JSON-LD (Schema.org)
Four structured data blocks in `src/app/page.tsx` (landing page is the only rich-result target): `SoftwareApplication`, `BreadcrumbList`, `HowTo` (5-step install flow), `FAQPage` (bound to the same items rendered by `FAQ.tsx`). Each emits a `<script type="application/ld+json">` via `dangerouslySetInnerHTML`.

### robots / sitemap / llms.txt
`src/app/robots.ts` allows `/`, disallows `/api/`, links the sitemap. `src/app/sitemap.ts` emits a single entry for the root (weekly, priority 1.0). `public/llms.txt` gives AI crawlers a concise product description.

### OpenGraph + Twitter Cards
Metadata lives in `src/app/layout.tsx` as the Next.js `metadata` export. `metadataBase` reads from `NEXT_PUBLIC_SITE_URL`; title template is `%s | SOMA Studio`. OG + Twitter fields cover type, siteName, image `/og-image.png`, alt text. The landing route overrides page-level `metadata` in `page.tsx`.

## DO NOT

- Do not use external dependencies in widget.js — it must stay vanilla JS under 15 KB
- Do not write to the filesystem in API routes (except /tmp on Vercel)
- Do not call `process.exit()` or `dotenv.config()` in `src/lib/` modules — CLI-only
- Do not use CSS-in-JS — Tailwind utility classes only
- Do not hardcode domain URLs — use `NEXT_PUBLIC_SITE_URL`
- Do not skip CORS headers on API routes — the widget calls from third-party domains
- Do not index more than `FREE_TIER.maxPages` in the web pipeline
- Do not store site records in JSON files — use Qdrant registry
