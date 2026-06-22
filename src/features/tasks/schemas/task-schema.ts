import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { PRIORITIES, tasks } from "~/db/schema";

// Task shape derived from the Drizzle table via drizzle-zod (Zod, single validator).
export const TaskSchema = createSelectSchema(tasks);

// Input boundaries authored in Zod; reused for Elysia body validation AND tool inputSchema.
export const CreateTaskSchema = z.object({
  priority: z.enum(PRIORITIES),
  title: z.string().min(1, "Title is required"),
});

export const CompleteTaskSchema = z.object({
  id: z.string().min(1),
});

export type Task = z.infer<typeof TaskSchema>;
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type CompleteTaskInput = z.infer<typeof CompleteTaskSchema>;
