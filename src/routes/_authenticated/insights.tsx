import { createFileRoute } from "@tanstack/react-router";
import { InsightsPage } from "@/components/pages/InsightsPage";

type InsightsSearch = {
  days?: number;
};

function validateSearch(search: Record<string, unknown>): InsightsSearch {
  return {
    days: search.days !== undefined ? Number(search.days) : undefined,
  };
}

export const Route = createFileRoute("/_authenticated/insights")({
  component: InsightsPage,
  validateSearch,
  head: () => ({
    meta: [
      { title: "Insights — Career CRM" },
      { name: "description", content: "Analytics and trends for your job search." },
    ],
  }),
});
