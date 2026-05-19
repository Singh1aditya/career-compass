import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
const TYPES = ["email", "call", "meeting", "linkedin", "other"];
const DIRECTIONS = ["outbound", "inbound"];

interface Application {
  id: string;
  role_title: string;
  company_name: string | null;
}

interface Props {
  contactId?: string;
  applicationId?: string;
  trigger?: React.ReactNode;
  onLogged?: () => void;
}

export function LogInteractionDialog({ contactId, applicationId, trigger, onLogged }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("email");
  const [direction, setDirection] = useState("outbound");
  const [summary, setSummary] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [linkedAppId, setLinkedAppId] = useState<string>(applicationId ?? "");
  const [apps, setApps] = useState<Application[]>([]);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [followUpDate, setFollowUpDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );
  const [followUpDesc, setFollowUpDesc] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (applicationId) {
      setLinkedAppId(applicationId);
    }
    supabase
      .from("applications")
      .select("id, role_title, company_name")
      .order("created_at", { ascending: false })
      .then(({ data }) => setApps((data as Application[]) ?? []));
  }, [open, applicationId]);

  const reset = () => {
    setType("email");
    setDirection("outbound");
    setSummary("");
    setDate(new Date().toISOString().slice(0, 10));
    setLinkedAppId(applicationId ?? "");
    setFollowUpOpen(false);
    setFollowUpDesc("");
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("interactions").insert({
      user_id: user!.id,
      contact_id: contactId ?? null,
      application_id: linkedAppId || null,
      type,
      direction,
      summary: summary || null,
      date,
    });

    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }

    toast.success("Interaction logged");

    if (followUpOpen && followUpDesc.trim()) {
      const { error: fuErr } = await supabase.from("follow_ups").insert({
        user_id: user!.id,
        contact_id: contactId ?? null,
        application_id: linkedAppId || null,
        due_date: followUpDate,
        description: followUpDesc,
        status: "pending",
      });
      if (fuErr) toast.error(`Follow-up failed: ${fuErr.message}`);
      else toast.success("Follow-up scheduled");
    }

    setSaving(false);
    setOpen(false);
    reset();
    onLogged?.();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>{trigger ?? <Button size="sm">Log Interaction</Button>}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log Interaction</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Direction</Label>
              <Select value={direction} onValueChange={setDirection}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIRECTIONS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Summary</Label>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Quick note about what happened..."
              rows={3}
            />
          </div>
          {!applicationId && (
            <div>
              <Label>Linked Application (optional)</Label>
              <Select
                value={linkedAppId || "none"}
                onValueChange={(v) => setLinkedAppId(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {apps.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.role_title}
                      {a.company_name ? ` @ ${a.company_name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="border-t pt-3 space-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={followUpOpen}
                onChange={(e) => setFollowUpOpen(e.target.checked)}
              />
              Schedule a follow-up
            </label>
            {followUpOpen && (
              <div className="space-y-2 pl-6">
                <div>
                  <Label className="text-xs">Due date</Label>
                  <Input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Description</Label>
                  <Input
                    value={followUpDesc}
                    onChange={(e) => setFollowUpDesc(e.target.value)}
                    placeholder="What to do next..."
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
