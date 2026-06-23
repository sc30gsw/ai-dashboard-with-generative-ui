import { Button, Input, Label, ListBox, Select, TextField } from "@heroui/react";

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
    <fieldset
      aria-label="Task filters"
      className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"
    >
      <form.Field name="status">
        {(field) => (
          <fieldset aria-label="Task status" className="flex flex-wrap gap-2">
            {TASK_STATUS_FILTERS.map((status) => {
              const isSelected = field.state.value === status;

              return (
                <Button
                  aria-pressed={isSelected}
                  key={status}
                  onPress={() => field.handleChange(status)}
                  type="button"
                  variant={isSelected ? "primary" : "secondary"}
                >
                  {STATUS_LABELS[status]}
                </Button>
              );
            })}
          </fieldset>
        )}
      </form.Field>
      <div className="flex flex-col gap-2 sm:flex-row">
        <form.Field name="search">
          {(field) => (
            <TextField className="sm:w-56">
              <Label className="sr-only">Search tasks</Label>
              <Input
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="Search title"
                value={field.state.value}
              />
            </TextField>
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
    </fieldset>
  );
}
