import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Search, Building2, Star, Globe } from "lucide-react";

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

const stages = ["startup", "growth", "enterprise"];

export function CompaniesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Company | null>(null);
  const [form, setForm] = useState({
    name: "", website: "", industry: "", stage: "startup", hiring_signals: "", watchlist: false, notes: "",
  });

  useEffect(() => { if (user) loadCompanies(); }, [user]);

  const loadCompanies = async () => {
    const { data } = await supabase.from("companies").select("*").order("created_at", { ascending: false });
    setCompanies((data as Company[]) ?? []);
    setLoading(false);
  };

  const filtered = companies.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.industry?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesWatchlist = !watchlistOnly || c.watchlist;
    return matchesSearch && matchesWatchlist;
  });

  const resetForm = () => {
    setForm({ name: "", website: "", industry: "", stage: "startup", hiring_signals: "", watchlist: false, notes: "" });
    setSelected(null);
  };

  const handleSave = async () => {
    if (!user || !form.name.trim()) return;
    const payload = { ...form, website: form.website || null, industry: form.industry || null, hiring_signals: form.hiring_signals || null, notes: form.notes || null };
    if (selected) {
      const { error } = await supabase.from("companies").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", selected.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Company updated");
    } else {
      const { error } = await supabase.from("companies").insert({ ...payload, user_id: user.id });
      if (error) { toast.error(error.message); return; }
      toast.success("Company added");
    }
    setDialogOpen(false);
    resetForm();
    loadCompanies();
  };

  const toggleWatchlist = async (company: Company) => {
    await supabase.from("companies").update({ watchlist: !company.watchlist }).eq("id", company.id);
    loadCompanies();
  };

  const openEdit = (company: Company) => {
    setSelected(company);
    setForm({
      name: company.name,
      website: company.website ?? "",
      industry: company.industry ?? "",
      stage: company.stage ?? "startup",
      hiring_signals: company.hiring_signals ?? "",
      watchlist: company.watchlist,
      notes: company.notes ?? "",
    });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Companies</h1>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Company</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{selected ? "Edit Company" : "Add Company"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Acme Inc" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Website</Label><Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://..." /></div>
                <div><Label>Industry</Label><Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder="Fintech" /></div>
              </div>
              <div>
                <Label>Stage</Label>
                <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{stages.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Hiring Signals</Label><Textarea value={form.hiring_signals} onChange={(e) => setForm({ ...form, hiring_signals: e.target.value })} rows={2} placeholder="Recent funding, job postings..." /></div>
              <div className="flex items-center gap-2">
                <Switch checked={form.watchlist} onCheckedChange={(c) => setForm({ ...form, watchlist: c })} />
                <Label>Add to Watchlist</Label>
              </div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
              <Button onClick={handleSave} className="w-full">{selected ? "Update" : "Add"} Company</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search companies..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={watchlistOnly} onCheckedChange={setWatchlistOnly} />
          <Label className="text-sm">Watchlist only</Label>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Card key={i} className="animate-pulse"><CardContent className="p-4"><div className="h-12 bg-muted rounded" /></CardContent></Card>)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <Building2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>No companies found. Start tracking companies you're interested in!</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <Card key={c.id} className="hover:shadow-sm transition-shadow cursor-pointer" onClick={() => navigate({ to: `/companies/${c.id}` })}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{c.name}</p>
                    {c.stage && <Badge variant="secondary" className="text-xs">{c.stage}</Badge>}
                    {c.watchlist && <Star className="h-3.5 w-3.5 text-warning fill-warning" />}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    {c.industry && <span>{c.industry}</span>}
                    {c.hiring_signals && <span>• {c.hiring_signals.slice(0, 50)}{c.hiring_signals.length > 50 ? "..." : ""}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {c.website && <a href={c.website} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}><Globe className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" /></a>}
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); toggleWatchlist(c); }}>
                    <Star className={`h-3.5 w-3.5 ${c.watchlist ? "text-warning fill-warning" : "text-muted-foreground"}`} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
