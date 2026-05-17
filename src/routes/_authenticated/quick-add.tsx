import { createFileRoute } from "@tanstack/react-router";
import { QuickAddPage } from "@/components/pages/QuickAddPage";

export const Route = createFileRoute("/_authenticated/quick-add")({
  component: QuickAddPage,
  head: () => ({
    meta: [
      { title: "Quick Add — Career CRM" },
      { name: "description", content: "Capture a job posting in one click." },
    ],
  }),
});
