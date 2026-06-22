import { Button, Card, Chip } from "@heroui/react";
import { eq, useLiveQuery } from "@tanstack/react-db";
import { getRouteApi, Link } from "@tanstack/react-router";

import { tasksCollection } from "~/features/tasks/collections/tasks-collection";
import { PriorityChip } from "~/features/tasks/components/priority-chip";

const routeApi = getRouteApi("/_app/tasks/$taskId");

export function TaskDetailPage() {
  const { taskId } = routeApi.useParams();

  const { data: matches, isLoading } = useLiveQuery((query) =>
    query.from({ task: tasksCollection }).where(({ task }) => eq(task.id, taskId)),
  );

  const task = matches?.[0];

  if (isLoading) {
    return <p className="text-sm text-zinc-500">Loading task...</p>;
  }

  if (!task) {
    return (
      <Card>
        <Card.Content className="flex flex-col gap-3 py-8">
          <p className="text-sm text-zinc-500">Task not found.</p>
          <Link className="text-sm font-medium text-zinc-900 hover:underline" to="/tasks">
            Back to tasks
          </Link>
        </Card.Content>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link className="text-sm text-zinc-500 hover:underline" to="/tasks">
            ← Tasks
          </Link>
          <h2 className="mt-1 text-2xl font-semibold">{task.title}</h2>
        </div>
        {!task.completed ? (
          <Button
            onPress={() => {
              tasksCollection.update(task.id, (draft) => {
                draft.completed = true;
              });
            }}
          >
            Mark complete
          </Button>
        ) : null}
      </div>

      <Card>
        <Card.Header>
          <Card.Title>Details</Card.Title>
        </Card.Header>
        <Card.Content className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-500">Priority</span>
            <PriorityChip priority={task.priority} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-500">Status</span>
            <Chip color={task.completed ? "success" : "default"} size="sm" variant="secondary">
              <Chip.Label>{task.completed ? "Done" : "Open"}</Chip.Label>
            </Chip>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-500">Created</span>
            <span className="text-sm">{task.createdAt.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-500">ID</span>
            <code className="rounded bg-zinc-100 px-2 py-1 text-xs">{task.id}</code>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}
