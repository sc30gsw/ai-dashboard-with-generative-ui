import { tool, type ToolSet } from "ai";
import { Result } from "better-result";
import { z } from "zod";

import {
  BulkAddTasksSchema,
  BulkDeleteTasksSchema,
  BulkUpdateTasksSchema,
  CreateTaskSchema,
  ListTasksSchema,
  TaskPrioritySchema,
  type Task,
} from "~/features/tasks/api/task-model";
import { TaskService } from "~/features/tasks/api/task-service";

/** Model-driven task tools for the chat route. Writes execute server-side via
 * TaskService; destructive ones set `needsApproval` so the AI SDK pauses for an
 * explicit user gesture. Single-target tools resolve the real id from a title
 * inside `execute` — the model never writes an id, which removes the null-id bug. */

function toView(task: Pick<Task, "completed" | "id" | "priority" | "title">) {
  return {
    completed: task.completed,
    id: task.id,
    priority: task.priority,
    title: task.title,
  };
}

type SingleResolution = { error: string } | { task: ReturnType<typeof toView> };

async function resolveSingleTask(sourceTitle: string): Promise<SingleResolution> {
  const listed = await TaskService.list(
    ListTasksSchema.parse({ search: sourceTitle, status: "all" }),
  );

  if (Result.isError(listed)) {
    return { error: "タスクの検索に失敗しました。" };
  }

  const tasks = listed.value;

  if (tasks.length === 0) {
    return { error: `「${sourceTitle}」に一致するタスクが見つかりませんでした。` };
  }

  const exact = tasks.filter((task) => task.title === sourceTitle);
  const target = exact.length === 1 ? exact[0] : tasks.length === 1 ? tasks[0] : null;

  if (!target) {
    return {
      error: `「${sourceTitle}」に複数一致しました。一括操作（まとめて〜）でお試しください。`,
    };
  }

  return { task: toView(target) };
}

const UpdateTaskToolInputSchema = z
  .object({
    completed: z.boolean().optional().describe("Set completion state"),
    priority: TaskPrioritySchema.optional().describe("New priority"),
    sourceTitle: z.string().trim().min(1).describe("Current title of the task to update"),
    title: z.string().trim().min(1).optional().describe("New title (rename)"),
  })
  .refine(
    (value) =>
      value.title !== undefined || value.priority !== undefined || value.completed !== undefined,
    "Provide at least one field to update",
  );

