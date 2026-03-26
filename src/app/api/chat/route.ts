import { NextRequest, NextResponse } from "next/server";
import { getSite } from "@/lib/sites";
import { processRAGQuery } from "@/lib/rag";
import { checkRateLimit } from "@/lib/rate-limiter";
import type { SiteConfig } from "@/types";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

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

    // Validate siteId format (prevents injection into Qdrant collection names)
    if (!/^[a-zA-Z0-9_-]+$/.test(siteId)) {
      return NextResponse.json(
        { error: "Invalid siteId format" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Check rate limit
    if (!(await checkRateLimit(siteId))) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429, headers: corsHeaders }
      );
    }

    // Load site config
    const site = await getSite(siteId);
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
    const response = await processRAGQuery(
      siteId,
      message,
      siteConfig,
      site.siteProfile || null,
      site.chunksIndexed || 100
    );

    return NextResponse.json(response, { headers: corsHeaders });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
