import { Button, Chip, Table, toast } from "@heroui/react";
import { Link } from "@tanstack/react-router";

import { tasksCollection } from "~/features/tasks/collections/tasks-collection";
import { PriorityChip } from "~/features/tasks/components/priority-chip";
import { useFilteredTasksQuery } from "~/features/tasks/hooks/use-filtered-tasks-query";
import type { useTaskListFilters } from "~/features/tasks/hooks/use-tasks-list-filters";
import { taskListFiltersToQuery } from "~/features/tasks/utils/tasks-live-query";

export function TaskTable({
  filters,
}: Record<"filters", ReturnType<typeof useTaskListFilters>["filters"]>) {
  const queryFilters = taskListFiltersToQuery(filters);
  const { data: tasks } = useFilteredTasksQuery(queryFilters);

  if (tasks.length === 0) {
    return <p className="text-muted text-sm">No tasks match the current filters.</p>;
  }

  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content aria-label="Tasks">
          <Table.Header>
            <Table.Column isRowHeader>Title</Table.Column>
            <Table.Column>Priority</Table.Column>
            <Table.Column>Status</Table.Column>
            <Table.Column>Actions</Table.Column>
          </Table.Header>
          <Table.Body items={tasks}>
            {(task) => (
              <Table.Row id={task.id}>
                <Table.Cell>
                  <Link
                    className="text-accent hover:text-accent/80 font-medium hover:underline"
                    params={{ taskId: task.id }}
                    to="/tasks/$taskId"
                  >
                    {task.title}
                  </Link>
                </Table.Cell>
                <Table.Cell>
                  <PriorityChip priority={task.priority} />
                </Table.Cell>
                <Table.Cell>
                  <Chip
                    color={task.completed ? "success" : "default"}
                    size="sm"
                    variant="secondary"
                  >
                    <Chip.Label>{task.completed ? "Done" : "Open"}</Chip.Label>
                  </Chip>
                </Table.Cell>
                <Table.Cell>
                  {!task.completed ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={() => {
                        const tx = tasksCollection.update(task.id, (draft) => {
                          draft.completed = true;
                        });

                        tx.isPersisted.promise.catch(() => {
                          toast.danger("タスクの完了に失敗しました。");
                        });
                      }}
                    >
                      Complete
                    </Button>
                  ) : (
                    <span className="text-muted text-xs">—</span>
                  )}
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}
