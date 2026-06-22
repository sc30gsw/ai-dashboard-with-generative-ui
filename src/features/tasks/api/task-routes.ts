import { Result } from "better-result";
import { Elysia } from "elysia";

import {
  BulkAddTasksSchema,
  BulkUpdateTasksSchema,
  CompleteTaskSchema,
  CreateTaskSchema,
  DeleteAllTasksSchema,
  DeleteTaskSchema,
  ListTasksSchema,
  UpdateTaskSchema,
} from "~/features/tasks/api/task-model";
import { TaskService } from "~/features/tasks/api/task-service";

export const taskRoutes = new Elysia({ prefix: "/tasks" })
  .get("/list", async () => {
    const result = await TaskService.list(ListTasksSchema.parse({}));

    return Result.isError(result)
      ? { message: result.error.message, ok: false as const }
      : { ok: true as const, tasks: result.value };
  })
  .post(
    "/list",
    async ({ body }) => {
      const result = await TaskService.list(body);

      return Result.isError(result)
        ? { message: result.error.message, ok: false as const }
        : { ok: true as const, tasks: result.value };
    },
    { body: ListTasksSchema },
  )
  .post(
    "/add",
    async ({ body }) => {
      const result = await TaskService.add(body);

      return Result.isError(result)
        ? { message: result.error.message, ok: false as const }
        : { ok: true as const, task: result.value };
    },
    { body: CreateTaskSchema },
  )
  .post(
    "/bulk-add",
    async ({ body }) => {
      const result = await TaskService.bulkAdd(body.tasks);

      return Result.isError(result)
        ? { message: result.error.message, ok: false as const }
        : { ok: true as const, result: result.value };
    },
    { body: BulkAddTasksSchema },
  )
  .post(
    "/bulk-update",
    async ({ body }) => {
      const result = await TaskService.bulkUpdate(body);

      return Result.isError(result)
        ? { message: result.error.message, ok: false as const }
        : { ok: true as const, result: result.value };
    },
    { body: BulkUpdateTasksSchema },
  )
  .post(
    "/complete",
    async ({ body }) => {
      const result = await TaskService.complete(body.id);

      return Result.isError(result)
        ? { message: result.error.message, ok: false as const }
        : { ok: true as const, task: result.value };
    },
    { body: CompleteTaskSchema },
  )
  .post(
    "/update",
    async ({ body }) => {
      const result = await TaskService.update(body);

      return Result.isError(result)
        ? { message: result.error.message, ok: false as const }
        : { ok: true as const, task: result.value };
    },
    { body: UpdateTaskSchema },
  )
  .post(
    "/delete",
    async ({ body }) => {
      const result = await TaskService.delete(body.id);

      return Result.isError(result)
        ? { message: result.error.message, ok: false as const }
        : { ok: true as const, task: result.value };
    },
    { body: DeleteTaskSchema },
  )
  .post(
    "/delete-all",
    async () => {
      const result = await TaskService.deleteAll();

      return Result.isError(result)
        ? { message: result.error.message, ok: false as const }
        : { ok: true as const, result: result.value };
    },
    { body: DeleteAllTasksSchema },
  );
