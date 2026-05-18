import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  Briefcase,
  Archive,
  RotateCcw,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { LogInteractionDialog } from "@/components/LogInteractionDialog";
import { NotesList } from "@/components/NotesList";
import { FollowUpsList } from "@/components/FollowUpsList";
import { TagEditor } from "@/components/TagEditor";
import { AttachmentsList } from "@/components/AttachmentsList";
import { AIComposeButton } from "@/components/AIComposeButton";

const TYPES = ["recruiter", "founder", "referral", "colleague", "other"];

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  role: string | null;
  contact_type: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Interaction {
  id: string;
  type: string;
  direction: string;
  summary: string | null;
  date: string;
  application_id: string | null;
}

interface Application {
  id: string;
  role_title: string;
  company_name: string | null;
  status: string;
}

interface Props {
  contactId: string;
}

const typeColors: Record<string, string> = {
  recruiter: "bg-primary/10 text-primary",
  founder: "bg-chart-3/10 text-chart-3",
  referral: "bg-success/10 text-success",
  colleague: "bg-chart-4/10 text-chart-4",
  other: "bg-muted text-muted-foreground",
};

export function ContactDetailPage({ contactId }: Props) {
  const navigate = useNavigate();
  const [contact, setContact] = useState<Contact | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [linkedApps, setLinkedApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Contact>>({});

  useEffect(() => {
    load();
  }, [contactId]);

  const load = async () => {
    setLoading(true);
    const { data: c } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", contactId)
      .maybeSingle();
    setContact((c as Contact) ?? null);
    if (c) setForm(c);

    const { data: ints } = await supabase
      .from("interactions")
      .select("*")
      .eq("contact_id", contactId)
      .order("date", { ascending: false });
    setInteractions((ints as Interaction[]) ?? []);

    // Applications linked through interactions
    const appIds = Array.from(
      new Set((ints ?? []).map((i: any) => i.application_id).filter(Boolean)),
    );
    if (appIds.length > 0) {
      const { data: apps } = await supabase
        .from("applications")
        .select("id, role_title, company_name, status")
        .in("id", appIds);
      setLinkedApps((apps as Application[]) ?? []);
    } else {
      setLinkedApps([]);
    }

    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.name?.trim()) {
      toast.error("Name is required");
      return;
    }
    const { error } = await supabase
      .from("contacts")
      .update({
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        company_name: form.company_name || null,
        role: form.role || null,
        contact_type: form.contact_type,
        notes: form.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contactId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Contact updated");
    setEditing(false);
    load();
  };

  const toggleArchive = async () => {
    if (!contact) return;
    const newStatus = contact.status === "active" ? "archived" : "active";
    await supabase.from("contacts").update({ status: newStatus }).eq("id", contactId);
    toast.success(newStatus === "archived" ? "Archived" : "Restored");
    load();
  };

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading...</div>;
  }

  if (!contact) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-muted-foreground">Contact not found.</p>
        <Button variant="outline" onClick={() => navigate({ to: "/contacts" })}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to contacts
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/contacts" })}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Contacts
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold truncate">{contact.name}</h1>
                <Badge
                  variant="secondary"
                  className={`text-xs ${typeColors[contact.contact_type]}`}
                >
                  {contact.contact_type}
                </Badge>
                {contact.status === "archived" && (
                  <Badge variant="outline" className="text-xs">
                    Archived
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                {contact.role && <span>{contact.role}</span>}
                {contact.company_name && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> {contact.company_name}
                  </span>
                )}
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="flex items-center gap-1 hover:underline"
                  >
                    <Mail className="h-3 w-3" /> {contact.email}
                  </a>
                )}
                {contact.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {contact.phone}
                  </span>
                )}
              </div>
              <div className="mt-3">
                <TagEditor contactId={contact.id} />
              </div>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <AIComposeButton
                kind="draft_email"
                context={{
                  contact_name: contact.name,
                  company: contact.company_name ?? "",
                  role: contact.role ?? "",
                }}
                size="sm"
                variant="outline"
              />
              <LogInteractionDialog contactId={contact.id} onLogged={load} />
              <Button variant="outline" size="sm" onClick={toggleArchive}>
                {contact.status === "active" ? (
                  <Archive className="h-3.5 w-3.5 mr-1" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                )}
                {contact.status === "active" ? "Archive" : "Restore"}
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
          <TabsTrigger value="applications">
            Applications {linkedApps.length > 0 && `(${linkedApps.length})`}
          </TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="followups">Follow-ups</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">Details</CardTitle>
              {!editing ? (
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(false);
                      setForm(contact);
                    }}
                  >
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
                  <Field label="Name" value={contact.name} />
                  <Field label="Type" value={contact.contact_type} />
                  <Field label="Email" value={contact.email} />
                  <Field label="Phone" value={contact.phone} />
                  <Field label="Company" value={contact.company_name} />
                  <Field label="Role" value={contact.role} />
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Notes</Label>
                    <p className="text-sm whitespace-pre-wrap mt-1">{contact.notes || "—"}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label>Name *</Label>
                    <Input
                      value={form.name ?? ""}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Email</Label>
                      <Input
                        value={form.email ?? ""}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <Input
                        value={form.phone ?? ""}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Company</Label>
                      <Input
                        value={form.company_name ?? ""}
                        onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Role</Label>
                      <Input
                        value={form.role ?? ""}
                        onChange={(e) => setForm({ ...form, role: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select
                      value={form.contact_type}
                      onValueChange={(v) => setForm({ ...form, contact_type: v })}
                    >
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
                    <Label>Notes</Label>
                    <Textarea
                      value={form.notes ?? ""}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      rows={4}
                    />
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
                interactions.map((i) => (
                  <div key={i.id} className="flex items-start gap-3 border-b pb-3 last:border-b-0">
                    <div
                      className={`h-2 w-2 rounded-full mt-2 shrink-0 ${i.direction === "outbound" ? "bg-primary" : "bg-success"}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-[10px] h-4 px-1">
                          {i.type}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] h-4 px-1">
                          {i.direction}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(i.date).toLocaleDateString()}
                        </span>
                      </div>
                      {i.summary && <p className="text-sm mt-1">{i.summary}</p>}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="applications">
          <Card>
            <CardContent className="p-4 space-y-2">
              {linkedApps.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No linked applications. Log an interaction with an Application linked to populate
                  this list.
                </p>
              ) : (
                linkedApps.map((a) => (
                  <Card
                    key={a.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => navigate({ to: `/applications/${a.id}` })}
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{a.role_title}</p>
                        {a.company_name && (
                          <p className="text-xs text-muted-foreground">{a.company_name}</p>
                        )}
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {a.status}
                      </Badge>
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
              <NotesList contactId={contact.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="followups">
          <Card>
            <CardContent className="p-4">
              <FollowUpsList contactId={contact.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Files</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <AttachmentsList parent={{ contact_id: contactId }} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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
