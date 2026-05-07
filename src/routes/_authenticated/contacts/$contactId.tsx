import { createFileRoute } from "@tanstack/react-router";
import { ContactDetailPage } from "@/components/pages/ContactDetailPage";

export const Route = createFileRoute("/_authenticated/contacts/$contactId")({
  component: ContactDetailComponent,
});

function ContactDetailComponent() {
  const { contactId } = Route.useParams();
  return <ContactDetailPage contactId={contactId} />;
}
