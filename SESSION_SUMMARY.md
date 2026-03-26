# Session History — SOMA Chat (soma-chat)

**Repo:** C:\Users\thoma\Desktop\Claude Code\soma-chat
**Live:** https://chatbot.somastudio.xyz

---

## Session 35A — 25 mars 2026 — MVP: Generic RAG Pipeline + Widget + API

### Context
New standalone project. Embeddable RAG chatbot widget for any website. Based on the Dacher Nutrition RAG project architecture (scrape → chunk → embed → Qdrant → Mistral LLM) but generalized for any site.

### What was built
- Generic website scraper (BFS crawl, cheerio, configurable max-pages/depth)
- Content chunker (heading-based sections, 500/100/50 token params)
- Qdrant indexer (soma_chat_{siteId} collections, mistral-embed 1024d)
- RAG pipeline (embed query → vector search → augmented prompt → LLM)
- Chat API (POST /api/chat) with CORS for cross-origin widget
- Site registry (JSON file → later migrated to Qdrant)
- Embeddable widget.js (vanilla JS, Shadow DOM, dark theme, 13.6 KB)
- Landing page placeholder
- Tested on somastudio.xyz: 21 pages, 187 chunks, 47s pipeline

### Widget polish (same session)
- Line-by-line markdown renderer (__bold__, headings, lists, hr, code)
- Suggested questions (auto-generated from page titles)
- Panel animation, button icon toggle, Escape key
- New conversation button, welcome screen, online dot

### RAG tuning (same session)
- Score threshold 0.35 → 0.50, limit 6 → 4
- Relative source filter: 80% of top score, max 2 sources
- LLM prompt: "Ne cite QUE les sources utilisées"

---

## Session 35B — 25 mars 2026 — Web Onboarding (SSE Pipeline)

### Context
Wire the landing page to the pipeline. Visitor enters URL → watches pages scraped in real-time → gets snippet.

### What was built
- Refactored scraper/chunker/indexer from CLI scripts to importable library modules (src/lib/)
- Pipeline orchestrator (src/lib/pipeline.ts) with PipelineEvent callbacks
- SSE API route (POST /api/pipeline) streaming events via ReadableStream
- Landing page rewrite: URL form → terminal UI → snippet card
- Free tier constants (10 pages, 3 depth)
- CLI scripts rewritten as thin wrappers

---

## Session 35C — 25 mars 2026 — Vercel Serverless Fix

### Problem
Vercel filesystem is read-only except /tmp. Pipeline failed silently when writing scraped/chunked files.

### Fix
- Dynamic dataDir: /tmp/soma-chat-data on Vercel, data/ locally
- Site registry migrated from JSON file to Qdrant collection (soma_chat_registry)
- getSite/upsertSite/listSites now async (Qdrant API)
- /tmp cleanup after pipeline completion
- FNV-1a hash for deterministic Qdrant point IDs

---

## Session 35E — 25 mars 2026 — Project Documentation Bootstrap

### What was created
- CLAUDE.md: complete project guide (stack, architecture, commands, env vars, DO NOTs)
- SPEC.md: product spec (user flow, API, data model, SSE events, free vs pro)
- HANDOFF.md: current state + known issues + next steps
- SESSION_SUMMARY.md: full session history (35A through 35E)
- Deleted AGENTS.md boilerplate

---

## Session 35H-35K — 26 mars 2026 — Landing Page + Intelligence + Scraper

### Context
Multi-step session: redesign landing page to match somastudio.xyz service layout, add lead capture, add intelligence layer (site profiling), fix content extraction for Webflow sites, add conversion banners.

### 35H — Landing Page Redesign
- Manrope font replaces Geist Sans (matches somastudio.xyz)
- IC service page layout: Hero → Features + "Gratuit" sidebar → How it works → Sandbox → CTA → Footer
- All sections always visible (pipeline appears inline when triggered)
- Left-aligned, max-w-[940px] container

