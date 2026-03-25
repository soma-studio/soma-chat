import * as fs from "fs";
import * as path from "path";
import * as cheerio from "cheerio";
import type { ScrapedPage } from "@/types";

// --- Configuration ---
const CRAWL_DELAY = 500;
const MIN_CONTENT_LENGTH = 50;
const USER_AGENT =
  "Mozilla/5.0 (compatible; SomaChatBot/1.0; +https://somastudio.xyz)";

const NOISE_SELECTORS = [
  "nav", "footer", "header", "script", "style", "noscript", "iframe", "aside",
  "[role='complementary']", "[role='navigation']", "[role='banner']",
  ".cookie-banner", ".cookie-consent", "#cookie-consent",
  ".popup", ".modal", ".sidebar", ".menu", ".nav",
  ".advertisement", ".ad", ".social-share", ".comments",
].join(", ");

const CONTENT_SELECTORS = [
  "main", "article", "[role='main']",
  ".content", ".post-content", ".entry-content", ".page-content",
  "#content", "#main", "#main-content",
];

const SKIP_EXTENSIONS = new Set([
  ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp",
  ".mp4", ".mp3", ".zip", ".doc", ".docx", ".xls", ".xlsx",
  ".ppt", ".pptx", ".css", ".js", ".xml", ".rss",
]);

// --- Interfaces ---
export interface ScrapeOptions {
  url: string;
  siteId: string;
  maxPages: number;
  maxDepth: number;
  dataDir: string;
  onPage?: (event: ScrapePageEvent) => void;
  onComplete?: (event: ScrapeCompleteEvent) => void;
  onLimitReached?: (event: ScrapeLimitEvent) => void;
}

export interface ScrapePageEvent {
  title: string;
  url: string;
  chars: number;
  current: number;
  maxPages: number;
}

export interface ScrapeCompleteEvent {
  pagesScraped: number;
  totalChars: number;
  elapsedMs: number;
}

export interface ScrapeLimitEvent {
  pagesScraped: number;
  totalPagesFound: number;
  message: string;
}

