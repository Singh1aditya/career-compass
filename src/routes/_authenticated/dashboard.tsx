import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/components/pages/DashboardPage";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Dashboard — Career CRM" },
      { name: "description", content: "Your career command center with daily actions, pipeline overview, and recent activity." },
    ],
  }),
});
