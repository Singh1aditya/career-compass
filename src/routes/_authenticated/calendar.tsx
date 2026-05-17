import { createFileRoute } from "@tanstack/react-router";
import { CalendarPage } from "@/components/pages/CalendarPage";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: CalendarPage,
  head: () => ({
    meta: [
      { title: "Calendar — Career CRM" },
      { name: "description", content: "Your scheduled interviews and events." },
    ],
  }),
});
