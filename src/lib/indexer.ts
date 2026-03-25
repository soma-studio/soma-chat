import * as fs from "fs";
import * as path from "path";
import type { Chunk } from "@/types";

// --- Configuration ---
const EMBED_MODEL = "mistral-embed";
const EMBED_DIM = 1024;
const BATCH_SIZE = 20;
const BATCH_DELAY = 500; // ms

// --- Interfaces ---
export interface IndexOptions {
  siteId: string;
  dataDir: string;
  onProgress?: (event: IndexProgressEvent) => void;
}

export interface IndexProgressEvent {
  indexed: number;
  total: number;
  percent: number;
}

export interface IndexResult {
  chunksIndexed: number;
  collectionName: string;
}

// --- Utilities ---
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function getCollectionName(siteId: string): string {
  return `soma_chat_${siteId.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

async function createCollection(collectionName: string): Promise<void> {
  const url = `${process.env.QDRANT_URL}/collections/${collectionName}`;

  const check = await fetch(url, {
    headers: { "api-key": process.env.QDRANT_API_KEY! },
  });

  if (check.ok) {
    await fetch(url, {
      method: "DELETE",
      headers: { "api-key": process.env.QDRANT_API_KEY! },
    });
    await sleep(1000);
  }

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "api-key": process.env.QDRANT_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      vectors: { size: EMBED_DIM, distance: "Cosine" },
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to create collection: ${await res.text()}`);
  }
}

async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const res = await fetch("https://api.mistral.ai/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
  });

  if (!res.ok) {
    throw new Error(`Mistral Embed error: ${await res.text()}`);
  }

  const data = await res.json();
  return data.data.map((d: { embedding: number[] }) => d.embedding);
}

async function upsertPoints(
  collectionName: string,
  points: { id: number; vector: number[]; payload: Record<string, unknown> }[]
): Promise<void> {
  const res = await fetch(
    `${process.env.QDRANT_URL}/collections/${collectionName}/points`,
    {
      method: "PUT",
      headers: {
        "api-key": process.env.QDRANT_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ points }),
    }
  );

  if (!res.ok) {
    throw new Error(`Qdrant upsert error: ${await res.text()}`);
  }
}

// --- Main index function ---
export async function indexSite(options: IndexOptions): Promise<IndexResult> {
  const collectionName = getCollectionName(options.siteId);

  // Validate env vars
  if (!process.env.MISTRAL_API_KEY) {
    throw new Error("MISTRAL_API_KEY is not set");
  }
  if (!process.env.QDRANT_URL || !process.env.QDRANT_API_KEY) {
    throw new Error("QDRANT_URL or QDRANT_API_KEY is not set");
  }

  // Read chunks
  const chunksFile = path.join(
    options.dataDir, options.siteId, "chunks", "all_chunks.json"
  );
  if (!fs.existsSync(chunksFile)) {
    throw new Error(`Chunks file not found: ${chunksFile}`);
  }

  const chunks: Chunk[] = JSON.parse(fs.readFileSync(chunksFile, "utf-8"));

  // Create collection
  await createCollection(collectionName);

  // Process in batches
  let indexed = 0;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map((c) => c.content);

    const embeddings = await getEmbeddings(texts);

    const points = batch.map((chunk, j) => ({
      id: i + j,
      vector: embeddings[j],
      payload: {
        chunk_id: chunk.chunk_id,
        doc_id: chunk.doc_id,
        title: chunk.title,
        content: chunk.content,
        url: chunk.url,
        type: chunk.type,
        section: chunk.section,
        scrapedAt: chunk.scrapedAt,
      },
    }));

    await upsertPoints(collectionName, points);

    indexed += batch.length;
    const percent = Math.round((indexed / chunks.length) * 100);

    options.onProgress?.({ indexed, total: chunks.length, percent });

    if (i + BATCH_SIZE < chunks.length) {
      await sleep(BATCH_DELAY);
    }
  }

  return { chunksIndexed: indexed, collectionName };
}
