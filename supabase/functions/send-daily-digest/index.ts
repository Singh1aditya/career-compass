// Sends a daily digest email to the user summarising:
//   - Overdue follow-ups
//   - Sequences with no activity in 7+ days
//   - Replies received yesterday
//   - This-week application stats
//
// Idempotent: writes to digest_log keyed by (user_id, date); runs at most once per day.
// Trigger: Supabase cron, daily at the user's configured digest_hour.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { DEFAULT_USER_ID } from "../_shared/constants.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Check digest is enabled
  const { data: settings } = await supabase
    .from("user_settings")
    .select("digest_enabled, display_name")
    .eq("user_id", DEFAULT_USER_ID)
    .maybeSingle();

  if (!settings?.digest_enabled) {
    return new Response(JSON.stringify({ skipped: true, reason: "digest disabled" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Idempotency: only one digest per calendar day
  const today = new Date().toISOString().split("T")[0];
  const { data: existing } = await supabase
    .from("digest_log")
    .select("id")
    .eq("user_id", DEFAULT_USER_ID)
    .gte("sent_at", today + "T00:00:00Z")
    .maybeSingle();

  if (existing) {
    return new Response(JSON.stringify({ skipped: true, reason: "already sent today" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Gather data
  const [overdueResult, repliesResult, weekAppsResult, staleSeqResult] = await Promise.all([
    supabase
      .from("follow_ups")
      .select("id, description, due_date, priority")
      .eq("user_id", DEFAULT_USER_ID)
      .eq("status", "pending")
      .lt("due_date", today)
      .order("due_date"),

    supabase
      .from("interactions")
      .select("id, summary, date, contact_id")
      .eq("type", "email")
      .eq("direction", "inbound")
      .gte("date", yesterday),

    supabase
      .from("applications")
      .select("id")
      .eq("user_id", DEFAULT_USER_ID)
      .gte("applied_date", weekStart.toISOString()),

    supabase
      .from("sequences")
      .select("id, name, updated_at")
      .eq("user_id", DEFAULT_USER_ID)
      .eq("status", "active")
      .lt("updated_at", sevenDaysAgo),
  ]);

  const overdue = overdueResult.data ?? [];
  const replies = repliesResult.data ?? [];
  const weekApps = weekAppsResult.data ?? [];
  const staleSeqs = staleSeqResult.data ?? [];

  // Get Gmail token for sending
  const { data: oauthToken } = await supabase
    .from("oauth_tokens")
    .select("access_token, refresh_token, expires_at, email")
    .eq("user_id", DEFAULT_USER_ID)
    .eq("provider", "gmail")
    .maybeSingle();

  const summary = {
    overdue_count: overdue.length,
    replies_count: replies.length,
    week_apps_count: weekApps.length,
    stale_sequences_count: staleSeqs.length,
  };

  // Build digest email HTML
  const displayName = settings.display_name || "there";
  const emailBody = buildDigestEmail({
    displayName,
    overdue,
    replies,
    weekAppsCount: weekApps.length,
    staleSeqs,
    today,
  });

  let emailSent = false;

  if (oauthToken) {
    let accessToken = oauthToken.access_token;

    // Refresh if expired
    if (oauthToken.expires_at && new Date(oauthToken.expires_at) < now) {
      const refreshed = await refreshToken(oauthToken.refresh_token);
      if (refreshed) {
        accessToken = refreshed.access_token;
        await supabase.from("oauth_tokens").update({
          access_token: refreshed.access_token,
          expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        }).eq("user_id", DEFAULT_USER_ID).eq("provider", "gmail");
      }
    }

    const toEmail = oauthToken.email;
    if (toEmail && accessToken) {
      const raw = buildRawEmail(toEmail, `Daily CRM Digest — ${today}`, emailBody);
      const gmailRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw }),
      });
      emailSent = gmailRes.ok;
    }
  }

  // Log the digest (idempotency record)
  await supabase.from("digest_log").insert({
    user_id: DEFAULT_USER_ID,
    summary,
    sent_at: now.toISOString(),
  });

  return new Response(JSON.stringify({ ok: true, emailSent, summary }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

function buildDigestEmail(opts: {
  displayName: string;
  overdue: any[];
  replies: any[];
  weekAppsCount: number;
  staleSeqs: any[];
  today: string;
}): string {
  const { displayName, overdue, replies, weekAppsCount, staleSeqs, today } = opts;

  const overdueHtml = overdue.length
    ? `<ul>${overdue.map((f) => `<li><strong>${f.due_date}</strong> — ${f.description} <em>(${f.priority})</em></li>`).join("")}</ul>`
    : `<p style="color:#6b7280">None — you're caught up!</p>`;

  const repliesHtml = replies.length
    ? `<ul>${replies.map((r) => `<li>${r.summary || "Email reply"} on ${new Date(r.date).toLocaleDateString()}</li>`).join("")}</ul>`
    : `<p style="color:#6b7280">No replies yesterday.</p>`;

  const staleHtml = staleSeqs.length
    ? `<ul>${staleSeqs.map((s) => `<li><strong>${s.name}</strong> — no activity in 7+ days</li>`).join("")}</ul>`
    : "";

  return `
<html><body style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px">
  <h2 style="color:#1e293b">Career CRM Daily Digest — ${today}</h2>
  <p>Hi ${displayName},</p>

  <h3 style="color:#dc2626">Overdue Follow-ups (${overdue.length})</h3>
  ${overdueHtml}

  <h3 style="color:#2563eb">Replies Received Yesterday (${replies.length})</h3>
  ${repliesHtml}

  <h3 style="color:#16a34a">This Week: ${weekAppsCount} application${weekAppsCount !== 1 ? "s" : ""} submitted</h3>

  ${staleSeqs.length ? `<h3 style="color:#d97706">Stale Sequences (${staleSeqs.length})</h3>${staleHtml}` : ""}

  <hr style="margin-top:32px;border:none;border-top:1px solid #e2e8f0"/>
  <p style="color:#94a3b8;font-size:12px">Sent by Career CRM · Manage in Settings → Reminders</p>
</body></html>`;
}

function buildRawEmail(to: string, subject: string, htmlBody: string): string {
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    htmlBody,
  ].join("\r\n");
  return btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function refreshToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  return res.json();
}
