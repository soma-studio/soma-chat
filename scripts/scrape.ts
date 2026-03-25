import * as path from "path";
import { scrapeWebsite } from "../src/lib/scraper";

function parseArgs(): {
  url: string;
  siteId: string;
  maxPages: number;
  maxDepth: number;
} {
  const args = process.argv.slice(2);
  let url = "";
  let siteId = "";
  let maxPages = 50;
  let maxDepth = 3;

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
      case "--max-depth":
        maxDepth = parseInt(args[++i], 10);
        break;
    }
  }

  if (!url) {
    console.error(
      "Usage: npx tsx scripts/scrape.ts --url <url> [--site-id <id>] [--max-pages 50] [--max-depth 3]"
    );
    process.exit(1);
  }

  if (!siteId) {
    const { v4 } = require("uuid");
    siteId = (v4() as string).slice(0, 8);
  }

  return { url, siteId, maxPages, maxDepth };
}

async function main() {
  const { url, siteId, maxPages, maxDepth } = parseArgs();

  console.log(`\n--- SOMA Chat Scraper ---`);
  console.log(`URL:       ${url}`);
  console.log(`Site ID:   ${siteId}`);
  console.log(`Max pages: ${maxPages}`);
  console.log(`Max depth: ${maxDepth}\n`);

  const result = await scrapeWebsite({
    url,
    siteId,
    maxPages,
    maxDepth,
    dataDir: path.join(process.cwd(), "data"),
    onPage: (event) => {
      console.log(
        `[${event.current}/${event.maxPages}] ${event.title.substring(0, 60).padEnd(60)} (${event.chars} chars)`
      );
    },
    onLimitReached: (event) => {
      console.log(`\n⚠ ${event.message}`);
    },
    onComplete: (event) => {
      const elapsed = (event.elapsedMs / 1000).toFixed(1);
      console.log(`\n--- Summary ---`);
      console.log(`Pages scraped:      ${event.pagesScraped}`);
      console.log(`Total content size: ${(event.totalChars / 1024).toFixed(1)} KB`);
      console.log(`Time elapsed:       ${elapsed}s`);
    },
  });

  if (result.pagesScraped === 0) {
    console.error("No pages scraped. Check the URL.");
    process.exit(1);
  }
}

main().catch(console.error);
