import * as fs from "fs";
import * as path from "path";
import type { ScrapedPage, Chunk } from "@/types";

// --- Configuration ---
const MAX_CHUNK_SIZE = 500; // tokens
const MIN_CHUNK_SIZE = 100; // tokens
const OVERLAP = 50; // tokens

// --- Interfaces ---
export interface ChunkOptions {
  siteId: string;
  dataDir: string;
}

export interface ChunkResult {
  totalChunks: number;
  documents: number;
  avgChunkSize: number;
  outputFile: string;
}

// --- Utilities ---
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
  const parts = content.split(/\n(?=#{1,3}\s+)/);
  const sections: Section[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const headingMatch = trimmed.match(/^#{1,3}\s+(.+)/);
    if (headingMatch) {
      const heading = headingMatch[1].trim();
      const body = trimmed.slice(headingMatch[0].length).trim();
      sections.push({ heading, content: body || heading });
    } else {
      sections.push({ heading: "general", content: trimmed });
    }
  }

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

// --- Main chunk function ---
export function chunkSite(options: ChunkOptions): ChunkResult {
  const scrapedDir = path.join(options.dataDir, options.siteId, "scraped");
  const outputFile = path.join(options.dataDir, options.siteId, "chunks", "all_chunks.json");

  if (!fs.existsSync(scrapedDir)) {
    throw new Error(`Scraped directory not found: ${scrapedDir}`);
  }

  const files = fs.readdirSync(scrapedDir).filter((f) => f.endsWith(".json"));
  const allChunks: Chunk[] = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(scrapedDir, file), "utf-8");
    const doc: ScrapedPage = JSON.parse(raw);
    const chunks = processDocument(doc);
    allChunks.push(...chunks);
  }

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(allChunks, null, 2), "utf-8");

  const avgSize =
    allChunks.length > 0
      ? allChunks.reduce((sum, c) => sum + c.content.length, 0) / allChunks.length
      : 0;

  return {
    totalChunks: allChunks.length,
    documents: files.length,
    avgChunkSize: Math.round(avgSize),
    outputFile,
  };
}
