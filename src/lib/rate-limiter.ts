const COLLECTION = "soma_chat_rate_limits";
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

const qdrantUrl = () => process.env.QDRANT_URL!;
const qdrantHeaders = () => ({
  "api-key": process.env.QDRANT_API_KEY!,
  "Content-Type": "application/json",
});

let collectionReady = false;

async function ensureCollection(): Promise<void> {
  if (collectionReady) return;

  const url = `${qdrantUrl()}/collections/${COLLECTION}`;
  const check = await fetch(url, {
    headers: { "api-key": process.env.QDRANT_API_KEY! },
  });

  if (check.ok) {
    collectionReady = true;
    return;
  }

  const res = await fetch(url, {
    method: "PUT",
    headers: qdrantHeaders(),
    body: JSON.stringify({
      vectors: { size: 1, distance: "Cosine" },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "unknown");
    throw new Error(`Failed to create rate limit collection: ${errText}`);
  }

  collectionReady = true;
}

function hashId(siteId: string): number {
  let hash = 2166136261;
  for (let i = 0; i < siteId.length; i++) {
    hash ^= siteId.charCodeAt(i);
    hash = (hash * 16777619) & 0x7fffffff;
  }
  return hash;
}

export async function checkRateLimit(siteId: string): Promise<boolean> {
  try {
    await ensureCollection();

    const pointId = hashId(siteId);
    const now = Date.now();

    // Try to get existing record
    const getRes = await fetch(
      `${qdrantUrl()}/collections/${COLLECTION}/points`,
      {
        method: "POST",
        headers: qdrantHeaders(),
        body: JSON.stringify({ ids: [pointId], with_payload: true }),
      }
    );

    let existing: { payload?: Record<string, unknown> } | null = null;
    if (getRes.ok) {
      const data = await getRes.json();
      existing = data.result?.[0] ?? null;
      console.log(`[Rate Limiter] siteId=${siteId} existing=${JSON.stringify(existing?.payload)}`);
    }

    if (!existing?.payload || now > (existing.payload.resetTime as number)) {
      // New window
      await upsertPoint(pointId, { siteId, count: 1, resetTime: now + RATE_WINDOW_MS });
      return true;
    }

    const count = existing.payload.count as number;
    if (count >= RATE_LIMIT) {
      console.log(`[Rate Limiter] BLOCKED siteId=${siteId} count=${count}`);
      return false;
    }

    // Increment
    await upsertPoint(pointId, { siteId, count: count + 1, resetTime: existing.payload.resetTime });
    return true;
  } catch (err) {
    // If rate limiter fails, allow the request (fail-open)
    console.error("[Rate Limiter] Error:", err instanceof Error ? err.message : String(err));
    return true;
  }
}

async function upsertPoint(id: number, payload: Record<string, unknown>): Promise<void> {
  await fetch(
    `${qdrantUrl()}/collections/${COLLECTION}/points`,
    {
      method: "PUT",
      headers: qdrantHeaders(),
      body: JSON.stringify({
        points: [{ id, vector: [0], payload }],
      }),
    }
  );
}
