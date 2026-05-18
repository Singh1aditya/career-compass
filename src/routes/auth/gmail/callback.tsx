import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
        const msg =
          search.error === "access_denied"
            ? "You denied Gmail access. Connect Gmail again to enable email sending."
            : `Gmail authorization failed: ${search.error}`;
        throw new Error(msg);
      }

      if (!search.code) {
        throw new Error("No authorization code received");
      }

      // Pass the exact redirect_uri that was used to initiate the OAuth flow so
      // the edge function can send it byte-for-byte to Google's token endpoint.
      const redirectUri = `${window.location.origin}/auth/gmail/callback`;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/gmail-exchange-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ code: search.code, redirect_uri: redirectUri }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to exchange authorization code");
      }

      toast.success(
        data.email ? `Gmail connected: ${data.email}` : "Gmail connected successfully!",
      );
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
          {processing ? "Please wait while we complete the setup." : "Redirecting..."}
        </p>
      </div>
    </div>
  );
}
