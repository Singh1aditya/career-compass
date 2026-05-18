// Scans the connected Gmail inbox for job-related emails:
//   - Confirmations ("thank you for applying", "we received your application")
//     → creates a new application with status='applied' if not already tracked
//   - Rejections ("unfortunately", "decided not to move forward", "regret")
//     → updates the matching application's status to 'rejected'
//
// Each Gmail message is processed at most once (tracked in processed_emails).
// Trigger: invoked by the SettingsPage "Scan Now" button or a Supabase cron.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { DEFAULT_USER_ID } from "../_shared/constants.ts";

// Gmail search query that catches both confirmation and rejection emails
const GMAIL_QUERY = [
  "(",
  'subject:"thank you for applying"',
  'OR subject:"thanks for applying"',
  'OR subject:"application received"',
  'OR subject:"we received your application"',
  'OR subject:"your application"',
  'OR subject:"unfortunately"',
  'OR subject:"not moving forward"',
  'OR subject:"regret to inform"',
  'OR subject:"decided to move forward"',
  'OR subject:"after careful consideration"',
  ")",
  "newer_than:60d",
].join(" ");

const CONFIRMATION_PATTERNS = [
  /thank(s| you) for applying/i,
  /thanks for your application/i,
  /application (has been )?received/i,
  /we('ve| have) received your application/i,
  /your application (for|to)/i,
  /confirming (we have received|your application)/i,
];

const REJECTION_PATTERNS = [
  /unfortunately[\s,].{0,80}(not|won't|will not|unable|decided)/i,
  /not moving forward/i,
  /regret to inform/i,
  /decided to (move forward|proceed|go) with (other|another)/i,
  /after careful consideration[\s,].{0,80}(other|not|won't|will not)/i,
  /(we|i) (have )?decided not to/i,
  /your application (was )?(unsuccessful|not selected)/i,
];

// Common ATS / no-reply domains. We strip these to fall back to body parsing.
const ATS_DOMAINS = new Set([
  "greenhouse.io",
  "lever.co",
  "workday.com",
  "myworkday.com",
  "ashbyhq.com",
  "smartrecruiters.com",
  "icims.com",
  "taleo.net",
  "successfactors.com",
  "jobvite.com",
  "breezy.hr",
]);

interface GmailMessage {
  id: string;
  threadId: string;
}

interface GmailFullMessage {
  id: string;
  threadId: string;
  snippet?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
    parts?: Array<{ mimeType?: string; body?: { data?: string }; parts?: any[] }>;
    body?: { data?: string };
    mimeType?: string;
  };
  internalDate?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Fetch and refresh OAuth token if needed
    const accessToken = await getValidAccessToken(supabase);
    if (!accessToken) {
      return jsonResponse(
        { success: false, error: "Gmail not connected. Connect in Settings." },
        401,
      );
    }

    // List messages matching our query
    const messages = await listMessages(accessToken, GMAIL_QUERY, 100);

    const summary = {
      scanned: messages.length,
      created: 0,
      updated: 0,
      skipped: 0,
      noop: 0,
    };

    for (const msg of messages) {
      // Already processed?
      const { data: existing } = await supabase
        .from("processed_emails")
        .select("id")
        .eq("gmail_message_id", msg.id)
        .maybeSingle();
      if (existing) {
        summary.skipped++;
        continue;
      }

      const full = await getMessage(accessToken, msg.id);
      const headers = headersOf(full);
      const subject = headers["subject"] ?? "";
      const fromHeader = headers["from"] ?? "";
      const dateHeader = headers["date"] ?? "";
      const body = extractBodyText(full);
      const fullText = `${subject}\n${body}`;

      const classification = classify(fullText);
      const detected = extractCompanyAndRole(subject, body, fromHeader);

      let action: "created" | "updated" | "noop" | "skipped" = "skipped";
      let applicationId: string | null = null;

      if (classification === "confirmation" && detected.company && detected.role) {
        // Find existing application for this company+role
        const existingApp = await findApplication(supabase, detected.company, detected.role);
        if (existingApp) {
          applicationId = existingApp.id;
          action = "noop";
          summary.noop++;
        } else {
          const { data: created } = await supabase
            .from("applications")
            .insert({
              user_id: DEFAULT_USER_ID,
              role_title: detected.role,
              company_name: detected.company,
              status: "applied",
              applied_date: dateHeader ? new Date(dateHeader).toISOString().slice(0, 10) : null,
              source: "Email Auto-Detect",
              notes: `Auto-imported from Gmail on ${new Date().toISOString().slice(0, 10)}\nSubject: ${subject}`,
            })
            .select("id")
            .single();
          if (created) {
            applicationId = created.id;
            action = "created";
            summary.created++;
          }
        }
      } else if (classification === "rejection" && detected.company) {
        const existingApp = await findApplication(supabase, detected.company, detected.role);
        if (existingApp && existingApp.status !== "rejected") {
          await supabase
            .from("applications")
            .update({
              status: "rejected",
              updated_at: new Date().toISOString(),
              notes: existingApp.notes
                ? `${existingApp.notes}\n\nRejected via email on ${new Date().toISOString().slice(0, 10)}`
                : `Rejected via email on ${new Date().toISOString().slice(0, 10)}`,
            })
            .eq("id", existingApp.id);
          applicationId = existingApp.id;
          action = "updated";
          summary.updated++;
        } else if (existingApp) {
          applicationId = existingApp.id;
          action = "noop";
          summary.noop++;
        }
      }

      // Record that we processed this email
      await supabase.from("processed_emails").insert({
        user_id: DEFAULT_USER_ID,
        gmail_message_id: msg.id,
        gmail_thread_id: msg.threadId,
        classification,
        application_id: applicationId,
        action_taken: action,
        detected_company: detected.company,
        detected_role: detected.role,
        email_subject: subject.slice(0, 500),
        email_from: fromHeader.slice(0, 200),
        email_date: dateHeader ? new Date(dateHeader).toISOString() : null,
      });
    }

    return jsonResponse({ success: true, summary });
  } catch (err: any) {
    console.error("[scan-job-emails]", err);
    return jsonResponse({ success: false, error: err.message }, 500);
  }
});

