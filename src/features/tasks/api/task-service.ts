import { Result, TaggedError } from "better-result";
import { and, asc, desc, eq, like, sql } from "drizzle-orm";

import { db } from "~/db";
import { tasks } from "~/db/schema";
import type {
  CreateTaskInput,
  ListTasksInput,
  Task,
  UpdateTaskInput,
} from "~/features/tasks/api/task-model";
import { TASK_PRIORITIES, TASK_PRIORITY_RANK } from "~/features/tasks/api/task-model";

class TaskError extends TaggedError("TaskError")<{
  cause?: unknown;
  message: string;
}>() {}

const priorityRank = sql<number>`case ${tasks.priority}
  ${sql.join(
    TASK_PRIORITIES.map((priority) => sql`when ${priority} then ${TASK_PRIORITY_RANK[priority]}`),
    sql.raw(" "),
  )}
end`;

function orderFor(input: ListTasksInput) {
  const direction = input.sortDirection === "desc" ? desc : asc;

  if (input.sortBy === "priority") {
    return direction(priorityRank);
  }

  if (input.sortBy === "title") {
    return direction(tasks.title);
  }

  return direction(tasks.createdAt);
}

export abstract class TaskService {
  static add(input: CreateTaskInput) {
    return Result.tryPromise({
      catch: (cause) => new TaskError({ cause, message: "Failed to add task" }),
      try: async () => {
        const [task] = await db.insert(tasks).values(input).returning();

        if (!task) {
          throw new Error("Failed to add task");
        }

        return task;
      },
    });
  }

  static list(input: ListTasksInput) {
    return Result.tryPromise({
      catch: (cause) => new TaskError({ cause, message: "Failed to list tasks" }),
      try: () => {
        const filters = [
          input.status === "active" ? eq(tasks.completed, false) : undefined,
          input.status === "completed" ? eq(tasks.completed, true) : undefined,
          input.priority ? eq(tasks.priority, input.priority) : undefined,
          input.search ? like(tasks.title, `%${input.search}%`) : undefined,
        ].filter((filter) => filter !== undefined);

        return db
          .select()
          .from(tasks)
          .where(filters.length ? and(...filters) : undefined)
          .orderBy(orderFor(input), asc(tasks.createdAt));
      },
    });
  }

  static complete(id: Task["id"]) {
    return Result.tryPromise({
      catch: (cause) => new TaskError({ cause, message: "Failed to complete task" }),
      try: async () => {
        const [task] = await db
          .update(tasks)
          .set({ completed: true })
          .where(eq(tasks.id, id))
          .returning();

        if (!task) {
          throw new Error("Task not found");
        }

        return task;
      },
    });
  }

  static update(input: UpdateTaskInput) {
    return Result.tryPromise({
      catch: (cause) => new TaskError({ cause, message: "Failed to update task" }),
      try: async () => {
        const [task] = await db
          .update(tasks)
          .set({
            completed: input.completed,
            priority: input.priority,
            title: input.title,
          })
          .where(eq(tasks.id, input.id))
          .returning();

        if (!task) {
          throw new Error("Task not found");
        }

        return task;
      },
    });
  }

  static delete(id: Task["id"]) {
    return Result.tryPromise({
      catch: (cause) => new TaskError({ cause, message: "Failed to delete task" }),
      try: async () => {
        const [task] = await db.delete(tasks).where(eq(tasks.id, id)).returning();

        if (!task) {
          throw new Error("Task not found");
        }

        return task;
      },
    });
  }
}
