import { createFileRoute } from "@tanstack/react-router";
import { FollowUpsPage } from "@/components/pages/FollowUpsPage";

export const Route = createFileRoute("/_authenticated/follow-ups")({
  component: FollowUpsPage,
  head: () => ({
    meta: [
      { title: "Follow-ups — Career CRM" },
      { name: "description", content: "Manage your pending follow-ups and reminders." },
    ],
  }),
});