export const chatTools = {
  add_task: tool({
    description:
      "Add ONE task. Use for 追加 / 登録 / 作成 of a single task. Provide title and priority (low/medium/high). Runs immediately, no approval.",
    inputSchema: CreateTaskSchema,
    execute: async ({ priority, title }) => {
      const result = await TaskService.add({ priority, title });

      if (Result.isError(result)) {
        return { message: result.error.message, status: "error" as const };
      }

      return {
        message: `「${result.value.title}」を追加しました。`,
        status: "success" as const,
        task: toView(result.value),
      };
    },
  }),

  bulk_add_tasks: tool({
    description:
      "Add SEVERAL tasks at once. Use for AとB追加 or 適当に N件追加 (invent realistic Japanese titles). Each item needs title + priority. Runs immediately, no approval.",
    inputSchema: BulkAddTasksSchema,
    execute: async ({ tasks }) => {
      const result = await TaskService.bulkAdd(tasks);

      if (Result.isError(result)) {
        return { message: result.error.message, status: "error" as const };
      }

      return {
        message: `${result.value.addedCount}件のタスクを追加しました。`,
        status: "success" as const,
      };
    },
  }),

  update_task: tool({
    description:
      "Update ONE task found by its current title. Use sourceTitle to locate it; set title (rename), priority, and/or completed. Requires user approval.",
    inputSchema: UpdateTaskToolInputSchema,
    needsApproval: true,
    execute: async ({ sourceTitle, ...fields }) => {
      const resolved = await resolveSingleTask(sourceTitle);

      if ("error" in resolved) {
        return { message: resolved.error, status: "error" as const };
      }

      const result = await TaskService.update({ id: resolved.task.id, ...fields });

      if (Result.isError(result)) {
        return { message: result.error.message, status: "error" as const };
      }

      return {
        message: `「${result.value.title}」を更新しました。`,
        status: "success" as const,
        task: toView(result.value),
      };
    },
  }),

  complete_task: tool({
    description:
      "Mark ONE task as completed, found by its title (sourceTitle). Use for 〜を完了. Requires user approval.",
    inputSchema: z.object({
      sourceTitle: z.string().trim().min(1).describe("Title of the task to complete"),
    }),
    needsApproval: true,
    execute: async ({ sourceTitle }) => {
      const resolved = await resolveSingleTask(sourceTitle);

      if ("error" in resolved) {
        return { message: resolved.error, status: "error" as const };
      }

      const result = await TaskService.complete(resolved.task.id);

      if (Result.isError(result)) {
        return { message: result.error.message, status: "error" as const };
      }

      return {
        message: `「${result.value.title}」を完了にしました。`,
        status: "success" as const,
        task: toView(result.value),
      };
    },
  }),

  delete_task: tool({
    description:
      "Delete ONE task found by its title (sourceTitle). Use for 〜を削除 of a single task. Requires user approval.",
    inputSchema: z.object({
      sourceTitle: z.string().trim().min(1).describe("Title of the task to delete"),
    }),
    needsApproval: true,
    execute: async ({ sourceTitle }) => {
      const resolved = await resolveSingleTask(sourceTitle);

      if ("error" in resolved) {
        return { message: resolved.error, status: "error" as const };
      }

      const result = await TaskService.delete(resolved.task.id);

      if (Result.isError(result)) {
        return { message: result.error.message, status: "error" as const };
      }

      return {
        message: `「${result.value.title}」を削除しました。`,
        status: "success" as const,
      };
    },
  }),

  bulk_update_tasks: tool({
    description:
      "Update MULTIPLE tasks by filter: search/searchTerms (title keywords), status (active/completed), priority. Set title, priority, and/or completed. Use for keyword/status bulk changes (含む〜をlowに / すべて完了に). Requires user approval.",
    inputSchema: BulkUpdateTasksSchema,
    needsApproval: true,
    execute: async (input) => {
      const result = await TaskService.bulkUpdate(input);

      if (Result.isError(result)) {
        return { message: result.error.message, status: "error" as const };
      }

      return {
        message: `${result.value.updatedCount}件のタスクを更新しました。`,
        status: "success" as const,
      };
    },
  }),

  bulk_delete_tasks: tool({
    description:
      "Delete MULTIPLE tasks by filter: search/searchTerms (title keywords), status (active/completed), priority. Use for 含む〜を削除 / 完了タスクを削除 / 優先度highを削除. Requires user approval.",
    inputSchema: BulkDeleteTasksSchema,
    needsApproval: true,
    execute: async (input) => {
      const result = await TaskService.bulkDelete(input);

      if (Result.isError(result)) {
        return { message: result.error.message, status: "error" as const };
      }

      return {
        message: `${result.value.deletedCount}件のタスクを削除しました。`,
        status: "success" as const,
      };
    },
  }),

  delete_all_tasks: tool({
    description:
      "Delete EVERY task on the board. Use ONLY for 全タスク削除 / すべて削除. Irreversible. Requires user approval.",
    inputSchema: z.object({}),
    needsApproval: true,
    execute: async () => {
      const result = await TaskService.deleteAll();

      if (Result.isError(result)) {
        return { message: result.error.message, status: "error" as const };
      }

      return {
        message: `${result.value.deletedCount}件のタスクをすべて削除しました。`,
        status: "success" as const,
      };
    },
  }),
} as const satisfies ToolSet;
