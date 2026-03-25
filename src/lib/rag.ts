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
- Ne cite une source QUE si tu utilises directement son contenu dans ta réponse. Zéro source hors-sujet.
- N'ajoute PAS de section "Sources" à la fin de ta réponse. Les sources sont affichées automatiquement par l'interface.
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
  const results = await searchSimilar(collectionName, queryVector, 4, 0.50);

  // 3. Build prompt and generate response
  const systemPrompt = buildSystemPrompt(siteConfig, results);
  const answer = await chatCompletion(systemPrompt, message);

  // 4. Deduplicate sources by URL, keeping highest score per URL
  const urlScores = new Map<
    string,
    { title: string; url: string; section: string; score: number }
  >();
  for (const r of results) {
    const existing = urlScores.get(r.payload.url);
    if (!existing || r.score > existing.score) {
      urlScores.set(r.payload.url, {
        title: r.payload.title,
        url: r.payload.url,
        section: r.payload.section,
        score: r.score,
      });
    }
  }

  // 5. Filter sources: relative threshold (must be within 80% of top score) + absolute floor
  const allSources = Array.from(urlScores.values()).sort(
    (a, b) => b.score - a.score
  );
  const topScore = allSources[0]?.score ?? 0;
  const relativeThreshold = topScore * 0.8;
  const absoluteFloor = 0.55;
  const threshold = Math.max(relativeThreshold, absoluteFloor);

  const sources = allSources
    .filter((s) => s.score >= threshold)
    .slice(0, 2);

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
