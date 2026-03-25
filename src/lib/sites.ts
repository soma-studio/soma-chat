import type { SiteRecord } from "@/types";

const REGISTRY_COLLECTION = "soma_chat_registry";

async function ensureCollection(): Promise<void> {
  const url = `${process.env.QDRANT_URL}/collections/${REGISTRY_COLLECTION}`;
  const res = await fetch(url, {
    headers: { "api-key": process.env.QDRANT_API_KEY! },
  });

  if (res.ok) return; // Collection exists

  // Create collection with a dummy vector (we only use payload)
  await fetch(url, {
    method: "PUT",
    headers: {
      "api-key": process.env.QDRANT_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      vectors: { size: 1, distance: "Cosine" },
    }),
  });
}

function siteIdToPointId(siteId: string): number {
  // FNV-1a hash — better distribution than simple char sum
  let hash = 2166136261;
  for (let i = 0; i < siteId.length; i++) {
    hash ^= siteId.charCodeAt(i);
    hash = (hash * 16777619) & 0x7fffffff; // Keep positive 31-bit
  }
  return hash;
}

export async function getSite(siteId: string): Promise<SiteRecord | null> {
  try {
    await ensureCollection();

    const res = await fetch(
      `${process.env.QDRANT_URL}/collections/${REGISTRY_COLLECTION}/points/scroll`,
      {
        method: "POST",
        headers: {
          "api-key": process.env.QDRANT_API_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filter: {
            must: [{ key: "siteId", match: { value: siteId } }],
          },
          limit: 1,
          with_payload: true,
        }),
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const points = data.result?.points;
    if (!points || points.length === 0) return null;

    return points[0].payload as unknown as SiteRecord;
  } catch {
    return null;
  }
}

export async function upsertSite(record: SiteRecord): Promise<void> {
  try {
    await ensureCollection();

    const pointId = siteIdToPointId(record.siteId);

    await fetch(
      `${process.env.QDRANT_URL}/collections/${REGISTRY_COLLECTION}/points`,
      {
        method: "PUT",
        headers: {
          "api-key": process.env.QDRANT_API_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          points: [
            {
              id: pointId,
              vector: [0], // Dummy vector — we only use payload
              payload: record,
            },
          ],
        }),
      }
    );
  } catch (err) {
    console.error("Failed to upsert site:", err);
  }
}

export async function listSites(): Promise<SiteRecord[]> {
  try {
    await ensureCollection();

    const res = await fetch(
      `${process.env.QDRANT_URL}/collections/${REGISTRY_COLLECTION}/points/scroll`,
      {
        method: "POST",
        headers: {
          "api-key": process.env.QDRANT_API_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          limit: 100,
          with_payload: true,
        }),
      }
    );

    if (!res.ok) return [];

    const data = await res.json();
    return (data.result?.points || []).map(
      (p: { payload: unknown }) => p.payload as SiteRecord
    );
  } catch {
    return [];
  }
}
