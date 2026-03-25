# HANDOFF — Session 35

## Date: 2026-03-25

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
- Markdown rendering: __bold__, ### headings, ordered lists, hr, inline code
- Suggested questions (auto-generated, clickable pills)
- Panel open/close animation (opacity + transform)
- Toggle button icon (chat ↔ close)
- Escape key, input disabled during loading
- New conversation button, enhanced welcome screen
- Online indicator dot, polished footer

### Session 35A-Fix — RAG Relevance
- Score threshold raised (0.35 → 0.50)
- Relative source filter (80% of top score)
- Max 2 displayed sources
- LLM instructed not to duplicate source citations

### Session 35B — Web Onboarding
- Refactored scraper/chunker/indexer into importable library modules
- Pipeline orchestrator with typed event callbacks
- SSE API route (POST /api/pipeline)
- Landing page: URL form → live terminal → snippet + copy button
- Free tier: 10 pages max, upsell banner

### Session 35C — Vercel Fix
- /tmp for intermediate files on Vercel (read-only filesystem)
- Site registry migrated from JSON to Qdrant (soma_chat_registry)
- getSite/upsertSite now async
- Cleanup /tmp after pipeline

### Session 35D — Live Preview (pending)
- Widget embedded mode (SOMA_CHAT_AUTO_OPEN)
- Preview iframe between terminal and snippet

## Deployed
- Vercel: chatbot.somastudio.xyz
- GitHub: github.com/soma-studio/soma-chat

## Known issues
- Widget markdown: `__text__` links not clickable (Mistral wraps page names in double underscores)
- No abuse protection on /api/pipeline (anyone can trigger pipelines)
- No rate limiting on pipeline API
- data/ directory still has local test data (gitignored)
- README.md is default create-next-app boilerplate

## Next session should
1. Session 35D: live widget preview on completion page
2. README.md rewrite (open source documentation, self-hosting guide)
3. Abuse protection on pipeline API (IP rate limiting, CAPTCHA)
4. Test pipeline on diverse sites (WordPress, Shopify, static HTML)
5. GitHub repo polish (LICENSE, CONTRIBUTING, .github/workflows)
