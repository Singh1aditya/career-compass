import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

interface GmailCallbackSearch {
  code?: string;
  error?: string;
  state?: string;
}

export const Route = createFileRoute("/auth/gmail/callback")({
  component: GmailCallbackComponent,
  validateSearch: (search: Record<string, any>): GmailCallbackSearch => search,
});

function GmailCallbackComponent() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth/gmail/callback" });
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      if (search.error) {
        throw new Error(search.error || "Gmail authorization failed");
      }

      if (!search.code) {
        throw new Error("No authorization code received");
      }

      // Call Edge Function to exchange code for tokens
      const response = await fetch(`${SUPABASE_URL}/functions/v1/gmail-exchange-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ code: search.code }),
      });

      if (!response.ok) {
        throw new Error("Failed to exchange authorization code");
      }

      const data = await response.json();

      // Store OAuth tokens in database
      const { error: dbError } = await supabase.from("oauth_tokens").insert({
        user_id: "00000000-0000-0000-0000-000000000000",
        provider: "gmail",
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
        scope: data.scope,
      });

      if (dbError) throw dbError;

      toast.success("Gmail connected successfully!");
      navigate({ to: "/settings" });
    } catch (error: any) {
      console.error("Gmail callback error:", error);
      toast.error(error.message || "Failed to connect Gmail");
      navigate({ to: "/settings" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-lg font-semibold mb-2">Connecting Gmail...</h2>
        <p className="text-muted-foreground">
          {processing
            ? "Please wait while we complete the setup."
            : "Redirecting..."}
        </p>
      </div>
    </div>
  );
}
