import { z } from "zod";

const taskRowSchema = z.object({
  id: z.string().describe("Task id"),
  title: z.string().describe("Task title"),
  priority: z.enum(["low", "medium", "high"]).describe("Priority level"),
  completed: z.boolean().describe("Whether the task is done"),
});

export const taskListPropsSchema = z.object({
  tasks: z
    .array(taskRowSchema)
    .describe("Tasks to display — pass the list_tasks Query result array"),
});

export type TaskRow = z.infer<typeof taskRowSchema>;
