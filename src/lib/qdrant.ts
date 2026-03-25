export interface QdrantSearchResult {
  id: number;
  score: number;
  payload: {
    chunk_id: string;
    doc_id: string;
    title: string;
    content: string;
    url: string;
    type: string;
    section: string;
    scrapedAt: string;
  };
}

export async function searchSimilar(
  collectionName: string,
  vector: number[],
  limit: number = 4,
  scoreThreshold: number = 0.50
): Promise<QdrantSearchResult[]> {
  const res = await fetch(
    `${process.env.QDRANT_URL}/collections/${collectionName}/points/search`,
    {
      method: "POST",
      headers: {
        "api-key": process.env.QDRANT_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        vector,
        limit,
        score_threshold: scoreThreshold,
        with_payload: true,
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Qdrant search error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.result;
}
