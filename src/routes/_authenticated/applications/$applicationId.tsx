import { createFileRoute } from "@tanstack/react-router";
import { ApplicationDetailPage } from "@/components/pages/ApplicationDetailPage";

export const Route = createFileRoute("/_authenticated/applications/$applicationId")({
  component: ApplicationDetailComponent,
});

function ApplicationDetailComponent() {
  const { applicationId } = Route.useParams();
  return <ApplicationDetailPage applicationId={applicationId} />;
}
