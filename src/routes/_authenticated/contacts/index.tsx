import { createFileRoute } from "@tanstack/react-router";
import { ContactsPage } from "@/components/pages/ContactsPage";

export const Route = createFileRoute("/_authenticated/contacts/")({
  component: ContactsPage,
  head: () => ({
    meta: [
      { title: "Contacts — Career CRM" },
      { name: "description", content: "Manage your professional network contacts." },
    ],
  }),
});
