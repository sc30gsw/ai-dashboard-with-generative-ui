import {
  Button,
  ButtonGroup,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  Select,
  TextField,
} from "@heroui/react";

import {
  CreateTaskDraftSchema,
  TASK_PRIORITIES,
  type TaskPriority,
} from "~/features/tasks/api/task-model";
import { withForm } from "~/features/tasks/hooks/form";

function formatFieldError(error: unknown) {
  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return String(error);
}

export const TaskDetailEditForm = withForm({
  defaultValues: {
    priority: "medium" as TaskPriority,
    title: "",
  },
  props: {
    onCancel: () => {},
  },
  render: function Render({ form, onCancel }) {
    return (
      <Form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field name="title">
          {(field) => (
            <TextField isInvalid={!field.state.meta.isValid}>
              <Label>Task title</Label>
              <Input
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="Task title"
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
            <TextField className="w-full sm:w-40">
              <Label>Priority</Label>
              <Select
                aria-label="Priority"
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
            </TextField>
          )}
        </form.Field>
        <ButtonGroup>
          <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
            {([canSubmit, isSubmitting]) => (
              <Button isDisabled={!canSubmit || isSubmitting} type="submit">
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
            )}
          </form.Subscribe>
          <Button type="button" variant="tertiary" onPress={onCancel}>
            Cancel
          </Button>
        </ButtonGroup>
        <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
          {(submitError) =>
            submitError ? <FieldError>{formatFieldError(submitError)}</FieldError> : null
          }
        </form.Subscribe>
      </Form>
    );
  },
});
