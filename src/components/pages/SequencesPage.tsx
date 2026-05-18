import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import { Plus, Search, Play, Pause, Edit2, Trash2, Mail } from "lucide-react";

interface Sequence {
  id: string;
  name: string;
  application_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  application?: {
    role_title: string;
    company_name: string;
  };
  recipients_count?: number;
}

interface Application {
  id: string;
  role_title: string;
  company_name: string;
}

import { DEFAULT_USER_ID } from "@/lib/constants";

export function SequencesPage() {
  const navigate = useNavigate();
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    application_id: "",
  });

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    // Load applications
    const { data: appsData } = await supabase
      .from("applications")
      .select("id, role_title, company_name")
      .order("company_name", { ascending: true });

    setApplications((appsData as Application[]) ?? []);

    // Load sequences
    let query = supabase.from("sequences").select("*");

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data } = await query.order("created_at", { ascending: false });
    setSequences((data as Sequence[]) ?? []);
    setLoading(false);
  };

  const filtered = sequences.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleCreateSequence = async () => {
    if (!form.name.trim() || !form.application_id) {
      toast.error("Please fill all fields");
      return;
    }

    const { error } = await supabase.from("sequences").insert({
      name: form.name,
      application_id: form.application_id,
      user_id: DEFAULT_USER_ID,
      status: "draft",
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Sequence created");
    setDialogOpen(false);
    setForm({ name: "", application_id: "" });
    loadData();
  };

  const toggleSequenceStatus = async (sequence: Sequence) => {
    const newStatus = sequence.status === "active" ? "paused" : "active";
    const { error } = await supabase
      .from("sequences")
      .update({ status: newStatus })
      .eq("id", sequence.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Sequence ${newStatus}`);
    loadData();
  };

  const deleteSequence = async (id: string) => {
    const { error } = await supabase.from("sequences").delete().eq("id", id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Sequence deleted");
    loadData();
  };

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-800",
    active: "bg-green-100 text-green-800",
    paused: "bg-yellow-100 text-yellow-800",
    completed: "bg-blue-100 text-blue-800",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Outreach Sequences</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> New Sequence
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Sequence</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Sequence Name *</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Anthropic Outreach"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Application *</label>
                <p className="text-xs text-muted-foreground mb-2">
                  Select the application this sequence is for
                </p>
                <Select
                  value={form.application_id}
                  onValueChange={(v) => setForm({ ...form, application_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an application" />
                  </SelectTrigger>
                  <SelectContent>
                    {applications.map((app) => (
                      <SelectItem key={app.id} value={app.id}>
                        {app.company_name} - {app.role_title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreateSequence} className="w-full">
                Create Sequence
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sequences..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-12 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Mail className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No sequences yet. Create one to start automating outreach!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <Card
              key={s.id}
              className="hover:shadow-sm transition-shadow cursor-pointer"
              onClick={() => navigate({ to: `/sequences/${s.id}` })}
            >
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{s.name}</p>
                    <Badge variant="secondary" className={statusColors[s.status]}>
                      {s.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    <span>{s.application?.company_name}</span>
                    {s.application?.role_title && (
                      <>
                        <span>•</span>
                        <span>{s.application.role_title}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSequenceStatus(s);
                    }}
                  >
                    {s.status === "active" ? (
                      <Pause className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSequence(s.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
