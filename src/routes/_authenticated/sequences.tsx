import { createFileRoute } from "@tanstack/react-router";
import { SequencesPage } from "@/components/pages/SequencesPage";

export const Route = createFileRoute("/_authenticated/sequences")({
  component: SequencesPage,
});
