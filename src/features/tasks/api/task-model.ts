import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { PRIORITIES, tasks } from "~/db/schema";

export const TASK_PRIORITIES = PRIORITIES;
const TASK_PRIORITY_FILTERS = ["all", ...TASK_PRIORITIES] as const;
export const TASK_STATUS_FILTERS = ["all", "active", "completed"] as const;
const TASK_SORT_BY_FIELDS = ["createdAt", "priority", "title"] as const;
const TASK_SORT_DIRECTIONS = ["asc", "desc"] as const;

const TaskSchema = createSelectSchema(tasks);

export const TaskViewSchema = TaskSchema.pick({
  completed: true,
  createdAt: true,
  id: true,
  priority: true,
  title: true,
});
export type TaskView = z.infer<typeof TaskViewSchema>;

//? ツール/承認カードが扱う最小ビュー（createdAt 抜き）への正規化。
//? AI SDK アダプタ・Web MCP アダプタ双方が共有する単一の変換。
export function toTaskView(task: Pick<TaskView, "completed" | "id" | "priority" | "title">) {
  return {
    completed: task.completed,
    id: task.id,
    priority: task.priority,
    title: task.title,
  };
}

export const TaskViewToolOutputSchema = TaskViewSchema.omit({ createdAt: true }).extend({
  createdAt: z.iso.datetime(),
});

const TaskPrioritySchema = z.enum(TASK_PRIORITIES);
const TaskPriorityFilterSchema = z.enum(TASK_PRIORITY_FILTERS);
const TaskStatusFilterSchema = z.enum(TASK_STATUS_FILTERS);
const TaskSortBySchema = z.enum(TASK_SORT_BY_FIELDS);
const TaskSortDirectionSchema = z.enum(TASK_SORT_DIRECTIONS);

const optionalNonEmptyString = z.preprocess(
  (value) =>
    value === null || value === undefined || (typeof value === "string" && value.trim() === "")
      ? undefined
      : value,
  z.string().trim().min(1).optional(),
);

export const CreateTaskSchema = z.object({
  priority: TaskPrioritySchema,
  title: z.string().trim().min(1, "Title is required"),
});

//? AI SDK の add_task 入力。ユーザーが優先度を言わなくてもモデルが止まらないよう medium 既定。
//? eden 経由の addTaskTool は CreateTaskSchema（priority 必須）のまま。
export const AddTaskToolInputSchema = CreateTaskSchema.extend({
  priority: TaskPrioritySchema.default("medium"),
});

//? AI SDK の単一対象 update 入力。モデルは id を書かず sourceTitle で対象を指す
//? （アダプタが execute 内で実 id を解決）。eden 経由の updateTaskTool は id ベース。
export const UpdateTaskToolInputSchema = z
  .object({
    completed: z.boolean().optional().describe("Set completion state"),
    priority: TaskPrioritySchema.optional().describe("New priority"),
    sourceTitle: z.string().trim().min(1).describe("Current title of the task to update"),
    title: z.string().trim().min(1).optional().describe("New title (rename)"),
  })
  .refine(
    (value) =>
      value.title !== undefined || value.priority !== undefined || value.completed !== undefined,
    "Provide at least one field to update",
  );

const BulkAddTaskItemSchema = CreateTaskSchema.extend({
  completed: z.boolean().optional(),
});

export const BulkAddTasksSchema = z.object({
  tasks: z.array(BulkAddTaskItemSchema).min(1).max(50),
});

export const BulkAddTasksOutputSchema = z.object({
  addedCount: z.number().int().nonnegative(),
  tasks: z.array(TaskViewToolOutputSchema),
});

