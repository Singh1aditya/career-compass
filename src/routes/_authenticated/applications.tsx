import { createFileRoute } from "@tanstack/react-router";
import { ApplicationsPage } from "@/components/pages/ApplicationsPage";

export const Route = createFileRoute("/_authenticated/applications")({
  component: ApplicationsPage,
  head: () => ({
    meta: [
      { title: "Applications — Career CRM" },
      { name: "description", content: "Track your job applications and hiring pipeline." },
    ],
  }),
});
