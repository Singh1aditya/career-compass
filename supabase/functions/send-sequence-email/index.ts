import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailPayload {
  to: string;
  subject: string;
  body: string;
  recipientId: string;
  stepNumber: number;
  sequenceId: string;
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: EmailPayload = await req.json();

    // Get user's Gmail OAuth token
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: oauthTokens } = await supabase
      .from("oauth_tokens")
      .select("*")
      .eq("provider", "gmail")
      .single();

    if (!oauthTokens) {
      return new Response(
        JSON.stringify({
          error: "Gmail not connected. Please connect Gmail in Settings.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // TODO: Implement Gmail API send when tokens are available
    // For now, return success placeholder
    console.log(`[Function] Would send email to ${payload.to}`);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: "placeholder-" + Date.now(),
        message: "Email ready to send (Gmail integration coming soon)",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
