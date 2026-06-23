import { Chip } from "@heroui/react";

import type { TaskPriority } from "~/features/tasks/api/task-model";

const PRIORITY_COLOR = {
  high: "danger",
  low: "default",
  medium: "warning",
} as const satisfies Record<TaskPriority, "accent" | "danger" | "default" | "warning">;

export function PriorityChip({ priority }: Record<"priority", TaskPriority>) {
  return (
    <Chip color={PRIORITY_COLOR[priority]} size="sm" variant="secondary">
      <Chip.Label>{priority}</Chip.Label>
    </Chip>
  );
}
