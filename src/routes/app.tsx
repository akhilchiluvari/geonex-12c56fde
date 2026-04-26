import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";

export const Route = createFileRoute("/app")({
  head: () => ({ meta: [{ title: "GEONEX — Banking" }] }),
  component: AppLayout,
});
