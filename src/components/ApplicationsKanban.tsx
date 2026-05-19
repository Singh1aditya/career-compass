import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

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

interface Props {
  applications: Application[];
  onChange: () => void;
}

const STATUSES = [
  "wishlist",
  "applied",
  "screening",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
] as const;

const STATUS_LABEL: Record<string, string> = {
  wishlist: "Wishlist",
  applied: "Applied",
  screening: "Screening",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

const STATUS_COLOR: Record<string, string> = {
  wishlist: "bg-muted",
  applied: "bg-primary/10",
  screening: "bg-warning/10",
  interviewing: "bg-chart-2/10",
  offer: "bg-success/10",
  rejected: "bg-destructive/10",
  withdrawn: "bg-muted",
};

function ApplicationCard({ app, dragging }: { app: Application; dragging?: boolean }) {
  const navigate = useNavigate();
  return (
    <Card
      className={`cursor-pointer active:cursor-grabbing ${dragging ? "opacity-50" : ""} hover:shadow-sm hover:border-primary/50 transition-all`}
      onClick={() => navigate({ to: `/applications/${app.id}` })}
      title="Click to open · drag to change status"
    >
      <CardContent className="p-3 space-y-1.5">
        <div className="font-medium text-sm leading-tight">{app.role_title}</div>
        {app.company_name && (
          <div className="text-xs text-muted-foreground">{app.company_name}</div>
        )}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {app.applied_date && (
            <Badge variant="outline" className="text-[10px] h-4 px-1">
              {new Date(app.applied_date).toLocaleDateString()}
            </Badge>
          )}
          {app.source && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1">
              {app.source}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DraggableCard({ app }: { app: Application }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: app.id,
    data: { app },
  });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}>
      <ApplicationCard app={app} dragging={isDragging} />
    </div>
  );
}

function DroppableColumn({
  status,
  applications,
}: {
  status: string;
  applications: Application[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className="flex flex-col w-72 shrink-0">
      <div
        className={`px-3 py-2 rounded-t-md ${STATUS_COLOR[status]} flex items-center justify-between`}
      >
        <span className="text-xs font-semibold uppercase tracking-wide">
          {STATUS_LABEL[status]}
        </span>
        <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-background">
          {applications.length}
        </Badge>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[200px] p-2 space-y-2 bg-muted/20 rounded-b-md border border-t-0 ${
          isOver ? "ring-2 ring-primary ring-inset" : ""
        }`}
      >
        {applications.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-6">Drop here</div>
        )}
        {applications.map((app) => (
          <DraggableCard key={app.id} app={app} />
        ))}
      </div>
    </div>
  );
}

export function ApplicationsKanban({ applications, onChange }: Props) {
  const [activeApp, setActiveApp] = useState<Application | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const byStatus = STATUSES.reduce(
    (acc, s) => {
      acc[s] = applications.filter((a) => a.status === s);
      return acc;
    },
    {} as Record<string, Application[]>,
  );

  const handleDragStart = (e: DragStartEvent) => {
    setActiveApp((e.active.data.current as { app: Application })?.app ?? null);
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveApp(null);
    const { active, over } = e;
    if (!over) return;

    const newStatus = String(over.id);
    const app = (active.data.current as { app: Application })?.app;
    if (!app || app.status === newStatus) return;
    if (!STATUSES.includes(newStatus as (typeof STATUSES)[number])) return;

    const { error } = await supabase
      .from("applications")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", app.id);

    if (error) {
      toast.error(`Failed: ${error.message}`);
    } else {
      toast.success(`Moved to ${STATUS_LABEL[newStatus]}`);
      onChange();
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-3">
        {STATUSES.map((s) => (
          <DroppableColumn key={s} status={s} applications={byStatus[s]} />
        ))}
      </div>
      <DragOverlay>{activeApp ? <ApplicationCard app={activeApp} /> : null}</DragOverlay>
    </DndContext>
  );
}
