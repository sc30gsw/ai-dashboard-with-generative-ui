import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { PRIORITIES, tasks } from "~/db/schema";

export const TASK_PRIORITIES = PRIORITIES;
export const TASK_PRIORITY_FILTERS = ["all", ...TASK_PRIORITIES] as const;
export const TASK_STATUS_FILTERS = ["all", "active", "completed"] as const;
export const TASK_SORT_BY_FIELDS = ["createdAt", "priority", "title"] as const;
export const TASK_SORT_DIRECTIONS = ["asc", "desc"] as const;
export const TASK_BOARD_SORTS = [
  "createdAt:asc",
  "createdAt:desc",
  "priority:asc",
  "title:asc",
] as const;

export const TaskSchema = createSelectSchema(tasks);

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
export type TaskViewToolOutput = z.infer<typeof TaskViewToolOutputSchema>;

export type TaskBoardItem = TaskView | TaskViewToolOutput;

export const TaskPrioritySchema = z.enum(TASK_PRIORITIES);
export const TaskPriorityFilterSchema = z.enum(TASK_PRIORITY_FILTERS);
export const TaskStatusFilterSchema = z.enum(TASK_STATUS_FILTERS);
export const TaskSortBySchema = z.enum(TASK_SORT_BY_FIELDS);
export const TaskSortDirectionSchema = z.enum(TASK_SORT_DIRECTIONS);
export const TaskBoardSortSchema = z.enum(TASK_BOARD_SORTS);

/** Treat null/blank as absent so LLM-generated empty search does not fail validation. */
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

export const BulkAddTaskItemSchema = CreateTaskSchema.extend({
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
    search: optionalNonEmptyString,
    searchTerms: z.array(z.string().trim().min(1)).min(1).optional(),
    status: TaskStatusFilterSchema.default("all"),
  })
  .refine(
    (input) =>
      input.search !== undefined ||
      (input.searchTerms?.length ?? 0) > 0 ||
      input.status === "completed" ||
      input.status === "active",
    "Provide search, searchTerms, or status filter (completed/active)",
  );

export const BulkDeleteTasksOutputSchema = z.object({
  deletedCount: z.number().int().nonnegative(),
});

/** Allows empty title while the user is still typing. */
export const CreateTaskDraftSchema = z.object({
  priority: TaskPrioritySchema,
  title: z.string(),
});

export const EditTaskFieldsSchema = CreateTaskSchema;

export const TaskListFilterFormSchema = z.object({
  priority: TaskPriorityFilterSchema,
  search: z.string(),
  status: TaskStatusFilterSchema,
});

export const TaskBoardFilterFormSchema = z.object({
  priority: TaskPriorityFilterSchema,
  search: z.string(),
  sort: TaskBoardSortSchema,
  status: TaskStatusFilterSchema,
});

export const defaultCreateTaskFormValues = {
  priority: "medium",
  title: "",
} satisfies CreateTaskDraftInput;

export const defaultTaskListFilterFormValues = {
  priority: "all",
  search: "",
  status: "all",
} as const satisfies TaskListFilterFormValues;

export function boardFilterFormDefaults(filters: ListTasksInput) {
  return {
    priority: filters.priority ?? "all",
    search: filters.search ?? "",
    sort: TaskBoardFilterFormSchema.shape.sort.parse(`${filters.sortBy}:${filters.sortDirection}`),
    status: filters.status,
  } satisfies TaskBoardFilterFormValues;
}

export function listInputFromBoardFilterForm(value: TaskBoardFilterFormValues) {
  const [sortBy, sortDirection] = value.sort.split(":");

  return ListTasksSchema.parse({
    priority: value.priority === "all" ? undefined : value.priority,
    search: value.search,
    sortBy,
    sortDirection,
    status: value.status,
  });
}

export const CompleteTaskSchema = z.object({
  id: z.string().min(1),
});

export const ListTasksSchema = z.object({
  priority: TaskPrioritySchema.optional(),
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

export const TaskModel = {
  bulkAddBody: BulkAddTasksSchema,
  bulkDeleteBody: BulkDeleteTasksSchema,
  bulkUpdateBody: BulkUpdateTasksSchema,
  completeBody: CompleteTaskSchema,
  createBody: CreateTaskSchema,
  deleteAllBody: DeleteAllTasksSchema,
  deleteBody: DeleteTaskSchema,
  listBody: ListTasksSchema,
  task: TaskSchema,
  taskView: TaskViewSchema,
  updateBody: UpdateTaskSchema,
} as const satisfies Record<string, z.ZodSchema<any>>;

export type Task = z.infer<typeof TaskSchema>;
export type TaskPriority = Task["priority"];
export type TaskPriorityFilter = z.infer<typeof TaskPriorityFilterSchema>;
export type TaskStatusFilter = z.infer<typeof TaskStatusFilterSchema>;
export type TaskSortBy = z.infer<typeof TaskSortBySchema>;
export type TaskSortDirection = z.infer<typeof TaskSortDirectionSchema>;
export type TaskBoardSort = z.infer<typeof TaskBoardSortSchema>;
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type BulkAddTasksInput = z.infer<typeof BulkAddTasksSchema>;
export type BulkAddTasksOutput = z.infer<typeof BulkAddTasksOutputSchema>;
export type BulkUpdateTasksInput = z.infer<typeof BulkUpdateTasksSchema>;
export type BulkUpdateTasksOutput = z.infer<typeof BulkUpdateTasksOutputSchema>;
export type BulkDeleteTasksInput = z.infer<typeof BulkDeleteTasksSchema>;
export type BulkDeleteTasksOutput = z.infer<typeof BulkDeleteTasksOutputSchema>;
export type CreateTaskDraftInput = z.infer<typeof CreateTaskDraftSchema>;
export type CompleteTaskInput = z.infer<typeof CompleteTaskSchema>;
export type DeleteTaskInput = z.infer<typeof DeleteTaskSchema>;
export type DeleteAllTasksOutput = z.infer<typeof DeleteAllTasksOutputSchema>;
export type ListTasksInput = z.infer<typeof ListTasksSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
export type TaskListFilterFormValues = z.infer<typeof TaskListFilterFormSchema>;
export type TaskBoardFilterFormValues = z.infer<typeof TaskBoardFilterFormSchema>;

export const TASK_PRIORITY_RANK = {
  high: 0,
  medium: 1,
  low: 2,
} as const satisfies Record<TaskPriority, number>;
