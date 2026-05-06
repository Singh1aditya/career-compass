import { createFileRoute } from "@tanstack/react-router";
import { SearchPage } from "@/components/pages/SearchPage";

export const Route = createFileRoute("/_authenticated/search")({
  component: SearchPage,
  head: () => ({
    meta: [
      { title: "Search — Career CRM" },
      { name: "description", content: "Search across all your contacts, applications, and notes." },
    ],
  }),
});
