import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";

    // Get Gmail token
    const { data: oauthToken } = await supabase
      .from("oauth_tokens")
      .select("*")
      .eq("user_id", DEFAULT_USER_ID)
      .eq("provider", "gmail")
      .single();

    if (!oauthToken) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Gmail not connected",
          checked: 0,
          updated: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get all sent emails with thread IDs
    const { data: sentEmails } = await supabase
      .from("sequence_sends")
      .select(
        `
        id,
        recipient_id,
        gmail_thread_id,
        sequence_recipients!inner(
          id,
          contact_id,
          state,
          sequence_id,
          contacts!inner(id, name, email)
        )
      `
      )
      .not("gmail_thread_id", "is", null);

    if (!sentEmails || sentEmails.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No sent emails to check",
          checked: 0,
          updated: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let checked = 0;
    let updated = 0;

    for (const email of sentEmails) {
      const threadId = email.gmail_thread_id;
      const recipientData = email.sequence_recipients;

      // Skip if already marked as replied
      if (recipientData.state === "replied") {
        continue;
      }

      try {
        // Check thread for new messages from sender's perspective
        const hasReply = await checkThreadForReply(
          threadId,
          recipientData.contacts.email,
          oauthToken.access_token
        );

        checked++;

        if (hasReply) {
          // Update recipient state to replied
          await supabase
            .from("sequence_recipients")
            .update({ state: "replied" })
            .eq("id", recipientData.id);

          // Create interaction record
          await supabase.from("interactions").insert({
            user_id: DEFAULT_USER_ID,
            contact_id: recipientData.contact_id,
            type: "email",
            direction: "inbound",
            summary: "Reply received",
            date: new Date().toISOString().split("T")[0],
          });

          updated++;
          console.log(
            `[Gmail] Reply detected from ${recipientData.contacts.email}`
          );
        }
      } catch (error: any) {
        console.error(
          `[Gmail] Error checking thread ${threadId}:`,
          error.message
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked,
        updated,
        message: `Checked ${checked} emails, found ${updated} replies`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[Function Error]", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        checked: 0,
        updated: 0,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function checkThreadForReply(
  threadId: string,
  senderEmail: string,
  accessToken: string
): Promise<boolean> {
  try {
    // Get thread details from Gmail API
    const response = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/threads/${threadId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      return false;
    }

    const thread = await response.json();

    if (!thread.messages || thread.messages.length < 2) {
      // No replies yet (only original message)
      return false;
    }

    // Check if there's a message from someone other than the sender
    for (const message of thread.messages) {
      const headers = message.payload.headers;
      const fromHeader = headers.find((h: any) => h.name === "From");

      if (
        fromHeader &&
        !fromHeader.value.toLowerCase().includes("me@") &&
        !fromHeader.value.toLowerCase().includes("noreply")
      ) {
        // Found a reply from someone other than us
        return true;
      }
    }

    return false;
  } catch (error: any) {
    console.error("[Gmail API Error]", error.message);
    return false;
  }
}
