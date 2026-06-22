import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { PRIORITIES, tasks } from "~/db/schema";

export const TaskSchema = createSelectSchema(tasks);

export const TaskViewSchema = TaskSchema.pick({
  completed: true,
  createdAt: true,
  id: true,
  priority: true,
  title: true,
});

export const CreateTaskSchema = z.object({
  priority: z.enum(PRIORITIES),
  title: z.string().trim().min(1, "Title is required"),
});

export const EditTaskFieldsSchema = CreateTaskSchema;

export const TaskListFilterFormSchema = z.object({
  priority: z.enum(["all", ...PRIORITIES]),
  search: z.string(),
  status: z.enum(["all", "active", "completed"]),
});

export const TaskBoardFilterFormSchema = z.object({
  priority: z.enum(["all", ...PRIORITIES]),
  search: z.string(),
  sort: z.enum(["createdAt:asc", "createdAt:desc", "priority:asc", "title:asc"]),
  status: z.enum(["all", "active", "completed"]),
});

export const defaultCreateTaskFormValues = {
  priority: "medium",
  title: "",
} as const satisfies CreateTaskInput;

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

export function listInputFromBoardFilterForm(value: TaskBoardFilterFormValues){
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
  priority: z.enum(PRIORITIES).optional(),
  search: z.string().trim().optional(),
  sortBy: z.enum(["createdAt", "priority", "title"]).default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).default("asc"),
  status: z.enum(["all", "active", "completed"]).default("all"),
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
    priority: z.enum(PRIORITIES).optional(),
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

export const TaskModel = {
  completeBody: CompleteTaskSchema,
  createBody: CreateTaskSchema,
  deleteBody: DeleteTaskSchema,
  listBody: ListTasksSchema,
  task: TaskSchema,
  taskView: TaskViewSchema,
  updateBody: UpdateTaskSchema,
} as const satisfies Record<string, z.ZodSchema<any>>;

export type Task = z.infer<typeof TaskSchema>;
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type CompleteTaskInput = z.infer<typeof CompleteTaskSchema>;
export type DeleteTaskInput = z.infer<typeof DeleteTaskSchema>;
export type ListTasksInput = z.infer<typeof ListTasksSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
export type TaskListFilterFormValues = z.infer<typeof TaskListFilterFormSchema>;
export type TaskBoardFilterFormValues = z.infer<typeof TaskBoardFilterFormSchema>;
