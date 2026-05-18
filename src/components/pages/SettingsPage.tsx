import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Lock, Bell, Clock, CheckCircle, Bot, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { EmailScanStatus } from "@/components/EmailScanStatus";
import { UserSettingsPanel } from "@/components/UserSettingsPanel";
import { DigestPreview } from "@/components/DigestPreview";
import { DEFAULT_USER_ID } from "@/lib/constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface AIUsage {
  totalRuns: number;
  totalCost: number;
  byKind: { kind: string; runs: number; cost: number }[];
}

interface ReminderSettings {
  digest_enabled: boolean;
  digest_hour: number;
  auto_followups_enabled: boolean;
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: new Date(2000, 0, 1, i).toLocaleTimeString([], { hour: "numeric", hour12: true }),
}));

export function SettingsPage() {
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [gmailHasCalendarScope, setGmailHasCalendarScope] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>({
    digest_enabled: false,
    digest_hour: 8,
    auto_followups_enabled: true,
  });
  const [reminderSaving, setReminderSaving] = useState(false);
  const [digestRunning, setDigestRunning] = useState(false);
  const [aiUsage, setAiUsage] = useState<AIUsage | null>(null);

  useEffect(() => {
    checkGmailConnection();
    loadReminderSettings();
    loadAiUsage();
  }, []);

  const checkGmailConnection = async () => {
    try {
      const { data } = await supabase
        .from("oauth_tokens")
        .select("email, scope")
        .eq("user_id", DEFAULT_USER_ID)
        .eq("provider", "gmail")
        .maybeSingle();
      setGmailConnected(!!data);
      setGmailEmail((data as any)?.email ?? null);
      setGmailHasCalendarScope(((data as any)?.scope ?? "").includes("calendar.events"));
    } catch {
      setGmailConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const loadReminderSettings = async () => {
    const { data } = await db
      .from("user_settings")
      .select("digest_enabled, digest_hour, auto_followups_enabled")
      .eq("user_id", DEFAULT_USER_ID)
      .maybeSingle();
    if (data) {
      setReminderSettings({
        digest_enabled: data.digest_enabled ?? false,
        digest_hour: data.digest_hour ?? 8,
        auto_followups_enabled: data.auto_followups_enabled ?? true,
      });
    }
  };

  const saveReminderSettings = async () => {
    setReminderSaving(true);
    const { error } = await db.from("user_settings").upsert({
      user_id: DEFAULT_USER_ID,
      ...reminderSettings,
      updated_at: new Date().toISOString(),
    });
    setReminderSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Reminder settings saved");
  };

  const runDigestNow = async () => {
    setDigestRunning(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("send-daily-digest");
      if (res.error) throw new Error(res.error.message);
      const body = res.data as any;
      if (body?.skipped) {
        toast.info(`Digest skipped: ${body.reason}`);
      } else {
        toast.success(
          `Digest sent! ${body?.summary?.overdue_count ?? 0} overdue, ${body?.summary?.replies_count ?? 0} replies`,
        );
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to send digest");
    } finally {
      setDigestRunning(false);
    }
  };

  const runAutoFollowups = async () => {
    try {
      const res = await supabase.functions.invoke("generate-auto-followups");
      if (res.error) throw new Error(res.error.message);
      const body = res.data as any;
      toast.success(
        `Generated ${body?.created ?? 0} auto follow-up${body?.created !== 1 ? "s" : ""}`,
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate follow-ups");
    }
  };

  const loadAiUsage = async () => {
    const since = new Date();
    since.setDate(1); // start of current month
    const { data } = await db
      .from("ai_runs")
      .select("kind, tokens_in, tokens_out, cost_usd")
      .eq("user_id", DEFAULT_USER_ID)
      .gte("created_at", since.toISOString());

    if (!data) return;
    const byKindMap: Record<string, { runs: number; cost: number }> = {};
    let totalCost = 0;
    for (const row of data) {
      const k = row.kind as string;
      byKindMap[k] = byKindMap[k] ?? { runs: 0, cost: 0 };
      byKindMap[k].runs++;
      byKindMap[k].cost += row.cost_usd ?? 0;
      totalCost += row.cost_usd ?? 0;
    }
    setAiUsage({
      totalRuns: data.length,
      totalCost,
      byKind: Object.entries(byKindMap).map(([kind, v]) => ({ kind, ...v })),
    });
  };

  const handleConnectGmail = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
    if (
      !clientId ||
      clientId.startsWith("YOUR_") ||
      !clientId.includes(".apps.googleusercontent.com")
    ) {
      toast.error(
        "VITE_GOOGLE_CLIENT_ID is not configured. Add your Google OAuth Client ID to .env.local.",
      );
      return;
    }
    const redirectUri = `${window.location.origin}/auth/gmail/callback`;
    const scope = [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/calendar.events",
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
    } catch {
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
                  <CardDescription>
                    Connect your Gmail account to send emails from sequences
                  </CardDescription>
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
            {!loading &&
              (gmailConnected ? (
                <div className="space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-green-900">Gmail connected</p>
                    <p className="text-xs text-green-700 mt-1">
                      {gmailEmail || "Ready to send emails"}
                    </p>
                  </div>
                  {!gmailHasCalendarScope && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                      <p className="text-sm font-medium text-amber-900">
                        Google Calendar not authorized
                      </p>
                      <p className="text-xs text-amber-700">
                        Re-connect Gmail to enable interview scheduling sync with Google Calendar.
                      </p>
                      <Button size="sm" variant="outline" onClick={handleConnectGmail}>
                        Re-connect to add Calendar access
                      </Button>
                    </div>
                  )}
                  <Button variant="destructive" onClick={handleDisconnectGmail}>
                    Disconnect Gmail
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Authorize Career CRM to send emails from your Gmail account.
                  </p>
                  <Button
                    onClick={handleConnectGmail}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    <Mail className="h-4 w-4 mr-2" /> Connect Gmail
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Requires Gmail send/read + Google Calendar access.
                  </p>
                </div>
              ))}
          </CardContent>
        </Card>

        {/* User Settings (signature, caps) */}
        <UserSettingsPanel />

        {/* Email Auto-Ingest */}
        <EmailScanStatus gmailConnected={gmailConnected} />

        {/* Reminders & Daily Digest */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Reminders &amp; Daily Digest</CardTitle>
                <CardDescription>
                  Get emailed each morning with overdue follow-ups, replies, and weekly stats
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="digest-toggle" className="text-sm font-medium">
                  Daily digest email
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sent to your connected Gmail address
                </p>
              </div>
              <Switch
                id="digest-toggle"
                checked={reminderSettings.digest_enabled}
                onCheckedChange={(v) => setReminderSettings((s) => ({ ...s, digest_enabled: v }))}
              />
            </div>

            {reminderSettings.digest_enabled && (
              <div className="flex items-center gap-3">
                <Label className="text-sm text-muted-foreground shrink-0">Send at</Label>
                <Select
                  value={String(reminderSettings.digest_hour)}
                  onValueChange={(v) =>
                    setReminderSettings((s) => ({ ...s, digest_hour: Number(v) }))
                  }
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOUR_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={String(o.value)}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">local time</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="autofollowup-toggle" className="text-sm font-medium">
                  Auto-generate follow-ups
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Creates reminders for stale applications and sequences after 7 days
                </p>
              </div>
              <Switch
                id="autofollowup-toggle"
                checked={reminderSettings.auto_followups_enabled}
                onCheckedChange={(v) =>
                  setReminderSettings((s) => ({ ...s, auto_followups_enabled: v }))
                }
              />
            </div>

            <div className="flex gap-2 flex-wrap pt-1">
              <Button onClick={saveReminderSettings} disabled={reminderSaving} size="sm">
                {reminderSaving ? "Saving..." : "Save reminder settings"}
              </Button>
              <Button variant="outline" size="sm" onClick={runDigestNow} disabled={digestRunning}>
                {digestRunning ? "Sending..." : "Send digest now"}
              </Button>
              <DigestPreview />
              <Button variant="outline" size="sm" onClick={runAutoFollowups}>
                Generate follow-ups now
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* AI Copilot */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>AI Copilot</CardTitle>
                <CardDescription>
                  Draft emails, summarise threads, analyse job descriptions — powered by Claude
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Use the <strong>Draft with AI</strong> button on application and sequence pages.
              Requires{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">ANTHROPIC_API_KEY</code> set in
              Supabase Edge Function secrets.
            </p>
            {aiUsage ? (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">This month</span>
                  <span className="text-muted-foreground">
                    {aiUsage.totalRuns} runs · ${aiUsage.totalCost.toFixed(4)}
                  </span>
                </div>
                {aiUsage.byKind.length > 0 && (
                  <div className="space-y-1">
                    {aiUsage.byKind.map((row) => (
                      <div
                        key={row.kind}
                        className="flex justify-between text-xs text-muted-foreground"
                      >
                        <span className="capitalize">{row.kind.replace(/_/g, " ")}</span>
                        <span>
                          {row.runs} runs · ${row.cost.toFixed(4)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No AI runs this month.</p>
            )}
          </CardContent>
        </Card>

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
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-sm">Two-factor authentication</span>
              <Button variant="outline" size="sm" disabled>
                Enable
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Send Window */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Preferred Send Time</CardTitle>
                <CardDescription>
                  Configure when emails from sequences should be sent
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Managed via the per-tick cap in Profile &amp; Sending Limits above
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
