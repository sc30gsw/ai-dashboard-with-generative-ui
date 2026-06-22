import { TaskViewSchema, type TaskPriority, type TaskView } from "~/features/tasks/api/task-model";

export const prioritySchema = TaskViewSchema.shape.priority;
export const taskItemSchema = TaskViewSchema;

export type Priority = TaskPriority;
export type TaskItem = TaskView;

export const priorityLabels = {
  high: "High",
  low: "Low",
  medium: "Medium",
} as const satisfies Record<Priority, string>;

export const priorityTone = {
  high: "border-red-300 bg-red-50 text-red-800",
  low: "border-slate-300 bg-slate-50 text-slate-700",
  medium: "border-amber-300 bg-amber-50 text-amber-800",
} as const satisfies Record<Priority, string>;
