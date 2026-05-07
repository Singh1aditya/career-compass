import { createFileRoute } from "@tanstack/react-router";
import { ImportPage } from "@/components/pages/ImportPage";

export const Route = createFileRoute("/_authenticated/import")({
  component: ImportPage,
});
