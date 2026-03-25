import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Check if registry collection exists
    const checkRes = await fetch(
      `${process.env.QDRANT_URL}/collections/soma_chat_registry`,
      { headers: { "api-key": process.env.QDRANT_API_KEY! } }
    );
    const checkData = await checkRes.text();

    // Try to list points
    const scrollRes = await fetch(
      `${process.env.QDRANT_URL}/collections/soma_chat_registry/points/scroll`,
      {
        method: "POST",
        headers: {
          "api-key": process.env.QDRANT_API_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ limit: 10, with_payload: true }),
      }
    );
    const scrollData = await scrollRes.text();

    return NextResponse.json({
      collection: { status: checkRes.status, data: checkData },
      scroll: { status: scrollRes.status, data: scrollData },
      env: {
        hasQdrantUrl: !!process.env.QDRANT_URL,
        hasQdrantKey: !!process.env.QDRANT_API_KEY,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
