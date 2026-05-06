import { createFileRoute } from "@tanstack/react-router";
import { CompaniesPage } from "@/components/pages/CompaniesPage";

export const Route = createFileRoute("/_authenticated/companies")({
  component: CompaniesPage,
  head: () => ({
    meta: [
      { title: "Companies — Career CRM" },
      { name: "description", content: "Track companies you're interested in and their hiring signals." },
    ],
  }),
});
