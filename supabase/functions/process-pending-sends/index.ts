import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SequenceStep {
  id: string;
  step_type: string;
  delay_days: number;
  template_subject: string;
  template_body: string;
  step_number: number;
}

interface Recipient {
  id: string;
  state: string;
  next_send_at: string;
  sequence_id: string;
  contact_id: string;
}

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

    console.log("[Cron] Processing pending sends...");

    // Get all active sequences
    const { data: sequences } = await supabase
      .from("sequences")
      .select("*")
      .eq("status", "active");

    if (!sequences || sequences.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No active sequences",
          processed: 0,
          sent: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let totalProcessed = 0;
    let totalSent = 0;

    for (const sequence of sequences) {
      // Get recipients ready to send
      const { data: recipients } = await supabase
        .from("sequence_recipients")
        .select("*")
        .eq("sequence_id", sequence.id)
        .neq("state", "replied")
        .neq("state", "bounced")
        .neq("state", "closed")
        .lte("next_send_at", new Date().toISOString());

      if (!recipients || recipients.length === 0) continue;

      for (const recipient of recipients) {
        totalProcessed++;

        try {
          // Get next step to send
          const step = await getNextStep(supabase, sequence.id, recipient.state);

          if (!step) {
            // No more steps, mark as closed
            await supabase
              .from("sequence_recipients")
              .update({ state: "closed" })
              .eq("id", recipient.id);
            continue;
          }

          // Get contact details
          const { data: contact } = await supabase
            .from("contacts")
            .select("*")
            .eq("id", recipient.contact_id)
            .single();

          if (!contact || !contact.email) continue;

          // Render template
          const subject = renderTemplate(step.template_subject, contact);
          const body = renderTemplate(step.template_body, contact);

          // Send email via Edge Function
          const sendResult = await sendEmailViaGmail(
            contact.email,
            subject,
            body,
            recipient.id,
            step.step_number
          );

          if (sendResult.success) {
            totalSent++;

            // Calculate next send time
            const { data: nextStep } = await supabase
              .from("sequence_steps")
              .select("*")
              .eq("sequence_id", sequence.id)
              .eq("step_number", step.step_number + 1)
              .single();

            let nextSendAt = null;
            if (nextStep) {
              const delayMs = nextStep.delay_days * 24 * 60 * 60 * 1000;
              nextSendAt = new Date(Date.now() + delayMs).toISOString();
            }

            // Update recipient state
            const nextState = getNextState(step.step_type);
            await supabase
              .from("sequence_recipients")
              .update({
                state: nextState,
                next_send_at: nextSendAt,
              })
              .eq("id", recipient.id);

            console.log(
              `[Cron] Sent email to ${contact.email} (state: ${nextState})`
            );
          } else {
            console.error(
              `[Cron] Failed to send to ${contact.email}:`,
              sendResult.error
            );
          }
        } catch (error: any) {
          console.error(`[Cron] Error processing recipient:`, error.message);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${totalProcessed} recipients, sent ${totalSent} emails`,
        processed: totalProcessed,
        sent: totalSent,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[Cron Error]", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        processed: 0,
        sent: 0,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function renderTemplate(
  text: string,
  contact: { name: string; company_name?: string; role?: string }
): string {
  const firstName = contact.name.split(" ")[0];
  return text
    .replace(/{{first_name}}/g, firstName)
    .replace(/{{company}}/g, contact.company_name || "[Company]")
    .replace(/{{role}}/g, contact.role || "[Role]")
    .replace(/{{my_name}}/g, "You");
}

function getNextState(stepType: string): string {
  const stateMap: Record<string, string> = {
    initial: "initial_sent",
    followup_1: "followup_1",
    followup_2: "followup_2",
    followup_3: "followup_3",
  };
  return stateMap[stepType] || "waiting";
}

async function getNextStep(
  supabase: any,
  sequenceId: string,
  currentState: string
): Promise<SequenceStep | null> {
  const stateToStepMap: Record<string, string> = {
    waiting: "initial",
    initial_sent: "followup_1",
    followup_1: "followup_2",
    followup_2: "followup_3",
    followup_3: "",
  };

  const nextStepType = stateToStepMap[currentState];
  if (!nextStepType) return null;

  const { data } = await supabase
    .from("sequence_steps")
    .select("*")
    .eq("sequence_id", sequenceId)
    .eq("step_type", nextStepType)
    .single();

  return data as SequenceStep | null;
}

async function sendEmailViaGmail(
  to: string,
  subject: string,
  body: string,
  recipientId: string,
  stepNumber: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const response = await fetch(
      `${supabaseUrl}/functions/v1/send-email-via-gmail`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify({
          to,
          subject,
          body,
          recipientId,
          stepNumber,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
