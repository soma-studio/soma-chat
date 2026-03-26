import * as fs from "fs";
import * as path from "path";
import { scrapeWebsite } from "./scraper";
import { chunkSite } from "./chunker";
import { indexSite } from "./indexer";
import { upsertSite } from "./sites";
import { captureLeadFromChatbot } from "./lead-capture";
import type { SiteRecord } from "@/types";

// --- Event types ---
export type PipelineEvent =
  | { type: "start"; siteId: string; url: string }
  | { type: "page"; title: string; url: string; chars: number; current: number; maxPages: number }
  | { type: "limit"; pagesScraped: number; totalPagesFound: number; message: string }
  | { type: "chunking"; totalChunks: number; documents: number }
  | { type: "indexing"; indexed: number; total: number; percent: number }
  | { type: "complete"; siteId: string; pagesIndexed: number; chunksIndexed: number; elapsedMs: number }
  | { type: "error"; message: string };

export interface PipelineOptions {
  url: string;
  siteId: string;
  maxPages: number;
  maxDepth: number;
  dataDir: string;
  onEvent: (event: PipelineEvent) => void;
}

// --- Dynamic data directory ---
export function getDataDir(): string {
  // Vercel serverless: filesystem is read-only except /tmp
  if (process.env.VERCEL) {
    return "/tmp/soma-chat-data";
  }
  return path.join(process.cwd(), "data");
}

// --- Helpers ---
function extractSiteName(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

function generateSuggestedQuestions(scrapedDir: string): string[] {
  const questions: string[] = [];

  try {
    const files = fs.readdirSync(scrapedDir).filter((f) => f.endsWith(".json"));
    const pageTitles: string[] = [];

    for (const file of files) {
      try {
        const page = JSON.parse(fs.readFileSync(path.join(scrapedDir, file), "utf-8"));
        pageTitles.push(page.title || "");
      } catch {
        // skip
      }
    }

    questions.push("Quels services proposez-vous ?");

    if (pageTitles.some((t) => /tarif|prix|pricing/i.test(t))) {
      questions.push("Quels sont vos tarifs ?");
    }
    if (pageTitles.some((t) => /contact/i.test(t))) {
      questions.push("Comment vous contacter ?");
    }
    if (pageTitles.some((t) => /blog|article/i.test(t))) {
      questions.push("Quels sont vos derniers articles ?");
    }
    if (pageTitles.some((t) => /propos|about|équipe|team/i.test(t))) {
      questions.push("Qui êtes-vous ?");
    }
  } catch {
    questions.push("Quels services proposez-vous ?");
  }

  return questions.slice(0, 4);
}

// --- Main pipeline ---
export async function runPipeline(options: PipelineOptions): Promise<void> {
  const { url, siteId, maxPages, maxDepth, dataDir, onEvent } = options;
  const startTime = Date.now();

  onEvent({ type: "start", siteId, url });

  try {
    // Step 1: Scrape
    const scrapeResult = await scrapeWebsite({
      url,
      siteId,
      maxPages,
      maxDepth,
      dataDir,
      onPage: (e) => {
        onEvent({
          type: "page",
          title: e.title,
          url: e.url,
          chars: e.chars,
          current: e.current,
          maxPages: e.maxPages,
        });
      },
      onLimitReached: (e) => {
        onEvent({
          type: "limit",
          pagesScraped: e.pagesScraped,
          totalPagesFound: e.totalPagesFound,
          message: e.message,
        });
      },
    });

    if (scrapeResult.pagesScraped === 0) {
      onEvent({ type: "error", message: "Aucune page n'a pu être indexée." });
      return;
    }

    // Step 2: Chunk
    const chunkResult = chunkSite({ siteId, dataDir });
    onEvent({
      type: "chunking",
      totalChunks: chunkResult.totalChunks,
      documents: chunkResult.documents,
    });

    // Step 3: Index
    const indexResult = await indexSite({
      siteId,
      dataDir,
      onProgress: (e) => {
        onEvent({
          type: "indexing",
          indexed: e.indexed,
          total: e.total,
          percent: e.percent,
        });
      },
    });

    // Step 4: Register site
    const scrapedDir = path.join(dataDir, siteId, "scraped");
    const scrapedFiles = fs.readdirSync(scrapedDir).filter((f) => f.endsWith(".json"));
    const siteName = extractSiteName(url);
    const suggestedQuestions = generateSuggestedQuestions(scrapedDir);

    const siteRecord: SiteRecord = {
      siteId,
      siteUrl: url,
      siteName,
      language: "fr",
      welcomeMessage: `Bonjour ! Je suis l'assistant de ${siteName}. Comment puis-je vous aider ?`,
      fallbackMessage:
        "Je ne trouve pas cette information sur notre site. N'hésitez pas à nous contacter directement.",
      accentColor: "#3b82f6",
      pagesIndexed: scrapedFiles.length,
      chunksIndexed: indexResult.chunksIndexed,
      suggestedQuestions,
      createdAt: new Date().toISOString(),
      lastScrapedAt: new Date().toISOString(),
    };

    try {
      await upsertSite(siteRecord);
    } catch (err) {
      console.error("Site registration failed:", err);
      // Non-fatal: the Qdrant collection with chunks exists, just the registry entry is missing
    }

    // Step 5: Capture lead for prospection (non-blocking, non-fatal)
    try {
      await captureLeadFromChatbot({
        siteUrl: url,
        siteName,
        contactEmail: scrapeResult.contactEmail,
        allEmails: scrapeResult.allEmails,
        pagesIndexed: scrapeResult.pagesScraped,
        siteId,
      });
    } catch {
      // Silently ignore — lead capture is optional
    }

    onEvent({
      type: "complete",
      siteId,
      pagesIndexed: scrapeResult.pagesScraped,
      chunksIndexed: indexResult.chunksIndexed,
      elapsedMs: Date.now() - startTime,
    });

    // Clean up temp files (important on Vercel where /tmp is shared)
    try {
      const siteDir = path.join(dataDir, siteId);
      fs.rmSync(siteDir, { recursive: true, force: true });
    } catch {
      // Non-critical — /tmp is cleaned up periodically anyway
    }
  } catch (err) {
    onEvent({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
