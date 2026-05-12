// Tokenizer + matcher for refining a contact sub-list against the role
// you're applying for. The diagram step "Refine Sub-list — Match Role/Title"
// uses this to flag "best-match" contacts (people whose own role overlaps
// with the role title on the application).

const STOPWORDS = new Set([
  "senior", "sr", "junior", "jr", "staff", "principal", "lead",
  "the", "and", "of", "at", "to", "for", "with", "via",
  "a", "an", "in", "on", "by",
  "i", "ii", "iii", "iv", "v", "1", "2", "3", "4", "5",
  "remote", "hybrid", "onsite", "contract", "full", "time", "part",
]);

/** Lowercased, split on whitespace + common separators, stopwords + short tokens removed. */
export function extractRoleTokens(role: string | null | undefined): string[] {
  if (!role) return [];
  const raw = role.toLowerCase().split(/[\s\-/,()&]+/).filter(Boolean);
  const out: string[] = [];
  for (const t of raw) {
    if (t.length < 3) continue;
    if (STOPWORDS.has(t)) continue;
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

/** Returns true if the contact's role shares ≥1 significant token with the application title. */
export function roleMatches(applicationTitle: string, contactRole: string | null | undefined): boolean {
  if (!contactRole) return false;
  const a = new Set(extractRoleTokens(applicationTitle));
  if (a.size === 0) return false;
  const b = extractRoleTokens(contactRole);
  return b.some((t) => a.has(t));
}

/** Returns the overlapping tokens — useful for surfacing "matched on: …" badges. */
export function matchedTokens(applicationTitle: string, contactRole: string | null | undefined): string[] {
  if (!contactRole) return [];
  const a = new Set(extractRoleTokens(applicationTitle));
  return extractRoleTokens(contactRole).filter((t) => a.has(t));
}
