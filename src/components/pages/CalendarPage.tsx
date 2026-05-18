import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_USER_ID } from "@/lib/constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Clock, MapPin, Video, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format, isSameDay, startOfMonth, endOfMonth, addMonths } from "date-fns";

interface CRMEvent {
  id: string;
  title: string;
  kind: string;
  scheduled_at: string;
  duration_min: number;
  location: string | null;
  meeting_url: string | null;
  notes: string | null;
  gcal_event_id: string | null;
  application_id: string | null;
  applications?: { role_title: string; company_name: string | null } | null;
}

const KIND_COLORS: Record<string, string> = {
  phone_screen: "bg-blue-100 text-blue-800",
  interview: "bg-indigo-100 text-indigo-800",
  technical: "bg-purple-100 text-purple-800",
  offer_call: "bg-green-100 text-green-800",
  networking: "bg-yellow-100 text-yellow-800",
  other: "bg-gray-100 text-gray-800",
};

const KIND_LABELS: Record<string, string> = {
  phone_screen: "Phone Screen",
  interview: "Interview",
  technical: "Technical",
  offer_call: "Offer Call",
  networking: "Networking",
  other: "Other",
};

export function CalendarPage() {
  const navigate = useNavigate();
  const [month, setMonth] = useState<Date>(new Date());
  const [events, setEvents] = useState<CRMEvent[]>([]);
  const [selected, setSelected] = useState<Date | undefined>(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, [month]);

  const loadEvents = async () => {
    setLoading(true);
    const from = startOfMonth(month).toISOString();
    const to = endOfMonth(addMonths(month, 0)).toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("events")
      .select("*, applications(role_title, company_name)")
      .eq("user_id", DEFAULT_USER_ID)
      .gte("scheduled_at", from)
      .lte("scheduled_at", to)
      .order("scheduled_at");

    if (error) {
      toast.error(error.message);
    } else {
      setEvents((data ?? []) as CRMEvent[]);
    }
    setLoading(false);
  };

  const handleDelete = async (ev: CRMEvent) => {
    if (ev.gcal_event_id) {
      // Remove from Google Calendar
      try {
        await supabase.functions.invoke("sync-gcal-event", {
          body: { operation: "delete", event_id: ev.id },
        });
      } catch {
        // non-fatal
      }
    }
    const { error } = await db.from("events").delete().eq("id", ev.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Event deleted");
    setEvents((prev) => prev.filter((e) => e.id !== ev.id));
  };

  const eventsOnSelected = selected
    ? events.filter((e) => isSameDay(new Date(e.scheduled_at), selected))
    : [];

  const eventDays = events.map((e) => new Date(e.scheduled_at));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {events.length} event{events.length !== 1 ? "s" : ""} this month
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-start">
        {/* Month picker */}
        <Card className="shrink-0">
          <CardContent className="p-3">
            <DayPicker
              mode="single"
              selected={selected}
              onSelect={setSelected}
              month={month}
              onMonthChange={setMonth}
              modifiers={{ hasEvent: eventDays }}
              modifiersClassNames={{
                hasEvent: "rdp-day--has-event",
              }}
              styles={{
                day: { position: "relative" },
              }}
              footer={
                <style>{`
                  .rdp-day--has-event::after {
                    content: '';
                    position: absolute;
                    bottom: 2px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 4px;
                    height: 4px;
                    border-radius: 50%;
                    background: hsl(var(--primary));
                  }
                `}</style>
              }
            />
          </CardContent>
        </Card>

        {/* Events for selected day */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold">
            {selected ? format(selected, "EEEE, MMMM d") : "Select a day"}
          </h2>

          {loading && (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-24 rounded-xl border bg-card animate-pulse" />
              ))}
            </div>
          )}

          {!loading && eventsOnSelected.length === 0 && (
            <p className="text-sm text-muted-foreground">No events scheduled for this day.</p>
          )}

          {eventsOnSelected.map((ev) => (
            <Card key={ev.id}>
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-sm font-semibold">{ev.title}</CardTitle>
                      <Badge
                        className={`text-[10px] h-4 px-1.5 ${KIND_COLORS[ev.kind] ?? KIND_COLORS.other}`}
                      >
                        {KIND_LABELS[ev.kind] ?? ev.kind}
                      </Badge>
                      {ev.gcal_event_id && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                          GCal synced
                        </Badge>
                      )}
                    </div>
                    {ev.applications && (
                      <button
                        className="text-xs text-primary hover:underline mt-0.5"
                        onClick={() => navigate({ to: `/applications/${ev.application_id}` })}
                      >
                        {ev.applications.role_title}
                        {ev.applications.company_name ? ` @ ${ev.applications.company_name}` : ""}
                      </button>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => handleDelete(ev)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>
                    {format(new Date(ev.scheduled_at), "h:mm a")} ·{" "}
                    {ev.duration_min < 60 ? `${ev.duration_min} min` : `${ev.duration_min / 60}h`}
                  </span>
                </div>
                {ev.location && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>{ev.location}</span>
                  </div>
                )}
                {ev.meeting_url && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <Video className="h-3 w-3 text-muted-foreground" />
                    <a
                      href={ev.meeting_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      Join meeting <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                {ev.notes && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap pt-1">
                    {ev.notes}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Upcoming events overview (non-selected days this month) */}
          {events.filter((e) => !selected || !isSameDay(new Date(e.scheduled_at), selected))
            .length > 0 && (
            <details className="mt-4">
              <summary className="text-xs text-muted-foreground cursor-pointer select-none">
                All events this month ({events.length})
              </summary>
              <div className="mt-2 space-y-1.5">
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted rounded px-2 py-1"
                    onClick={() => setSelected(new Date(ev.scheduled_at))}
                  >
                    <span className="text-muted-foreground w-16 shrink-0">
                      {format(new Date(ev.scheduled_at), "MMM d")}
                    </span>
                    <span className="font-medium truncate">{ev.title}</span>
                    <Badge
                      className={`ml-auto text-[10px] h-4 px-1 shrink-0 ${KIND_COLORS[ev.kind] ?? ""}`}
                    >
                      {KIND_LABELS[ev.kind] ?? ev.kind}
                    </Badge>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