// --- URL utilities ---
function normalizeUrl(href: string, baseUrl: string): string | null {
  try {
    const parsed = new URL(href, baseUrl);
    parsed.hash = "";
    const trackingParams = [
      "utm_source", "utm_medium", "utm_campaign", "utm_content",
      "utm_term", "fbclid", "gclid", "ref",
    ];
    for (const param of trackingParams) {
      parsed.searchParams.delete(param);
    }
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
    return new URL(url).hostname === new URL(baseUrl).hostname;
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

export function urlToSlug(url: string): string {
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
  if (pathname.includes("/blog") || pathname.includes("/article") || pathname.includes("/post")) return "blog";
  if (pathname.includes("/product") || pathname.includes("/shop") || pathname.includes("/boutique")) return "product";
  if (pathname.includes("/faq") || pathname.includes("/question")) return "faq";
  return "page";
}

// --- Content extraction ---
function extractContent($: cheerio.CheerioAPI): string {
  $(NOISE_SELECTORS).remove();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let $content: cheerio.Cheerio<any> | null = null;
  for (const selector of CONTENT_SELECTORS) {
    const found = $(selector);
    if (found.length > 0) {
      $content = found.first();
      break;
    }
  }

  if (!$content || $content.length === 0) {
    $content = $("body");
  }

  const lines: string[] = [];

  $content.find("h1, h2, h3, h4, h5, h6, p, li, blockquote, td, th, figcaption, div").each((_i, el) => {
    const $el = $(el);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tagName = (el as any).tagName?.toLowerCase();

    if (tagName === "div") {
      const hasBlockChildren = $el.children("h1, h2, h3, h4, h5, h6, p, ul, ol, table, article, section, div").length > 0;
      if (hasBlockChildren) return;
    }

    const text = $el.text().replace(/\s+/g, " ").trim();
    if (!text) return;

    switch (tagName) {
      case "h1": lines.push(`\n# ${text}\n`); break;
      case "h2": lines.push(`\n## ${text}\n`); break;
      case "h3": lines.push(`\n### ${text}\n`); break;
      case "h4": case "h5": case "h6": lines.push(`\n#### ${text}\n`); break;
      case "li": lines.push(`- ${text}`); break;
      case "blockquote": lines.push(`> ${text}`); break;
      default: lines.push(text);
    }
  });

  $content.find("table").each((_i, table) => {
    const rows: string[][] = [];
    $(table).find("tr").each((_j, tr) => {
      const cells: string[] = [];
      $(tr).find("td, th").each((_k, cell) => {
        cells.push($(cell).text().replace(/\s+/g, " ").trim());
      });
      if (cells.length > 0) rows.push(cells);
    });
    if (rows.length > 0) {
      lines.push("");
      for (let r = 0; r < rows.length; r++) {
        lines.push(`| ${rows[r].join(" | ")} |`);
        if (r === 0) lines.push(`| ${rows[r].map(() => "---").join(" | ")} |`);
      }
      lines.push("");
    }
  });

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function extractMetadata($: cheerio.CheerioAPI): { title: string; description: string } {
  const title =
    $("title").text().trim() ||
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("h1").first().text().trim() || "";
  const description =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() || "";
  return { title, description };
}

function extractLinks($: cheerio.CheerioAPI, currentUrl: string, baseUrl: string): string[] {
  const links: string[] = [];
  $("a[href]").each((_i, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    if (href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) return;
    const normalized = normalizeUrl(href, currentUrl);
    if (!normalized) return;
    if (!isSameDomain(normalized, baseUrl)) return;
    if (hasSkippableExtension(normalized)) return;
    links.push(normalized);
  });
  return links;
}

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
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// --- Main scrape function ---
export async function scrapeWebsite(options: ScrapeOptions): Promise<ScrapeCompleteEvent> {
  const startTime = Date.now();
  const outputDir = path.join(options.dataDir, options.siteId, "scraped");
  fs.mkdirSync(outputDir, { recursive: true });

  const visited = new Set<string>();
  const queue: { url: string; depth: number }[] = [];
  let pagesScraped = 0;
  let totalContentSize = 0;

  const rootUrl = normalizeUrl(options.url, options.url);
  if (!rootUrl) {
    return { pagesScraped: 0, totalChars: 0, elapsedMs: Date.now() - startTime };
  }

  queue.push({ url: rootUrl, depth: 0 });
  visited.add(rootUrl);

  while (queue.length > 0 && pagesScraped < options.maxPages) {
    const item = queue.shift()!;
    const html = await fetchPage(item.url);
    if (!html) continue;

    const $ = cheerio.load(html);
    const { title, description } = extractMetadata($);

    // Discover links before removing noise
    if (item.depth < options.maxDepth) {
      const newLinks = extractLinks($, item.url, rootUrl);
      for (const link of newLinks) {
        if (!visited.has(link)) {
          visited.add(link);
          queue.push({ url: link, depth: item.depth + 1 });
        }
      }
    }

    const content = extractContent($);
    if (content.length < MIN_CONTENT_LENGTH) continue;

    const page: ScrapedPage = {
      url: item.url, title, description, content,
      type: detectPageType(item.url),
      scrapedAt: new Date().toISOString(),
    };

    const slug = urlToSlug(item.url);
    fs.writeFileSync(path.join(outputDir, `${slug}.json`), JSON.stringify(page, null, 2), "utf-8");

    pagesScraped++;
    totalContentSize += content.length;

    options.onPage?.({
      title, url: item.url, chars: content.length,
      current: pagesScraped, maxPages: options.maxPages,
    });

    if (queue.length > 0) await sleep(CRAWL_DELAY);
  }

  // If queue still has items, report limit reached
  if (queue.length > 0) {
    options.onLimitReached?.({
      pagesScraped,
      totalPagesFound: visited.size,
      message: `${pagesScraped} pages index\u00e9es sur ${visited.size} d\u00e9tect\u00e9es (limite free tier).`,
    });
  }

  const result: ScrapeCompleteEvent = {
    pagesScraped,
    totalChars: totalContentSize,
    elapsedMs: Date.now() - startTime,
  };

  options.onComplete?.(result);
  return result;
}
