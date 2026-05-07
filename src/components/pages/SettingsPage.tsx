import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Lock, Bell, Clock, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { EmailScanStatus } from "@/components/EmailScanStatus";
import { UserSettingsPanel } from "@/components/UserSettingsPanel";

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";

export function SettingsPage() {
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkGmailConnection();
  }, []);

  const checkGmailConnection = async () => {
    try {
      const { data } = await supabase
        .from("oauth_tokens")
        .select("*")
        .eq("user_id", DEFAULT_USER_ID)
        .eq("provider", "gmail")
        .single();

      if (data) {
        setGmailConnected(true);
        // Decode the email from metadata if available
        setGmailEmail(data.email || "Connected");
      }
    } catch (error) {
      setGmailConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGmail = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
    if (!clientId || clientId.startsWith("YOUR_") || !clientId.includes(".apps.googleusercontent.com")) {
      toast.error(
        "VITE_GOOGLE_CLIENT_ID is not set. Add it to .env.local — see GMAIL_SETUP.md.",
      );
      return;
    }
    const redirectUri = `${window.location.origin}/auth/gmail/callback`;
    const scope = [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.readonly",
    ].join(" ");

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;

    window.location.href = authUrl;
  };

  const handleDisconnectGmail = async () => {
    try {
      const { error } = await supabase
        .from("oauth_tokens")
        .delete()
        .eq("user_id", DEFAULT_USER_ID)
        .eq("provider", "gmail");

      if (error) throw error;

      setGmailConnected(false);
      setGmailEmail(null);
      toast.success("Gmail disconnected");
    } catch (error: any) {
      toast.error("Failed to disconnect Gmail");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your Career CRM preferences</p>
      </div>

      <div className="grid gap-6">
        {/* Gmail Integration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>Gmail Integration</CardTitle>
                  <CardDescription>Connect your Gmail account to send emails from sequences</CardDescription>
                </div>
              </div>
              {gmailConnected && (
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Connected</span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!loading && (
              <>
                {gmailConnected ? (
                  <div className="space-y-3">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-sm font-medium text-green-900">
                        ✓ Gmail connected
                      </p>
                      <p className="text-xs text-green-700 mt-1">
                        {gmailEmail || "Your Gmail account is ready to send emails"}
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      onClick={handleDisconnectGmail}
                    >
                      Disconnect Gmail
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Click below to authorize Career CRM to send emails from your Gmail account.
                    </p>
                    <Button
                      onClick={handleConnectGmail}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      <Mail className="h-4 w-4 mr-2" /> Connect Gmail
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      We'll need permission to send emails and monitor replies.
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* User Settings (signature, caps) */}
        <UserSettingsPanel />

        {/* Email Auto-Ingest */}
        <EmailScanStatus gmailConnected={gmailConnected} />

        {/* Security */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Security</CardTitle>
                <CardDescription>Manage your account security settings</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Two-factor authentication</span>
              <Button variant="outline" size="sm" disabled>
                Enable
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Control how you're notified about interactions and follow-ups</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Coming Soon</p>
          </CardContent>
        </Card>

        {/* Send Window */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Preferred Send Time</CardTitle>
                <CardDescription>Configure when emails from sequences should be sent</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Phase 3 feature - configurable after Gmail integration</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
