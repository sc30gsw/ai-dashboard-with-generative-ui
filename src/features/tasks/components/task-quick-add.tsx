import { Button, FieldError, Input, Label, ListBox, Select, TextField, toast } from "@heroui/react";
import { useForm } from "@tanstack/react-form";
import { Result } from "better-result";

import {
  CreateTaskDraftSchema,
  CreateTaskSchema,
  TASK_PRIORITIES,
  type TaskPriority,
} from "~/features/tasks/api/task-model";
import { tasksCollection } from "~/features/tasks/collections/tasks-collection";
import { runTaskMutationSync } from "~/features/tasks/utils/run-task-mutation";

function formatFieldError(error: unknown) {
  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return String(error);
}

export function TaskQuickAdd() {
  const form = useForm({
    defaultValues: {
      priority: "medium" as TaskPriority,
      title: "",
    },
    validators: {
      onChange: CreateTaskDraftSchema,
      onSubmit: CreateTaskSchema,
    },
    onSubmit: ({ value, formApi }) => {
      const result = runTaskMutationSync(() =>
        tasksCollection.insert({
          completed: false,
          createdAt: new Date(),
          id: crypto.randomUUID(),
          priority: value.priority,
          title: value.title.trim(),
        }),
      );

      if (Result.isError(result)) {
        return result.error.message;
      }

      //? 楽観的 insert は即時反映。API 失敗時は TanStack DB が自動ロールバックするので、
      //? ユーザーへは toast でフィードバックする（rejection を握りつぶさない）。
      result.value.isPersisted.promise.catch(() => {
        toast.danger("タスクの追加に失敗しました。");
      });

      formApi.reset();
    },
  });

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <form.Field name="title">
          {(field) => (
            <TextField className="flex-1" isInvalid={!field.state.meta.isValid}>
              <Label className="sr-only">Task title</Label>
              <Input
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="New task title"
                value={field.state.value}
              />
              {!field.state.meta.isValid ? (
                <FieldError>
                  {field.state.meta.errors.map((error) => formatFieldError(error)).join(", ")}
                </FieldError>
              ) : null}
            </TextField>
          )}
        </form.Field>
        <form.Field name="priority">
          {(field) => (
            <Select
              aria-label="Priority"
              className="w-full sm:w-40"
              onChange={(key) => {
                const parsed = CreateTaskDraftSchema.shape.priority.safeParse(key);

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
                  {TASK_PRIORITIES.map((value) => (
                    <ListBox.Item id={value} key={value} textValue={value}>
                      {value}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          )}
        </form.Field>
        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
          {([canSubmit, isSubmitting]) => (
            <Button isDisabled={!canSubmit || isSubmitting} type="submit">
              {isSubmitting ? "Adding..." : "Add task"}
            </Button>
          )}
        </form.Subscribe>
      </div>
      <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
        {(submitError) =>
          submitError ? (
            <p className="text-sm text-red-600" role="alert">
              {formatFieldError(submitError)}
            </p>
          ) : null
        }
      </form.Subscribe>
    </form>
  );
}
