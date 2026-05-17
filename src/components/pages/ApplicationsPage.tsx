import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Search, Briefcase, List, LayoutGrid, Trash2, RefreshCw } from "lucide-react";
import { ApplicationsKanban } from "@/components/ApplicationsKanban";
import { BulkActionBar } from "@/components/BulkActionBar";
import { APPLICATION_STATUSES as statuses, statusColors } from "@/lib/status";
import { DEFAULT_USER_ID } from "@/lib/constants";

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

export function ApplicationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Application | null>(null);
  const [form, setForm] = useState({
    company_name: "",
    role_title: "",
    status: "wishlist",
    applied_date: "",
    resume_version: "",
    source: "",
    notes: "",
  });
  // Multi-select
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulkStatusDialogOpen, setBulkStatusDialogOpen] = useState(false);
  const [bulkNewStatus, setBulkNewStatus] = useState("applied");

  useEffect(() => { if (user) loadApps(); }, [user]);

  const loadApps = async () => {
    const { data } = await supabase.from("applications").select("*").order("created_at", { ascending: false });
    setApps((data as Application[]) ?? []);
    setCheckedIds(new Set());
    setLoading(false);
  };

  const filtered = apps.filter((a) => {
    const matchesSearch = a.role_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesStatus = viewMode === "kanban" || statusFilter === "all" || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const resetForm = () => {
    setForm({ company_name: "", role_title: "", status: "wishlist", applied_date: "", resume_version: "", source: "", notes: "" });
    setSelected(null);
  };

  const handleSave = async () => {
    if (!user || !form.role_title.trim()) return;
    const payload = {
      ...form,
      applied_date: form.applied_date || null,
      resume_version: form.resume_version || null,
      source: form.source || null,
      notes: form.notes || null,
      company_name: form.company_name || null,
    };
    if (selected) {
      const { error } = await supabase.from("applications").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", selected.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Application updated");
    } else {
      const { error } = await supabase.from("applications").insert({ ...payload, user_id: DEFAULT_USER_ID });
      if (error) { toast.error(error.message); return; }
      toast.success("Application added");
    }
    setDialogOpen(false);
    resetForm();
    loadApps();
  };

  // --- Multi-select helpers ---
  const filteredIds = filtered.map((a) => a.id);
  const allChecked = filteredIds.length > 0 && filteredIds.every((id) => checkedIds.has(id));
  const someChecked = filteredIds.some((id) => checkedIds.has(id));

  const toggleRow = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setCheckedIds(allChecked ? new Set() : new Set(filteredIds));
  };

  const bulkChangeStatus = async () => {
    const ids = Array.from(checkedIds);
    const { error } = await supabase
      .from("applications")
      .update({ status: bulkNewStatus, updated_at: new Date().toISOString() })
      .in("id", ids);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} application${ids.length !== 1 ? "s" : ""} moved to "${bulkNewStatus}"`);
    setBulkStatusDialogOpen(false);
    loadApps();
  };

  const bulkDelete = async () => {
    const ids = Array.from(checkedIds);
    if (!window.confirm(`Delete ${ids.length} application${ids.length !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    const { error } = await supabase.from("applications").delete().in("id", ids);
    if (error) { toast.error(error.message); return; }
    toast.success(`Deleted ${ids.length} application${ids.length !== 1 ? "s" : ""}`);
    loadApps();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Applications</h1>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border bg-background p-0.5">
            <Button
              type="button"
              size="sm"
              variant={viewMode === "list" ? "secondary" : "ghost"}
              className="h-7 px-2"
              onClick={() => setViewMode("list")}
            >
              <List className="h-3.5 w-3.5 mr-1" /> List
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === "kanban" ? "secondary" : "ghost"}
              className="h-7 px-2"
              onClick={() => setViewMode("kanban")}
            >
              <LayoutGrid className="h-3.5 w-3.5 mr-1" /> Kanban
            </Button>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Application</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{selected ? "Edit Application" : "Add Application"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Role Title *</Label><Input value={form.role_title} onChange={(e) => setForm({ ...form, role_title: e.target.value })} placeholder="Senior Engineer" /></div>
                <div><Label>Company</Label><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="Acme Inc" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Applied Date</Label><Input type="date" value={form.applied_date} onChange={(e) => setForm({ ...form, applied_date: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Resume Version</Label><Input value={form.resume_version} onChange={(e) => setForm({ ...form, resume_version: e.target.value })} placeholder="v2.1" /></div>
                  <div><Label>Source</Label><Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="LinkedIn, referral..." /></div>
                </div>
                <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
                <Button onClick={handleSave} className="w-full">{selected ? "Update" : "Add"} Application</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search applications..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        {viewMode === "list" && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Card key={i} className="animate-pulse"><CardContent className="p-4"><div className="h-12 bg-muted rounded" /></CardContent></Card>)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <Briefcase className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>No applications found. Start tracking your job search!</p>
        </CardContent></Card>
      ) : viewMode === "kanban" ? (
        <ApplicationsKanban applications={filtered} onChange={loadApps} />
      ) : (
        <>
          {/* Select-all bar */}
          <div className="flex items-center gap-2 px-1">
            <Checkbox
              checked={allChecked ? true : someChecked ? "indeterminate" : false}
              onCheckedChange={toggleAll}
              aria-label="Select all"
            />
            <span className="text-xs text-muted-foreground">
              {checkedIds.size > 0 ? `${checkedIds.size} selected` : `${filtered.length} application${filtered.length !== 1 ? "s" : ""}`}
            </span>
          </div>

          <div className="space-y-2">
            {filtered.map((a) => (
              <Card
                key={a.id}
                className={`hover:shadow-sm transition-shadow cursor-pointer ${checkedIds.has(a.id) ? "ring-1 ring-primary/40 bg-primary/5" : ""}`}
                onClick={() => navigate({ to: `/applications/${a.id}` })}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={checkedIds.has(a.id)}
                      onCheckedChange={() => toggleRow(a.id)}
                      aria-label={`Select ${a.role_title}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{a.role_title}</p>
                      <Badge variant="secondary" className={`text-xs ${statusColors[a.status]}`}>{a.status}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                      {a.company_name && <span>{a.company_name}</span>}
                      {a.applied_date && <span>• Applied {a.applied_date}</span>}
                      {a.source && <span>• {a.source}</span>}
                    </div>
                  </div>
                  {a.resume_version && <Badge variant="outline" className="text-xs shrink-0">Resume {a.resume_version}</Badge>}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Bulk status change dialog */}
      <Dialog open={bulkStatusDialogOpen} onOpenChange={setBulkStatusDialogOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Change Status ({checkedIds.size} applications)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Select value={bulkNewStatus} onValueChange={setBulkNewStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button className="w-full" onClick={bulkChangeStatus}>
              Apply
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <BulkActionBar
        selectedCount={checkedIds.size}
        onClear={() => setCheckedIds(new Set())}
        actions={[
          {
            label: "Change status",
            icon: <RefreshCw className="h-3 w-3" />,
            variant: "outline",
            onClick: () => setBulkStatusDialogOpen(true),
          },
          {
            label: "Delete",
            icon: <Trash2 className="h-3 w-3" />,
            variant: "destructive",
            onClick: bulkDelete,
          },
        ]}
      />
    </div>
  );
}
