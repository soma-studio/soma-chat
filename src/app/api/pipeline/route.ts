import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { runPipeline, getDataDir } from "@/lib/pipeline";
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
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return Response.json(
      { error: "Invalid URL format" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Block non-HTTP protocols
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return Response.json(
      { error: "Only HTTP/HTTPS URLs are allowed" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Block private/internal IPs (SSRF protection)
  const hostname = parsedUrl.hostname.toLowerCase();
  const BLOCKED_HOSTS = [
    'localhost', '127.0.0.1', '0.0.0.0', '[::1]',
    '169.254.169.254',  // AWS metadata
    'metadata.google.internal',  // GCP metadata
  ];
  const BLOCKED_PREFIXES = [
    '10.', '172.16.', '172.17.', '172.18.', '172.19.',
    '172.20.', '172.21.', '172.22.', '172.23.', '172.24.',
    '172.25.', '172.26.', '172.27.', '172.28.', '172.29.',
    '172.30.', '172.31.', '192.168.',
  ];
  if (
    BLOCKED_HOSTS.includes(hostname) ||
    BLOCKED_PREFIXES.some(p => hostname.startsWith(p))
  ) {
    return Response.json(
      { error: "Internal URLs are not allowed" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const siteId = uuidv4().slice(0, 8);
  const dataDir = getDataDir();

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      function send(event: Record<string, unknown>) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Client disconnected — ignore write error
        }
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
