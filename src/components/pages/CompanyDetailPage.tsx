import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { ArrowLeft, Building2, Globe, Save, Star, Briefcase, Users } from "lucide-react";
import { toast } from "sonner";
import { NotesList } from "@/components/NotesList";
import { AttachmentsList } from "@/components/AttachmentsList";

const STAGES = ["startup", "growth", "enterprise"];

interface Company {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  stage: string | null;
  hiring_signals: string | null;
  watchlist: boolean;
  notes: string | null;
  created_at: string;
}

interface Application {
  id: string;
  role_title: string;
  status: string;
  applied_date: string | null;
}

interface Contact {
  id: string;
  name: string;
  role: string | null;
  contact_type: string;
  email: string | null;
}

interface Props {
  companyId: string;
}

export function CompanyDetailPage({ companyId }: Props) {
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Company>>({});

  useEffect(() => { load(); }, [companyId]);

  const load = async () => {
    setLoading(true);
    const { data: c } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .maybeSingle();
    setCompany((c as Company) ?? null);
    if (c) setForm(c);

    if (c?.name) {
      const [appsRes, contactsRes] = await Promise.all([
        supabase
          .from("applications")
          .select("id, role_title, status, applied_date")
          .ilike("company_name", `%${c.name}%`)
          .order("created_at", { ascending: false }),
        supabase
          .from("contacts")
          .select("id, name, role, contact_type, email")
          .ilike("company_name", `%${c.name}%`)
          .eq("status", "active")
          .order("name"),
      ]);
      setApps((appsRes.data as Application[]) ?? []);
      setContacts((contactsRes.data as Contact[]) ?? []);
    }

    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.name?.trim()) {
      toast.error("Name is required");
      return;
    }
    const { error } = await supabase
      .from("companies")
      .update({
        name: form.name,
        website: form.website || null,
        industry: form.industry || null,
        stage: form.stage,
        hiring_signals: form.hiring_signals || null,
        watchlist: form.watchlist ?? false,
        notes: form.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", companyId);
    if (error) { toast.error(error.message); return; }
    toast.success("Company updated");
    setEditing(false);
    load();
  };

  const toggleWatchlist = async () => {
    if (!company) return;
    await supabase.from("companies").update({ watchlist: !company.watchlist }).eq("id", companyId);
    load();
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;

  if (!company) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-muted-foreground">Company not found.</p>
        <Button variant="outline" onClick={() => navigate({ to: "/companies" })}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to companies
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/companies" })}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Companies
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Building2 className="h-6 w-6 text-muted-foreground shrink-0" />
                <h1 className="text-2xl font-bold truncate">{company.name}</h1>
                {company.watchlist && <Star className="h-4 w-4 text-warning fill-warning" />}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                {company.industry && <Badge variant="secondary" className="text-xs">{company.industry}</Badge>}
                {company.stage && <Badge variant="outline" className="text-xs">{company.stage}</Badge>}
                {company.website && (
                  <a href={`https://${company.website.replace(/^https?:\/\//, "")}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline">
                    <Globe className="h-3 w-3" /> {company.website}
                  </a>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={toggleWatchlist}>
              <Star className={`h-3.5 w-3.5 mr-1 ${company.watchlist ? "text-warning fill-warning" : ""}`} />
              {company.watchlist ? "Unwatch" : "Watch"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="applications">
            Applications {apps.length > 0 && `(${apps.length})`}
          </TabsTrigger>
          <TabsTrigger value="contacts">
            Contacts {contacts.length > 0 && `(${contacts.length})`}
          </TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">Details</CardTitle>
              {!editing ? (
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setForm(company); }}>
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
                  <Field label="Name" value={company.name} />
                  <Field label="Industry" value={company.industry} />
                  <Field label="Website" value={company.website} />
                  <Field label="Stage" value={company.stage} />
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Hiring Signals</Label>
                    <p className="text-sm mt-1">{company.hiring_signals || "—"}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Notes</Label>
                    <p className="text-sm whitespace-pre-wrap mt-1">{company.notes || "—"}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label>Name *</Label>
                    <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Industry</Label>
                      <Input value={form.industry ?? ""} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
                    </div>
                    <div>
                      <Label>Stage</Label>
                      <Select value={form.stage ?? ""} onValueChange={(v) => setForm({ ...form, stage: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Website</Label>
                    <Input value={form.website ?? ""} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="example.com" />
                  </div>
                  <div>
                    <Label>Hiring signals</Label>
                    <Input value={form.hiring_signals ?? ""} onChange={(e) => setForm({ ...form, hiring_signals: e.target.value })} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={form.watchlist ?? false} onCheckedChange={(v) => setForm({ ...form, watchlist: v })} />
                    <Label>Add to watchlist</Label>
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

        <TabsContent value="applications">
          <Card>
            <CardContent className="p-4 space-y-2">
              {apps.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No applications at this company yet.
                </p>
              ) : (
                apps.map((a) => (
                  <Card
                    key={a.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => navigate({ to: `/applications/${a.id}` })}
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{a.role_title}</p>
                        {a.applied_date && (
                          <p className="text-xs text-muted-foreground">Applied {a.applied_date}</p>
                        )}
                      </div>
                      <Badge variant="secondary" className="text-xs">{a.status}</Badge>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts">
          <Card>
            <CardContent className="p-4 space-y-2">
              {contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No contacts at this company yet.
                </p>
              ) : (
                contacts.map((c) => (
                  <Card
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => navigate({ to: `/contacts/${c.id}` })}
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[c.role, c.email].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs">{c.contact_type}</Badge>
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
              <NotesList contactId={undefined} applicationId={undefined} />
              <p className="text-xs text-muted-foreground mt-2">Note: notes table doesn't currently link to companies; use the Notes field in Overview for company-level notes.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Files</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <AttachmentsList parent={{ company_id: companyId }} />
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
