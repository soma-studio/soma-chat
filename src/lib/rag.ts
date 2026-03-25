import { getEmbedding, chatCompletion } from "./mistral";
import { searchSimilar, type QdrantSearchResult } from "./qdrant";
import type { SiteConfig, RAGResponse } from "@/types";

function buildSystemPrompt(
  config: SiteConfig,
  chunks: QdrantSearchResult[]
): string {
  const formattedChunks = chunks
    .map(
      (c, i) =>
        `--- Extrait ${i + 1} ---
Titre : ${c.payload.title}
Section : ${c.payload.section}
URL : ${c.payload.url}
Score : ${c.score.toFixed(3)}
Contenu :
${c.payload.content}
---`
    )
    .join("\n\n");

  const lang = config.language === "en" ? "anglais" : "français";

  return `Tu es l'assistant IA de ${config.siteName} (${config.siteUrl}).

RÈGLES :
- Réponds UNIQUEMENT à partir des extraits documentaires fournis ci-dessous.
- Si l'information n'est pas dans les extraits, dis : "${config.fallbackMessage}"
- Cite tes sources quand c'est pertinent (titre de la page + lien).
- Sois concis, professionnel et bienveillant.
- Réponds en ${lang}.

EXTRAITS DOCUMENTAIRES :
${formattedChunks}`;
}

export async function processRAGQuery(
  siteId: string,
  message: string,
  siteConfig: SiteConfig
): Promise<RAGResponse> {
  const start = Date.now();

  // Collection name from siteId
  const collectionName = `soma_chat_${siteId.replace(/[^a-zA-Z0-9]/g, "_")}`;

  // 1. Embed the query
  const queryVector = await getEmbedding(message);

  // 2. Search similar chunks
  const results = await searchSimilar(collectionName, queryVector, 6, 0.35);

  // 3. Build prompt and generate response
  const systemPrompt = buildSystemPrompt(siteConfig, results);
  const answer = await chatCompletion(systemPrompt, message);

  // 4. Deduplicate sources by URL
  const seenUrls = new Set<string>();
  const sources = results
    .filter((r) => {
      if (seenUrls.has(r.payload.url)) return false;
      seenUrls.add(r.payload.url);
      return true;
    })
    .map((r) => ({
      title: r.payload.title,
      url: r.payload.url,
      section: r.payload.section,
      score: r.score,
    }));

  return {
    answer,
    sources,
    meta: {
      model: "mistral-small-latest",
      chunks_retrieved: results.length,
      latency_ms: Date.now() - start,
      rag_enabled: true,
    },
  };
}
