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

// --- Email extraction ---
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const FALSE_POSITIVE_EMAILS = [
  "example", "noreply", "no-reply", "wix", "wordpress", "sentry",
  "test@", "user@", "email@", "name@", "your@", "info@example",
  "protection@", "abuse@", "postmaster@",
];

const PREFERRED_EMAIL_PREFIXES = [
  "contact", "info", "hello", "accueil", "bonjour",
  "direction", "commercial", "support",
];

function extractEmailsFromHtml(html: string, $: cheerio.CheerioAPI): string[] {
  const emailSet = new Set<string>();

  // From mailto links
  $('a[href^="mailto:"]').each((_i, el) => {
    const href = $(el).attr("href");
    if (href) {
      const email = decodeURIComponent(
        href.replace("mailto:", "").split("?")[0].trim()
      ).toLowerCase();
      if (email.includes("@")) emailSet.add(email);
    }
  });

  // From raw HTML via regex
  const regexMatches = html.match(EMAIL_REGEX) || [];
  for (const email of regexMatches) {
    emailSet.add(decodeURIComponent(email.toLowerCase()));
  }

  // Filter false positives
  return Array.from(emailSet).filter((email) =>
    !FALSE_POSITIVE_EMAILS.some((pattern) => email.includes(pattern))
  );
}

function pickBestEmail(emails: string[], siteUrl: string): string | null {
  if (emails.length === 0) return null;

  let domain: string;
  try {
    domain = new URL(siteUrl).hostname.replace(/^www\./, "");
  } catch {
    return emails[0];
  }

  // Prefer emails matching the website domain
  const domainMatches = emails.filter((email) => email.split("@")[1] === domain);

  if (domainMatches.length > 0) {
    for (const prefix of PREFERRED_EMAIL_PREFIXES) {
      const match = domainMatches.find((e) => e.startsWith(prefix + "@"));
      if (match) return match;
    }
    return domainMatches[0];
  }

  return emails[0];
}

// --- Language variant filter ---
const LANGUAGE_PATH_SEGMENTS = ["/en", "/fr", "/it", "/es", "/de", "/pt", "/nl", "/ru", "/ja", "/zh", "/ko", "/ar"];

function isLanguageVariant(url: string, rootUrl: string): boolean {
  try {
    const rootPath = new URL(rootUrl).pathname;
    const urlPath = new URL(url).pathname;

    // If root itself is a language path, don't filter
    for (const seg of LANGUAGE_PATH_SEGMENTS) {
      if (rootPath.startsWith(seg + "/") || rootPath === seg) return false;
    }

    // Filter URLs starting with a language segment
    for (const seg of LANGUAGE_PATH_SEGMENTS) {
      if (urlPath.startsWith(seg + "/") || urlPath === seg) return true;
    }

    return false;
  } catch {
    return false;
  }
}

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
  contactEmail: string | null;
  allEmails: string[];
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
    const urlHost = new URL(url).hostname.replace(/^www\./, "");
    const baseHost = new URL(baseUrl).hostname.replace(/^www\./, "");
    return urlHost === baseHost;
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

function detectPageType(url: string): ScrapedPage['type'] {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.includes("/blog") || pathname.includes("/article") || pathname.includes("/post")) return "blog";
    if (pathname.includes("/product") || pathname.includes("/shop") || pathname.includes("/boutique")) return "product";
    if (pathname.includes("/faq") || pathname.includes("/question")) return "faq";
    return "page";
  } catch {
    return "page";
  }
}

// --- JSON-LD extraction ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function flattenJsonLd(data: any, depth: number = 0): string {
  if (depth > 3) return "";
  if (!data || typeof data !== "object") return "";

  const lines: string[] = [];
  const type = data["@type"];

  // Skip non-content schemas
  const SKIP_TYPES = ["BreadcrumbList", "WebSite", "WebPage", "SiteNavigationElement", "SearchAction", "Organization"];
  if (type && (Array.isArray(type) ? type.every((t: string) => SKIP_TYPES.includes(t)) : SKIP_TYPES.includes(type))) {
    return "";
  }

  if (type) lines.push(`\n## ${Array.isArray(type) ? type.join(" / ") : type}\n`);

  for (const key of Object.keys(data)) {
    if (key.startsWith("@")) continue;
    const val = data[key];

    if (typeof val === "string" && val.length > 0 && val.length < 500) {
      lines.push(`${key}: ${val}`);
    } else if (typeof val === "number" || typeof val === "boolean") {
      lines.push(`${key}: ${val}`);
    } else if (Array.isArray(val)) {
      const items = val
        .map((item) => {
          if (typeof item === "string") return item;
          if (typeof item === "object" && item.name) return item.name;
          if (typeof item === "object") return flattenJsonLd(item, depth + 1);
          return "";
        })
        .filter(Boolean);
      if (items.length > 0) lines.push(`${key}: ${items.join(", ")}`);
    } else if (typeof val === "object" && val !== null) {
      const nested = flattenJsonLd(val, depth + 1);
      if (nested) lines.push(nested);
    }
  }

  return lines.join("\n");
}

