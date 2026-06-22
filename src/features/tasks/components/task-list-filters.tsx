import { Button, Input, ListBox, Select } from "@heroui/react";
import { cn } from "cnfast";

import {
  TASK_PRIORITIES,
  TASK_STATUS_FILTERS,
  TaskListFilterFormSchema,
  type TaskStatusFilter,
} from "~/features/tasks/api/task-model";
import type { useTaskListFilters } from "~/features/tasks/hooks/use-tasks-list-filters";

const STATUS_LABELS = {
  active: "Open",
  all: "All",
  completed: "Done",
} as const satisfies Record<TaskStatusFilter, string>;

export function TaskListFilters({
  form,
}: Record<"form", ReturnType<typeof useTaskListFilters>["form"]>) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <form.Field name="status">
        {(field) => (
          <div aria-label="Task status" className="flex flex-wrap gap-2">
            {TASK_STATUS_FILTERS.map((status) => {
              const isSelected = field.state.value === status;

              return (
                <Button
                  aria-pressed={isSelected}
                  className={cn(
                    "min-h-10 rounded-md border px-3 text-sm font-medium",
                    isSelected
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100",
                  )}
                  key={status}
                  onPress={() => field.handleChange(status)}
                  type="button"
                  variant="secondary"
                >
                  {STATUS_LABELS[status]}
                </Button>
              );
            })}
          </div>
        )}
      </form.Field>
      <div className="flex flex-col gap-2 sm:flex-row">
        <form.Field name="search">
          {(field) => (
            <Input
              aria-label="Search tasks"
              className="sm:w-56"
              name={field.name}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder="Search title"
              value={field.state.value}
            />
          )}
        </form.Field>
        <form.Field name="priority">
          {(field) => (
            <Select
              aria-label="Priority filter"
              className="sm:w-40"
              onChange={(key) => {
                const parsed = TaskListFilterFormSchema.shape.priority.safeParse(key);

                if (parsed.success) {
                  field.handleChange(parsed.data);
                }
              }}
              value={field.state.value}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="all" textValue="all">
                    All priorities
                  </ListBox.Item>
                  {TASK_PRIORITIES.map((priority) => (
                    <ListBox.Item id={priority} key={priority} textValue={priority}>
                      {priority}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          )}
        </form.Field>
      </div>
    </div>
  );
}
