// Auto-generates follow_ups rows for two scenarios:
//   1. Application in 'applied' state with no outbound interaction in 7 days
//   2. Sequence recipient stuck in 'initial_sent' with no inbound reply after delay_days
//
// Idempotent: won't create duplicate auto follow-ups for the same application/recipient.
// Trigger: Supabase cron, daily.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { listGmailUsers, LEGACY_USER_ID } from "../_shared/constants.ts";
const STALE_DAYS = 7;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // Single-user assumption today. To extend, loop over listGmailUsers().
  const users = await listGmailUsers(supabase);
  const userId = users[0] ?? LEGACY_USER_ID;

  // Check if auto-followups are enabled for this user
  const { data: settings } = await supabase
    .from("user_settings")
    .select("auto_followups_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (settings && settings.auto_followups_enabled === false) {
    return new Response(JSON.stringify({ skipped: true, reason: "auto_followups disabled" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  let created = 0;

  // --- Scenario 1: stale 'applied' applications ---
  const { data: staleApps } = await supabase
    .from("applications")
    .select("id, role_title, company_name")
    .eq("user_id", userId)
    .eq("status", "applied")
    .lt("applied_date", cutoff);

  for (const app of staleApps ?? []) {
    // Check if there's already an open auto follow-up for this application
    const { data: existing } = await supabase
      .from("follow_ups")
      .select("id")
      .eq("application_id", app.id)
      .eq("source", "auto")
      .eq("status", "pending")
      .maybeSingle();

    if (existing) continue;

    // Check if there was any recent outbound interaction
    const { data: recentInteraction } = await supabase
      .from("interactions")
      .select("id")
      .eq("application_id", app.id)
      .eq("direction", "outbound")
      .gte("date", cutoff)
      .maybeSingle();

    if (recentInteraction) continue;

    const dueDate = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    await supabase.from("follow_ups").insert({
      user_id: userId,
      application_id: app.id,
      description: `Follow up on application for ${app.role_title}${app.company_name ? ` at ${app.company_name}` : ""} — no activity in ${STALE_DAYS} days`,
      due_date: dueDate,
      priority: "medium",
      status: "pending",
      source: "auto",
    });

    created++;
  }

  // --- Scenario 2: sequence recipients stuck in initial_sent with no reply ---
  const { data: stuckRecipients } = await supabase
    .from("sequence_recipients")
    .select(
      `
      id,
      contact_id,
      sequence_id,
      next_send_at,
      contacts(name),
      sequences(name)
    `,
    )
    .eq("state", "initial_sent")
    .lt("next_send_at", cutoff);

  for (const r of stuckRecipients ?? []) {
    const { data: existing } = await supabase
      .from("follow_ups")
      .select("id")
      .eq("contact_id", r.contact_id)
      .eq("source", "auto")
      .eq("status", "pending")
      .maybeSingle();

    if (existing) continue;

    const contactName = (r.contacts as any)?.name ?? "contact";
    const sequenceName = (r.sequences as any)?.name ?? "sequence";
    const dueDate = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    await supabase.from("follow_ups").insert({
      user_id: userId,
      contact_id: r.contact_id,
      description: `No reply from ${contactName} in sequence "${sequenceName}" — consider a manual follow-up`,
      due_date: dueDate,
      priority: "medium",
      status: "pending",
      source: "auto",
    });

    created++;
  }

  return new Response(JSON.stringify({ ok: true, created }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
