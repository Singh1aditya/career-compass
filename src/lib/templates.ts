// Single source of truth for template variable rendering.
// Used by: SequenceDetailPage UI, TemplatePreview, sequence-utils, and the
// edge function process-pending-sends (which has its own copy because Deno).
//
// Supported variables:
//   {{first_name}}    — contact's first name (split on whitespace)
//   {{full_name}}     — contact's full name
//   {{company}}       — contact.company_name
//   {{role}}          — contact.role
//   {{contact_email}} — contact.email
//   {{my_name}}       — sender's display name (from settings, fallback "You")
//   {{my_signature}}  — sender's signature block (from settings)
//   {{my_role}}       — sender's role (from settings)

import { supabase } from "@/integrations/supabase/client";

export interface TemplateContact {
  name: string;
  email?: string | null;
  company_name?: string | null;
  role?: string | null;
}

export interface TemplateSender {
  display_name?: string | null;
  signature?: string | null;
  role?: string | null;
}

export function renderTemplate(
  text: string,
  contact: TemplateContact,
  sender: TemplateSender = {},
): string {
  const firstName = (contact.name ?? "").split(" ")[0] || "[First Name]";
  return text
    .replace(/{{\s*first_name\s*}}/gi, firstName)
    .replace(/{{\s*full_name\s*}}/gi, contact.name || "[Name]")
    .replace(/{{\s*company\s*}}/gi, contact.company_name || "[Company]")
    .replace(/{{\s*role\s*}}/gi, contact.role || "[Role]")
    .replace(/{{\s*contact_email\s*}}/gi, contact.email || "[Email]")
    .replace(/{{\s*my_name\s*}}/gi, sender.display_name || "You")
    .replace(/{{\s*my_signature\s*}}/gi, sender.signature || "")
    .replace(/{{\s*my_role\s*}}/gi, sender.role || "");
}

let cachedSender: TemplateSender | null = null;
let cachedSenderUserId: string | null = null;

export async function loadSender(userId: string, force = false): Promise<TemplateSender> {
  if (cachedSender && !force && cachedSenderUserId === userId) return cachedSender;
  const { data } = await supabase
    .from("user_settings")
    .select("display_name, signature")
    .eq("user_id", userId)
    .maybeSingle();
  cachedSender = (data as TemplateSender) ?? {};
  cachedSenderUserId = userId;
  return cachedSender;
}

export function clearSenderCache() {
  cachedSender = null;
  cachedSenderUserId = null;
}
