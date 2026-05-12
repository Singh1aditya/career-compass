import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Briefcase, Save, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { LogInteractionDialog } from "@/components/LogInteractionDialog";
import { NotesList } from "@/components/NotesList";
import { FollowUpsList } from "@/components/FollowUpsList";
import { StartOutreachWizard } from "@/components/StartOutreachWizard";

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";
const STATUSES = ["wishlist", "applied", "screening", "interviewing", "offer", "rejected", "withdrawn"];

const statusColors: Record<string, string> = {
  wishlist: "bg-muted text-muted-foreground",
  applied: "bg-primary/10 text-primary",
  screening: "bg-warning/10 text-warning-foreground",
  interviewing: "bg-chart-2/10 text-foreground",
  offer: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  withdrawn: "bg-muted text-muted-foreground",
};

interface Application {
  id: string;
  company_name: string | null;
  role_title: string;
  status: string;
  applied_date: string | null;
  resume_version: string | null;
  source: string | null;
  notes: string | null;
  created_at: string;
}

interface Interaction {
  id: string;
  type: string;
  direction: string;
  summary: string | null;
  date: string;
  contact_id: string | null;
}

interface Sequence {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

interface Contact {
  id: string;
  name: string;
  contact_type: string;
}

interface Props {
  applicationId: string;
}

export function ApplicationDetailPage({ applicationId }: Props) {
  const navigate = useNavigate();
  const [app, setApp] = useState<Application | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [contacts, setContacts] = useState<Record<string, Contact>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Application>>({});
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => { load(); }, [applicationId]);

