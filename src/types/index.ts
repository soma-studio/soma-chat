export interface ScrapedPage {
  url: string;
  title: string;
  description: string;
  content: string;
  type: string; // 'page' | 'blog' | 'product' | 'faq'
  scrapedAt: string;
}

export interface Chunk {
  chunk_id: string;
  doc_id: string;
  title: string;
  content: string;
  url: string;
  type: string;
  section: string;
  scrapedAt: string;
}

export interface SiteConfig {
  siteName: string;
  siteUrl: string;
  language: string; // 'fr' | 'en'
  welcomeMessage: string;
  fallbackMessage: string;
}

export interface SiteProfile {
  businessType: string;
  businessName: string;
  location: string;
  keyFacts: string[];
  tone: string;
  persona: string;
  summary: string;
  suggestedQuestions: string[];
}

export interface SiteRecord {
  siteId: string;
  siteUrl: string;
  siteName: string;
  language: string;
  welcomeMessage: string;
  fallbackMessage: string;
  accentColor: string;
  pagesIndexed: number;
  chunksIndexed: number;
  suggestedQuestions: string[];
  createdAt: string;
  lastScrapedAt: string;
  siteProfile: SiteProfile | null;
}

export interface Source {
  title: string;
  url: string;
  section: string;
  score: number;
}

export interface Meta {
  model: string;
  chunks_retrieved: number;
  latency_ms: number;
  rag_enabled: boolean;
}

export interface RAGResponse {
  answer: string;
  sources: Source[];
  meta: Meta;
}
