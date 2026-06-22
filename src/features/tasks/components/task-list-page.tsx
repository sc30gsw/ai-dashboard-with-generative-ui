import { Card } from "@heroui/react";
import { Suspense } from "react";

import { TaskListFilters } from "~/features/tasks/components/task-list-filters";
import { TaskQuickAdd } from "~/features/tasks/components/task-quick-add";
import { TaskTable } from "~/features/tasks/components/task-table";
import { useTaskListFilters } from "~/features/tasks/hooks/use-tasks-list-filters";

export function TaskListPage() {
  const { filters, form } = useTaskListFilters();


  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold">Tasks</h2>
        <p className="text-muted text-sm">Browse and manage tasks outside of Generative UI.</p>
      </div>

      <Card>
        <Card.Header>
          <Card.Title>Quick add</Card.Title>
        </Card.Header>
        <Card.Content>
          <TaskQuickAdd />
        </Card.Content>
      </Card>

      <Card>
        <Card.Header className="flex flex-col gap-4">
          <Card.Title>Task list</Card.Title>
          <TaskListFilters form={form} />
        </Card.Header>
        <Card.Content>
          <Suspense fallback={<p className="text-muted text-sm">読み込み中...</p>}>
          
          <TaskTable filters={filters} />
          </Suspense>
        </Card.Content>
      </Card>
    </div>
  );
}
