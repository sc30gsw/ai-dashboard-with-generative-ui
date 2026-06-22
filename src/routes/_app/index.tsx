import { ClientOnly, createFileRoute } from "@tanstack/react-router";

import { DashboardPage } from "~/features/dashboard/components/dashboard-page";

export const Route = createFileRoute("/_app/")({
  component: DashboardRoute,
});

function DashboardRoute() {
  return (
    <ClientOnly fallback={<p className="text-muted text-sm">読み込み中...</p>}>
      <DashboardPage />
    </ClientOnly>
  );
}
