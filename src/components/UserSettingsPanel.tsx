import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { User, Save } from "lucide-react";
import { toast } from "sonner";
import { clearSenderCache } from "@/lib/templates";
import { DEFAULT_USER_ID } from "@/lib/constants";

interface Settings {
  display_name: string | null;
  signature: string | null;
  daily_email_cap: number;
  per_tick_email_cap: number;
}

export function UserSettingsPanel() {
  const [s, setS] = useState<Settings>({
    display_name: "",
    signature: "",
    daily_email_cap: 50,
    per_tick_email_cap: 10,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const { data } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", DEFAULT_USER_ID)
      .maybeSingle();
    if (data) setS(data as Settings);
    setLoading(false);
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("user_settings")
      .upsert({
        user_id: DEFAULT_USER_ID,
        display_name: s.display_name || null,
        signature: s.signature || null,
        daily_email_cap: s.daily_email_cap,
        per_tick_email_cap: s.per_tick_email_cap,
        updated_at: new Date().toISOString(),
      });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    clearSenderCache();
    toast.success("Settings saved");
  };

  if (loading) return <Card><CardContent className="p-6 text-muted-foreground">Loading...</CardContent></Card>;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Profile & Sending Limits</CardTitle>
            <CardDescription>
              These power the <code className="text-xs">{"{{my_name}}"}</code> and <code className="text-xs">{"{{my_signature}}"}</code> template variables and cap how many emails each cron tick sends.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Display name</Label>
          <Input
            value={s.display_name ?? ""}
            onChange={(e) => setS({ ...s, display_name: e.target.value })}
            placeholder="Adi Singh"
          />
          <p className="text-xs text-muted-foreground mt-1">Replaces <code>{"{{my_name}}"}</code></p>
        </div>
        <div>
          <Label>Email signature</Label>
          <Textarea
            value={s.signature ?? ""}
            onChange={(e) => setS({ ...s, signature: e.target.value })}
            placeholder={"Best,\nAdi Singh\nSenior Engineer · adi@example.com"}
            rows={5}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1">Replaces <code>{"{{my_signature}}"}</code></p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Per-tick cap (per cron run)</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={s.per_tick_email_cap}
              onChange={(e) => setS({ ...s, per_tick_email_cap: Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground mt-1">Max emails per 15-min cron tick</p>
          </div>
          <div>
            <Label>Daily cap</Label>
            <Input
              type="number"
              min={1}
              max={500}
              value={s.daily_email_cap}
              onChange={(e) => setS({ ...s, daily_email_cap: Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground mt-1">Soft cap (informational; not yet enforced)</p>
          </div>
        </div>
        <Button onClick={save} disabled={saving}>
          <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}
