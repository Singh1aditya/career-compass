import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_USER_ID } from "@/lib/constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarCheck } from "lucide-react";
import { toast } from "sonner";

const EVENT_KINDS = [
  { value: "phone_screen", label: "Phone Screen" },
  { value: "interview", label: "Interview" },
  { value: "technical", label: "Technical Round" },
  { value: "offer_call", label: "Offer Call" },
  { value: "networking", label: "Networking" },
  { value: "other", label: "Other" },
] as const;

interface Props {
  applicationId: string;
  roleTitle?: string;
  companyName?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

interface FormState {
  title: string;
  kind: string;
  scheduled_at: string;
  duration_min: number;
  location: string;
  meeting_url: string;
  notes: string;
}

export function ScheduleInterviewDialog({
  applicationId,
  roleTitle,
  companyName,
  open,
  onOpenChange,
  onCreated,
}: Props) {
  const defaultTitle = roleTitle
    ? `Interview — ${roleTitle}${companyName ? ` @ ${companyName}` : ""}`
    : "Interview";

  const [form, setForm] = useState<FormState>({
    title: defaultTitle,
    kind: "interview",
    scheduled_at: "",
    duration_min: 60,
    location: "",
    meeting_url: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const set = (field: keyof FormState, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.scheduled_at) {
      toast.error("Please set a date and time");
      return;
    }
    setSaving(true);

    const payload = {
      user_id: DEFAULT_USER_ID,
      application_id: applicationId,
      title: form.title.trim() || defaultTitle,
      kind: form.kind,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      duration_min: form.duration_min,
      location: form.location || null,
      meeting_url: form.meeting_url || null,
      notes: form.notes || null,
    };

    const { data, error } = await db.from("events").insert(payload).select().single();

    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }

    // Attempt Google Calendar sync (non-blocking — Gmail integration optional)
    try {
      await supabase.functions.invoke("sync-gcal-event", {
        body: { operation: "create", event_id: data.id },
      });
    } catch {
      // Silent — user may not have Gmail connected
    }

    toast.success("Interview scheduled — reminder follow-up created");
    setSaving(false);
    onOpenChange(false);
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4" /> Schedule Interview
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.kind} onValueChange={(v) => set("kind", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Duration</Label>
              <Select
                value={String(form.duration_min)}
                onValueChange={(v) => set("duration_min", Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[15, 30, 45, 60, 90, 120].map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m < 60 ? `${m} min` : `${m / 60}h`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Date &amp; Time</Label>
            <Input
              type="datetime-local"
              value={form.scheduled_at}
              onChange={(e) => set("scheduled_at", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input
              placeholder="Office address or 'Virtual'"
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Meeting URL</Label>
            <Input
              placeholder="https://meet.google.com/..."
              value={form.meeting_url}
              onChange={(e) => set("meeting_url", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              rows={3}
              placeholder="Prep notes, interviewer names..."
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
