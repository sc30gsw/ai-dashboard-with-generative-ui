import { SelectField } from "~/features/chat/genui/task-board-select-field";
import { priorityLabels, type Priority } from "~/features/chat/genui/task-board-types";
import { TASK_PRIORITIES } from "~/features/tasks/api/task-model";

export type PrioritySelectProps = {
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: Priority;
};

export function PrioritySelect({ id, label, onChange, value }: PrioritySelectProps) {
  return (
    <SelectField
      id={id}
      label={label}
      onChange={onChange}
      options={TASK_PRIORITIES.map((priority) => [priority, priorityLabels[priority]])}
      value={value}
    />
  );
}
