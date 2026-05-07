import { supabase } from "@/integrations/supabase/client";

export interface SearchResults {
  contacts: Array<{ id: string; name: string; email: string | null; company_name: string | null; contact_type: string }>;
  applications: Array<{ id: string; role_title: string; company_name: string | null; status: string }>;
  companies: Array<{ id: string; name: string; industry: string | null }>;
  notes: Array<{ id: string; content: string; contact_id: string | null; company_id: string | null; application_id: string | null }>;
}

export const emptyResults: SearchResults = {
  contacts: [],
  applications: [],
  companies: [],
  notes: [],
};

export async function searchAll(query: string, limit = 10): Promise<SearchResults> {
  const q = query.trim();
  if (q.length < 2) return emptyResults;

  const pattern = `%${q}%`;
  const [contactsRes, appsRes, companiesRes, notesRes] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, name, email, company_name, contact_type")
      .or(`name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern},company_name.ilike.${pattern},role.ilike.${pattern},notes.ilike.${pattern}`)
      .limit(limit),
    supabase
      .from("applications")
      .select("id, role_title, company_name, status")
      .or(`role_title.ilike.${pattern},company_name.ilike.${pattern},notes.ilike.${pattern}`)
      .limit(limit),
    supabase
      .from("companies")
      .select("id, name, industry")
      .or(`name.ilike.${pattern},industry.ilike.${pattern}`)
      .limit(limit),
    supabase
      .from("notes")
      .select("id, content, contact_id, company_id, application_id")
      .ilike("content", pattern)
      .limit(limit),
  ]);

  return {
    contacts: (contactsRes.data ?? []) as SearchResults["contacts"],
    applications: (appsRes.data ?? []) as SearchResults["applications"],
    companies: (companiesRes.data ?? []) as SearchResults["companies"],
    notes: (notesRes.data ?? []) as SearchResults["notes"],
  };
}

export function totalResultCount(r: SearchResults): number {
  return r.contacts.length + r.applications.length + r.companies.length + r.notes.length;
}
