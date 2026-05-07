import { useState, useEffect, useCallback } from "react";
import type { User } from "@supabase/supabase-js";

const DEFAULT_USER: User = {
  id: "00000000-0000-0000-0000-000000000000",
  aud: "authenticated",
  role: "authenticated",
  email: "personal@carecrm.local",
  email_confirmed_at: new Date().toISOString(),
  phone: "",
  confirmed_at: new Date().toISOString(),
  last_sign_in_at: new Date().toISOString(),
  app_metadata: {},
  user_metadata: {},
  identities: [],
  is_anonymous: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as unknown as User;

export function useAuth() {
  const [user] = useState<User>(DEFAULT_USER);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(false);
  }, []);

  const signOut = useCallback(async () => {
    // No-op for personal app
  }, []);

  return { user, session: null, loading, signOut };
}
