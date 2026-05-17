import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { renderTemplate as renderTemplateCore, loadSender } from "@/lib/templates";

import { DEFAULT_USER_ID } from "@/lib/constants";

// Synchronous wrapper for the existing API. For accurate signature rendering
// at send time, the edge function reads sender settings from the DB directly.
export function renderTemplate(
  text: string,
  contact: { name: string; company_name?: string | null; role?: string | null; email?: string | null }
): string {
  return renderTemplateCore(text, contact);
}

// Use this from UI when you want signature variables filled in for preview.
export async function renderTemplateWithSender(
  text: string,
  contact: { name: string; company_name?: string | null; role?: string | null; email?: string | null }
): Promise<string> {
  const sender = await loadSender();
  return renderTemplateCore(text, contact, sender);
}

/**
 * Get the next step to send for a recipient
 */
async function getNextStepToSend(
  sequenceId: string,
  recipientId: string,
  currentState: string
) {
  // Map state to next step type
  const stateToStepMap: Record<string, string> = {
    waiting: "initial",
    initial_sent: "followup_1",
    followup_1: "followup_2",
    followup_2: "followup_3",
  };

  const nextStepType = stateToStepMap[currentState];
  if (!nextStepType) return null;

  const { data } = await supabase
    .from("sequence_steps")
    .select("*")
    .eq("sequence_id", sequenceId)
    .eq("step_type", nextStepType)
    .single();

  return data;
}

/**
 * Process pending sends - called by scheduler
 */
export async function processPendingSends() {
  console.log("[Sequences] Processing pending sends...");

  try {
    // Get all active sequences
    const { data: sequences } = await supabase
      .from("sequences")
      .select("*")
      .eq("status", "active");

    if (!sequences || sequences.length === 0) {
      console.log("[Sequences] No active sequences");
      return { success: true, sent: 0 };
    }

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
        const step = await getNextStepToSend(
          sequence.id,
          recipient.id,
          recipient.state
        );

        if (!step) {
          // No more steps, mark as completed
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
        const subject = renderTemplate(step.template_subject ?? "", contact as any);
        const body = renderTemplate(step.template_body, contact as any);

        // Send email (will be delegated to Edge Function when Gmail is connected)
        const sendResult = await sendEmail({
          to: contact.email,
          subject,
          body,
          contactId: contact.id,
          recipientId: recipient.id,
          stepNumber: step.step_number,
          sequenceId: sequence.id,
        });

        if (sendResult.success) {
          // Log the send
          await supabase.from("sequence_sends").insert({
            recipient_id: recipient.id,
            step_number: step.step_number,
            subject,
            body,
          });

          // Update recipient state
          const nextState =
            step.step_type === "initial"
              ? "initial_sent"
              : `followup_${step.step_number}`;

          // Get next step to calculate when to send next
          const nextStep = await supabase
            .from("sequence_steps")
            .select("*")
            .eq("sequence_id", sequence.id)
            .eq("step_number", step.step_number + 1)
            .single();

          let nextSendAt = null;
          if (nextStep.data) {
            const delayMs = nextStep.data.delay_days * 24 * 60 * 60 * 1000;
            nextSendAt = new Date(Date.now() + delayMs).toISOString();
          }

          await supabase
            .from("sequence_recipients")
            .update({
              state: nextState,
              next_send_at: nextSendAt,
            })
            .eq("id", recipient.id);

          totalSent++;
        }
      }
    }

    console.log(`[Sequences] Processed ${totalSent} sends`);
    return { success: true, sent: totalSent };
  } catch (error: any) {
    console.error("[Sequences] Error processing sends:", error);
    throw error;
  }
}

/**
 * Send email via Gmail API
 */
async function sendEmail(params: {
  to: string;
  subject: string;
  body: string;
  contactId: string;
  recipientId: string;
  stepNumber: number;
  sequenceId: string;
}): Promise<{ success: boolean; messageId?: string }> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email-via-gmail`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          to: params.to,
          subject: params.subject,
          body: params.body,
          recipientId: params.recipientId,
          stepNumber: params.stepNumber,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error(`[Email] Failed to send to ${params.to}:`, result.error);
      return { success: false };
    }

    console.log(`[Email] Sent to ${params.to}:`, result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error: any) {
    console.error(`[Email] Error sending to ${params.to}:`, error);
    return { success: false };
  }
}

/**
 * Enroll a contact in a sequence (initialize with first step)
 */
export async function enrollContactInSequence(
  sequenceId: string,
  contactId: string
) {
  // Get first step
  const { data: firstStep } = await supabase
    .from("sequence_steps")
    .select("*")
    .eq("sequence_id", sequenceId)
    .eq("step_type", "initial")
    .single();

  if (!firstStep) {
    throw new Error("Sequence has no initial step");
  }

  // Calculate when to send first email (now or after delay)
  const delayMs = firstStep.delay_days * 24 * 60 * 60 * 1000;
  const nextSendAt = new Date(Date.now() + delayMs).toISOString();

  return {
    sequence_id: sequenceId,
    contact_id: contactId,
    user_id: DEFAULT_USER_ID,
    state: "waiting",
    next_send_at: nextSendAt,
  };
}

/**
 * Get sequence statistics
 */
export async function getSequenceStats(sequenceId: string) {
  const { data: recipients } = await supabase
    .from("sequence_recipients")
    .select("state")
    .eq("sequence_id", sequenceId);

  if (!recipients) {
    return {
      total: 0,
      waiting: 0,
      sent: 0,
      replied: 0,
      bounced: 0,
      closed: 0,
    };
  }

  return {
    total: recipients.length,
    waiting: recipients.filter((r) => r.state === "waiting").length,
    sent: recipients.filter((r) =>
      ["initial_sent", "followup_1", "followup_2", "followup_3"].includes(
        r.state
      )
    ).length,
    replied: recipients.filter((r) => r.state === "replied").length,
    bounced: recipients.filter((r) => r.state === "bounced").length,
    closed: recipients.filter((r) => r.state === "closed").length,
  };
}
