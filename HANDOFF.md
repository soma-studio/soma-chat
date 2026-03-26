# HANDOFF — Session 35 (Updated after 35K)

## Date: 2026-03-26

## What was completed

### Session 35A — MVP
- Project scaffold (Next.js 16 + Tailwind 4 + TypeScript)
- Generic website scraper (BFS crawl, cheerio, any site)
- Content chunker (heading-based sections, 500 token max)
- Qdrant indexer (mistral-embed 1024d, batched)
- RAG pipeline (embed → search → LLM response with sources)
- Chat API with CORS (POST /api/chat)
- Site registry (initially JSON file, later migrated to Qdrant)
- Embeddable widget (Shadow DOM, dark theme, 13.6 KB)
- Landing page (hero + how-it-works + URL form placeholder)
- Tested on somastudio.xyz (21 pages, 187 chunks)

### Session 35A-Polish — Widget UX Overhaul
- Markdown rendering, suggested questions, animations, keyboard nav

### Session 35A-Fix — RAG Relevance
- Score threshold, relative source filter, max 2 sources

### Session 35B — Web Onboarding
- Pipeline orchestrator with SSE streaming
- Landing page: URL form → live terminal → snippet card

### Session 35C — Vercel Fix
- /tmp for intermediate files, Qdrant site registry

### Session 35D — Live Preview + VSCode Terminal
- Widget embedded mode (SOMA_CHAT_AUTO_OPEN)
- Preview iframe, VSCode terminal style

### Session 35E — Documentation
- CLAUDE.md, SPEC.md, HANDOFF.md, SESSION_SUMMARY.md

### Session 35F — Error Propagation
- upsertSite throws on failure, debug endpoint

### Session 35G — Qdrant Fix + Stripe Card
- Payload index on siteId, Stripe-style snippet card with syntax highlighting

### Session 35H — Landing Page Redesign
- IC service layout: Hero → Features + Pricing sidebar → How it works → Sandbox → CTA → Footer
- Manrope font replaces Geist Sans
- All sections always visible (pipeline appears inline in sandbox section)

### Session 35I — Lead Capture
- Email extraction during scraping (regex + mailto)
- pickBestEmail with domain matching and preferred prefixes
- src/lib/lead-capture.ts: Supabase insert with dedup by website URL
- Leads as source="soma-chat", industry="soma-chatbot", score=40
- Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY

### Session 35J — Intelligence Layer
- src/lib/site-analyzer.ts: LLM-powered site profiling (businessType, keyFacts, tone, persona)
- SiteProfile stored in SiteRecord, injected into RAG system prompt
- keyFacts provide fallback knowledge when vector search misses
- Adaptive RAG thresholds by corpus size (0.25/0.35/0.45)
- Multilingual page variant filter (/en, /it, /es, /de)
- "Analyse du site en cours..." step in terminal UI

### Session 35K — Scraper Fix + Conversion Banners
- JSON-LD extraction BEFORE script tag removal (flattenJsonLd)
- Nuclear text node fallback for Webflow/div-heavy sites
- hoteldesarts-aix.fr: 151 chars → 4084 chars, 2 chunks → 18 chunks
- AEO/SEO upsell banner (amber, conditional: <20 chunks)
- Custom chatbot upsell banner (always visible)
- Bare domain input (auto-prepend https://)

## Deployed
- Vercel: chatbot.somastudio.xyz
- GitHub: github.com/soma-studio/soma-chat

## Known issues from code review
- **WARNING**: In-memory rate limiter ineffective on Vercel serverless (resets on cold start)
- **WARNING**: CORS wildcard on all API routes — any origin can call chat API
- **WARNING**: `text-[#55556a]` used in footer/pricing fails WCAG AA contrast (should be `#8b8b9e`)
- **WARNING**: No aria-live on terminal output, missing aria-labels on form inputs
- **WARNING**: `detectPageType()` lacks try-catch on `new URL()`
- **WARNING**: `res.json()` error parsing not wrapped in try-catch in page.tsx
- **INFO**: Supabase client re-instantiated on every lead capture call (no singleton)
- **INFO**: ScrapedPage.type and SiteConfig.language should be union types, not string

## Manual steps pending
1. Run SQL in Supabase to add "soma-chatbot" industry
2. Add SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to Vercel env vars
3. Redeploy after env var changes

## Next session should
1. Fix WARNING items from code review (contrast, a11y, error handling)
2. README.md rewrite (open source documentation, self-hosting guide)
3. Persistent rate limiting (Vercel KV or Qdrant-based)
4. Test pipeline on diverse sites (WordPress, Shopify, static HTML, SPA)
5. GitHub repo polish (LICENSE, CONTRIBUTING)
