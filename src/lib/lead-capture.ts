/**
 * Captures SOMA Chat users as leads in the Supabase prospection database.
 * Only inserts if Supabase credentials are configured and an email was found.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const INDUSTRY_ID = "soma-chatbot";

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _supabase;
}

interface LeadCaptureData {
  siteUrl: string;
  siteName: string;
  contactEmail: string | null;
  allEmails: string[];
  pagesIndexed: number;
  siteId: string;
}

export async function captureLeadFromChatbot(data: LeadCaptureData): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    console.log("[Lead Capture] Supabase not configured — skipping lead capture");
    return;
  }

  // Skip if no email found
  if (!data.contactEmail) {
    console.log("[Lead Capture] No contact email found — skipping lead capture");
    return;
  }

  try {

    // Check if this site URL is already a lead (avoid duplicates)
    const { data: existingLeads } = await supabase
      .from("leads")
      .select("id")
      .eq("website", data.siteUrl)
      .limit(1);

    if (existingLeads && existingLeads.length > 0) {
      console.log(`[Lead Capture] Lead already exists for ${data.siteUrl} — skipping`);

      // Log an event on the existing lead that they used SOMA Chat again
      await supabase.from("events").insert({
        lead_id: existingLeads[0].id,
        type: "soma_chat_usage",
        details: {
          siteId: data.siteId,
          pagesIndexed: data.pagesIndexed,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Extract company name from site name
    const companyName = data.siteName
      .replace(/\.(com|fr|xyz|io|net|org|co|eu)$/i, "")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    // Insert lead
    const { data: insertedLead, error } = await supabase
      .from("leads")
      .insert({
        company_name: companyName,
        website: data.siteUrl,
        contact_email: data.contactEmail,
        email_verified: false,
        industry_id: INDUSTRY_ID,
        score: 40,
        status: "new",
        source: "soma-chat",
        siren: `sc_${data.siteId}`,
        notes: JSON.stringify({
          allEmails: data.allEmails,
          pagesIndexed: data.pagesIndexed,
          chatbotSiteId: data.siteId,
          capturedAt: new Date().toISOString(),
        }),
      })
      .select("id")
      .single();

    if (error) {
      console.error(`[Lead Capture] Failed to insert lead: ${error.message}`);
      return;
    }

    // Log creation event
    if (insertedLead) {
      await supabase.from("events").insert({
        lead_id: insertedLead.id,
        type: "lead_created",
        details: {
          source: "soma-chat",
          siteId: data.siteId,
          pagesIndexed: data.pagesIndexed,
          email: data.contactEmail,
        },
      });
    }

    console.log(`[Lead Capture] Lead captured: ${companyName} (${data.contactEmail})`);
  } catch (err) {
    // Non-fatal — lead capture should never break the pipeline
    console.error("[Lead Capture] Error:", err instanceof Error ? err.message : String(err));
  }
}
