/**
 * Rate limiter backed by Supabase PostgreSQL.
 * Uses an atomic SQL function (INSERT ... ON CONFLICT DO UPDATE ... RETURNING)
 * to prevent race conditions between Vercel serverless instances.
 *
 * === SQL SETUP (run manually in Supabase SQL Editor) ===
 *
 * CREATE TABLE IF NOT EXISTS rate_limits (
 *   site_id TEXT PRIMARY KEY,
 *   count INTEGER NOT NULL DEFAULT 1,
 *   window_start BIGINT NOT NULL
 * );
 *
 * CREATE OR REPLACE FUNCTION check_rate_limit(
 *   p_site_id TEXT,
 *   p_now BIGINT,
 *   p_window_ms BIGINT,
 *   p_limit INTEGER
 * ) RETURNS BOOLEAN AS $$
 * DECLARE
 *   v_count INTEGER;
 * BEGIN
 *   INSERT INTO rate_limits (site_id, count, window_start)
 *   VALUES (p_site_id, 1, p_now)
 *   ON CONFLICT (site_id) DO UPDATE SET
 *     count = CASE
 *       WHEN rate_limits.window_start < (p_now - p_window_ms) THEN 1
 *       ELSE rate_limits.count + 1
 *     END,
 *     window_start = CASE
 *       WHEN rate_limits.window_start < (p_now - p_window_ms) THEN p_now
 *       ELSE rate_limits.window_start
 *     END
 *   RETURNING count INTO v_count;
 *
 *   RETURN v_count <= p_limit;
 * END;
 * $$ LANGUAGE plpgsql;
 *
 * === CLEANUP: delete old Qdrant collection ===
 * curl -X DELETE "https://<QDRANT_URL>/collections/soma_chat_rate_limits" \
 *   -H "api-key: <QDRANT_API_KEY>"
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

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

export async function checkRateLimit(siteId: string): Promise<boolean> {
  try {
    const supabase = getSupabase();
    if (!supabase) return true; // No Supabase = dev mode, allow all

    const now = Date.now();

    // Atomic: insert-or-increment + check in one SQL call
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_site_id: siteId,
      p_now: now,
      p_window_ms: RATE_WINDOW_MS,
      p_limit: RATE_LIMIT,
    });

    if (error) {
      console.error("[Rate Limiter] RPC error, using fallback:", error.message);
      return await fallbackRateLimit(supabase, siteId, now);
    }

    if (data === false) {
      console.log(`[Rate Limiter] BLOCKED siteId=${siteId}`);
    }

    return data as boolean;
  } catch (err) {
    console.error("[Rate Limiter] Error:", err instanceof Error ? err.message : String(err));
    return true; // fail-open
  }
}

/**
 * Fallback if the RPC function doesn't exist yet (before SQL setup).
 * Not atomic — has minor race window, but better than nothing.
 */
async function fallbackRateLimit(
  supabase: SupabaseClient,
  siteId: string,
  now: number
): Promise<boolean> {
  const windowStart = now - RATE_WINDOW_MS;

  const { data: existing } = await supabase
    .from("rate_limits")
    .select("count, window_start")
    .eq("site_id", siteId)
    .single();

  if (!existing || existing.window_start < windowStart) {
    await supabase
      .from("rate_limits")
      .upsert(
        { site_id: siteId, count: 1, window_start: now },
        { onConflict: "site_id" }
      );
    return true;
  }

  if (existing.count >= RATE_LIMIT) {
    console.log(`[Rate Limiter] BLOCKED (fallback) siteId=${siteId} count=${existing.count}`);
    return false;
  }

  await supabase
    .from("rate_limits")
    .update({ count: existing.count + 1 })
    .eq("site_id", siteId);

  return true;
}
