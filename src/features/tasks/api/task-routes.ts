import { Result } from "better-result";
import { Elysia } from "elysia";

import { addTask, completeTask, listTasks } from "~/features/tasks/api/task-service";
import { CompleteTaskSchema, CreateTaskSchema } from "~/features/tasks/schemas/task-schema";

// Elysia consumes Zod directly via Standard Schema (no TypeBox). Result is
// converted to plain JSON at the boundary — never leak Result/class instances.
export const taskRoutes = new Elysia({ prefix: "/tasks" })
  .get("/list", async () => {
    const result = await listTasks();

    return Result.isError(result)
      ? { message: result.error.message, ok: false as const }
      : { ok: true as const, tasks: result.value };
  })
  .post(
    "/add",
    async ({ body }) => {
      const result = await addTask(body);

      return Result.isError(result)
        ? { message: result.error.message, ok: false as const }
        : { ok: true as const, task: result.value };
    },
    { body: CreateTaskSchema },
  )
  .post(
    "/complete",
    async ({ body }) => {
      const result = await completeTask(body.id);

      return Result.isError(result)
        ? { message: result.error.message, ok: false as const }
        : { ok: true as const, task: result.value };
    },
    { body: CompleteTaskSchema },
  );
