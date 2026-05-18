// Syncs a CRM event to Google Calendar.
// Supports create, update, and delete operations.
// Called from the frontend after creating/editing/deleting an event row.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { DEFAULT_USER_ID } from "../_shared/constants.ts";

interface SyncRequest {
  operation: "create" | "update" | "delete";
  event_id: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  let body: SyncRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { operation, event_id } = body;

  // Load OAuth token
  const { data: oauthToken } = await supabase
    .from("oauth_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", DEFAULT_USER_ID)
    .eq("provider", "gmail")
    .maybeSingle();

  if (!oauthToken) {
    return new Response(JSON.stringify({ error: "Gmail not connected" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let accessToken = oauthToken.access_token;

  // Refresh if expired
  if (oauthToken.expires_at && new Date(oauthToken.expires_at) < new Date()) {
    const refreshed = await refreshAccessToken(oauthToken.refresh_token);
    if (!refreshed) {
      return new Response(JSON.stringify({ error: "Token refresh failed" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    accessToken = refreshed.access_token;
    await supabase
      .from("oauth_tokens")
      .update({
        access_token: refreshed.access_token,
        expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      })
      .eq("user_id", DEFAULT_USER_ID)
      .eq("provider", "gmail");
  }

  if (operation === "delete") {
    const { data: ev } = await supabase
      .from("events")
      .select("gcal_event_id, gcal_calendar_id")
      .eq("id", event_id)
      .single();

    if (ev?.gcal_event_id) {
      const calId = encodeURIComponent(ev.gcal_calendar_id ?? "primary");
      await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${ev.gcal_event_id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Load event for create/update
  const { data: ev, error: evErr } = await supabase
    .from("events")
    .select("*")
    .eq("id", event_id)
    .single();

  if (evErr || !ev) {
    return new Response(JSON.stringify({ error: "Event not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const endTime = new Date(
    new Date(ev.scheduled_at).getTime() + ev.duration_min * 60 * 1000,
  ).toISOString();

  const gcalBody: Record<string, unknown> = {
    summary: ev.title,
    description: ev.notes ?? "",
    start: { dateTime: ev.scheduled_at, timeZone: "UTC" },
    end: { dateTime: endTime, timeZone: "UTC" },
    ...(ev.location ? { location: ev.location } : {}),
    ...(ev.meeting_url
      ? { conferenceData: { entryPoints: [{ entryPointType: "video", uri: ev.meeting_url }] } }
      : {}),
  };

  const calId = encodeURIComponent(ev.gcal_calendar_id ?? "primary");

  let gcalResponse: Response;
  if (operation === "create") {
    gcalResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calId}/events`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(gcalBody),
    });
  } else {
    // update
    if (!ev.gcal_event_id) {
      return new Response(JSON.stringify({ error: "No gcal_event_id to update" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    gcalResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${ev.gcal_event_id}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(gcalBody),
      },
    );
  }

  if (!gcalResponse.ok) {
    const errText = await gcalResponse.text();
    return new Response(JSON.stringify({ error: errText }), {
      status: gcalResponse.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const gcalData = await gcalResponse.json();

  // Persist the gcal event id back to the events row
  await supabase
    .from("events")
    .update({ gcal_event_id: gcalData.id, gcal_calendar_id: ev.gcal_calendar_id ?? "primary" })
    .eq("id", event_id);

  return new Response(JSON.stringify({ ok: true, gcal_event_id: gcalData.id }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

async function refreshAccessToken(
  token: string,
): Promise<{ access_token: string; expires_in: number } | null> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  return res.json();
}
