// Accepts a quick-capture payload from the bookmarklet or the /quick-add form.
// Creates an application in 'wishlist' status plus optionally a company record.
//
// POST body:
//   { url?, title?, description?, company_name?, role_title?, location?, source?, notes? }
//
// If role_title is missing, tries to extract it from `title` using simple heuristics.
// If company_name is missing but can be inferred from the URL domain, uses that.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.0";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.36.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { getUserIdFromJWT, LEGACY_USER_ID } from "../_shared/constants.ts";

interface CapturePayload {
  url?: string;
  title?: string;
  description?: string;
  company_name?: string;
  role_title?: string;
  location?: string;
  source?: string;
  notes?: string;
  jd_text?: string; // full JD text for AI parsing
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const userId = getUserIdFromJWT(req) ?? LEGACY_USER_ID;

  let payload: CapturePayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let { role_title, company_name, location, source } = payload;
  const { notes, url, jd_text } = payload;

  // If we have JD text and missing fields, parse with Claude
  if (jd_text && (!role_title || !company_name)) {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (apiKey) {
      try {
        const client = new Anthropic({ apiKey });
        const msg = await client.messages.create({
          model: "claude-haiku-4-5",
          max_tokens: 256,
          system:
            "Extract job details from the text. Respond with JSON only: {role_title, company_name, location, source}. Use null for unknown fields.",
          messages: [
            {
              role: "user",
              content: jd_text.slice(0, 3000),
            },
          ],
        });
        const text = (msg.content[0] as { type: string; text: string }).text.trim();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (!role_title && parsed.role_title) role_title = parsed.role_title;
          if (!company_name && parsed.company_name) company_name = parsed.company_name;
          if (!location && parsed.location) location = parsed.location;
          if (!source && parsed.source) source = parsed.source;
        }
      } catch {
        // Non-fatal — continue without AI-parsed fields
      }
    }
  }

  // Fallback: try to extract from title
  if (!role_title && payload.title) {
    role_title = payload.title
      .replace(/\s*[-|–]\s*(linkedin|indeed|glassdoor|greenhouse|lever|ashby|workday).*/i, "")
      .trim();
  }
  if (!role_title) role_title = "Unknown Role";

  // Fallback: extract company from URL
  if (!company_name && url) {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, "");
      // Strip known job board domains
      const jobBoards = [
        "linkedin.com",
        "indeed.com",
        "glassdoor.com",
        "greenhouse.io",
        "lever.co",
        "ashbyhq.com",
        "workday.com",
      ];
      if (!jobBoards.some((b) => hostname.includes(b))) {
        company_name = hostname.split(".")[0];
        company_name = company_name.charAt(0).toUpperCase() + company_name.slice(1);
      }
    } catch {
      // ignore
    }
  }

  // Upsert company if we have a name
  let company_id: string | null = null;
  if (company_name) {
    const { data: existingCompany } = await supabase
      .from("companies")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", company_name)
      .maybeSingle();

    if (existingCompany) {
      company_id = existingCompany.id;
    } else {
      const { data: newCompany } = await supabase
        .from("companies")
        .insert({ user_id: userId, name: company_name })
        .select("id")
        .single();
      company_id = newCompany?.id ?? null;
    }
  }

  const { data: application, error } = await supabase
    .from("applications")
    .insert({
      user_id: userId,
      role_title,
      company_name: company_name ?? null,
      company_id,
      status: "wishlist",
      source: source ?? (url ? new URL(url).hostname.replace(/^www\./, "") : null),
      notes:
        [
          notes ?? "",
          url ? `Source URL: ${url}` : "",
          jd_text ? `\n---\n${jd_text.slice(0, 2000)}` : "",
        ]
          .filter(Boolean)
          .join("\n")
          .trim() || null,
    })
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ ok: true, application_id: application.id, role_title, company_name }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
