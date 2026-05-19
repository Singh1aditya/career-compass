import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Mail, RefreshCw } from "lucide-react";
import { format, subDays } from "date-fns";

interface DigestData {
  overdue: { id: string; description: string; due_date: string }[];
  recentReplies: { id: string; summary: string | null; date: string }[];
  staleSequences: { id: string; name: string }[];
  weekStats: { applied: number; replies: number; interviews: number };
}

export function DigestPreview() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DigestData | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const now = new Date();
      const yesterday = subDays(now, 1).toISOString();
      const weekAgo = subDays(now, 7).toISOString();

      const [overdueRes, repliesRes, statsRes] = await Promise.all([
        supabase
          .from("follow_ups")
          .select("id, description, due_date")
          .eq("user_id", user.id)
          .neq("status", "completed")
          .lt("due_date", now.toISOString())
          .order("due_date")
          .limit(10),
        supabase
          .from("interactions")
          .select("id, summary, date")
          .eq("user_id", user.id)
          .eq("direction", "inbound")
          .gte("date", yesterday)
          .order("date", { ascending: false })
          .limit(10),
        supabase
          .from("applications")
          .select("status, created_at")
          .eq("user_id", user.id)
          .gte("created_at", weekAgo),
      ]);

      const applied = (statsRes.data ?? []).filter((a) => a.status !== "wishlist").length;
      const interviews = (statsRes.data ?? []).filter((a) =>
        ["screening", "interviewing"].includes(a.status),
      ).length;

      setData({
        overdue: (overdueRes.data ?? []) as DigestData["overdue"],
        recentReplies: (repliesRes.data ?? []) as DigestData["recentReplies"],
        staleSequences: [],
        weekStats: { applied, replies: (repliesRes.data ?? []).length, interviews },
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && !data) load();
  }, [open]);

  const today = format(new Date(), "EEEE, MMMM d");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
          <Mail className="h-3.5 w-3.5 mr-1" />
          Preview digest
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Daily Digest Preview</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={load}
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <p className="text-sm text-muted-foreground py-4 text-center">Loading preview…</p>
        )}

        {data && !loading && (
          <div className="space-y-5 text-sm font-mono bg-muted/40 rounded-lg p-4 leading-relaxed">
            <div>
              <p className="font-bold text-base">☀️ Good morning — {today}</p>
              <p className="text-muted-foreground text-xs mt-0.5">Your daily job-search digest</p>
            </div>

            <div>
              <p className="font-semibold">📊 This week</p>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                <li>
                  • {data.weekStats.applied} application{data.weekStats.applied !== 1 ? "s" : ""}{" "}
                  submitted
                </li>
                <li>
                  • {data.weekStats.replies} repl{data.weekStats.replies !== 1 ? "ies" : "y"}{" "}
                  received
                </li>
                <li>
                  • {data.weekStats.interviews} interview
                  {data.weekStats.interviews !== 1 ? "s" : ""} in progress
                </li>
              </ul>
            </div>

            {data.recentReplies.length > 0 && (
              <div>
                <p className="font-semibold">
                  📬 Replies since yesterday ({data.recentReplies.length})
                </p>
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  {data.recentReplies.map((r) => (
                    <li key={r.id}>
                      • {r.summary ?? "(no summary)"} — {format(new Date(r.date), "h:mm a")}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.overdue.length > 0 && (
              <div>
                <p className="font-semibold">⚠️ Overdue follow-ups ({data.overdue.length})</p>
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  {data.overdue.map((f) => (
                    <li key={f.id}>
                      • {f.description} — was due {format(new Date(f.due_date), "MMM d")}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.overdue.length === 0 && data.recentReplies.length === 0 && (
              <p className="text-muted-foreground">
                ✅ All caught up — no overdue follow-ups or new replies.
              </p>
            )}

            <p className="text-xs text-muted-foreground border-t pt-3">
              This is a preview of your digest email. The actual email is sent via Gmail.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
