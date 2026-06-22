import { useForm } from "@tanstack/react-form";

import { PrioritySelect } from "~/features/chat/genui/task-board-priority-select";
import { TextField } from "~/features/chat/genui/task-board-text-field";
import { prioritySchema, type Priority } from "~/features/chat/genui/task-board-types";
import {
  CreateTaskDraftSchema,
  CreateTaskSchema,
  type Task,
} from "~/features/tasks/api/task-model";

export type AddTaskFormProps = {
  initialPriority: Priority;
  initialTitle: string;
  isDisabled: boolean;
  onAdd: (task: Task) => Promise<void> | void;
};

export function AddTaskForm({
  initialPriority,
  initialTitle,
  isDisabled,
  onAdd,
}: AddTaskFormProps) {
  const form = useForm({
    defaultValues: {
      priority: initialPriority,
      title: initialTitle,
    },
    validators: {
      onChange: CreateTaskDraftSchema,
      onSubmit: CreateTaskSchema,
    },
    onSubmit: async ({ value }) => {
      const task = {
        completed: false,
        createdAt: new Date(),
        id: crypto.randomUUID(),
        priority: value.priority,
        title: value.title.trim(),
      } satisfies Task;

      await onAdd(task);
      form.reset();
    },
  });

  return (
    <form
      aria-label="Add task"
      className="grid gap-3 border-b border-white/10 px-5 py-4 md:grid-cols-[1fr_10rem_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="title">
        {(field) => (
          <TextField
            error={field.state.meta.errors.map((error) => error?.message).join(", ")}
            id={field.name}
            label="New task"
            name={field.name}
            onBlur={field.handleBlur}
            onChange={field.handleChange}
            placeholder="e.g. buy milk"
            required
            value={field.state.value}
          />
        )}
      </form.Field>
      <form.Field name="priority">
        {(field) => (
          <PrioritySelect
            id={field.name}
            label="Priority"
            onChange={(value) => {
              const parsed = prioritySchema.safeParse(value);

              if (parsed.success) {
                field.handleChange(parsed.data);
              }
            }}
            value={field.state.value}
          />
        )}
      </form.Field>
      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
        {([canSubmit, isSubmitting]) => (
          <button
            className="min-h-12 self-end rounded-md bg-white px-4 font-medium text-zinc-950 outline-offset-2 hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white disabled:opacity-50"
            disabled={!canSubmit || isDisabled}
            type="submit"
          >
            {isSubmitting ? "Adding..." : "Add"}
          </button>
        )}
      </form.Subscribe>
    </form>
  );
}
