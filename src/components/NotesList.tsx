import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";

interface Note {
  id: string;
  content: string;
  created_at: string;
}

interface Props {
  contactId?: string;
  applicationId?: string;
}

export function NotesList({ contactId, applicationId }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    load();
  }, [contactId, applicationId]);

  const load = async () => {
    let q = supabase.from("notes").select("*").order("created_at", { ascending: false });
    if (contactId) q = q.eq("contact_id", contactId);
    if (applicationId) q = q.eq("application_id", applicationId);
    const { data } = await q;
    setNotes((data as Note[]) ?? []);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!draft.trim()) return;
    const { error } = await supabase.from("notes").insert({
      user_id: DEFAULT_USER_ID,
      contact_id: contactId ?? null,
      application_id: applicationId ?? null,
      content: draft.trim(),
    });
    if (error) { toast.error(error.message); return; }
    setDraft("");
    setAdding(false);
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-3">
      {!adding ? (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Note
        </Button>
      ) : (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a note…"
            rows={3}
            autoFocus
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setDraft(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No notes yet.</p>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => (
            <Card key={n.id}>
              <CardContent className="p-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm whitespace-pre-wrap">{n.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 shrink-0"
                  aria-label="Delete note"
                  onClick={() => handleDelete(n.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
