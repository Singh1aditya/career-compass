import { createFileRoute } from "@tanstack/react-router";
import { SequenceDetailPage } from "@/components/pages/SequenceDetailPage";

export const Route = createFileRoute("/_authenticated/sequences/$sequenceId")({
  component: SequenceDetailComponent,
});

function SequenceDetailComponent() {
  const { sequenceId } = Route.useParams();
  return <SequenceDetailPage sequenceId={sequenceId} />;
}
