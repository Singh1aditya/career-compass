// Helpers shared across edge functions for extracting the caller's
// Supabase Auth user_id from the request, and for iterating users in
// cron-driven functions.
//
// The legacy zero-UUID fallback is intentional: it covers two cases —
//   1. Health checks (`{ __healthcheck: true }`) where no JWT is present.
//   2. Operator-triggered runs during the migration window before the
//      first real user signs up.
// Once auth migration (20260519 + 20260520) lands and at least one
// real user exists, the fallback is effectively dead.
export const LEGACY_USER_ID = "00000000-0000-0000-0000-000000000000";

// Back-compat alias — older edge function code still imports this name.
// New code should call `getUserIdFromJWT` instead.
export const DEFAULT_USER_ID = LEGACY_USER_ID;

// Decode the user_id (`sub` claim) from a Supabase Auth JWT in the
// Authorization header. Returns null if no header or malformed token.
// We don't verify the signature here — Supabase functions already do
// that at the edge gateway when verify_jwt is on. We only need the sub.
export function getUserIdFromJWT(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!auth) return null;
  const token = auth.replace(/^Bearer\s+/i, "");
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

// Returns the distinct list of user_ids that have an `oauth_tokens` row
// (i.e. users who have connected Gmail). Cron-invoked functions iterate
// this list to do per-user work.
export async function listGmailUsers(
  // deno-lint-ignore no-explicit-any
  supabase: any,
): Promise<string[]> {
  const { data } = await supabase.from("oauth_tokens").select("user_id").eq("provider", "gmail");
  if (!data) return [];
  const ids = new Set<string>();
  for (const row of data as { user_id: string }[]) ids.add(row.user_id);
  return [...ids];
}
