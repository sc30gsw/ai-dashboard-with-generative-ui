import { useForm } from "@tanstack/react-form";
import { getRouteApi } from "@tanstack/react-router";

import { SelectField } from "~/features/chat/genui/task-board-select-field";
import { TextField } from "~/features/chat/genui/task-board-text-field";
import { priorityLabels } from "~/features/chat/genui/task-board-types";
import {
  boardFilterFormDefaults,
  listInputFromBoardFilterForm,
  TASK_BOARD_SORTS,
  TASK_PRIORITIES,
  TASK_STATUS_FILTERS,
  TaskBoardFilterFormSchema,
  type TaskBoardSort,
  type TaskStatusFilter,
  type ListTasksInput,
  type TaskBoardFilterFormValues,
} from "~/features/tasks/api/task-model";

const STATUS_LABLELS = {
  active: "Active",
  all: "All",
  completed: "Completed",
} as const satisfies Record<TaskStatusFilter, string>;

const SORT_LABELS = {
  "createdAt:asc": "Oldest",
  "createdAt:desc": "Newest",
  "priority:asc": "Priority",
  "title:asc": "Title",
} as const satisfies Record<TaskBoardSort, string>;

const routeApi = getRouteApi("/_app/chat");

export type FilterTaskFormProps = {
  filters: ListTasksInput;
  isDisabled: boolean;
  onApplied: () => void;
  searchKey: string;
};

export function FilterTaskForm({ filters, isDisabled, onApplied, searchKey }: FilterTaskFormProps) {
  const navigate = routeApi.useNavigate();

  return (
    <FilterTaskFormInner
      filters={filters}
      isDisabled={isDisabled}
      key={searchKey}
      onSubmit={(value) => {
        void navigate({
          replace: true,
          search: listInputFromBoardFilterForm(value),
        });
        onApplied();
      }}
    />
  );
}

type FilterTaskFormInnerProps = {
  filters: ListTasksInput;
  isDisabled: boolean;
  onSubmit: (value: TaskBoardFilterFormValues) => void;
};

function FilterTaskFormInner({ filters, isDisabled, onSubmit }: FilterTaskFormInnerProps) {
  const form = useForm({
    defaultValues: boardFilterFormDefaults(filters),
    validators: { onChange: TaskBoardFilterFormSchema },
    onSubmit: ({ value }) => {
      onSubmit(value);
    },
  });

  return (
    <form
      aria-label="Filter tasks"
      className="grid gap-3 border-b border-white/10 px-5 py-4 md:grid-cols-[1fr_9rem_9rem_9rem_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="search">
        {(field) => (
          <TextField
            id={field.name}
            label="Search"
            name={field.name}
            onBlur={field.handleBlur}
            onChange={field.handleChange}
            placeholder="Task title"
            value={field.state.value}
          />
        )}
      </form.Field>
      <form.Field name="status">
        {(field) => (
          <SelectField
            id={field.name}
            label="Status"
            onChange={(value) => {
              const parsed = TaskBoardFilterFormSchema.shape.status.safeParse(value);

              if (parsed.success) {
                field.handleChange(parsed.data);
              }
            }}
            options={TASK_STATUS_FILTERS.map((status) => [status, STATUS_LABLELS[status]])}
            value={field.state.value}
          />
        )}
      </form.Field>
      <form.Field name="priority">
        {(field) => (
          <SelectField
            id={field.name}
            label="Priority"
            onChange={(value) => {
              const parsed = TaskBoardFilterFormSchema.shape.priority.safeParse(value);

              if (parsed.success) {
                field.handleChange(parsed.data);
              }
            }}
            options={[
              ["all", "All"],
              ...TASK_PRIORITIES.map<[string, string]>((priority) => [
                priority,
                priorityLabels[priority],
              ]),
            ]}
            value={field.state.value}
          />
        )}
      </form.Field>
      <form.Field name="sort">
        {(field) => (
          <SelectField
            id={field.name}
            label="Sort"
            onChange={(value) => {
              const parsed = TaskBoardFilterFormSchema.shape.sort.safeParse(value);

              if (parsed.success) {
                field.handleChange(parsed.data);
              }
            }}
            options={TASK_BOARD_SORTS.map((sort) => [sort, SORT_LABELS[sort]])}
            value={field.state.value}
          />
        )}
      </form.Field>
      <button
        className="min-h-12 self-end rounded-md border border-zinc-600 px-4 font-medium text-zinc-100 outline-offset-2 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white disabled:opacity-50"
        disabled={isDisabled}
        type="submit"
      >
        Apply
      </button>
    </form>
  );
}
