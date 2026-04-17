# SPEC.md — soma-chat

## 1. Product Overview

**SOMA Chat** is an embeddable RAG chatbot widget. Website owners enter their URL, the system scrapes their public content, indexes it into a vector database, and generates a `<script>` snippet. Visitors on the client's site can then ask questions answered by the site's own content.

**Business model:** Open-source (MIT). Free tier with "Powered by SOMA Studio" branding. Pro tier (future) removes branding, increases page limit, adds auto-refresh.

**Target audience:** SMB owners, agencies, freelancers who want a chatbot on their site without coding.

## 2. User Flow

1. Visit chatbot.somastudio.xyz
2. Enter site URL → click "Créer"
3. Watch pages being scraped in real-time (SSE terminal)
4. Receive a `<script>` snippet
5. Paste snippet in their HTML → chatbot appears on their site

## 3. API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/pipeline` | POST | Start pipeline, returns SSE stream |
| `/api/chat` | POST | RAG query (`siteId` + `message`) |
| `/api/site/[id]` | GET | Site config for widget (name, welcome, color, questions) |

## 4. Data Model

### ScrapedPage
Intermediate format (written to disk, then discarded after indexing).
Fields: url, title, description, content, type, scrapedAt

### Chunk
Stored as Qdrant point payload in `soma_chat_{siteId}` collections.
Fields: chunk_id, doc_id, title, content, url, type, section, scrapedAt

### SiteRecord
Stored as Qdrant point payload in `soma_chat_registry` collection.
Fields: siteId, siteUrl, siteName, language, welcomeMessage, fallbackMessage, accentColor, pagesIndexed, chunksIndexed, suggestedQuestions, createdAt, lastScrapedAt

## 5. Pipeline Events (SSE)

| Event type | Fields | Description |
|------------|--------|-------------|
| start | siteId, url | Pipeline started |
| page | title, url, chars, current, maxPages | Page scraped |
| limit | pagesScraped, totalPagesFound, message | Free tier limit reached |
| chunking | totalChunks, documents | Chunking complete |
| indexing | indexed, total, percent | Indexing progress (%) |
| complete | siteId, pagesIndexed, chunksIndexed, elapsedMs | Done |
| error | message | Pipeline failed |

## 6. Free Tier vs Pro (future)

| Feature | Free | Pro |
|---------|------|-----|
| Pages indexed | 10 | 500+ |
| Questions/month | 200 | Unlimited |
| Refresh | Manual | Auto (weekly) |
| Branding | "Powered by SOMA Studio" | White label |
| Customization | Color + message | Tone, persona, custom prompts |
| Support | GitHub issues | Email |
| Price | 0€ | TBD (29-79€/month) |

## 7. Widget Features

- Shadow DOM CSS isolation
- Dark theme chat panel (380x520px, responsive mobile)
- Markdown rendering (bold, headings, lists, links, code, hr)
- Source citations with links
- Suggested questions (auto-generated from scraped pages)
- Typing indicator
- New conversation button
- Online indicator dot
- Panel open/close animation
- Escape key to close
- Input disabled during loading
- "Powered by SOMA Studio" footer
- Embedded mode (SOMA_CHAT_AUTO_OPEN) for preview

---

## 8. Post-Bootstrap Additions

Sections 1-7 are the original bootstrap spec. Features shipped afterward (Sessions 35H-K, 37D-F, G, I, K) are documented in CLAUDE.md and SESSION_SUMMARY.md. Key additions:

- **CMS-driven content** (Session 37D): `src/lib/cms-data.ts` fetches FAQ + features from Payload REST on somastudio.xyz with 1h ISR; fallbacks when the CMS is unreachable. Consumed by `ChatbotPage.tsx` + `FAQ.tsx`.
- **Lead capture** (Session 35I): emails extracted during scrape land in Supabase `leads` table with `source: "soma-chat"`.
- **Intelligence layer** (Session 35J): LLM-generated site profile (`businessType`, `tone`, `persona`) drives adaptive RAG thresholds and welcome messages.
- **SEO / AEO** (Session 37F): GA4 + 4 JSON-LD schemas + robots / sitemap / llms.txt + OpenGraph + Twitter cards. Descriptive map in CLAUDE.md "SEO / Analytics".
- **VoiceWidget** (Session G): floating voice assistant embedded from `voice.somastudio.xyz` on the landing page. Described in CLAUDE.md "VoiceWidget".
- **Navbar + Footer alignment** (Sessions I, K): navigation links harmonized with somastudio.xyz (`Projets → Tarifs`, `Blog → Ressources`), GitHub footer link added.