// --- Content extraction ---
function extractContent($: cheerio.CheerioAPI): string {
  // Extract JSON-LD structured data BEFORE removing scripts
  const jsonLdTexts: string[] = [];
  $('script[type="application/ld+json"]').each((_i, el) => {
    try {
      const raw = $(el).html();
      if (!raw) return;
      const data = JSON.parse(raw);
      const extracted = flattenJsonLd(data);
      if (extracted.trim()) jsonLdTexts.push(extracted);
    } catch {
      // Invalid JSON-LD — skip
    }
  });

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
      // Skip divs that have semantic block children (we'll visit those)
      const semanticChildCount = $el.children("h1, h2, h3, h4, h5, h6, p, ul, ol, table, article, section").length;
      if (semanticChildCount > 0) return;
      // Skip wrapper divs with no direct text
      const directText = $el.contents().filter(function() { return this.type === "text"; }).text().trim();
      if (directText.length < 5 && $el.children("div").length > 0) return;
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

  let result = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  // Fallback: if structured extraction yields < 200 chars, extract all leaf text
  if (result.length < 200 && $content) {
    const fallbackLines: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $content.find("*").each((_i: number, el: any) => {
      const $el = $(el);
      const tag = el.tagName?.toLowerCase();
      if (["script", "style", "noscript", "svg", "img", "br", "hr", "link", "meta"].includes(tag)) return;

      const directText = $el.contents()
        .filter(function() { return this.type === "text"; })
        .text().replace(/\s+/g, " ").trim();

      if (directText.length > 3) {
        if (["h1", "h2", "h3", "h4"].includes(tag)) {
          fallbackLines.push(`\n## ${directText}\n`);
        } else {
          fallbackLines.push(directText);
        }
      }
    });

    const fallback = fallbackLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (fallback.length > result.length * 1.5) result = fallback;
  }

  // Nuclear fallback: walk every text node when still < 300 chars
  if (result.length < 300 && $content) {
    const allTexts: string[] = [];

    $content.find("*").contents().each(function () {
      if (this.type === "text") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const text = (this as any).data?.replace(/\s+/g, " ").trim();
        if (text && text.length > 2) {
          allTexts.push(text);
        }
      }
    });

    // Deduplicate (Webflow often has duplicate text in mobile/desktop variants)
    const seen = new Set<string>();
    const uniqueTexts = allTexts.filter((t) => {
      const normalized = t.toLowerCase().trim();
      if (seen.has(normalized)) return false;
      if (normalized.length < 3) return false;
      seen.add(normalized);
      return true;
    });

    const nuclearResult = uniqueTexts.join("\n");
    if (nuclearResult.length > result.length * 1.5) {
      result = nuclearResult;
    }
  }

  // Combine JSON-LD structured data + extracted text
  const jsonLdSection = jsonLdTexts.length > 0 ? jsonLdTexts.join("\n") : "";

  if (jsonLdSection && result) {
    return (result + "\n\n--- Données structurées ---\n" + jsonLdSection).replace(/\n{3,}/g, "\n\n").trim();
  } else if (jsonLdSection) {
    return jsonLdSection.trim();
  }

  return result;
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
      signal: AbortSignal.timeout(10000),
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
  const allFoundEmails: string[] = [];

  const rootUrl = normalizeUrl(options.url, options.url);
  if (!rootUrl) {
    return { pagesScraped: 0, totalChars: 0, elapsedMs: Date.now() - startTime, contactEmail: null, allEmails: [] };
  }

  // Probe the root URL — if bare domain fails, try www. prefix
  let effectiveRootUrl = rootUrl;
  const rootHtml = await fetchPage(rootUrl);
  if (!rootHtml) {
    try {
      const parsed = new URL(rootUrl);
      if (!parsed.hostname.startsWith("www.")) {
        const wwwUrl = `${parsed.protocol}//www.${parsed.hostname}${parsed.pathname}${parsed.search}`;
        const wwwHtml = await fetchPage(wwwUrl);
        if (wwwHtml) {
          effectiveRootUrl = wwwUrl;
          console.log(`[Scraper] Bare domain failed, using www: ${wwwUrl}`);
        }
      }
    } catch {
      // Keep original URL
    }
  }

  queue.push({ url: effectiveRootUrl, depth: 0 });
  visited.add(effectiveRootUrl);

  while (queue.length > 0 && pagesScraped < options.maxPages) {
    const item = queue.shift()!;
    const html = await fetchPage(item.url);
    if (!html) continue;

    const $ = cheerio.load(html);

    // Extract emails before noise removal (emails often in footer)
    const pageEmails = extractEmailsFromHtml(html, $);
    allFoundEmails.push(...pageEmails);

    const { title, description } = extractMetadata($);

    // Discover links before removing noise
    if (item.depth < options.maxDepth) {
      const newLinks = extractLinks($, item.url, rootUrl);
      for (const link of newLinks) {
        if (!visited.has(link) && !isLanguageVariant(link, options.url)) {
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

  const uniqueEmails = [...new Set(allFoundEmails)];
  const contactEmail = pickBestEmail(uniqueEmails, options.url);

  const result: ScrapeCompleteEvent = {
    pagesScraped,
    totalChars: totalContentSize,
    elapsedMs: Date.now() - startTime,
    contactEmail,
    allEmails: uniqueEmails,
  };

  options.onComplete?.(result);
  return result;
}
