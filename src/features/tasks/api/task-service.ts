import { Result, TaggedError } from "better-result";
import { eq } from "drizzle-orm";

import { db } from "~/db";
import { tasks } from "~/db/schema";
import type { CreateTaskInput, Task } from "~/features/tasks/schemas/task-schema";

class TaskError extends TaggedError("TaskError")<{
  cause?: unknown;
  message: string;
}>() {}

export function addTask(input: CreateTaskInput) {
  return Result.tryPromise({
    catch: (cause) => new TaskError({ cause, message: "Failed to add task" }),
    try: async () => {
      const [task] = await db.insert(tasks).values(input).returning();

      return task;
    },
  });
}

export function listTasks() {
  return Result.tryPromise({
    catch: (cause) => new TaskError({ cause, message: "Failed to list tasks" }),
    try: () => db.select().from(tasks).orderBy(tasks.createdAt),
  });
}

export function completeTask(id: Task["id"]) {
  return Result.tryPromise({
    catch: (cause) => new TaskError({ cause, message: "Failed to complete task" }),
    try: async () => {
      const [task] = await db
        .update(tasks)
        .set({ completed: true })
        .where(eq(tasks.id, id))
        .returning();

      return task;
    },
  });
}
