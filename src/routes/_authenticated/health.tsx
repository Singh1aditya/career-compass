import { createFileRoute } from "@tanstack/react-router";
import { HealthPage } from "@/components/pages/HealthPage";

export const Route = createFileRoute("/_authenticated/health")({
  component: HealthPage,
  head: () => ({
    meta: [
      { title: "System Health — Career CRM" },
      { name: "description", content: "Edge function reachability status." },
    ],
  }),
});
