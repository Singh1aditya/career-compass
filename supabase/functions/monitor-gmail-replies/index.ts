import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    import { DEFAULT_USER_ID } from "../_shared/constants.ts";

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
        },
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
      `,
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
        },
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
        const replyInfo = await checkThreadForReply(
          threadId,
          recipientData.contacts.email,
          oauthToken.access_token,
        );

        checked++;

        if (replyInfo.hasReply) {
          if (replyInfo.isOutOfOffice) {
            // Out-of-office auto-reply: don't transition; log and continue
            await supabase.from("automation_logs").insert({
              level: "info",
              function_name: "monitor-gmail-replies",
              message: "OOO auto-reply detected, skipping state change",
              payload: { contact: recipientData.contacts.email, threadId },
            });
            continue;
          }

          // Real reply — flip state, lock automation, create interaction
          await supabase
            .from("sequence_recipients")
            .update({
              state: "replied",
              automation_active: false,
              lock_reason: "reply_detected",
            })
            .eq("id", recipientData.id);

          await supabase.from("interactions").insert({
            user_id: DEFAULT_USER_ID,
            contact_id: recipientData.contact_id,
            type: "email",
            direction: "inbound",
            summary: "Reply received (auto-detected)",
            date: new Date().toISOString().split("T")[0],
          });

          await supabase.from("automation_logs").insert({
            level: "info",
            function_name: "monitor-gmail-replies",
            message: "reply detected, automation paused",
            payload: { contact: recipientData.contacts.email, threadId },
          });

          updated++;
        }
      } catch (error: any) {
        await supabase.from("automation_logs").insert({
          level: "error",
          function_name: "monitor-gmail-replies",
          message: "thread check error",
          payload: { threadId, error: error.message },
        });
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
      },
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
      },
    );
  }
});

const OOO_PATTERNS = [
  /out\s+of\s+office/i,
  /vacation\s+(auto[-\s]?reply|response)/i,
  /automatic\s+reply/i,
  /auto[-\s]?reply/i,
  /currently\s+(out|away|on\s+leave)/i,
  /will\s+be\s+(out|away)\s+of\s+the\s+office/i,
];

function looksLikeOOO(subject: string, snippet: string): boolean {
  const haystack = `${subject}\n${snippet}`;
  return OOO_PATTERNS.some((re) => re.test(haystack));
}

async function checkThreadForReply(
  threadId: string,
  senderEmail: string,
  accessToken: string,
): Promise<{ hasReply: boolean; isOutOfOffice: boolean }> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/threads/${threadId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!response.ok) return { hasReply: false, isOutOfOffice: false };
    const thread = await response.json();
    if (!thread.messages || thread.messages.length < 2) {
      return { hasReply: false, isOutOfOffice: false };
    }

    for (const message of thread.messages) {
      const headers = message.payload?.headers ?? [];
      const fromHeader = headers.find((h: any) => h.name === "From");
      const subjectHeader = headers.find((h: any) => h.name === "Subject");
      if (!fromHeader) continue;
      const fromVal = (fromHeader.value || "").toLowerCase();
      if (fromVal.includes("me@") || fromVal.includes("noreply") || fromVal.includes("no-reply")) {
        continue;
      }
      // Found a reply from someone other than us
      const subject = subjectHeader?.value ?? "";
      const snippet = message.snippet ?? "";
      return { hasReply: true, isOutOfOffice: looksLikeOOO(subject, snippet) };
    }

    return { hasReply: false, isOutOfOffice: false };
  } catch (error: any) {
    console.error("[Gmail API Error]", error.message);
    return { hasReply: false, isOutOfOffice: false };
  }
}
