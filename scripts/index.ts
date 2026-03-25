import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";
import type { Chunk } from "../src/types";

// Load .env.local
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const EMBED_MODEL = "mistral-embed";
const EMBED_DIM = 1024;
const BATCH_SIZE = 20;
const BATCH_DELAY = 500; // ms

function parseArgs(): { siteId: string } {
  const args = process.argv.slice(2);
  let siteId = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--site-id") {
      siteId = args[++i];
    }
  }

  if (!siteId) {
    console.error("Usage: npx tsx scripts/index.ts --site-id <id>");
    process.exit(1);
  }

  return { siteId };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function getCollectionName(siteId: string): string {
  // Qdrant collection names: alphanumeric + underscores
  return `soma_chat_${siteId.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

async function createCollection(collectionName: string): Promise<void> {
  const url = `${process.env.QDRANT_URL}/collections/${collectionName}`;

  // Check if collection exists
  const check = await fetch(url, {
    headers: { "api-key": process.env.QDRANT_API_KEY! },
  });

  if (check.ok) {
    console.log(`Collection "${collectionName}" exists. Deleting...`);
    await fetch(url, {
      method: "DELETE",
      headers: { "api-key": process.env.QDRANT_API_KEY! },
    });
    await sleep(1000);
  }

  // Create collection
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "api-key": process.env.QDRANT_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      vectors: {
        size: EMBED_DIM,
        distance: "Cosine",
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to create collection: ${await res.text()}`);
  }

  console.log(
    `Collection "${collectionName}" created (dim=${EMBED_DIM}, cosine)\n`
  );
}

async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const res = await fetch("https://api.mistral.ai/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: texts,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Mistral Embed error: ${err}`);
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
    const err = await res.text();
    throw new Error(`Qdrant upsert error: ${err}`);
  }
}

async function main() {
  const { siteId } = parseArgs();
  const collectionName = getCollectionName(siteId);

  console.log(`\n--- SOMA Chat Indexer ---`);
  console.log(`Site ID:    ${siteId}`);
  console.log(`Collection: ${collectionName}\n`);

  // Validate env vars
  if (!process.env.MISTRAL_API_KEY) {
    console.error("MISTRAL_API_KEY is not set");
    process.exit(1);
  }
  if (!process.env.QDRANT_URL || !process.env.QDRANT_API_KEY) {
    console.error("QDRANT_URL or QDRANT_API_KEY is not set");
    process.exit(1);
  }

  // Read chunks
  const chunksFile = path.join(
    process.cwd(),
    "data",
    siteId,
    "chunks",
    "all_chunks.json"
  );
  if (!fs.existsSync(chunksFile)) {
    console.error(`Chunks file not found: ${chunksFile}`);
    process.exit(1);
  }

  const chunks: Chunk[] = JSON.parse(fs.readFileSync(chunksFile, "utf-8"));
  console.log(`Loaded ${chunks.length} chunks\n`);

  // Create collection
  await createCollection(collectionName);

  // Process in batches
  let indexed = 0;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map((c) => c.content);

    try {
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
      const pct = Math.round((indexed / chunks.length) * 100);
      console.log(`[${pct}%] Indexed ${indexed}/${chunks.length} chunks`);

      await sleep(BATCH_DELAY);
    } catch (err) {
      console.error(`Error on batch starting at ${i}: ${err}`);
      await sleep(2000);
    }
  }

  console.log(`\nDone! Indexed ${indexed} chunks into "${collectionName}".`);
}

main().catch(console.error);
