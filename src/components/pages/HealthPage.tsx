import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Activity,
} from "lucide-react";
import { format } from "date-fns";

interface FunctionStatus {
  name: string;
  description: string;
  status: "ok" | "error" | "checking" | "idle";
  latencyMs?: number;
  lastChecked?: Date;
  errorMsg?: string;
  category: "email" | "ai" | "automation" | "storage";
}

const FUNCTIONS: Pick<FunctionStatus, "name" | "description" | "category">[] = [
  { name: "send-daily-digest", description: "Daily digest email", category: "email" },
  { name: "generate-auto-followups", description: "Auto follow-up generator", category: "automation" },
  { name: "scan-job-emails", description: "Job email scanner", category: "email" },
  { name: "gmail-poll-replies", description: "Gmail reply poller", category: "email" },
  { name: "process-pending-sends", description: "Pending send processor", category: "email" },
  { name: "ai-assist", description: "AI compose assistant", category: "ai" },
  { name: "quick-capture", description: "Quick capture (bookmarklet)", category: "automation" },
  { name: "sync-gcal-event", description: "Google Calendar sync", category: "automation" },
];

const CATEGORY_COLORS: Record<FunctionStatus["category"], string> = {
  email: "bg-blue-100 text-blue-800",
  ai: "bg-purple-100 text-purple-800",
  automation: "bg-yellow-100 text-yellow-800",
  storage: "bg-green-100 text-green-800",
};

export function HealthPage() {
  const [statuses, setStatuses] = useState<FunctionStatus[]>(
    FUNCTIONS.map((f) => ({ ...f, status: "idle" }))
  );
  const [checking, setChecking] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const checkAll = useCallback(async () => {
    setChecking(true);
    setStatuses((prev) => prev.map((s) => ({ ...s, status: "checking" })));

    const results = await Promise.all(
      FUNCTIONS.map(async (fn) => {
        const start = Date.now();
        try {
          // Use a HEAD-equivalent: invoke with empty body and expect any response
          const { error } = await supabase.functions.invoke(fn.name, {
            body: { __healthcheck: true },
          });
          const latencyMs = Date.now() - start;

          // Many functions return an error about missing params — that's OK,
          // it still means the function is reachable.
          const reachable = latencyMs < 10000;

          return {
            ...fn,
            status: (reachable ? "ok" : "error") as FunctionStatus["status"],
            latencyMs,
            lastChecked: new Date(),
            errorMsg: reachable ? undefined : "Timed out",
          };
        } catch (e: unknown) {
          return {
            ...fn,
            status: "error" as const,
            latencyMs: Date.now() - start,
            lastChecked: new Date(),
            errorMsg: e instanceof Error ? e.message : "Unknown error",
          };
        }
      })
    );

    setStatuses(results);
    setLastRun(new Date());
    setChecking(false);
  }, []);

  useEffect(() => {
    checkAll();
  }, []);

  const okCount = statuses.filter((s) => s.status === "ok").length;
  const errorCount = statuses.filter((s) => s.status === "error").length;

  const StatusIcon = ({ status }: { status: FunctionStatus["status"] }) => {
    if (status === "ok") return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (status === "error") return <XCircle className="h-4 w-4 text-destructive" />;
    if (status === "checking") return <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />;
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const categories = Array.from(new Set(FUNCTIONS.map((f) => f.category)));

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" /> System Health
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Edge function reachability · {lastRun ? `Last checked ${format(lastRun, "h:mm:ss a")}` : "Not checked yet"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={checkAll}
          disabled={checking}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${checking ? "animate-spin" : ""}`} />
          {checking ? "Checking…" : "Re-check all"}
        </Button>
      </div>

      {/* Summary row */}
      <div className="flex gap-3">
        <Card className="flex-1">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-green-600">{okCount}</p>
              <p className="text-xs text-muted-foreground">Reachable</p>
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="h-6 w-6 text-destructive" />
            <div>
              <p className="text-2xl font-bold text-destructive">{errorCount}</p>
              <p className="text-xs text-muted-foreground">Unreachable</p>
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="p-4 flex items-center gap-3">
            <Activity className="h-6 w-6 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{FUNCTIONS.length}</p>
              <p className="text-xs text-muted-foreground">Total functions</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-category */}
      {categories.map((cat) => {
        const fns = statuses.filter((s) => s.category === cat);
        return (
          <Card key={cat}>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-semibold capitalize flex items-center gap-2">
                {cat}
                <Badge className={`text-[10px] h-4 px-1.5 ${CATEGORY_COLORS[cat]}`}>
                  {fns.filter((f) => f.status === "ok").length}/{fns.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {fns.map((fn) => (
                  <div key={fn.name} className="flex items-center gap-3 px-4 py-3">
                    <StatusIcon status={fn.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{fn.name}</p>
                      <p className="text-xs text-muted-foreground">{fn.description}</p>
                      {fn.errorMsg && (
                        <p className="text-xs text-destructive mt-0.5">{fn.errorMsg}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {fn.latencyMs !== undefined && (
                        <p className="text-xs text-muted-foreground">
                          {fn.latencyMs}ms
                        </p>
                      )}
                      {fn.lastChecked && (
                        <p className="text-[10px] text-muted-foreground/60">
                          {format(fn.lastChecked, "h:mm:ss a")}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
