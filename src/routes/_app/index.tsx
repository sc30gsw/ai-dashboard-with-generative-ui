import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";

import { DashboardPage } from "~/features/dashboard/components/dashboard-page";

export const Route = createFileRoute("/_app/")({
  component: DashboardRoute,
});
function DashboardRoute() {
  return (
    <ClientOnly fallback={<p className="text-muted text-sm">読み込み中...</p>}>
      <Suspense fallback={<p className="text-muted text-sm">読み込み中...</p>}>
        <DashboardPage />
      </Suspense>
    </ClientOnly>
  );
}
