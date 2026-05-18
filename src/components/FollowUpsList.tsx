import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Clock, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_USER_ID } from "@/lib/constants";

interface FollowUp {
  id: string;
  description: string | null;
  due_date: string;
  status: string;
  created_at: string;
}

interface Props {
  contactId?: string;
  applicationId?: string;
}

function isOverdue(dateStr: string) {
  return new Date(dateStr) < new Date(new Date().toDateString());
}

function isToday(dateStr: string) {
  return dateStr === new Date().toISOString().slice(0, 10);
}

export function FollowUpsList({ contactId, applicationId }: Props) {
  const [items, setItems] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [desc, setDesc] = useState("");
  const [due, setDue] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );

  useEffect(() => {
    load();
  }, [contactId, applicationId]);

  const load = async () => {
    let q = supabase.from("follow_ups").select("*").order("due_date", { ascending: true });
    if (contactId) q = q.eq("contact_id", contactId);
    if (applicationId) q = q.eq("application_id", applicationId);
    const { data } = await q;
    setItems((data as FollowUp[]) ?? []);
    setLoading(false);
  };

  const create = async () => {
    if (!desc.trim()) return;
    const { error } = await supabase.from("follow_ups").insert({
      user_id: DEFAULT_USER_ID,
      contact_id: contactId ?? null,
      application_id: applicationId ?? null,
      description: desc.trim(),
      due_date: due,
      status: "pending",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setDesc("");
    setAdding(false);
    load();
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("follow_ups").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    load();
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const pending = items.filter((i) => i.status === "pending");
  const done = items.filter((i) => i.status !== "pending");

  return (
    <div className="space-y-3">
      {!adding ? (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Follow-up
        </Button>
      ) : (
        <Card>
          <CardContent className="p-3 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <Input
                className="col-span-2"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="What to follow up on..."
                autoFocus
              />
              <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={create}>
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAdding(false);
                  setDesc("");
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {pending.length === 0 && done.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No follow-ups yet.</p>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Pending
              </p>
              {pending.map((f) => (
                <Card key={f.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{f.description ?? "(no description)"}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant={
                            isOverdue(f.due_date)
                              ? "destructive"
                              : isToday(f.due_date)
                                ? "default"
                                : "outline"
                          }
                          className="text-[10px] h-4 px-1"
                        >
                          {isOverdue(f.due_date)
                            ? "Overdue"
                            : isToday(f.due_date)
                              ? "Today"
                              : new Date(f.due_date).toLocaleDateString()}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      aria-label="Mark complete"
                      onClick={() => setStatus(f.id, "completed")}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      aria-label="Skip"
                      onClick={() => setStatus(f.id, "skipped")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {done.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Completed / Skipped
              </p>
              {done.map((f) => (
                <Card key={f.id} className="opacity-60">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm line-through">{f.description ?? "(no description)"}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] h-4 px-1">
                      {f.status}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
