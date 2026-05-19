import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Inbox, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface ScanSummary {
  scanned: number;
  created: number;
  updated: number;
  skipped: number;
  noop: number;
}

interface ProcessedEmail {
  id: string;
  classification: string;
  action_taken: string;
  detected_company: string | null;
  detected_role: string | null;
  email_subject: string | null;
  email_from: string | null;
  processed_at: string;
}

export function EmailScanStatus({ gmailConnected }: { gmailConnected: boolean }) {
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [recent, setRecent] = useState<ProcessedEmail[]>([]);
  const [stats, setStats] = useState({ created: 0, updated: 0, total: 0 });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const { data: rows, count } = await supabase
      .from("processed_emails")
      .select("*", { count: "exact" })
      .order("processed_at", { ascending: false })
      .limit(10);

    if (rows && rows.length > 0) {
      setLastScan(rows[0].processed_at);
      setRecent(rows as ProcessedEmail[]);
    }

    const { count: createdCount } = await supabase
      .from("processed_emails")
      .select("*", { count: "exact", head: true })
      .eq("action_taken", "created");
    const { count: updatedCount } = await supabase
      .from("processed_emails")
      .select("*", { count: "exact", head: true })
      .eq("action_taken", "updated");

    setStats({
      created: createdCount ?? 0,
      updated: updatedCount ?? 0,
      total: count ?? 0,
    });
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("scan-job-emails");
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Scan failed");
      const summary = data.summary as ScanSummary;
      toast.success(
        `Scanned ${summary.scanned} emails — created ${summary.created}, updated ${summary.updated}`,
      );
      await loadStats();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to scan inbox");
    } finally {
      setScanning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Email Auto-Ingest</CardTitle>
              <CardDescription>
                Scan Gmail for application confirmations and rejection emails. Auto-creates and
                updates applications in your tracker.
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!gmailConnected ? (
          <div className="bg-muted/50 border rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              Connect Gmail above to enable email auto-ingest.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="border rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-2xl font-bold text-green-600">{stats.created}</p>
              </div>
              <div className="border rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Updated</p>
                <p className="text-2xl font-bold text-blue-600">{stats.updated}</p>
              </div>
              <div className="border rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Total Scanned</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={handleScan} disabled={scanning}>
                <RefreshCw className={`h-4 w-4 mr-2 ${scanning ? "animate-spin" : ""}`} />
                {scanning ? "Scanning..." : "Scan Now"}
              </Button>
              {lastScan && (
                <p className="text-xs text-muted-foreground">
                  Last scan: {new Date(lastScan).toLocaleString()}
                </p>
              )}
            </div>

            {recent.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-muted text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Recent Activity
                </div>
                <div className="divide-y">
                  {recent.map((r) => (
                    <div key={r.id} className="px-3 py-2 text-sm flex items-start gap-2">
                      {r.action_taken === "created" ? (
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      ) : r.action_taken === "updated" ? (
                        <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                      ) : (
                        <div className="h-4 w-4 mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {r.detected_company ?? "Unknown company"}
                          </span>
                          {r.detected_role && (
                            <span className="text-xs text-muted-foreground truncate">
                              · {r.detected_role}
                            </span>
                          )}
                          <Badge
                            variant="outline"
                            className={`text-[10px] h-4 px-1 ml-auto ${
                              r.classification === "rejection"
                                ? "border-destructive/40 text-destructive"
                                : r.classification === "confirmation"
                                  ? "border-primary/40 text-primary"
                                  : ""
                            }`}
                          >
                            {r.classification}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] h-4 px-1">
                            {r.action_taken}
                          </Badge>
                        </div>
                        {r.email_subject && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {r.email_subject}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
