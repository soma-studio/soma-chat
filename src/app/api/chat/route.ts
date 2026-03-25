import { NextRequest, NextResponse } from "next/server";
import { getSite } from "@/lib/sites";
import { processRAGQuery } from "@/lib/rag";
import type { SiteConfig } from "@/types";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// In-memory rate limiting: siteId -> { count, resetTime }
const rateLimits = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 20; // requests per minute
const RATE_WINDOW = 60_000; // 1 minute

function checkRateLimit(siteId: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(siteId);

  if (!entry || now > entry.resetTime) {
    rateLimits.set(siteId, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { siteId, message } = body;

    // Validate siteId
    if (!siteId || typeof siteId !== "string") {
      return NextResponse.json(
        { error: "siteId is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate message
    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (message.length > 1000) {
      return NextResponse.json(
        { error: "message must be 1000 characters or less" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Check rate limit
    if (!checkRateLimit(siteId)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429, headers: corsHeaders }
      );
    }

    // Load site config
    const site = getSite(siteId);
    if (!site) {
      return NextResponse.json(
        { error: `Site "${siteId}" not found` },
        { status: 404, headers: corsHeaders }
      );
    }

    const siteConfig: SiteConfig = {
      siteName: site.siteName,
      siteUrl: site.siteUrl,
      language: site.language,
      welcomeMessage: site.welcomeMessage,
      fallbackMessage: site.fallbackMessage,
    };

    // Process RAG query
    const response = await processRAGQuery(siteId, message, siteConfig);

    return NextResponse.json(response, { headers: corsHeaders });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
