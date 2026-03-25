import type { SiteRecord } from "@/types";

const REGISTRY_COLLECTION = "soma_chat_registry";

async function ensurePayloadIndex(): Promise<void> {
  const headers = {
    "api-key": process.env.QDRANT_API_KEY!,
    "Content-Type": "application/json",
  };

  // Check if siteId index already exists
  const infoRes = await fetch(
    `${process.env.QDRANT_URL}/collections/${REGISTRY_COLLECTION}`,
    { headers: { "api-key": process.env.QDRANT_API_KEY! } }
  );

  if (infoRes.ok) {
    const info = await infoRes.json();
    const schema = info.result?.payload_schema;
    if (schema && schema.siteId) return; // Index already exists
  }

  console.log("Creating payload index on siteId...");
  const res = await fetch(
    `${process.env.QDRANT_URL}/collections/${REGISTRY_COLLECTION}/index`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify({
        field_name: "siteId",
        field_schema: "keyword",
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "unknown");
    console.error(`Failed to create siteId index [${res.status}]: ${errText}`);
    // Non-fatal: filtering may still work without strict mode
  } else {
    console.log("Payload index on siteId created");
  }
}

async function ensureCollection(): Promise<void> {
  const url = `${process.env.QDRANT_URL}/collections/${REGISTRY_COLLECTION}`;
  const check = await fetch(url, {
    headers: { "api-key": process.env.QDRANT_API_KEY! },
  });

  if (check.ok) {
    await ensurePayloadIndex();
    return;
  }

  console.log(`Creating registry collection: ${REGISTRY_COLLECTION}`);
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "api-key": process.env.QDRANT_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      vectors: { size: 1, distance: "Cosine" },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "unknown");
    console.error(`Failed to create registry collection [${res.status}]: ${errText}`);
    throw new Error(`Failed to create registry: ${errText}`);
  }

  console.log("Registry collection created");
  await ensurePayloadIndex();
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
  await ensureCollection();

  const pointId = siteIdToPointId(record.siteId);

  const res = await fetch(
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

  if (!res.ok) {
    const errText = await res.text().catch(() => "unknown error");
    console.error(`upsertSite failed [${res.status}]: ${errText}`);
    throw new Error(`Failed to register site: ${errText}`);
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
