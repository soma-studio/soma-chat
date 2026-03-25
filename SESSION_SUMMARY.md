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

### Commits
- `9d5cd01` — feat: SOMA Chat MVP
- `409e7fd` — polish: widget UX overhaul
- Multiple fix commits for markdown, sources, site API

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

### Commit
- `ad57701` — feat: web onboarding — SSE pipeline API + terminal UI + free tier

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

### Commit
- `6fbd220` — fix: Vercel serverless compatibility

---

## Session 35E — 25 mars 2026 — Project Documentation Bootstrap

### Context
Project built rapidly, missing proper documentation.

### What was created
- CLAUDE.md: complete project guide (stack, architecture, commands, env vars, DO NOTs)
- SPEC.md: product spec (user flow, API, data model, SSE events, free vs pro)
- HANDOFF.md: current state + known issues + next steps
- SESSION_SUMMARY.md: full session history (35A through 35E)
- Deleted AGENTS.md boilerplate

---

## Progression

| Session | Scope | Status |
|---------|-------|--------|
| 35A | MVP: pipeline + API + widget | ✅ |
| 35A-Polish | Widget UX overhaul | ✅ |
| 35B | Web onboarding (SSE terminal) | ✅ |
| 35C | Vercel serverless fix | ✅ |
| 35D | Live widget preview | ⬜ |
| 35E | Project documentation | ✅ (this session) |
| 36 | README + open source polish | ⬜ |
| 37 | Abuse protection + testing | ⬜ |
