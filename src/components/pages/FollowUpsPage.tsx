import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Clock, CheckCircle2, SkipForward, AlertCircle, Calendar } from "lucide-react";
import { format, isToday, isPast, isFuture, parseISO, addDays } from "date-fns";

interface FollowUp {
  id: string;
  description: string;
  due_date: string;
  status: string;
  priority: string;
  contact_id: string | null;
  application_id: string | null;
  created_at: string;
}

export function FollowUpsPage() {
  const { user } = useAuth();
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [form, setForm] = useState({
    description: "",
    due_date: format(new Date(), "yyyy-MM-dd"),
    priority: "medium",
  });

  useEffect(() => { if (user) loadFollowUps(); }, [user, statusFilter]);

  const loadFollowUps = async () => {
    let query = supabase.from("follow_ups").select("*").order("due_date", { ascending: true });
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    const { data } = await query;
    setFollowUps((data as FollowUp[]) ?? []);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user || !form.description.trim()) return;
    const { error } = await supabase.from("follow_ups").insert({
      ...form,
      user_id: user.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Follow-up added");
    setDialogOpen(false);
    setForm({ description: "", due_date: format(new Date(), "yyyy-MM-dd"), priority: "medium" });
    loadFollowUps();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("follow_ups").update({ status }).eq("id", id);
    toast.success(`Follow-up ${status}`);
    loadFollowUps();
  };

  const snooze = async (id: string) => {
    const newDate = format(addDays(new Date(), 1), "yyyy-MM-dd");
    await supabase.from("follow_ups").update({ due_date: newDate }).eq("id", id);
    toast.success("Snoozed to tomorrow");
    loadFollowUps();
  };

  const overdue = followUps.filter((f) => {
    const d = parseISO(f.due_date);
    return isPast(d) && !isToday(d) && f.status === "pending";
  });
  const today = followUps.filter((f) => isToday(parseISO(f.due_date)) && f.status === "pending");
  const upcoming = followUps.filter((f) => isFuture(parseISO(f.due_date)) && !isToday(parseISO(f.due_date)) && f.status === "pending");
  const completed = followUps.filter((f) => f.status !== "pending");

  const priorityColors: Record<string, string> = {
    high: "text-destructive",
    medium: "text-warning-foreground",
    low: "text-muted-foreground",
  };

  const renderGroup = (title: string, items: FollowUp[], icon: React.ReactNode) => {
    if (items.length === 0) return null;
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            {icon} {title} ({items.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{f.description}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">{format(parseISO(f.due_date), "MMM d")}</span>
                  <Badge variant="outline" className={`text-xs ${priorityColors[f.priority]}`}>{f.priority}</Badge>
                </div>
              </div>
              {f.status === "pending" && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => updateStatus(f.id, "completed")} title="Complete">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => snooze(f.id)} title="Snooze">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => updateStatus(f.id, "skipped")} title="Skip">
                    <SkipForward className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Follow-ups</h1>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="skipped">Skipped</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Follow-up</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Follow-up</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Description *</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Follow up with Jane about the referral" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
                  <div>
                    <Label>Priority</Label>
                    <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleSave} className="w-full">Add Follow-up</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Card key={i} className="animate-pulse"><CardContent className="p-4"><div className="h-12 bg-muted rounded" /></CardContent></Card>)}</div>
      ) : followUps.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <Clock className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>{statusFilter === "pending" ? "No pending follow-ups. You're all caught up!" : "No follow-ups found."}</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {renderGroup("Overdue", overdue, <AlertCircle className="h-4 w-4 text-destructive" />)}
          {renderGroup("Today", today, <Clock className="h-4 w-4 text-primary" />)}
          {renderGroup("Upcoming", upcoming, <Calendar className="h-4 w-4 text-muted-foreground" />)}
          {statusFilter !== "pending" && renderGroup("Completed / Skipped", completed, <CheckCircle2 className="h-4 w-4 text-success" />)}
        </div>
      )}
    </div>
  );
}
