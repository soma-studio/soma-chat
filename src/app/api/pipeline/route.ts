import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import * as path from "path";
import { runPipeline } from "@/lib/pipeline";
import { FREE_TIER } from "@/lib/constants";

export const maxDuration = 60;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const { url } = body;
  if (!url || typeof url !== "string") {
    return Response.json(
      { error: "Missing url field" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    return Response.json(
      { error: "Invalid URL format" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const siteId = uuidv4().slice(0, 8);
  const dataDir = path.join(process.cwd(), "data");

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      function send(event: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      runPipeline({
        url,
        siteId,
        maxPages: FREE_TIER.maxPages,
        maxDepth: FREE_TIER.maxDepth,
        dataDir,
        onEvent: (event) => {
          send(event);
        },
      }).then(() => {
        controller.close();
      }).catch((err) => {
        send({ type: "error", message: err instanceof Error ? err.message : String(err) });
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
