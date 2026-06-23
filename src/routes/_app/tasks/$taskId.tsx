import { ClientOnly, createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { Suspense } from "react";
import { z } from "zod";

import { TaskDetailPage } from "~/features/tasks/components/task-detail-page";

const taskDetailSearchSchema = z.object({
  edit: z.boolean().default(false),
});

const defaultTaskDetailSearch = {
  edit: false,
} as const satisfies z.infer<typeof taskDetailSearchSchema>;

export const Route = createFileRoute("/_app/tasks/$taskId")({
  component: TaskDetailRoute,
  validateSearch: taskDetailSearchSchema,
  search: {
    middlewares: [stripSearchParams(defaultTaskDetailSearch)],
  },
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