### 35I — Lead Capture
- Email extraction during BFS crawl (regex + mailto links, false positive filtering)
- pickBestEmail: domain matching + preferred prefix ordering
- src/lib/lead-capture.ts: Supabase insert with dedup by website URL
- Leads as source="soma-chat", industry_id="soma-chatbot", score=40
- Non-fatal: never breaks pipeline, silently skips if Supabase not configured
- @supabase/supabase-js installed

### 35J — Intelligence Layer + RAG Quality
- src/lib/site-analyzer.ts: LLM-powered site analysis via Mistral
  - Generates SiteProfile: businessType, businessName, location, keyFacts, tone, persona, summary, suggestedQuestions
  - Fallback profile if LLM fails
- SiteProfile stored in SiteRecord (Qdrant registry), injected into RAG system prompt
- keyFacts provide fallback knowledge when vector search misses
- Persona/tone make chatbot conversational
- Adaptive RAG thresholds: 0.25 for <30 chunks, 0.35 for <100, 0.45 for 100+
- Multilingual page variant filter (/en, /it, /es, /de skipped)
- "Analyse du site en cours..." purple step in terminal UI
- Bare domain input fix (auto-prepend https://)

### 35K — Scraper Fix + Conversion Banners
- JSON-LD extraction BEFORE script tag removal
  - flattenJsonLd() converts schema.org (Hotel, Restaurant, etc.) into readable text
  - Skips non-content schemas (BreadcrumbList, WebSite, etc.)
- Nuclear text node fallback: walks every #text node in DOM
  - Deduplicates (Webflow mobile/desktop variants)
  - Triggers when < 300 chars extracted
- hoteldesarts-aix.fr results: 151 chars → 4,084 chars, 2 chunks → 18 chunks
- Conversion banners after snippet card:
  - AEO/SEO upsell (amber, conditional: <20 chunks) → somastudio.xyz/nos-services/site-ia-ready
  - Custom chatbot upsell (always visible) → somastudio.xyz/nos-services/assistant-ia-rag

### Files created/modified

| File | Change |
|------|--------|
| `src/app/layout.tsx` | Manrope font (was Geist Sans) |
| `src/app/globals.css` | --font-manrope CSS variable |
| `src/app/page.tsx` | Full redesign: IC layout, conversion banners, analyzing event, bare domain fix |
| `src/lib/scraper.ts` | Email extraction, language filter, JSON-LD, nuclear fallback, improved div handling |
| `src/lib/pipeline.ts` | Site analysis step, lead capture integration, analyzing event type |
| `src/lib/rag.ts` | Adaptive thresholds, intelligent system prompt with SiteProfile |
| `src/lib/lead-capture.ts` | **NEW** — Supabase lead insertion |
| `src/lib/site-analyzer.ts` | **NEW** — LLM-powered site profiling |
| `src/app/api/chat/route.ts` | Pass siteProfile + chunksCount to processRAGQuery |
| `src/app/api/site/[id]/route.ts` | Return profile-aware siteName + suggestedQuestions |
| `src/types/index.ts` | SiteProfile interface, SiteRecord.siteProfile field |
| `CLAUDE.md` | Supabase env vars, font reference fix |
| `package.json` | @supabase/supabase-js dependency |

### Patterns discovered
- Webflow sites nest text in 5+ div levels — standard extractors get < 3% of content
- JSON-LD schema.org data (Hotel, Restaurant) contains structured facts (prices, hours, reviews) that dramatically improve RAG quality
- Walking every #text node ("nuclear fallback") captures all visible text regardless of HTML structure
- Single-page sites with anchor navigation (#about, #pricing) only produce 1 scraped page
- Adaptive RAG thresholds are essential: small sites (< 30 chunks) need much lower thresholds (0.25 vs 0.45)
- Site profiling via LLM generates keyFacts that serve as always-available knowledge, compensating for weak vector search on small corpora

### Commits
- `001e800` — feat: landing page redesign
- `963b38d` — feat: lead capture
- `0586249` — feat: intelligence layer
- `24b811e` — fix: accept bare domains
- `b15bb35` — feat: aggressive content extraction + JSON-LD + conversion banners

---

## Session 36 — 26 mars 2026 — Code Review Fixes (Security + Quality + A11y)

### Context
Post-35K code review identified 15 issues across security, accessibility, and code quality. All fixed in one session.

### Security fixes
- **XSS in widget markdown renderer**: Added `escapeHtml()` + `isSafeUrl()` helpers. Content escaped BEFORE inline formatting, only generated tags survive. Links validated against `http:`, `https:`, `mailto:` protocols.
- **XSS in srcDoc iframe**: `htmlEncode()` on `completeData.siteId` in iframe interpolation. Snippet siteId sanitized with alphanumeric filter.
- **detectPageType crash**: Wrapped `new URL(url)` in try-catch, defaults to `'page'`.
- **SSRF protection**: Pipeline route blocks non-HTTP protocols and private/internal IPs (localhost, RFC 1918 ranges, AWS/GCP metadata endpoints).
- **Persistent rate limiter**: Replaced in-memory `Map` (reset on Vercel cold start) with Qdrant-backed `soma_chat_rate_limits` collection. Fail-open on errors. Added siteId format validation.

### Accessibility fixes
- WCAG AA contrast: `text-[#55556a]` → `text-[#8b8b9e]` (6 occurrences, placeholder kept)
- `aria-label="URL de votre site web"` on URL input
- `aria-live="polite"` + `aria-label="Progression du pipeline"` on terminal output

### Quality & type safety fixes
- `res.json()` error parsing wrapped in try-catch (handles 502 HTML responses)
- Supabase client: lazy singleton `getSupabase()` replaces dynamic import per call
- `ScrapedPage.type`: `string` → `'page' | 'blog' | 'product' | 'faq'` union
- `SiteConfig.language` + `SiteRecord.language`: `string` → `'fr' | 'en'` union
- SSE stream: try-catch around `controller.enqueue` for client disconnection
- Widget fetch: `.catch(function () {})` → `console.warn` logging
- `PipelineEvent` discriminated union type replaces `any` in handleEvent

### Files created/modified

| File | Change |
|------|--------|
| `public/widget.js` | escapeHtml, isSafeUrl, content sanitization, fetch error logging |
| `src/app/page.tsx` | htmlEncode, PipelineEvent type, a11y attrs, contrast fix, res.json try-catch |
| `src/app/api/chat/route.ts` | Import Qdrant rate limiter, siteId validation, remove in-memory Map |
| `src/app/api/pipeline/route.ts` | SSRF protection, SSE error boundary |
| `src/lib/rate-limiter.ts` | **NEW** — Qdrant-backed rate limiter |
| `src/lib/lead-capture.ts` | Supabase singleton pattern |
| `src/lib/scraper.ts` | detectPageType try-catch, return type |
| `src/types/index.ts` | Union types for ScrapedPage.type, SiteConfig.language, SiteRecord.language |

### Commits
- `d5615b9` — fix: security (XSS, SSRF, rate limiter) + a11y + type safety

---

## Progression

| Session | Scope | Status |
|---------|-------|--------|
| 35A | MVP: pipeline + API + widget | ✅ |
| 35A-Polish | Widget UX overhaul | ✅ |
| 35B | Web onboarding (SSE terminal) | ✅ |
| 35C | Vercel serverless fix | ✅ |
| 35D | Live widget preview + VSCode terminal | ✅ |
| 35E | Project documentation | ✅ |
| 35F | Error propagation + debug endpoint | ✅ |
| 35G | Qdrant payload index + Stripe card | ✅ |
| 35H | Landing page redesign (IC layout) | ✅ |
| 35I | Lead capture (Supabase) | ✅ |
| 35J | Intelligence layer (site profiling) | ✅ |
| 35K | Scraper fix + JSON-LD + banners | ✅ |
| 36 | Code review fixes (security + a11y + types) | ✅ |
| 37 | README + GitHub polish + diverse site testing | ⬜ |
