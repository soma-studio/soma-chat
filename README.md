<div align="center">

# SOMA Chat

**Chatbot IA gratuit pour n'importe quel site web — en 5 minutes, sans carte bancaire.**

[Démo live](https://chatbot.somastudio.xyz) · [Documentation](#démarrage-rapide) · [Signaler un bug](https://github.com/soma-studio/soma-chat/issues)

![Licence MIT](https://img.shields.io/badge/licence-MIT-blue.svg)
![Next.js 16](https://img.shields.io/badge/Next.js-16-black.svg)
![Mistral AI](https://img.shields.io/badge/Mistral_AI-RAG-orange.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)

</div>

---

SOMA Chat scrape le contenu public de votre site, l'indexe dans une base vectorielle, et fait tourner un chatbot intelligent qui répond aux questions de vos visiteurs — entraîné sur **votre** contenu.

## Fonctionnalités

- **Scraping automatique** — Crawl BFS avec Cheerio, extraction de contenu depuis n'importe quel site statique ou SSR
- **Recherche vectorielle (RAG)** — Embeddings Mistral AI + Qdrant pour la recherche sémantique
- **Widget intégrable** — Une seule balise `<script>`, isolation Shadow DOM, ~15 Ko
- **Intelligence contextuelle** — Profilage du site par LLM : persona, ton, questions suggérées
- **Extraction JSON-LD** — Les données structurées (schema.org) enrichissent la base de connaissances
- **Multi-tenant** — Chaque site possède sa propre collection Qdrant (`soma_chat_{siteId}`)
- **Capture de leads** — Emails de contact extraits pendant le scraping (optionnel, Supabase)
- **Gratuit** — 10 pages indexées, chat illimité, aucune carte bancaire

## Comment ça marche

```
Votre site → Scraper (Cheerio) → Chunker → Embeddings (Mistral) → Qdrant
                                                                       ↓
Question visiteur → Embed query → Recherche vectorielle → Prompt RAG → Mistral LLM → Réponse
```

## Démarrage rapide

### Utiliser la version hébergée (recommandé)

1. Rendez-vous sur [chatbot.somastudio.xyz](https://chatbot.somastudio.xyz)
2. Entrez l'URL de votre site
3. Attendez ~20 secondes pour l'indexation
4. Copiez le snippet `<script>` dans votre site

### Auto-hébergement

```bash
git clone https://github.com/soma-studio/soma-chat.git
cd soma-chat
npm install
cp .env.example .env  # Remplissez vos clés API
npm run dev
```

#### Variables d'environnement requises

| Variable | Description |
|----------|-------------|
| `MISTRAL_API_KEY` | Clé API [Mistral AI](https://console.mistral.ai/) |
| `QDRANT_URL` | URL de l'instance [Qdrant Cloud](https://cloud.qdrant.io/) |
| `QDRANT_API_KEY` | Clé API Qdrant Cloud |
| `ADMIN_SECRET` | Secret admin pour les routes protégées |
| `NEXT_PUBLIC_SITE_URL` | URL de votre déploiement |

Optionnel (capture de leads) :

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | URL du projet Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service role Supabase |

### Pipeline CLI

```bash
# Pipeline complet (scrape + chunk + index)
npm run pipeline -- --url https://example.com --site-id mon-site --max-pages 10

# Étapes individuelles
npm run scrape -- --url https://example.com --site-id mon-site
npm run chunk -- --site-id mon-site
npm run index -- --site-id mon-site
```

## Intégration du widget

Ajoutez ce snippet avant `</body>` :

```html
<script src="https://chatbot.somastudio.xyz/widget.js" data-site-id="VOTRE_SITE_ID"></script>
```

Attribut optionnel :
- `data-color="#3b82f6"` — Couleur d'accent (toute valeur hexadécimale)

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Framework | Next.js 16 (App Router) |
| Langage | TypeScript (strict mode) |
| Scraping | Cheerio |
| Embeddings | Mistral AI (`mistral-embed`, 1024d) |
| LLM | Mistral AI (`mistral-small-latest`) |
| Base vectorielle | Qdrant Cloud |
| Widget | Vanilla JS, Shadow DOM |
| Déploiement | Vercel |
| Styles | Tailwind CSS 4 |

## Architecture

```
src/
  app/
    page.tsx              → Landing page (formulaire URL → terminal SSE → snippet)
    api/
      chat/route.ts       → POST /api/chat (requête RAG)
      pipeline/route.ts   → POST /api/pipeline (flux SSE)
      site/[id]/route.ts  → GET /api/site/:id (config widget)
  lib/
    scraper.ts            → Crawler web BFS
    chunker.ts            → Découpage par headings (500 tokens max)
    indexer.ts            → Indexeur vectoriel Qdrant
    pipeline.ts           → Orchestrateur du pipeline
    rag.ts                → Pipeline RAG (recherche → prompt → LLM)
    site-analyzer.ts      → Profilage de site par LLM
    lead-capture.ts       → Insertion leads Supabase
  types/
    index.ts              → Interfaces TypeScript
public/
  widget.js               → Widget chat intégrable (~15 Ko)
```

## Limites du tier gratuit

| Paramètre | Valeur |
|-----------|--------|
| Pages max | 10 |
| Profondeur de crawl max | 3 |
| Rate limit chat | 20 req/min par site |
| Branding | « Propulsé par SOMA Studio » |

Besoin de plus ? [Contactez-nous](https://somastudio.xyz/contact) pour des déploiements sur mesure : pages illimitées, documents internes, white-label, multi-langue.

## Contribuer

Les contributions sont les bienvenues. Merci d'ouvrir une issue pour discuter de votre proposition avant de soumettre une PR.

## Licence

[MIT](LICENSE) — SOMA Studio
