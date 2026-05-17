import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { format, subDays, startOfWeek, getISOWeek, getISOWeekYear } from "date-fns";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// Returns counts per status across all applications
export async function fetchFunnelData(): Promise<{ status: string; count: number }[]> {
  const { data, error } = await supabase
    .from("applications")
    .select("status")
    .eq("user_id", DEFAULT_USER_ID);

  if (error || !data) return [];

  const counts: Record<string, number> = {};
  for (const row of data) {
    const s = row.status as string;
    counts[s] = (counts[s] ?? 0) + 1;
  }

  return Object.entries(counts).map(([status, count]) => ({ status, count }));
}

// Returns { sent, replied, rate } for last N days
export async function fetchResponseRate(
  days: number
): Promise<{ sent: number; replied: number; rate: number }> {
  const since = subDays(new Date(), days).toISOString();

  const { data: outbound } = await supabase
    .from("interactions")
    .select("id")
    .eq("type", "email")
    .eq("direction", "outbound")
    .gte("date", since);

  const { data: inbound } = await supabase
    .from("interactions")
    .select("id")
    .eq("type", "email")
    .eq("direction", "inbound")
    .gte("date", since);

  const sent = outbound?.length ?? 0;
  const replied = inbound?.length ?? 0;
  const rate = sent > 0 ? Math.round((replied / sent) * 100) : 0;

  return { sent, replied, rate };
}

// Returns median days in each status (from application_status_history)
export async function fetchTimeInStage(): Promise<{ status: string; medianDays: number }[]> {
  const { data, error } = await db
    .from("application_status_history")
    .select("application_id, to_status, changed_at")
    .order("application_id")
    .order("changed_at");

  if (error || !data || data.length === 0) return [];

  // Group by application_id
  const byApp: Record<string, { to_status: string; changed_at: string }[]> = {};
  for (const row of data) {
    const appId = row.application_id as string;
    if (!byApp[appId]) byApp[appId] = [];
    byApp[appId].push({ to_status: row.to_status as string, changed_at: row.changed_at as string });
  }

  // For each consecutive pair, record the time spent in `to_status` (duration until next transition)
  const durations: Record<string, number[]> = {};
  for (const rows of Object.values(byApp)) {
    for (let i = 0; i < rows.length - 1; i++) {
      const status = rows[i].to_status;
      const start = new Date(rows[i].changed_at).getTime();
      const end = new Date(rows[i + 1].changed_at).getTime();
      const days = (end - start) / (1000 * 60 * 60 * 24);
      if (days >= 0) {
        if (!durations[status]) durations[status] = [];
        durations[status].push(days);
      }
    }
  }

  function median(arr: number[]): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return Object.entries(durations).map(([status, days]) => ({
    status,
    medianDays: Math.round(median(days) * 10) / 10,
  }));
}

// Returns weekly submission counts for last 12 weeks
export async function fetchWeeklyTrend(): Promise<{ week: string; count: number }[]> {
  const since = subDays(new Date(), 84).toISOString(); // 12 weeks

  const { data, error } = await supabase
    .from("interactions")
    .select("date")
    .eq("type", "email")
    .eq("direction", "outbound")
    .gte("date", since);

  if (error || !data) return [];

  const counts: Record<string, number> = {};
  for (const row of data) {
    const d = new Date(row.date as string);
    const year = getISOWeekYear(d);
    const week = getISOWeek(d);
    const key = `${year}-W${String(week).padStart(2, "0")}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }

  // Build all 12 week buckets so gaps show as 0
  const result: { week: string; count: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = subDays(new Date(), i * 7);
    const year = getISOWeekYear(d);
    const week = getISOWeek(d);
    const key = `${year}-W${String(week).padStart(2, "0")}`;
    if (!result.find((r) => r.week === key)) {
      result.push({ week: key, count: counts[key] ?? 0 });
    }
  }

  return result;
}

// Returns { applications, replies, interviews, followUps } for current week
export async function fetchThisWeekStats(): Promise<{
  applications: number;
  replies: number;
  interviews: number;
  followUps: number;
}> {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();

  const { data: apps } = await supabase
    .from("applications")
    .select("id")
    .eq("user_id", DEFAULT_USER_ID)
    .gte("created_at", weekStart);

  const { data: replies } = await supabase
    .from("interactions")
    .select("id")
    .eq("type", "email")
    .eq("direction", "inbound")
    .gte("date", weekStart);

  const { data: interviews } = await supabase
    .from("applications")
    .select("id")
    .eq("user_id", DEFAULT_USER_ID)
    .eq("status", "interviewing")
    .gte("updated_at", weekStart);

  const { data: followUps } = await supabase
    .from("interactions")
    .select("id")
    .eq("type", "follow_up")
    .gte("date", weekStart);

  return {
    applications: apps?.length ?? 0,
    replies: replies?.length ?? 0,
    interviews: interviews?.length ?? 0,
    followUps: followUps?.length ?? 0,
  };
}
