import { getEmbedding, chatCompletion } from "./mistral";
import { searchSimilar, type QdrantSearchResult } from "./qdrant";
import type { SiteConfig, SiteProfile, RAGResponse } from "@/types";

function buildSystemPrompt(
  config: SiteConfig,
  siteProfile: SiteProfile | null,
  chunks: QdrantSearchResult[]
): string {
  const formattedChunks = chunks
    .map(
      (c, i) =>
        `--- Extrait ${i + 1} ---
Titre : ${c.payload.title}
Section : ${c.payload.section}
URL : ${c.payload.url}
Contenu :
${c.payload.content}
---`
    )
    .join("\n\n");

  const lang = config.language === "en" ? "anglais" : "français";

  // Build context section from profile
  let contextBlock = "";
  if (siteProfile) {
    contextBlock = `
IDENTITÉ :
Tu es ${siteProfile.persona}. ${siteProfile.businessName} est ${siteProfile.businessType.toLowerCase()}${siteProfile.location ? ` situé(e) à ${siteProfile.location}` : ""}.
${siteProfile.summary}

FAITS CLÉS QUE TU CONNAIS :
${siteProfile.keyFacts.map((f) => `- ${f}`).join("\n")}

TON À ADOPTER : ${siteProfile.tone}
`;
  }

  return `Tu es l'assistant IA de ${config.siteName} (${config.siteUrl}).
${contextBlock}
RÈGLES :
- Réponds en t'appuyant sur les FAITS CLÉS ci-dessus ET les extraits documentaires ci-dessous.
- Si un fait clé répond directement à la question, utilise-le même si les extraits sont moins pertinents.
- Si l'information n'est ni dans les faits clés ni dans les extraits, dis : "${config.fallbackMessage}"
- Ne cite une source QUE si tu utilises directement son contenu. Zéro source hors-sujet.
- N'ajoute PAS de section "Sources" à la fin de ta réponse. Les sources sont affichées automatiquement par l'interface.
- Sois naturel et conversationnel, pas robotique. Adapte-toi au ton décrit ci-dessus.
- Réponds en ${lang}.

EXTRAITS DOCUMENTAIRES :
${formattedChunks}`;
}

export async function processRAGQuery(
  siteId: string,
  message: string,
  siteConfig: SiteConfig,
  siteProfile: SiteProfile | null,
  chunksCount: number = 100
): Promise<RAGResponse> {
  const start = Date.now();

  // Collection name from siteId
  const collectionName = `soma_chat_${siteId.replace(/[^a-zA-Z0-9]/g, "_")}`;

  // Adaptive thresholds: smaller corpus needs wider search
  const qdrantThreshold = chunksCount < 30 ? 0.25 : chunksCount < 100 ? 0.35 : 0.45;
  const sourceDisplayFloor = chunksCount < 30 ? 0.30 : chunksCount < 100 ? 0.40 : 0.50;
  const maxResults = chunksCount < 30 ? 6 : 4;

  // 1. Embed the query
  const queryVector = await getEmbedding(message);

  // 2. Search similar chunks
  const results = await searchSimilar(collectionName, queryVector, maxResults, qdrantThreshold);

  // 3. Build prompt and generate response
  const systemPrompt = buildSystemPrompt(siteConfig, siteProfile, results);
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

  // 5. Filter sources: relative threshold (must be within 80% of top score) + adaptive floor
  const allSources = Array.from(urlScores.values()).sort(
    (a, b) => b.score - a.score
  );
  const topScore = allSources[0]?.score ?? 0;
  const relativeThreshold = topScore * 0.8;
  const threshold = Math.max(relativeThreshold, sourceDisplayFloor);

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
