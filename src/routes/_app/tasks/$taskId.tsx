import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";

import { TaskDetailPage } from "~/features/tasks/components/task-detail-page";

export const Route = createFileRoute("/_app/tasks/$taskId")({
  component: TaskDetailRoute,
});
function TaskDetailRoute() {
  return (
    <ClientOnly fallback={<p className="text-muted text-sm">読み込み中...</p>}>
      <Suspense fallback={<p className="text-muted text-sm">読み込み中...</p>}>
        <TaskDetailPage />
      </Suspense>
    </ClientOnly>
  );
}
