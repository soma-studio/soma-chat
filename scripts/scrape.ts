import * as fs from "fs";
import * as path from "path";
import * as cheerio from "cheerio";
import type { ScrapedPage } from "../src/types";

// --- Configuration ---
const MAX_PAGES_DEFAULT = 50;
const MAX_DEPTH_DEFAULT = 3;
const CRAWL_DELAY = 500; // ms between requests
const MIN_CONTENT_LENGTH = 50;
const USER_AGENT =
  "Mozilla/5.0 (compatible; SomaChatBot/1.0; +https://somastudio.xyz)";

// Elements to remove before content extraction
const NOISE_SELECTORS = [
  "nav",
  "footer",
  "header",
  "script",
  "style",
  "noscript",
  "iframe",
  "aside",
  "[role='complementary']",
  "[role='navigation']",
  "[role='banner']",
  ".cookie-banner",
  ".cookie-consent",
  "#cookie-consent",
  ".popup",
  ".modal",
  ".sidebar",
  ".menu",
  ".nav",
  ".advertisement",
  ".ad",
  ".social-share",
  ".comments",
].join(", ");

// Content container selectors in priority order
const CONTENT_SELECTORS = [
  "main",
  "article",
  "[role='main']",
  ".content",
  ".post-content",
  ".entry-content",
  ".page-content",
  "#content",
  "#main",
  "#main-content",
];

// File extensions to skip
const SKIP_EXTENSIONS = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".svg",
  ".webp",
  ".mp4",
  ".mp3",
  ".zip",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".css",
  ".js",
  ".xml",
  ".rss",
]);

// --- CLI argument parsing ---
function parseArgs(): {
  url: string;
  siteId: string;
  maxPages: number;
  maxDepth: number;
} {
  const args = process.argv.slice(2);
  let url = "";
  let siteId = "";
  let maxPages = MAX_PAGES_DEFAULT;
  let maxDepth = MAX_DEPTH_DEFAULT;

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
    console.error("Usage: npx tsx scripts/scrape.ts --url <url> [--site-id <id>] [--max-pages 50] [--max-depth 3]");
    process.exit(1);
  }

  if (!siteId) {
    // Generate short ID from URL
    const { v4 } = require("uuid");
    siteId = (v4() as string).slice(0, 8);
  }

  return { url, siteId, maxPages, maxDepth };
}

// --- URL utilities ---
function normalizeUrl(href: string, baseUrl: string): string | null {
  try {
    const parsed = new URL(href, baseUrl);
    // Remove hash
    parsed.hash = "";
    // Remove common tracking params
    const trackingParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "fbclid",
      "gclid",
      "ref",
    ];
    for (const param of trackingParams) {
      parsed.searchParams.delete(param);
    }
    // Remove trailing slash (except for root)
    let normalized = parsed.toString();
    if (normalized.endsWith("/") && parsed.pathname !== "/") {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return null;
  }
}

function isSameDomain(url: string, baseUrl: string): boolean {
  try {
    const a = new URL(url);
    const b = new URL(baseUrl);
    return a.hostname === b.hostname;
  } catch {
    return false;
  }
}

