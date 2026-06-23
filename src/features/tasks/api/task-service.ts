import { Result, TaggedError } from "better-result";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { filter, isDefined, pickBy } from "remeda";

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

function compactFilters<T>(items: (T | undefined)[]) {
  return filter(items, isDefined);
}

function statusFilters(input: { status: ListTasksInput["status"] }) {
  return compactFilters([
    input.status === "active" ? eq(tasks.completed, false) : undefined,
    input.status === "completed" ? eq(tasks.completed, true) : undefined,
  ]);
}

function taskUpdates(input: Pick<BulkUpdateTasksInput, "completed" | "priority" | "title">) {
  return pickBy(
    { completed: input.completed, priority: input.priority, title: input.title },
    (value) => value !== undefined,
  );
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
        const filters = compactFilters([
          ...statusFilters(input),
          input.priorityFilter ? eq(tasks.priority, input.priorityFilter) : undefined,
          titleSearchFilter(input.search, input.searchTerms),
        ]);

        //? 空フィルタは全件 UPDATE になる。confirmAll が明示されない限り拒否する（schema 非依存の防御）。
        if (filters.length === 0 && !input.confirmAll) {
          throw new Error(
            "Bulk update requires a filter (priorityFilter/status/search) or confirmAll: true",
          );
        }

        const matching = await db
          .select({ id: tasks.id })
          .from(tasks)
          .where(filters.length ? and(...filters) : undefined);

        if (matching.length === 0) {
          return { tasks: [], updatedCount: 0 };
        }

        const updates = taskUpdates(input);

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
        const filters = compactFilters([
          ...statusFilters(input),
          input.priority ? eq(tasks.priority, input.priority) : undefined,
          titleSearchFilter(input.search, input.searchTerms),
        ]);

        //? 空フィルタは and() が undefined になり全件 DELETE になる。delete に confirmAll の概念は無く、
        //? 真に空のフィルタは正当な用途が無いため拒否する（schema の refine 非依存の防御）。
        if (filters.length === 0) {
          throw new Error("Bulk delete requires a filter");
        }

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
        const filters = compactFilters([
          input.status === "active" ? eq(tasks.completed, false) : undefined,
          input.status === "completed" ? eq(tasks.completed, true) : undefined,
          input.priority ? eq(tasks.priority, input.priority) : undefined,
          titleSearchFilter(input.search, input.searchTerms),
        ]);

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
        const updates = taskUpdates(input);

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
