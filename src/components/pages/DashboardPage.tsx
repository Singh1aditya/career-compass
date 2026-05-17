import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import {
  Briefcase,
  Users,
  Building2,
  Clock,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Plus,
} from "lucide-react";
import { format, isToday, isPast, parseISO } from "date-fns";
import { statusColors } from "@/lib/status";

interface Stats {
  totalContacts: number;
  totalApplications: number;
  totalCompanies: number;
  pendingFollowUps: number;
  applicationsByStatus: Record<string, number>;
}

interface FollowUp {
  id: string;
  description: string | null;
  due_date: string;
  status: string;
  contact_id: string | null;
  application_id: string | null;
}

interface Interaction {
  id: string;
  summary: string | null;
  type: string;
  direction: string;
  date: string;
  contact_id: string | null;
}

export function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalContacts: 0,
    totalApplications: 0,
    totalCompanies: 0,
    pendingFollowUps: 0,
    applicationsByStatus: {},
  });
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    const [contactsRes, appsRes, companiesRes, followUpsRes, interactionsRes] =
      await Promise.all([
        supabase.from("contacts").select("id", { count: "exact", head: true }),
        supabase.from("applications").select("id, status"),
        supabase.from("companies").select("id", { count: "exact", head: true }),
        supabase
          .from("follow_ups")
          .select("*")
          .eq("status", "pending")
          .order("due_date", { ascending: true })
          .limit(10),
        supabase
          .from("interactions")
          .select("*")
          .order("date", { ascending: false })
          .limit(5),
      ]);

    const appsByStatus: Record<string, number> = {};
    (appsRes.data ?? []).forEach((a) => {
      appsByStatus[a.status] = (appsByStatus[a.status] || 0) + 1;
    });

    setStats({
      totalContacts: contactsRes.count ?? 0,
      totalApplications: appsRes.data?.length ?? 0,
      totalCompanies: companiesRes.count ?? 0,
      pendingFollowUps: followUpsRes.data?.length ?? 0,
      applicationsByStatus: appsByStatus,
    });
    setFollowUps((followUpsRes.data as FollowUp[]) ?? []);
    setInteractions((interactionsRes.data as Interaction[]) ?? []);
    setLoading(false);
  };

  const completeFollowUp = async (id: string) => {
    await supabase.from("follow_ups").update({ status: "completed" }).eq("id", id);
    loadData();
  };

  const statCards = [
    { label: "Contacts", value: stats.totalContacts, icon: Users, to: "/contacts" },
    { label: "Applications", value: stats.totalApplications, icon: Briefcase, to: "/applications" },
    { label: "Companies", value: stats.totalCompanies, icon: Building2, to: "/companies" },
    { label: "Pending Follow-ups", value: stats.pendingFollowUps, icon: Clock, to: "/follow-ups" },
  ];


  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-10 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          <Link to="/contacts">
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" /> Contact
            </Button>
          </Link>
          <Link to="/applications">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> Application
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Link key={s.label} to={s.to}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <s.icon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-2xl font-bold">{s.value}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Pipeline */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Briefcase className="h-4 w-4" /> Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(stats.applicationsByStatus).length === 0 ? (
              <p className="text-sm text-muted-foreground">No applications yet. Start tracking your job search!</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(stats.applicationsByStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <Badge variant="secondary" className={statusColors[status]}>
                      {status}
                    </Badge>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Queue */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4" /> Action Queue
              </CardTitle>
              <Link to="/follow-ups">
                <Button variant="ghost" size="sm">
                  View all <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {followUps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending follow-ups. You're all caught up!</p>
            ) : (
              <div className="space-y-3">
                {followUps.slice(0, 5).map((fu) => {
                  const dueDate = parseISO(fu.due_date);
                  const overdue = isPast(dueDate) && !isToday(dueDate);
                  return (
                    <div key={fu.id} className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {overdue ? (
                            <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                          ) : (
                            <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          )}
                          <p className="text-sm truncate">{fu.description}</p>
                        </div>
                        <p className={`text-xs mt-0.5 ml-5.5 ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                          {overdue ? "Overdue — " : ""}
                          {format(dueDate, "MMM d")}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 h-7 w-7 p-0"
                        onClick={() => completeFollowUp(fu.id)}
                      >
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {interactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No interactions logged yet.</p>
          ) : (
            <div className="space-y-3">
              {interactions.map((i) => (
                <div key={i.id} className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full shrink-0 ${i.direction === "outbound" ? "bg-primary" : "bg-success"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{i.summary || `${i.type} (${i.direction})`}</p>
                    <p className="text-xs text-muted-foreground">{format(parseISO(i.date), "MMM d")}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0">{i.type}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