// --- Gmail helpers ---

async function listMessages(
  accessToken: string,
  query: string,
  maxResults: number,
): Promise<GmailMessage[]> {
  const url = new URL("https://www.googleapis.com/gmail/v1/users/me/messages");
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", String(maxResults));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail messages.list failed: ${res.status} ${text}`);
  }
  const json = await res.json();
  return json.messages ?? [];
}

async function getMessage(accessToken: string, messageId: string): Promise<GmailFullMessage> {
  const url = `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Gmail messages.get failed: ${res.status}`);
  }
  return res.json();
}

function headersOf(full: GmailFullMessage): Record<string, string> {
  const out: Record<string, string> = {};
  const headers = full.payload?.headers ?? [];
  for (const h of headers) {
    out[h.name.toLowerCase()] = h.value;
  }
  return out;
}

function extractBodyText(full: GmailFullMessage): string {
  // Prefer text/plain. Fall back to snippet.
  const decode = (data?: string) => {
    if (!data) return "";
    try {
      const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
      return atob(normalized);
    } catch {
      return "";
    }
  };

  const walk = (part: any): string => {
    if (!part) return "";
    if (part.mimeType === "text/plain" && part.body?.data) {
      return decode(part.body.data);
    }
    if (part.parts && Array.isArray(part.parts)) {
      for (const sub of part.parts) {
        const text = walk(sub);
        if (text) return text;
      }
    }
    if (part.mimeType === "text/html" && part.body?.data) {
      // Strip tags as a fallback
      return decode(part.body.data).replace(/<[^>]+>/g, " ");
    }
    return "";
  };

  const fromParts = walk(full.payload);
  if (fromParts) return fromParts;
  return full.snippet ?? "";
}

// --- Classification ---

type Classification = "confirmation" | "rejection" | "unknown";

function classify(text: string): Classification {
  for (const re of REJECTION_PATTERNS) {
    if (re.test(text)) return "rejection";
  }
  for (const re of CONFIRMATION_PATTERNS) {
    if (re.test(text)) return "confirmation";
  }
  return "unknown";
}

// --- Company / role extraction ---

interface Detected {
  company: string | null;
  role: string | null;
}

function extractCompanyAndRole(subject: string, body: string, fromHeader: string): Detected {
  const role = extractRole(subject, body);
  const company = extractCompany(subject, body, fromHeader);
  return { role, company };
}

