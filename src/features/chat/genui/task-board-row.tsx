import { useForm } from "@tanstack/react-form";
import { cn } from "cnfast";

import { PrioritySelect } from "~/features/chat/genui/task-board-priority-select";
import { TextField } from "~/features/chat/genui/task-board-text-field";
import {
  priorityLabels,
  prioritySchema,
  priorityTone,
  type TaskItem,
} from "~/features/chat/genui/task-board-types";
import { EditTaskFieldsSchema } from "~/features/tasks/api/task-model";

type TaskRowSaveInput = Pick<TaskItem, "priority" | "title">;

export type TaskRowProps = {
  isDisabled: boolean;
  isEditing: boolean;
  onCancelEdit: () => void;
  onDelete: () => Promise<void> | void;
  onEdit: () => void;
  onSave: (input: TaskRowSaveInput) => Promise<void> | void;
  onToggleComplete: () => Promise<void> | void;
  task: TaskItem;
};

export function TaskRow({
  isDisabled,
  isEditing,
  onCancelEdit,
  onDelete,
  onEdit,
  onSave,
  onToggleComplete,
  task,
}: TaskRowProps) {
  if (isEditing) {
    return (
      <TaskEditForm
        isDisabled={isDisabled}
        key={task.id}
        onCancel={onCancelEdit}
        onSave={onSave}
        task={task}
      />
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-[auto_1fr_auto] md:items-center">
      <button
        aria-pressed={task.completed}
        className={cn(
          "flex min-h-12 min-w-12 items-center justify-center rounded-md border text-sm font-semibold outline-offset-2 focus-visible:outline focus-visible:outline-white disabled:opacity-50",
          task.completed
            ? "border-emerald-400 bg-emerald-950 text-emerald-100"
            : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800",
        )}
        disabled={isDisabled}
        onClick={() => void onToggleComplete()}
        type="button"
      >
        {task.completed ? "Done" : "Open"}
      </button>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p
            className={cn(
              "text-base font-semibold wrap-break-word",
              task.completed && "line-through decoration-zinc-500",
            )}
          >
            {task.title}
          </p>
          <span
            className={cn(
              "rounded-md border px-2 py-1 text-xs font-medium",
              priorityTone[task.priority],
            )}
          >
            {priorityLabels[task.priority]}
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          {task.completed ? "Completed task" : "Active task"}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 md:justify-end">
        <button
          className="min-h-11 rounded-md border border-zinc-600 px-3 text-sm font-medium text-zinc-100 outline-offset-2 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-50"
          disabled={isDisabled}
          onClick={onEdit}
          type="button"
        >
          Edit
        </button>
        <button
          className="min-h-11 rounded-md border border-red-400/70 px-3 text-sm font-medium text-red-100 outline-offset-2 hover:bg-red-950 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-50"
          disabled={isDisabled}
          onClick={() => void onDelete()}
          type="button"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

type TaskEditFormProps = {
  isDisabled: boolean;
  onCancel: () => void;
  onSave: (input: TaskRowSaveInput) => Promise<void> | void;
  task: TaskItem;
};

function TaskEditForm({ isDisabled, onCancel, onSave, task }: TaskEditFormProps) {
  const form = useForm({
    defaultValues: {
      priority: task.priority,
      title: task.title,
    },
    validators: { onChange: EditTaskFieldsSchema },
    onSubmit: async ({ value }) => {
      await onSave({ priority: value.priority, title: value.title.trim() });
    },
  });

  return (
    <form
      className="grid gap-3 md:grid-cols-[1fr_10rem_auto_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="title">
        {(field) => (
          <TextField
            error={field.state.meta.errors.map((error) => error?.message).join(", ")}
            id={`edit-title-${task.id}`}
            label="Title"
            name={field.name}
            onBlur={field.handleBlur}
            onChange={field.handleChange}
            required
            value={field.state.value}
          />
        )}
      </form.Field>
      <form.Field name="priority">
        {(field) => (
          <PrioritySelect
            id={`edit-priority-${task.id}`}
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
            {isSubmitting ? "Saving..." : "Save"}
          </button>
        )}
      </form.Subscribe>
      <button
        className="min-h-12 self-end rounded-md border border-zinc-600 px-4 font-medium text-zinc-100 outline-offset-2 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
        onClick={onCancel}
        type="button"
      >
        Cancel
      </button>
    </form>
  );
}
