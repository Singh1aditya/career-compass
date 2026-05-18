import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Get all active sequences
    const { data: sequences } = await supabase.from("sequences").select("*").eq("status", "active");

    if (!sequences || sequences.length === 0) {
      return new Response(JSON.stringify({ success: true, checked: 0, updated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalChecked = 0;
    let totalUpdated = 0;

    for (const sequence of sequences) {
      // Get recipients with pending emails
      const { data: recipients } = await supabase
        .from("sequence_recipients")
        .select("*, sequence_sends(gmail_message_id, gmail_thread_id)", { count: "exact" })
        .eq("sequence_id", sequence.id)
        .neq("state", "replied")
        .neq("state", "closed");

      if (!recipients) continue;

      for (const recipient of recipients) {
        // TODO: Check Gmail API for replies to threads
        // For now, just log
        console.log(`[Gmail Poll] Checking for replies for recipient ${recipient.id}`);
        totalChecked++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked: totalChecked,
        updated: totalUpdated,
        message: "Gmail polling complete (full integration coming soon)",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
