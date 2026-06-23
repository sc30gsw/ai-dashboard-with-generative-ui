import { Button, Card, Chip, CloseIcon, Input, ListBox, Select, Table } from "@heroui/react";
import { type ComponentRenderProps, defineComponent } from "@openuidev/react-lang";
import { useState } from "react";
import { sort } from "remeda";

import {
  PRIORITY_FILTER_LABELS,
  PRIORITY_FILTERS,
  SORT_LABELS,
  SORTS,
} from "~/features/chat/constants/tasks-list-options";
import { taskListPropsSchema, type TaskRow } from "~/features/chat/schemas/task-list-schema";
import { TASK_PRIORITY_RANK } from "~/features/tasks/api/task-model";

const PRIORITY_COLOR = {
  high: "danger",
  low: "default",
  medium: "warning",
} as const satisfies Record<TaskRow["priority"], "danger" | "default" | "warning">;

function sortTasks(tasks: TaskRow[], sortKey: (typeof SORTS)[number]) {
  if (sortKey === "priority") {
    return sort(tasks, (a, b) => TASK_PRIORITY_RANK[a.priority] - TASK_PRIORITY_RANK[b.priority]);
  }

  if (sortKey === "title") {
    return sort(tasks, (a, b) => a.title.localeCompare(b.title, "ja"));
  }

  return tasks;
}

export const taskList = defineComponent({
  component: function TaskListView({ props }: ComponentRenderProps<Record<"tasks", TaskRow[]>>) {
    const { tasks } = props;

    const [query, setQuery] = useState("");
    const [priority, setPriority] = useState<(typeof PRIORITY_FILTERS)[number]>("all");
    const [sortKey, setSortKey] = useState<(typeof SORTS)[number]>("default");

    //? React Compiler が priority / query / sortKey を依存として追跡できるよう、ローカル変数として保持する。
    const normalized = query.trim().toLowerCase();
    const filtered = tasks.filter(
      (task) =>
        (priority === "all" || task.priority === priority) &&
        (normalized === "" || task.title.toLowerCase().includes(normalized)),
    );
    const visible = sortTasks(filtered, sortKey);

    return (
      <Card>
        <Card.Content className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex flex-1 gap-2">
              <Input
                aria-label="タスクを検索"
                className="flex-1"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="タスクを検索..."
                value={query}
              />
              {query === "" ? null : (
                <Button
                  aria-label="検索をクリア"
                  onPress={() => setQuery("")}
                  size="sm"
                  variant="secondary"
                >
                  <CloseIcon />
                </Button>
              )}
            </div>
            <Select
              aria-label="優先度で絞り込み"
              className="sm:w-44"
              onChange={(key) => setPriority(key as (typeof PRIORITY_FILTERS)[number])}
              value={priority}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {PRIORITY_FILTERS.map((value) => (
                    <ListBox.Item id={value} key={value} textValue={PRIORITY_FILTER_LABELS[value]}>
                      {PRIORITY_FILTER_LABELS[value]}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <Select
              aria-label="並び替え"
              className="sm:w-44"
              onChange={(key) => setSortKey(key as (typeof SORTS)[number])}
              value={sortKey}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {SORTS.map((value) => (
                    <ListBox.Item id={value} key={value} textValue={SORT_LABELS[value]}>
                      {SORT_LABELS[value]}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
          {visible.length === 0 ? (
            <p className="text-muted py-6 text-center text-sm">該当なし</p>
          ) : (
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="タスク一覧">
                  <Table.Header>
                    <Table.Column isRowHeader>Title</Table.Column>
                    <Table.Column>Priority</Table.Column>
                    <Table.Column>Done</Table.Column>
                  </Table.Header>
                  <Table.Body items={visible}>
                    {(task) => (
                      <Table.Row id={task.id}>
                        <Table.Cell>{task.title}</Table.Cell>
                        <Table.Cell>
                          <Chip color={PRIORITY_COLOR[task.priority]} size="sm" variant="secondary">
                            <Chip.Label>{task.priority}</Chip.Label>
                          </Chip>
                        </Table.Cell>
                        <Table.Cell>
                          <Chip
                            color={task.completed ? "success" : "default"}
                            size="sm"
                            variant="secondary"
                          >
                            <Chip.Label>{task.completed ? "完了" : "未完了"}</Chip.Label>
                          </Chip>
                        </Table.Cell>
                      </Table.Row>
                    )}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          )}
        </Card.Content>
      </Card>
    );
  },
  description:
    "Task list with a built-in search box, priority filter, sort control, and priority/done status chips. Use this instead of Table to show, list, or filter tasks.",
  name: "TaskList",
  props: taskListPropsSchema,
});
