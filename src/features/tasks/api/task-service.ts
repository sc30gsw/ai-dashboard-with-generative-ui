import { Result, TaggedError } from "better-result";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";

import { db } from "~/db";
import { tasks } from "~/db/schema";
import { likeContainsPattern } from "~/features/tasks/api/like-search";
import type {
  BulkAddTasksInput,
  BulkDeleteTasksInput,
  BulkUpdateTasksInput,
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

function titleLikeCondition(term: string) {
  const pattern = likeContainsPattern(term);

  return sql`${tasks.title} LIKE ${pattern} ESCAPE '\\'`;
}

function titleSearchFilter(search?: string, searchTerms?: string[]) {
  if (searchTerms && searchTerms.length > 0) {
    return or(...searchTerms.map((term) => titleLikeCondition(term)));
  }

  if (search) {
    return titleLikeCondition(search);
  }

  return undefined;
}

function statusFilters(input: { status: ListTasksInput["status"] }) {
  return [
    input.status === "active" ? eq(tasks.completed, false) : undefined,
    input.status === "completed" ? eq(tasks.completed, true) : undefined,
  ].filter((filter) => filter !== undefined);
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

  static bulkAdd(inputs: BulkAddTasksInput["tasks"]) {
    return Result.tryPromise({
      catch: (cause) => new TaskError({ cause, message: "Failed to bulk add tasks" }),
      try: async () => {
        const created = await db.insert(tasks).values(inputs).returning();

        return { addedCount: created.length, tasks: created };
      },
    });
  }

  static bulkUpdate(input: BulkUpdateTasksInput) {
    return Result.tryPromise({
      catch: (cause) => new TaskError({ cause, message: "Failed to bulk update tasks" }),
      try: async () => {
        const filters = [
          ...statusFilters(input),
          titleSearchFilter(input.search, input.searchTerms),
        ].filter((filter) => filter !== undefined);

        const matching = await db
          .select({ id: tasks.id })
          .from(tasks)
          .where(and(...filters));

        if (matching.length === 0) {
          return { tasks: [], updatedCount: 0 };
        }

        const updates: Partial<Pick<Task, "completed" | "priority" | "title">> = {};

        if (input.title !== undefined) {
          updates.title = input.title;
        }

        if (input.priority !== undefined) {
          updates.priority = input.priority;
        }

        if (input.completed !== undefined) {
          updates.completed = input.completed;
        }

        const updated = await db
          .update(tasks)
          .set(updates)
          .where(
            inArray(
              tasks.id,
              matching.map((row) => row.id),
            ),
          )
          .returning();

        return { tasks: updated, updatedCount: updated.length };
      },
    });
  }

  static bulkDelete(input: BulkDeleteTasksInput) {
    return Result.tryPromise({
      catch: (cause) => new TaskError({ cause, message: "Failed to bulk delete tasks" }),
      try: async () => {
        const filters = [
          ...statusFilters(input),
          input.priority ? eq(tasks.priority, input.priority) : undefined,
          titleSearchFilter(input.search, input.searchTerms),
        ].filter((filter) => filter !== undefined);

        const deleted = await db
          .delete(tasks)
          .where(and(...filters))
          .returning();

        return { deletedCount: deleted.length };
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
          titleSearchFilter(input.search, input.searchTerms),
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
        const updates: Partial<Pick<Task, "completed" | "priority" | "title">> = {};

        if (input.title !== undefined) {
          updates.title = input.title;
        }

        if (input.priority !== undefined) {
          updates.priority = input.priority;
        }

        if (input.completed !== undefined) {
          updates.completed = input.completed;
        }

        const [task] = await db
          .update(tasks)
          .set(updates)
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

  static deleteAll() {
    return Result.tryPromise({
      catch: (cause) => new TaskError({ cause, message: "Failed to delete all tasks" }),
      try: async () => {
        const deleted = await db.delete(tasks).returning();

        return { deletedCount: deleted.length };
      },
    });
  }
}
