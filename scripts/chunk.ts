import * as path from "path";
import { chunkSite } from "../src/lib/chunker";

function parseArgs(): { siteId: string } {
  const args = process.argv.slice(2);
  let siteId = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--site-id") {
      siteId = args[++i];
    }
  }

  if (!siteId) {
    console.error("Usage: npx tsx scripts/chunk.ts --site-id <id>");
    process.exit(1);
  }

  return { siteId };
}

async function main() {
  const { siteId } = parseArgs();

  console.log(`\n--- SOMA Chat Chunker ---`);
  console.log(`Site ID: ${siteId}\n`);

  const result = chunkSite({
    siteId,
    dataDir: path.join(process.cwd(), "data"),
  });

  console.log(`\n--- Summary ---`);
  console.log(`Documents processed: ${result.documents}`);
  console.log(`Total chunks: ${result.totalChunks}`);
  console.log(
    `Avg chunk size: ${result.avgChunkSize} chars (~${Math.round(result.avgChunkSize / 4)} tokens)`
  );
  console.log(`Output: ${result.outputFile}`);
}

main().catch(console.error);
