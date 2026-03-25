import { execSync } from "child_process";
import { v4 as uuidv4 } from "uuid";

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

function runStep(name: string, command: string): void {
  const start = Date.now();
  console.log(`\n${"=".repeat(50)}`);
  console.log(`STEP: ${name}`);
  console.log(`${"=".repeat(50)}\n`);

  try {
    execSync(command, { stdio: "inherit", cwd: process.cwd() });
  } catch {
    console.error(`\nStep "${name}" failed. Aborting pipeline.`);
    process.exit(1);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n-> ${name} completed in ${elapsed}s`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateSuggestedQuestions(scrapedDir: string, fs: any, path: any): string[] {
  const questions: string[] = [];
  const files = fs.readdirSync(scrapedDir).filter((f: string) => f.endsWith(".json"));

  const pageTitles: string[] = [];

  for (const file of files) {
    try {
      const page = JSON.parse(fs.readFileSync(path.join(scrapedDir, file), "utf-8"));
      pageTitles.push(page.title || "");
    } catch {
      // skip
    }
  }

  // Generate based on what pages exist
  questions.push("Quels services proposez-vous ?");

  if (pageTitles.some((t: string) => /tarif|prix|pricing/i.test(t))) {
    questions.push("Quels sont vos tarifs ?");
  }
  if (pageTitles.some((t: string) => /contact/i.test(t))) {
    questions.push("Comment vous contacter ?");
  }
  if (pageTitles.some((t: string) => /blog|article/i.test(t))) {
    questions.push("Quels sont vos derniers articles ?");
  }
  if (pageTitles.some((t: string) => /propos|about|équipe|team/i.test(t))) {
    questions.push("Qui \u00eates-vous ?");
  }

  // Cap at 4 questions
  return questions.slice(0, 4);
}

async function main() {
  const { url, siteId, maxPages } = parseArgs();
  const totalStart = Date.now();

  console.log(`\n${"#".repeat(50)}`);
  console.log(`  SOMA Chat Pipeline`);
  console.log(`  URL:     ${url}`);
  console.log(`  Site ID: ${siteId}`);
  console.log(`${"#".repeat(50)}`);

  // Step 1: Scrape
  runStep(
    "Scrape",
    `npx tsx scripts/scrape.ts --url ${url} --site-id ${siteId} --max-pages ${maxPages}`
  );

  // Step 2: Chunk
  runStep("Chunk", `npx tsx scripts/chunk.ts --site-id ${siteId}`);

  // Step 3: Index
  runStep("Index", `npx tsx scripts/index.ts --site-id ${siteId}`);

  // Step 4: Register site
  try {
    const fs = await import("fs");
    const path = await import("path");

    const chunksFile = path.join(
      process.cwd(),
      "data",
      siteId,
      "chunks",
      "all_chunks.json"
    );
    const scrapedDir = path.join(process.cwd(), "data", siteId, "scraped");
    const sitesFile = path.join(process.cwd(), "data", "sites.json");

    const chunks = JSON.parse(fs.readFileSync(chunksFile, "utf-8"));
    const scrapedFiles = fs
      .readdirSync(scrapedDir)
      .filter((f: string) => f.endsWith(".json"));

    // Try to get site name from first scraped page
    let siteName = siteId;
    if (scrapedFiles.length > 0) {
      const firstPage = JSON.parse(
        fs.readFileSync(path.join(scrapedDir, scrapedFiles[0]), "utf-8")
      );
      // Extract domain as site name
      try {
        siteName = new URL(url).hostname.replace("www.", "");
      } catch {
        siteName = firstPage.title || siteId;
      }
    }

    // Generate suggested questions from scraped pages
    const suggestedQuestions = generateSuggestedQuestions(scrapedDir, fs, path);
    console.log(`\nSuggested questions: ${suggestedQuestions.join(", ")}`);

    // Read existing sites
    let sites: Record<string, unknown>[] = [];
    if (fs.existsSync(sitesFile)) {
      sites = JSON.parse(fs.readFileSync(sitesFile, "utf-8"));
    }

    // Upsert site record
    const existingIndex = sites.findIndex(
      (s: Record<string, unknown>) => s.siteId === siteId
    );
    const siteRecord = {
      siteId,
      siteUrl: url,
      siteName,
      language: "fr",
      welcomeMessage: `Bonjour ! Je suis l'assistant de ${siteName}. Comment puis-je vous aider ?`,
      fallbackMessage:
        "Je ne trouve pas cette information sur notre site. N'hésitez pas à nous contacter directement.",
      accentColor: "#3b82f6",
      pagesIndexed: scrapedFiles.length,
      chunksIndexed: chunks.length,
      suggestedQuestions,
      createdAt:
        existingIndex >= 0
          ? (sites[existingIndex] as Record<string, unknown>).createdAt
          : new Date().toISOString(),
      lastScrapedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      sites[existingIndex] = siteRecord;
    } else {
      sites.push(siteRecord);
    }

    fs.writeFileSync(sitesFile, JSON.stringify(sites, null, 2), "utf-8");
    console.log(`Site registered in ${sitesFile}`);
  } catch (err) {
    console.error(`Warning: Could not register site: ${err}`);
  }

  const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(1);
  console.log(`\n${"#".repeat(50)}`);
  console.log(`  Pipeline complete! Total time: ${totalElapsed}s`);
  console.log(`${"#".repeat(50)}\n`);
}

main().catch(console.error);
