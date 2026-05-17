// AI Copilot edge function.
// Supported operations (kind):
//   draft_email   — draft an initial outreach from contact + application context
//   draft_reply   — draft a reply to an existing thread
//   summarize     — 1-line summary of a thread / interaction
//   gap_analysis  — JD vs resume gap bullets (requires jd + resume text)
//   auto_tag      — suggest contact tags from email signature + role
//
// Model selection: haiku for speed (draft, summarize, tag); sonnet for analysis.
// Prompt caching: system prompts are marked with cache_control so repeated calls
// within 5 minutes don't incur extra input token charges.
// API key: stored in ANTHROPIC_API_KEY env var (set in Supabase Edge Function secrets).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.0";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.27.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";

// Approximate cost per 1M tokens (MTok) in USD — used for logging only
const COST_TABLE: Record<string, { in: number; out: number }> = {
  "claude-haiku-4-5-20251001": { in: 0.80, out: 4.00 },
  "claude-sonnet-4-6":         { in: 3.00, out: 15.00 },
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const body = await req.json();
  const { kind, context } = body as { kind: string; context: Record<string, string> };

  if (!kind || !context) {
    return new Response(JSON.stringify({ error: "kind and context are required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const client = new Anthropic({ apiKey });

  // Choose model per operation
  const model =
    kind === "gap_analysis"
      ? "claude-sonnet-4-6"
      : "claude-haiku-4-5-20251001";

  let systemPrompt: string;
  let userPrompt: string;

  switch (kind) {
    case "draft_email": {
      systemPrompt = `You are an expert career coach writing professional outreach emails for job seekers.
Write concise, warm, non-generic emails that feel human. Keep them under 150 words.
Output ONLY the email — subject on the first line prefixed "Subject: ", then a blank line, then the body. No preamble.`;
      userPrompt = `Write an outreach email.
Contact: ${context.contact_name ?? "Hiring Manager"} (${context.contact_role ?? "unknown role"}) at ${context.company ?? "the company"}
Role I'm applying for: ${context.role ?? "the position"}
Tone: ${context.tone ?? "professional and warm"}
My name: ${context.my_name ?? ""}
My background: ${context.my_background ?? "software engineer"}`;
      break;
    }
    case "draft_reply": {
      systemPrompt = `You are helping a job seeker reply to emails professionally and naturally.
Output ONLY the reply body — no subject, no preamble. Keep it under 100 words.`;
      userPrompt = `Draft a reply to this thread:

--- Original thread ---
${context.thread ?? ""}
--- End thread ---

My name: ${context.my_name ?? ""}
Tone: ${context.tone ?? "professional"}`;
      break;
    }
    case "summarize": {
      systemPrompt = `Summarise email interactions in one sentence, max 20 words. Output only the summary, no punctuation at the end.`;
      userPrompt = `Summarise: ${context.thread ?? context.text ?? ""}`;
      break;
    }
    case "gap_analysis": {
      systemPrompt = `You are a senior technical recruiter. Analyse the gap between a job description and a resume.
Output a markdown bullet list of missing skills or experiences the candidate should address.
Be specific and actionable. Focus on hard gaps, not minor style differences. Max 8 bullets.`;
      userPrompt = `Job description:
${context.jd ?? ""}

Resume:
${context.resume ?? ""}`;
      break;
    }
    case "auto_tag": {
      systemPrompt = `You are classifying a professional contact. Choose the most fitting tags from this list:
recruiter, hiring-manager, founder, engineer, designer, pm, referral, alumni, colleague, investor
Output ONLY a JSON array of matching tags, e.g. ["recruiter","tech"]. Max 3 tags.`;
      userPrompt = `Contact name: ${context.contact_name ?? ""}
Role/title: ${context.contact_role ?? ""}
Company: ${context.company ?? ""}
Email signature or bio: ${context.signature ?? ""}`;
      break;
    }
    default:
      return new Response(JSON.stringify({ error: `Unknown kind: ${kind}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
  }

  const response = await client.messages.create({
    model,
    max_tokens: kind === "gap_analysis" ? 1024 : 512,
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  const output = response.content.map((b: any) => (b.type === "text" ? b.text : "")).join("");

  const tokensIn = response.usage.input_tokens;
  const tokensOut = response.usage.output_tokens;
  const rate = COST_TABLE[model] ?? { in: 0, out: 0 };
  const costUsd = (tokensIn / 1_000_000) * rate.in + (tokensOut / 1_000_000) * rate.out;

  // Log run (fire-and-forget)
  supabase.from("ai_runs").insert({
    user_id: DEFAULT_USER_ID,
    kind,
    model,
    output,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    cost_usd: costUsd,
  }).then(() => {});

  return new Response(JSON.stringify({ output, model, tokensIn, tokensOut, costUsd }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
