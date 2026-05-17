import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";

interface ExchangePayload {
  code: string;
  redirect_uri: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: ExchangePayload = await req.json();

    if (!payload.code) {
      throw new Error("Missing authorization code");
    }
    if (!payload.redirect_uri) {
      throw new Error("Missing redirect_uri");
    }

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: "Google OAuth credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Exchange authorization code for tokens using the redirect_uri the
    // browser used — must be byte-for-byte identical to what was sent to Google.
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: payload.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: payload.redirect_uri,
        grant_type: "authorization_code",
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.json();
      throw new Error(err.error_description || err.error || "Failed to exchange token");
    }

    const tokens = await tokenResponse.json();

    // Fetch the connected Gmail address
    let email: string | null = null;
    try {
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (userInfoRes.ok) {
        const info = await userInfoRes.json();
        email = info.email ?? null;
      }
    } catch (_) {
      // non-fatal
    }

    // Persist tokens in the DB using the service role key so they never
    // travel back through the browser.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { error: dbError } = await supabase.from("oauth_tokens").upsert(
      {
        user_id: DEFAULT_USER_ID,
        provider: "gmail",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        scope: tokens.scope,
        email,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" }
    );

    if (dbError) {
      console.error("DB upsert error:", dbError);
      throw new Error("Failed to save Gmail credentials");
    }

    return new Response(
      JSON.stringify({ success: true, email }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Exchange error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
