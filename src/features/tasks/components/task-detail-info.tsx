import { Button, ButtonGroup, Chip, Code, Fieldset, Label, Paragraph } from "@heroui/react";

import type { TaskView } from "~/features/tasks/api/task-model";
import { PriorityChip } from "~/features/tasks/components/priority-chip";
import { TaskDeleteDialog } from "~/features/tasks/components/task-delete-dialog";

export function TaskDetailInfo({ onEdit, task }: { onEdit: () => void; task: TaskView }) {
  return (
    <Fieldset className="flex flex-col gap-4">
      <Fieldset.Group className="flex items-center gap-2">
        <Label className="text-muted text-sm">Priority</Label>
        <PriorityChip priority={task.priority} />
      </Fieldset.Group>
      <Fieldset.Group className="flex items-center gap-2">
        <Label className="text-muted text-sm">Status</Label>
        <Chip color={task.completed ? "success" : "default"} size="sm" variant="secondary">
          <Chip.Label>{task.completed ? "Done" : "Open"}</Chip.Label>
        </Chip>
      </Fieldset.Group>
      <Fieldset.Group className="flex items-center gap-2">
        <Label className="text-muted text-sm">Created</Label>
        <Paragraph size="sm">{task.createdAt.toLocaleString()}</Paragraph>
      </Fieldset.Group>
      <Fieldset.Group className="flex items-center gap-2">
        <Label className="text-muted text-sm">ID</Label>
        <Code>{task.id}</Code>
      </Fieldset.Group>
      <Fieldset.Actions>
        <ButtonGroup>
          <Button variant="secondary" onPress={onEdit}>
            Edit
          </Button>
          <TaskDeleteDialog task={task} />
        </ButtonGroup>
      </Fieldset.Actions>
    </Fieldset>
  );
}
