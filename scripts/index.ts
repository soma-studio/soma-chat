import * as path from "path";
import dotenv from "dotenv";
import { indexSite } from "../src/lib/indexer";

// Load .env.local
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

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

async function main() {
  const { siteId } = parseArgs();

  console.log(`\n--- SOMA Chat Indexer ---`);
  console.log(`Site ID: ${siteId}\n`);

  const result = await indexSite({
    siteId,
    dataDir: path.join(process.cwd(), "data"),
    onProgress: (event) => {
      console.log(`[${event.percent}%] Indexed ${event.indexed}/${event.total} chunks`);
    },
  });

  console.log(`\nDone! Indexed ${result.chunksIndexed} chunks into "${result.collectionName}".`);
}

main().catch(console.error);
