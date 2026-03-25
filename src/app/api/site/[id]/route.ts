import { NextRequest, NextResponse } from "next/server";
import { getSite } from "@/lib/sites";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const site = getSite(id);
  if (!site) {
    return NextResponse.json(
      { error: `Site "${id}" not found` },
      { status: 404, headers: corsHeaders }
    );
  }

  return NextResponse.json(
    {
      siteName: site.siteName,
      welcomeMessage: site.welcomeMessage,
      accentColor: site.accentColor,
      suggestedQuestions: site.suggestedQuestions || [],
    },
    { headers: corsHeaders }
  );
}
