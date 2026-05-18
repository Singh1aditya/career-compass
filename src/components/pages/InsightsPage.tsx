import { useState, useEffect, useCallback } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import type { Route } from "@/routes/_authenticated/insights";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { statusLabel } from "@/lib/status";
import {
  fetchFunnelData,
  fetchResponseRate,
  fetchTimeInStage,
  fetchWeeklyTrend,
  fetchThisWeekStats,
} from "@/lib/insights";

// Hex palette for recharts (Tailwind classes don't work inside SVG)
const STATUS_HEX: Record<string, string> = {
  wishlist: "#94a3b8",
  applied: "#6366f1",
  screening: "#f59e0b",
  interviewing: "#10b981",
  offer: "#22c55e",
  rejected: "#ef4444",
  withdrawn: "#94a3b8",
};

const PIPELINE_ORDER = ["wishlist", "applied", "screening", "interviewing", "offer"];

const DAYS_OPTIONS = [
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
  { label: "All time", value: 0 },
] as const;

type FunnelRow = { status: string; count: number };
type StageRow = { status: string; medianDays: number };
type TrendRow = { week: string; count: number };
type WeekStats = { applications: number; replies: number; interviews: number; followUps: number };
type RateData = { sent: number; replied: number; rate: number };

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={`rounded-xl border bg-card p-4 animate-pulse ${className ?? ""}`}>
      <div className="h-4 w-1/3 bg-muted rounded mb-3" />
      <div className="h-24 bg-muted rounded" />
    </div>
  );
}

export function InsightsPage() {
  const search = useSearch({ from: "/_authenticated/insights" });
  const navigate = useNavigate({ from: "/insights" });

  // days=0 means "all time"
  const days = (search as { days?: number }).days ?? 30;

  const setDays = useCallback(
    (d: number) => {
      navigate({ search: { days: d } });
    },
    [navigate],
  );

  const [loading, setLoading] = useState(true);
  const [funnel, setFunnel] = useState<FunnelRow[]>([]);
  const [rate, setRate] = useState<RateData>({ sent: 0, replied: 0, rate: 0 });
  const [stages, setStages] = useState<StageRow[]>([]);
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [weekStats, setWeekStats] = useState<WeekStats>({
    applications: 0,
    replies: 0,
    interviews: 0,
    followUps: 0,
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const effectiveDays = days === 0 ? 3650 : days; // "all time" = 10 years

    Promise.all([
      fetchFunnelData(),
      fetchResponseRate(effectiveDays),
      fetchTimeInStage(),
      fetchWeeklyTrend(),
      fetchThisWeekStats(),
    ]).then(([f, r, s, t, w]) => {
      if (cancelled) return;
      setFunnel(f);
      setRate(r);
      setStages(s);
      setTrend(t);
      setWeekStats(w);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [days]);

  // Separate pipeline from rejected/withdrawn for funnel
  const pipelineFunnel = PIPELINE_ORDER.map((status) => {
    const row = funnel.find((f) => f.status === status);
    return { status, count: row?.count ?? 0 };
  });

  const rejectedCount = funnel.find((f) => f.status === "rejected")?.count ?? 0;
  const withdrawnCount = funnel.find((f) => f.status === "withdrawn")?.count ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Insights</h1>
        <div className="flex items-center gap-1 rounded-lg border p-1 w-fit">
          {DAYS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setDays(opt.value)}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                days === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* This week stat row */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Applications this week" value={weekStats.applications} />
          <StatCard label="Replies this week" value={weekStats.replies} />
          <StatCard label="Interviews this week" value={weekStats.interviews} />
          <StatCard label="Follow-ups this week" value={weekStats.followUps} />
        </div>
      )}

      {/* Funnel + Response rate side by side */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Funnel chart (2/3 width) */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Application Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-48 animate-pulse rounded bg-muted" />
            ) : pipelineFunnel.every((r) => r.count === 0) ? (
              <p className="text-muted-foreground text-sm">No data yet</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={pipelineFunnel.map((r) => ({
                      ...r,
                      label: statusLabel[r.status] ?? r.status,
                    }))}
                    layout="vertical"
                    margin={{ top: 0, right: 24, left: 8, bottom: 0 }}
                  >
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: number) => [value, "Applications"]}
                      cursor={{ fill: "hsl(var(--muted))" }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {pipelineFunnel.map((entry) => (
                        <rect key={entry.status} fill={STATUS_HEX[entry.status] ?? "#94a3b8"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {(rejectedCount > 0 || withdrawnCount > 0) && (
                  <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
                    {rejectedCount > 0 && (
                      <span>
                        <span className="font-medium text-destructive">{rejectedCount}</span>{" "}
                        rejected
                      </span>
                    )}
                    {withdrawnCount > 0 && (
                      <span>
                        <span className="font-medium">{withdrawnCount}</span> withdrawn
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Response rate card (1/3 width) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Response Rate</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center gap-2 pt-4">
            {loading ? (
              <div className="h-24 w-full animate-pulse rounded bg-muted" />
            ) : rate.sent === 0 ? (
              <p className="text-muted-foreground text-sm">No data yet</p>
            ) : (
              <>
                <p className="text-5xl font-bold text-primary">{rate.rate}%</p>
                <p className="text-sm text-muted-foreground text-center">
                  {rate.replied} replies / {rate.sent} sent
                  <br />
                  (last {days === 0 ? "all time" : `${days} days`})
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Time in stage table + Weekly trend side by side */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Time in stage */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Time in Stage</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-36 animate-pulse rounded bg-muted" />
            ) : stages.length === 0 ? (
              <p className="text-muted-foreground text-sm">No data yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="pb-2 text-left font-medium">Status</th>
                    <th className="pb-2 text-right font-medium">Median Days</th>
                  </tr>
                </thead>
                <tbody>
                  {stages
                    .sort(
                      (a, b) => PIPELINE_ORDER.indexOf(a.status) - PIPELINE_ORDER.indexOf(b.status),
                    )
                    .map((row) => (
                      <tr key={row.status} className="border-b last:border-0">
                        <td className="py-2">{statusLabel[row.status] ?? row.status}</td>
                        <td className="py-2 text-right tabular-nums">{row.medianDays}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Weekly trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Outreach — Last 12 Weeks</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-48 animate-pulse rounded bg-muted" />
            ) : trend.every((r) => r.count === 0) ? (
              <p className="text-muted-foreground text-sm">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trend} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v: string) => v.replace(/^\d{4}-/, "")}
                    interval="preserveStartEnd"
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={28} />
                  <Tooltip
                    formatter={(value: number) => [value, "Emails sent"]}
                    labelFormatter={(label: string) => `Week ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#6366f1" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
