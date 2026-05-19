import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.0";
import { getUserIdFromJWT, LEGACY_USER_ID } from "../_shared/constants.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendEmailPayload {
  to: string;
  subject: string;
  body: string;
  recipientId: string;
  stepNumber: number;
  // Optional — cron invoker (process-pending-sends) passes the sequence
  // owner's id explicitly because it has no JWT. Browser callers can omit
  // this and we'll derive it from the Authorization header.
  userId?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: SendEmailPayload = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const userId = payload.userId ?? getUserIdFromJWT(req) ?? LEGACY_USER_ID;

    // Get user's Gmail OAuth token
    const { data: oauthToken, error: tokenError } = await supabase
      .from("oauth_tokens")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", "gmail")
      .single();

    if (tokenError || !oauthToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Gmail not connected. Please connect in Settings.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Check if token is expired
    if (oauthToken.expires_at && new Date(oauthToken.expires_at) < new Date()) {
      // Refresh token
      const refreshed = await refreshGmailToken(supabase, userId, oauthToken.refresh_token);

      if (!refreshed) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Failed to refresh Gmail token. Please reconnect.",
          }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // Get fresh token
    const { data: freshToken } = await supabase
      .from("oauth_tokens")
      .select("access_token")
      .eq("user_id", userId)
      .eq("provider", "gmail")
      .single();

    if (!freshToken) {
      throw new Error("Failed to get Gmail token");
    }

    // Send email via Gmail API
    const result = await sendViaGmailAPI(
      payload.to,
      payload.subject,
      payload.body,
      freshToken.access_token,
    );

    if (!result.success) {
      return new Response(JSON.stringify(result), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log the send
    await supabase.from("sequence_sends").insert({
      recipient_id: payload.recipientId,
      step_number: payload.stepNumber,
      subject: payload.subject,
      body: payload.body,
      gmail_message_id: result.messageId,
      gmail_thread_id: result.threadId,
      sent_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        messageId: result.messageId,
        threadId: result.threadId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[Function Error]", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

async function sendViaGmailAPI(
  to: string,
  subject: string,
  body: string,
  accessToken: string,
): Promise<{
  success: boolean;
  messageId?: string;
  threadId?: string;
  error?: string;
}> {
  try {
    // Create RFC 2822 formatted email
    const email = `To: ${to}\r\nSubject: ${subject}\r\n\r\n${body}`;
    const encodedEmail = btoa(email).replace(/\+/g, "-").replace(/\//g, "_");

    // Send via Gmail API
    const response = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw: encodedEmail,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error?.message || "Failed to send email",
      };
    }

    const result = await response.json();

    return {
      success: true,
      messageId: result.id,
      threadId: result.threadId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function refreshGmailToken(
  supabase: any,
  userId: string,
  refreshToken: string,
): Promise<boolean> {
  try {
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      console.error("Google OAuth credentials not configured");
      return false;
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }).toString(),
    });

    if (!response.ok) {
      return false;
    }

    const tokens = await response.json();

    await supabase
      .from("oauth_tokens")
      .update({
        access_token: tokens.access_token,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      })
      .eq("user_id", userId)
      .eq("provider", "gmail");

    return true;
  } catch (error) {
    console.error("Token refresh error:", error);
    return false;
  }
}