function hasSkippableExtension(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return Array.from(SKIP_EXTENSIONS).some((ext) => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

function urlToSlug(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const slug = pathname
      .replace(/^\/|\/$/g, "")
      .replace(/\//g, "-")
      .replace(/[^a-zA-Z0-9-]/g, "_");
    return slug || "index";
  } catch {
    return "unknown";
  }
}

function detectPageType(url: string): string {
  const pathname = new URL(url).pathname.toLowerCase();
  if (pathname.includes("/blog") || pathname.includes("/article") || pathname.includes("/post")) {
    return "blog";
  }
  if (pathname.includes("/product") || pathname.includes("/shop") || pathname.includes("/boutique")) {
    return "product";
  }
  if (pathname.includes("/faq") || pathname.includes("/question")) {
    return "faq";
  }
  return "page";
}

// --- Content extraction ---
function extractContent($: cheerio.CheerioAPI): string {
  // Remove noise elements
  $(NOISE_SELECTORS).remove();

  // Find the best content container
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let $content: cheerio.Cheerio<any> | null = null;
  for (const selector of CONTENT_SELECTORS) {
    const found = $(selector);
    if (found.length > 0) {
      $content = found.first();
      break;
    }
  }

  // Fallback to body
  if (!$content || $content.length === 0) {
    $content = $("body");
  }

  const lines: string[] = [];

  // Walk through elements and extract text with structure
  $content.find("h1, h2, h3, h4, h5, h6, p, li, blockquote, td, th, figcaption, div").each((_i, el) => {
    const $el = $(el);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tagName = (el as any).tagName?.toLowerCase();

    // Skip divs that contain other block elements (avoid duplication)
    if (tagName === "div") {
      const hasBlockChildren = $el.children("h1, h2, h3, h4, h5, h6, p, ul, ol, table, article, section, div").length > 0;
      if (hasBlockChildren) return;
    }

    const text = $el.text().replace(/\s+/g, " ").trim();
    if (!text) return;

    switch (tagName) {
      case "h1":
        lines.push(`\n# ${text}\n`);
        break;
      case "h2":
        lines.push(`\n## ${text}\n`);
        break;
      case "h3":
        lines.push(`\n### ${text}\n`);
        break;
      case "h4":
      case "h5":
      case "h6":
        lines.push(`\n#### ${text}\n`);
        break;
      case "li":
        lines.push(`- ${text}`);
        break;
      case "blockquote":
        lines.push(`> ${text}`);
        break;
      default:
        lines.push(text);
    }
  });

  // Extract tables as pipe-delimited markdown
  $content.find("table").each((_i, table) => {
    const rows: string[][] = [];
    $(table)
      .find("tr")
      .each((_j, tr) => {
        const cells: string[] = [];
        $(tr)
          .find("td, th")
          .each((_k, cell) => {
            cells.push($(cell).text().replace(/\s+/g, " ").trim());
          });
        if (cells.length > 0) rows.push(cells);
      });

    if (rows.length > 0) {
      lines.push("");
      for (let r = 0; r < rows.length; r++) {
        lines.push(`| ${rows[r].join(" | ")} |`);
        if (r === 0) {
          lines.push(`| ${rows[r].map(() => "---").join(" | ")} |`);
        }
      }
      lines.push("");
    }
  });

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractMetadata($: cheerio.CheerioAPI): {
  title: string;
  description: string;
} {
  const title =
    $("title").text().trim() ||
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("h1").first().text().trim() ||
    "";

  const description =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    "";

  return { title, description };
}

function extractLinks(
  $: cheerio.CheerioAPI,
  currentUrl: string,
  baseUrl: string
): string[] {
  const links: string[] = [];

  $("a[href]").each((_i, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    const normalized = normalizeUrl(href, currentUrl);
    if (!normalized) return;

    if (!isSameDomain(normalized, baseUrl)) return;
    if (hasSkippableExtension(normalized)) return;

    // Skip mailto, tel, javascript links
    if (href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
      return;
    }

    links.push(normalized);
  });

  return links;
}

// --- Fetcher ---
async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      console.warn(`  [${res.status}] ${url}`);
      return null;
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return null;
    }

    return await res.text();
  } catch (err) {
    console.warn(`  [ERROR] ${url}: ${err}`);
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// --- Main crawl ---
async function main() {
  const { url, siteId, maxPages, maxDepth } = parseArgs();
  const startTime = Date.now();

  console.log(`\n--- SOMA Chat Scraper ---`);
  console.log(`URL:       ${url}`);
  console.log(`Site ID:   ${siteId}`);
  console.log(`Max pages: ${maxPages}`);
  console.log(`Max depth: ${maxDepth}\n`);

  const outputDir = path.join(process.cwd(), "data", siteId, "scraped");
  fs.mkdirSync(outputDir, { recursive: true });

  // BFS crawl
  const visited = new Set<string>();
  const queue: { url: string; depth: number }[] = [];
  let pagesScraped = 0;
  let totalContentSize = 0;

  // Normalize and enqueue the root URL
  const rootUrl = normalizeUrl(url, url);
  if (!rootUrl) {
    console.error("Invalid root URL");
    process.exit(1);
  }

  queue.push({ url: rootUrl, depth: 0 });
  visited.add(rootUrl);

  while (queue.length > 0 && pagesScraped < maxPages) {
    const item = queue.shift()!;

    // Fetch page
    const html = await fetchPage(item.url);
    if (!html) {
      continue;
    }

    // Parse with cheerio
    const $ = cheerio.load(html);

    // Extract metadata
    const { title, description } = extractMetadata($);

    // Discover links before removing noise (nav contains important links)
    if (item.depth < maxDepth) {
      const newLinks = extractLinks($, item.url, rootUrl);
      for (const link of newLinks) {
        if (!visited.has(link)) {
          visited.add(link);
          queue.push({ url: link, depth: item.depth + 1 });
        }
      }
    }

    // Extract content (this removes noise elements)
    const content = extractContent($);

    // Skip pages with too little content
    if (content.length < MIN_CONTENT_LENGTH) {
      continue;
    }

    // Build scraped page
    const page: ScrapedPage = {
      url: item.url,
      title,
      description,
      content,
      type: detectPageType(item.url),
      scrapedAt: new Date().toISOString(),
    };

    // Write to file
    const slug = urlToSlug(item.url);
    const filePath = path.join(outputDir, `${slug}.json`);
    fs.writeFileSync(filePath, JSON.stringify(page, null, 2), "utf-8");

    pagesScraped++;
    totalContentSize += content.length;
    console.log(
      `[${pagesScraped}/${maxPages}] ${title.substring(0, 60).padEnd(60)} (${content.length} chars)`
    );

    // Crawl delay
    if (queue.length > 0) {
      await sleep(CRAWL_DELAY);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n--- Summary ---`);
  console.log(`Pages scraped:      ${pagesScraped}`);
  console.log(`Total content size: ${(totalContentSize / 1024).toFixed(1)} KB`);
  console.log(`Time elapsed:       ${elapsed}s`);
  console.log(`Output directory:   ${outputDir}`);
}

main().catch(console.error);
