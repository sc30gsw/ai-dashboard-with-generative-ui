import { Card } from "@heroui/react";
import { eq, useLiveSuspenseQuery } from "@tanstack/react-db";
import { getRouteApi, Link } from "@tanstack/react-router";

import { tasksCollection } from "~/features/tasks/collections/tasks-collection";
import { TaskDetailView } from "~/features/tasks/components/task-detail-view";

const routeApi = getRouteApi("/_app/tasks/$taskId");

export function TaskDetailPage() {
  const { taskId } = routeApi.useParams();

  const { data: matches } = useLiveSuspenseQuery((query) =>
    query.from({ task: tasksCollection }).where(({ task }) => eq(task.id, taskId)),
  );

  const task = matches[0];

  if (!task) {
    return (
      <Card>
        <Card.Content className="flex flex-col gap-3 py-8">
          <p className="text-muted text-sm">Task not found.</p>
          <Link
            className="text-accent hover:text-accent/80 text-sm font-medium hover:underline"
            to="/tasks"
          >
            Back to tasks
          </Link>
        </Card.Content>
      </Card>
    );
  }

  return <TaskDetailView task={task} />;
}
