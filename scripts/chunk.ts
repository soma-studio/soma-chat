import * as fs from "fs";
import * as path from "path";
import type { ScrapedPage, Chunk } from "../src/types";

const MAX_CHUNK_SIZE = 500; // tokens
const MIN_CHUNK_SIZE = 100; // tokens
const OVERLAP = 50; // tokens

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

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function slugifyDocId(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const slug = pathname
      .replace(/^\/|\/$/g, "")
      .replace(/\//g, "-")
      .replace(/[^a-zA-Z0-9-]/g, "_");
    return slug || "index";
  } catch {
    return url.replace(/[^a-zA-Z0-9-]/g, "_");
  }
}

function slugifySection(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

interface Section {
  heading: string;
  content: string;
}

function splitIntoSections(content: string): Section[] {
  // Split on markdown headings (## or ###)
  const parts = content.split(/\n(?=#{1,3}\s+)/);
  const sections: Section[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Check if this part starts with a heading
    const headingMatch = trimmed.match(/^#{1,3}\s+(.+)/);
    if (headingMatch) {
      const heading = headingMatch[1].trim();
      const body = trimmed.slice(headingMatch[0].length).trim();
      sections.push({ heading, content: body || heading });
    } else {
      sections.push({ heading: "general", content: trimmed });
    }
  }

  // If no sections were detected, return the whole content as one section
  if (sections.length === 0) {
    sections.push({ heading: "general", content });
  }

  return sections;
}

function splitIntoChunks(
  content: string,
  maxTokens: number,
  overlap: number
): string[] {
  const sentences = content.split(/(?<=[.!?\n])\s+/);
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentSize = 0;

  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence);

    if (currentSize + sentenceTokens > maxTokens && currentChunk.length > 0) {
      chunks.push(currentChunk.join(" ").trim());

      // Keep overlap from end of previous chunk
      let overlapSize = 0;
      const overlapStart: string[] = [];
      for (let i = currentChunk.length - 1; i >= 0; i--) {
        const t = estimateTokens(currentChunk[i]);
        if (overlapSize + t > overlap) break;
        overlapStart.unshift(currentChunk[i]);
        overlapSize += t;
      }

      currentChunk = [...overlapStart, sentence];
      currentSize = overlapSize + sentenceTokens;
    } else {
      currentChunk.push(sentence);
      currentSize += sentenceTokens;
    }
  }

  if (currentChunk.length > 0) {
    const remaining = currentChunk.join(" ").trim();
    if (estimateTokens(remaining) >= MIN_CHUNK_SIZE || chunks.length === 0) {
      chunks.push(remaining);
    } else if (chunks.length > 0) {
      // Merge with previous chunk if too small
      chunks[chunks.length - 1] += " " + remaining;
    }
  }

  return chunks;
}

function processDocument(doc: ScrapedPage): Chunk[] {
  const docId = slugifyDocId(doc.url);
  const chunks: Chunk[] = [];
  const sections = splitIntoSections(doc.content);

  for (const section of sections) {
    if (section.content.trim().length < 10) continue;

    const textChunks = splitIntoChunks(section.content, MAX_CHUNK_SIZE, OVERLAP);
    const sectionSlug = slugifySection(section.heading);

    for (let i = 0; i < textChunks.length; i++) {
      chunks.push({
        chunk_id: `${docId}-${sectionSlug}-${String(i).padStart(3, "0")}`,
        doc_id: docId,
        title: doc.title,
        content: textChunks[i],
        url: doc.url,
        type: doc.type,
        section: section.heading,
        scrapedAt: doc.scrapedAt,
      });
    }
  }

  return chunks;
}

async function main() {
  const { siteId } = parseArgs();

  console.log(`\n--- SOMA Chat Chunker ---`);
  console.log(`Site ID: ${siteId}\n`);

  const scrapedDir = path.join(process.cwd(), "data", siteId, "scraped");
  const outputFile = path.join(
    process.cwd(),
    "data",
    siteId,
    "chunks",
    "all_chunks.json"
  );

  if (!fs.existsSync(scrapedDir)) {
    console.error(`Scraped directory not found: ${scrapedDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(scrapedDir).filter((f) => f.endsWith(".json"));
  console.log(`Found ${files.length} scraped documents\n`);

  const allChunks: Chunk[] = [];

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(scrapedDir, file), "utf-8");
      const doc: ScrapedPage = JSON.parse(raw);

      const chunks = processDocument(doc);
      allChunks.push(...chunks);

      console.log(
        `${doc.title.substring(0, 50).padEnd(50)} -> ${chunks.length} chunk(s)`
      );
    } catch (err) {
      console.error(`Error processing ${file}: ${err}`);
    }
  }

  // Ensure output dir exists
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });

  // Write all chunks
  fs.writeFileSync(outputFile, JSON.stringify(allChunks, null, 2), "utf-8");

  const avgSize =
    allChunks.length > 0
      ? allChunks.reduce((sum, c) => sum + c.content.length, 0) /
        allChunks.length
      : 0;

  console.log(`\n--- Summary ---`);
  console.log(`Total chunks: ${allChunks.length}`);
  console.log(
    `Avg chunk size: ${Math.round(avgSize)} chars (~${Math.round(avgSize / 4)} tokens)`
  );
  console.log(`Output: ${outputFile}`);
}

main().catch(console.error);
