import { createFileRoute } from "@tanstack/react-router";
import { CompanyDetailPage } from "@/components/pages/CompanyDetailPage";

export const Route = createFileRoute("/_authenticated/companies/$companyId")({
  component: CompanyDetailComponent,
});

function CompanyDetailComponent() {
  const { companyId } = Route.useParams();
  return <CompanyDetailPage companyId={companyId} />;
}