  const load = async () => {
    setLoading(true);
    const { data: a } = await supabase
      .from("applications")
      .select("*")
      .eq("id", applicationId)
      .maybeSingle();
    setApp((a as Application) ?? null);
    if (a) setForm(a);

    const { data: ints } = await supabase
      .from("interactions")
      .select("*")
      .eq("application_id", applicationId)
      .order("date", { ascending: false });
    setInteractions((ints as Interaction[]) ?? []);

    // Pull involved contacts
    const cIds = Array.from(new Set((ints ?? []).map((i: any) => i.contact_id).filter(Boolean)));
    if (cIds.length > 0) {
      const { data: cs } = await supabase
        .from("contacts")
        .select("id, name, contact_type")
        .in("id", cIds);
      const map: Record<string, Contact> = {};
      (cs ?? []).forEach((c: any) => { map[c.id] = c; });
      setContacts(map);
    } else {
      setContacts({});
    }

    const { data: seqs } = await supabase
      .from("sequences")
      .select("id, name, status, created_at")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false });
    setSequences((seqs as Sequence[]) ?? []);

    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.role_title?.trim()) {
      toast.error("Role title is required");
      return;
    }
    const { error } = await supabase
      .from("applications")
      .update({
        role_title: form.role_title,
        company_name: form.company_name || null,
        status: form.status,
        applied_date: form.applied_date || null,
        resume_version: form.resume_version || null,
        source: form.source || null,
        notes: form.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", applicationId);
    if (error) { toast.error(error.message); return; }
    toast.success("Application updated");
    setEditing(false);
    load();
  };

  const handleWizardCreated = (sequenceId: string) => {
    setWizardOpen(false);
    navigate({ to: "/sequences/$sequenceId", params: { sequenceId } });
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;

  if (!app) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-muted-foreground">Application not found.</p>
        <Button variant="outline" onClick={() => navigate({ to: "/applications" })}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to applications
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/applications" })}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Applications
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold truncate">{app.role_title}</h1>
                <Badge variant="secondary" className={`text-xs ${statusColors[app.status]}`}>
                  {app.status}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                {app.company_name && (
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-3 w-3" /> {app.company_name}
                  </span>
                )}
                {app.applied_date && <span>Applied {app.applied_date}</span>}
                {app.source && <span>Source: {app.source}</span>}
                {app.resume_version && <Badge variant="outline" className="text-xs">Resume {app.resume_version}</Badge>}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <LogInteractionDialog applicationId={app.id} onLogged={load} />
              <Button size="sm" onClick={() => setWizardOpen(true)}>
                <Send className="h-3.5 w-3.5 mr-1" /> Start Outreach Campaign
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="interactions">
            Interactions {interactions.length > 0 && `(${interactions.length})`}
          </TabsTrigger>
          <TabsTrigger value="contacts">
            Contacts {Object.keys(contacts).length > 0 && `(${Object.keys(contacts).length})`}
          </TabsTrigger>
          <TabsTrigger value="sequences">
            Sequences {sequences.length > 0 && `(${sequences.length})`}
          </TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="followups">Follow-ups</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">Details</CardTitle>
              {!editing ? (
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setForm(app); }}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave}>
                    <Save className="h-3.5 w-3.5 mr-1" /> Save
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {!editing ? (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <Field label="Role" value={app.role_title} />
                  <Field label="Status" value={app.status} />
                  <Field label="Company" value={app.company_name} />
                  <Field label="Applied" value={app.applied_date} />
                  <Field label="Source" value={app.source} />
                  <Field label="Resume" value={app.resume_version} />
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Notes</Label>
                    <p className="text-sm whitespace-pre-wrap mt-1">{app.notes || "—"}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label>Role *</Label>
                    <Input value={form.role_title ?? ""} onChange={(e) => setForm({ ...form, role_title: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Company</Label>
                      <Input value={form.company_name ?? ""} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Applied date</Label>
                      <Input type="date" value={form.applied_date ?? ""} onChange={(e) => setForm({ ...form, applied_date: e.target.value })} />
                    </div>
                    <div>
                      <Label>Resume version</Label>
                      <Input value={form.resume_version ?? ""} onChange={(e) => setForm({ ...form, resume_version: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label>Source</Label>
                    <Input value={form.source ?? ""} onChange={(e) => setForm({ ...form, source: e.target.value })} />
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={4} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="interactions">
          <Card>
            <CardContent className="p-4 space-y-3">
              {interactions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No interactions yet. Click "Log Interaction" above.
                </p>
              ) : (
                interactions.map((i) => {
                  const c = i.contact_id ? contacts[i.contact_id] : null;
                  return (
                    <div key={i.id} className="flex items-start gap-3 border-b pb-3 last:border-b-0">
                      <div className={`h-2 w-2 rounded-full mt-2 shrink-0 ${i.direction === "outbound" ? "bg-primary" : "bg-success"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="text-[10px] h-4 px-1">{i.type}</Badge>
                          <Badge variant="outline" className="text-[10px] h-4 px-1">{i.direction}</Badge>
                          {c && (
                            <span
                              className="text-xs font-medium hover:underline cursor-pointer"
                              onClick={() => navigate({ to: `/contacts/${c.id}` })}
                            >
                              {c.name}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">{new Date(i.date).toLocaleDateString()}</span>
                        </div>
                        {i.summary && <p className="text-sm mt-1">{i.summary}</p>}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts">
          <Card>
            <CardContent className="p-4 space-y-2">
              {Object.keys(contacts).length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No linked contacts yet. Log interactions with contacts to build this list.
                </p>
              ) : (
                Object.values(contacts).map((c) => (
                  <Card
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => navigate({ to: `/contacts/${c.id}` })}
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs">{c.contact_type}</Badge>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sequences">
          <Card>
            <CardContent className="p-4 space-y-2">
              {sequences.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No outreach campaigns yet. Click "Start Outreach Campaign" above.
                </p>
              ) : (
                sequences.map((s) => (
                  <Card
                    key={s.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => navigate({ to: `/sequences/${s.id}` })}
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      <Send className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.name}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs">{s.status}</Badge>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardContent className="p-4">
              <NotesList applicationId={app.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="followups">
          <Card>
            <CardContent className="p-4">
              <FollowUpsList applicationId={app.id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <StartOutreachWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        applicationId={app.id}
        roleTitle={app.role_title}
        companyName={app.company_name}
        onCreated={handleWizardCreated}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <p className="text-sm mt-0.5">{value || <span className="text-muted-foreground">—</span>}</p>
    </div>
  );
}