function extractRole(subject: string, body: string): string | null {
  // Subject patterns:
  //   "Thank you for applying to the Senior Engineer position at Acme"
  //   "Your application for Software Engineer at Acme"
  //   "Application received: Senior Engineer"
  const patterns: RegExp[] = [
    /(?:apply(?:ing)?|application)\s+(?:for|to)(?:\s+the)?\s+(.+?)\s+(?:position|role|opening|opportunity|job)/i,
    /(?:apply(?:ing)?|application)\s+(?:for|to)(?:\s+the)?\s+(.+?)\s+at\s+/i,
    /your application for\s+(.+?)\s+(?:at|has|is|was)/i,
    /application (?:received|status)[:\s]+(.+?)(?:\s+at\s+|\s*$|\s*-|\s*–)/i,
    /position[:\s]+(.+?)(?:\s+at\s+|\s*$|\s*-|\s*–)/i,
  ];

  for (const re of patterns) {
    const m = subject.match(re) ?? body.slice(0, 1000).match(re);
    if (m && m[1]) {
      return cleanRole(m[1]);
    }
  }
  return null;
}

function cleanRole(raw: string): string {
  return raw
    .replace(/[‘’“”"']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function extractCompany(subject: string, body: string, fromHeader: string): string | null {
  // Try subject "at <Company>" first
  const atMatch = subject.match(/\bat\s+([A-Z][\w&.,'\- ]{1,60}?)(?:[!.\n]|\s*$)/);
  if (atMatch && atMatch[1]) {
    const candidate = atMatch[1].trim();
    if (candidate.length >= 2) return candidate;
  }

  // Body: "at <Company>" near "applying" / "application"
  const bodyMatch = body.slice(0, 2000).match(/\bat\s+([A-Z][\w&.,'\- ]{1,60}?)(?:[!.\n]|\s*$)/);
  if (bodyMatch && bodyMatch[1]) {
    return bodyMatch[1].trim();
  }

  // From header: "Company Name <noreply@company.com>"
  const fromName = fromHeader.match(/^([^<]+)</);
  if (fromName && fromName[1]) {
    const name = fromName[1].replace(/["]/g, "").trim();
    if (name && !/^(no[-_ ]?reply|notifications?|careers?|jobs)$/i.test(name)) {
      return name;
    }
  }

  // Fall back to email domain (skip ATS domains)
  const domainMatch = fromHeader.match(/@([\w.\-]+)/);
  if (domainMatch && domainMatch[1]) {
    const domain = domainMatch[1].toLowerCase();
    if (!ATS_DOMAINS.has(domain)) {
      const root = domain
        .replace(
          /^(mail\.|email\.|notifications?\.|hr\.|jobs\.|careers\.|talent\.|recruiting\.)/,
          "",
        )
        .replace(/\.(com|io|co|net|org|ai|app|dev|us|uk)$/, "");
      if (root.length >= 2) {
        return root.charAt(0).toUpperCase() + root.slice(1);
      }
    }
  }

  return null;
}

// --- Database lookup ---

async function findApplication(supabase: any, company: string, role: string | null) {
  // Try exact-ish match on company + role
  if (role) {
    const { data: byBoth } = await supabase
      .from("applications")
      .select("id, company_name, role_title, status, notes")
      .ilike("company_name", `%${company}%`)
      .ilike("role_title", `%${role}%`)
      .limit(1);
    if (byBoth && byBoth.length > 0) return byBoth[0];
  }
  // Fall back to company alone (rejection emails sometimes lack the role)
  const { data: byCompany } = await supabase
    .from("applications")
    .select("id, company_name, role_title, status, notes")
    .ilike("company_name", `%${company}%`)
    .order("created_at", { ascending: false })
    .limit(1);
  if (byCompany && byCompany.length > 0) return byCompany[0];
  return null;
}

// --- OAuth token handling ---

async function getValidAccessToken(supabase: any): Promise<string | null> {
  const { data: token } = await supabase
    .from("oauth_tokens")
    .select("*")
    .eq("user_id", DEFAULT_USER_ID)
    .eq("provider", "gmail")
    .single();

  if (!token) return null;

  if (token.expires_at && new Date(token.expires_at) < new Date()) {
    const ok = await refreshGmailToken(supabase, token.refresh_token);
    if (!ok) return null;
    const { data: fresh } = await supabase
      .from("oauth_tokens")
      .select("access_token")
      .eq("user_id", DEFAULT_USER_ID)
      .eq("provider", "gmail")
      .single();
    return fresh?.access_token ?? null;
  }
  return token.access_token;
}

async function refreshGmailToken(supabase: any, refreshToken: string): Promise<boolean> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) return false;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!res.ok) return false;

  const tokens = await res.json();
  await supabase
    .from("oauth_tokens")
    .update({
      access_token: tokens.access_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    })
    .eq("user_id", DEFAULT_USER_ID)
    .eq("provider", "gmail");
  return true;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
