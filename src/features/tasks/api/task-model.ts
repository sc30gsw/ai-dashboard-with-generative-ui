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

export const TaskViewToolOutputSchema = TaskViewSchema.omit({ createdAt: true }).extend({
  createdAt: z.iso.datetime(),
});

export const TaskPrioritySchema = z.enum(TASK_PRIORITIES);
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
    completed: z.boolean().optional(),
    priority: TaskPrioritySchema.optional(),
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
