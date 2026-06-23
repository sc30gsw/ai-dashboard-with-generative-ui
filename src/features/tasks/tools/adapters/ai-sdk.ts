import { tool, type ToolSet } from "ai";
import { Result } from "better-result";
import { filter, only } from "remeda";
import { z } from "zod";

import {
  AddTaskToolInputSchema,
  BulkAddTasksSchema,
  BulkDeleteTasksSchema,
  BulkUpdateTasksSchema,
  ListTasksSchema,
  toTaskView,
  UpdateTaskToolInputSchema,
} from "~/features/tasks/api/task-model";
import { TaskService } from "~/features/tasks/api/task-service";
import { TASK_TOOL_POLICY } from "~/features/tasks/tools/defs";

//* AI SDK アダプタ（パターン A: モデル駆動の書き込み）。書き込みは TaskService でサーバー側実行。
//* `needsApproval` は defs の単一ポリシーから引く（サーフェス間でドリフトさせない）。
//* 単一対象ツールは `execute` 内でタイトルから実 id を解決 — モデルは id を書かない（null-id バグを排除）。

async function resolveSingleTask(sourceTitle: string) {
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

  //? 完全一致のみ採用する。承認カードはモデルの sourceTitle を表示するため（実行は execute 前に
  //? 一時停止し、解決後タイトルを承認時に出せない）、部分一致で別タイトルのタスクを解決すると
  //? 承認内容と実対象がずれる。完全一致が無ければ見つからない扱いにする（R8）。
  const exactMatches = filter(tasks, (task) => task.title === sourceTitle);
  const target = only(exactMatches);

  if (!target) {
    if (exactMatches.length === 0) {
      return { error: `「${sourceTitle}」に一致するタスクが見つかりませんでした。` };
    }

    return {
      error: `「${sourceTitle}」に複数一致しました。一括操作（まとめて〜）でお試しください。`,
    };
  }

  return { task: toTaskView(target) };
}

export const chatTools = {
  add_task: tool({
    description:
      "Add ONE task. Use for 追加 / 登録 / 作成 of a single task. Provide a title; if the user does not state a priority, default to medium silently — NEVER ask the user to choose a priority. Runs immediately, no approval.",
    inputSchema: AddTaskToolInputSchema,
    needsApproval: TASK_TOOL_POLICY.add_task.needsApproval,
    execute: async ({ priority, title }) => {
      const result = await TaskService.add({ priority, title });

      if (Result.isError(result)) {
        return { message: result.error.message, status: "error" as const };
      }

      return {
        message: `「${result.value.title}」を追加しました。`,
        status: "success" as const,
        task: toTaskView(result.value),
      };
    },
  }),

  bulk_add_tasks: tool({
    description:
      "Add SEVERAL tasks at once. Use for AとB追加 or 適当に N件追加 (invent realistic Japanese titles). Each item needs title + priority. Runs immediately, no approval.",
    inputSchema: BulkAddTasksSchema,
    needsApproval: TASK_TOOL_POLICY.bulk_add_tasks.needsApproval,
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
    needsApproval: TASK_TOOL_POLICY.update_task.needsApproval,
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
        task: toTaskView(result.value),
      };
    },
  }),

  complete_task: tool({
    description:
      "Mark ONE task as completed, found by its title (sourceTitle). Use for 〜を完了. Requires user approval.",
    inputSchema: z.object({
      sourceTitle: z.string().trim().min(1).describe("Title of the task to complete"),
    }),
    needsApproval: TASK_TOOL_POLICY.complete_task.needsApproval,
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
        task: toTaskView(result.value),
      };
    },
  }),

  delete_task: tool({
    description:
      "Delete ONE task found by its title (sourceTitle). Use for 〜を削除 of a single task. Requires user approval.",
    inputSchema: z.object({
      sourceTitle: z.string().trim().min(1).describe("Title of the task to delete"),
    }),
    needsApproval: TASK_TOOL_POLICY.delete_task.needsApproval,
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
      "Update MULTIPLE tasks by filter: search/searchTerms (title keywords), status (active/completed), priorityFilter (target only this priority). Set fields: title, priority (the new priority to assign), completed. NOTE priorityFilter = which tasks to match; priority = the value to set. For 'すべて〜' with no filter, pass confirmAll: true. Requires user approval.",
    inputSchema: BulkUpdateTasksSchema,
    needsApproval: TASK_TOOL_POLICY.bulk_update_tasks.needsApproval,
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
    needsApproval: TASK_TOOL_POLICY.bulk_delete_tasks.needsApproval,
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
    needsApproval: TASK_TOOL_POLICY.delete_all_tasks.needsApproval,
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
