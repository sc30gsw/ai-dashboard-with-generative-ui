import { Result } from "better-result";
import { Elysia } from "elysia";

import {
  BulkAddTasksSchema,
  BulkDeleteTasksSchema,
  BulkUpdateTasksSchema,
  CompleteTaskSchema,
  CreateTaskSchema,
  DeleteAllTasksSchema,
  DeleteTaskSchema,
  ListTasksSchema,
  UpdateTaskSchema,
} from "~/features/tasks/api/task-model";
import { TaskService } from "~/features/tasks/api/task-service";

//? 内部の TaskError メッセージをクライアントへ漏らさないための汎用メッセージ。
const GENERIC_ERROR_MESSAGE = "操作に失敗しました。";

//? 詳細はサーバー側に残し、クライアントには汎用メッセージのみ返す。
//? 応答 SHAPE（{ ok: false, message }）は維持し、Eden クライアント / collection / tool 側の data.ok・data.message 依存を壊さない。
function errorResponse(error: Record<"message", string>) {
  console.error("[task-routes]", error.message);

  return { message: GENERIC_ERROR_MESSAGE, ok: false as const };
}

export const taskRoutes = new Elysia({ prefix: "/tasks" })
  .get("/list", async () => {
    const result = await TaskService.list(ListTasksSchema.parse({}));

    return Result.isError(result)
      ? errorResponse(result.error)
      : { ok: true as const, tasks: result.value };
  })
  .post(
    "/list",
    async ({ body }) => {
      const result = await TaskService.list(body);

      return Result.isError(result)
        ? errorResponse(result.error)
        : { ok: true as const, tasks: result.value };
    },
    { body: ListTasksSchema },
  )
  .post(
    "/add",
    async ({ body }) => {
      const result = await TaskService.add(body);

      return Result.isError(result)
        ? errorResponse(result.error)
        : { ok: true as const, task: result.value };
    },
    { body: CreateTaskSchema },
  )
  .post(
    "/bulk-add",
    async ({ body }) => {
      const result = await TaskService.bulkAdd(body.tasks);

      return Result.isError(result)
        ? errorResponse(result.error)
        : { ok: true as const, result: result.value };
    },
    { body: BulkAddTasksSchema },
  )
  .post(
    "/bulk-update",
    async ({ body }) => {
      const result = await TaskService.bulkUpdate(body);

      return Result.isError(result)
        ? errorResponse(result.error)
        : { ok: true as const, result: result.value };
    },
    { body: BulkUpdateTasksSchema },
  )
  .post(
    "/bulk-delete",
    async ({ body }) => {
      const result = await TaskService.bulkDelete(body);

      return Result.isError(result)
        ? errorResponse(result.error)
        : { ok: true as const, result: result.value };
    },
    { body: BulkDeleteTasksSchema },
  )
  .post(
    "/complete",
    async ({ body }) => {
      const result = await TaskService.complete(body.id);

      return Result.isError(result)
        ? errorResponse(result.error)
        : { ok: true as const, task: result.value };
    },
    { body: CompleteTaskSchema },
  )
  .post(
    "/update",
    async ({ body }) => {
      const result = await TaskService.update(body);

      return Result.isError(result)
        ? errorResponse(result.error)
        : { ok: true as const, task: result.value };
    },
    { body: UpdateTaskSchema },
  )
  .post(
    "/delete",
    async ({ body }) => {
      const result = await TaskService.delete(body.id);

      return Result.isError(result)
        ? errorResponse(result.error)
        : { ok: true as const, task: result.value };
    },
    { body: DeleteTaskSchema },
  )
  .post(
    "/delete-all",
    async () => {
      const result = await TaskService.deleteAll();

      return Result.isError(result)
        ? errorResponse(result.error)
        : { ok: true as const, result: result.value };
    },
    { body: DeleteAllTasksSchema },
  );
