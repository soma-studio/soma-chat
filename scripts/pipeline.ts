import * as path from "path";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { runPipeline } from "../src/lib/pipeline";

// Load .env.local
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

function parseArgs(): { url: string; siteId: string; maxPages: number } {
  const args = process.argv.slice(2);
  let url = "";
  let siteId = "";
  let maxPages = 50;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--url":
        url = args[++i];
        break;
      case "--site-id":
        siteId = args[++i];
        break;
      case "--max-pages":
        maxPages = parseInt(args[++i], 10);
        break;
    }
  }

  if (!url) {
    console.error(
      "Usage: npx tsx scripts/pipeline.ts --url <url> [--site-id <id>] [--max-pages 50]"
    );
    process.exit(1);
  }

  if (!siteId) {
    siteId = uuidv4().slice(0, 8);
    console.log(`Generated site ID: ${siteId}`);
  }

  return { url, siteId, maxPages };
}

async function main() {
  const { url, siteId, maxPages } = parseArgs();

  console.log(`\n${"#".repeat(50)}`);
  console.log(`  SOMA Chat Pipeline`);
  console.log(`  URL:     ${url}`);
  console.log(`  Site ID: ${siteId}`);
  console.log(`${"#".repeat(50)}`);

  await runPipeline({
    url,
    siteId,
    maxPages,
    maxDepth: 3,
    dataDir: path.join(process.cwd(), "data"),
    onEvent: (event) => {
      switch (event.type) {
        case "start":
          console.log(`\nScraping ${event.url}...`);
          break;
        case "page":
          console.log(
            `  [${event.current}/${event.maxPages}] ${event.title.substring(0, 60).padEnd(60)} (${event.chars} chars)`
          );
          break;
        case "limit":
          console.log(`\n⚠ ${event.message}`);
          break;
        case "chunking":
          console.log(`\nChunking: ${event.documents} documents -> ${event.totalChunks} chunks`);
          break;
        case "indexing":
          process.stdout.write(
            `\rIndexing: ${event.percent}% (${event.indexed}/${event.total})`
          );
          break;
        case "complete":
          console.log(`\n\n${"#".repeat(50)}`);
          console.log(
            `  Pipeline complete! ${event.pagesIndexed} pages, ${event.chunksIndexed} chunks`
          );
          console.log(`  Time: ${(event.elapsedMs / 1000).toFixed(1)}s`);
          console.log(`${"#".repeat(50)}\n`);
          break;
        case "error":
          console.error(`\nERROR: ${event.message}`);
          break;
      }
    },
  });
}

main().catch(console.error);