export const BulkUpdateTasksSchema = z
  .object({
    //? 全件適用（フィルタなし）の明示意図。未指定で filters が空なら service 層が throw する。
    confirmAll: z.boolean().optional(),
    completed: z.boolean().optional(),
    //? 設定値（SET）: 一致タスクをこの priority にする。
    priority: TaskPrioritySchema.optional(),
    //? 絞り込み（FILTER）: この priority のタスクだけを対象にする。priority(SET) とは別キー。
    priorityFilter: TaskPrioritySchema.optional(),
    search: optionalNonEmptyString,
    searchTerms: z.array(z.string().trim().min(1)).min(1).optional(),
    status: TaskStatusFilterSchema.default("all"),
    title: z.string().trim().min(1).optional(),
  })
  .refine(
    (input) =>
      input.title !== undefined || input.priority !== undefined || input.completed !== undefined,
    "Provide at least one field to update",
  );

export const BulkUpdateTasksOutputSchema = z.object({
  tasks: z.array(TaskViewToolOutputSchema),
  updatedCount: z.number().int().nonnegative(),
});

export const BulkDeleteTasksSchema = z
  .object({
    priority: TaskPrioritySchema.optional(),
    search: optionalNonEmptyString,
    searchTerms: z.array(z.string().trim().min(1)).min(1).optional(),
    status: TaskStatusFilterSchema.default("all"),
  })
  .refine(
    (input) =>
      input.search !== undefined ||
      (input.searchTerms?.length ?? 0) > 0 ||
      input.status === "completed" ||
      input.status === "active" ||
      input.priority !== undefined,
    "Provide search, searchTerms, status filter (completed/active), or priority",
  );

export const BulkDeleteTasksOutputSchema = z.object({
  deletedCount: z.number().int().nonnegative(),
});

export const CreateTaskDraftSchema = z.object({
  priority: TaskPrioritySchema,
  title: z.string(),
});

export const TaskListFilterFormSchema = z.object({
  priority: TaskPriorityFilterSchema,
  search: z.string(),
  status: TaskStatusFilterSchema,
});

export const CompleteTaskSchema = z.object({
  id: z.string().min(1),
});

export const ListTasksSchema = z.object({
  priority: TaskPrioritySchema.optional(),
  refreshKey: z.string().optional(),
  search: optionalNonEmptyString,
  searchTerms: z.array(z.string().trim().min(1)).min(1).optional(),
  sortBy: TaskSortBySchema.default("createdAt"),
  sortDirection: TaskSortDirectionSchema.default("asc"),
  status: TaskStatusFilterSchema.default("all"),
});

export const defaultListTasksSchema = {
  priority: undefined,
  search: undefined,
  sortBy: "createdAt",
  sortDirection: "asc",
  status: "all",
} as const satisfies ListTasksInput;

export const UpdateTaskSchema = z
  .object({
    completed: z.boolean().optional(),
    id: z.string().min(1),
    priority: TaskPrioritySchema.optional(),
    title: z.string().trim().min(1, "Title is required").optional(),
  })
  .refine(
    (input) =>
      input.title !== undefined || input.priority !== undefined || input.completed !== undefined,
    "Provide at least one task field to update",
  );

export const DeleteTaskSchema = z.object({
  id: z.string().min(1),
});

export const DeleteAllTasksSchema = z.object({});

export const DeleteAllTasksOutputSchema = z.object({
  deletedCount: z.number().int().nonnegative(),
});

export type Task = z.infer<typeof TaskSchema>;
export type TaskPriority = Task["priority"];
export type TaskPriorityFilter = z.infer<typeof TaskPriorityFilterSchema>;
export type TaskStatusFilter = z.infer<typeof TaskStatusFilterSchema>;
export type TaskSortDirection = z.infer<typeof TaskSortDirectionSchema>;
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type BulkAddTasksInput = z.infer<typeof BulkAddTasksSchema>;
export type BulkUpdateTasksInput = z.infer<typeof BulkUpdateTasksSchema>;
export type BulkDeleteTasksInput = z.infer<typeof BulkDeleteTasksSchema>;
export type ListTasksInput = z.infer<typeof ListTasksSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
export type TaskListFilterFormValues = z.infer<typeof TaskListFilterFormSchema>;

export const TASK_PRIORITY_RANK = {
  high: 0,
  medium: 1,
  low: 2,
} as const satisfies Record<TaskPriority, number>;
