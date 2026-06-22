import { ClientOnly, createFileRoute, stripSearchParams } from "@tanstack/react-router";

import { defaultListTasksSchema, ListTasksSchema } from "~/features/tasks/api/task-model";
import { TaskListPage } from "~/features/tasks/components/task-list-page";

export const Route = createFileRoute("/_app/tasks/")({
  validateSearch: ListTasksSchema,
  search: {
    middlewares: [stripSearchParams(defaultListTasksSchema)],
  },
  component: TaskListRoute,
});

function TaskListRoute() {
  return (
    <ClientOnly fallback={<p className="text-muted text-sm">読み込み中...</p>}>
      <TaskListPage />
    </ClientOnly>
  );
}
