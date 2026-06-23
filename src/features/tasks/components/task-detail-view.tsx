import { Card, Header, Heading, linkVariants } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { cn } from "cnfast";

import { type TaskView } from "~/features/tasks/api/task-model";
import { TaskDetailCardContent } from "~/features/tasks/components/task-detail-card-content";
import { TaskDetailCompletionToggleButton } from "~/features/tasks/components/task-detail-completion-toggle-button";

export function TaskDetailView({ task }: Record<"task", TaskView>) {
  return (
    <div className="flex flex-col gap-6">
      <Header className="flex items-center justify-between gap-4">
        <div>
          <Link className={cn(linkVariants().base(), "text-sm")} to="/tasks">
            ← Tasks
          </Link>
          <Heading className="mt-1" level={2}>
            {task.title}
          </Heading>
        </div>
        <TaskDetailCompletionToggleButton task={task} />
      </Header>

      <Card>
        <Card.Header>
          <Card.Title>Details</Card.Title>
        </Card.Header>
        <Card.Content className="flex flex-col gap-4">
          <TaskDetailCardContent task={task} />
        </Card.Content>
      </Card>
    </div>
  );
}
