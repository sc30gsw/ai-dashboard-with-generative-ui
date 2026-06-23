import type { InferUITools, ToolUIPart as SdkToolUIPart } from "ai";

import type { chatTools } from "~/features/tasks/tools/chat-ai-tools";

type ToolUIPart = SdkToolUIPart<InferUITools<typeof chatTools>>;

export const TOOL_LABELS = {
  add_task: "タスクを追加",
  bulk_add_tasks: "タスクを一括追加",
  bulk_delete_tasks: "タスクを一括削除",
  bulk_update_tasks: "タスクを一括更新",
  complete_task: "タスクを完了",
  delete_all_tasks: "全タスクを削除",
  delete_task: "タスクを削除",
  update_task: "タスクを更新",
} as const satisfies Record<keyof typeof chatTools, string>;

export const DESTRUCTIVE_TOOLS = new Set(["bulk_delete_tasks", "delete_all_tasks", "delete_task"]);

export function toolNameOf(type: ToolUIPart["type"]) {
  return type.replace(/^tool-/, "");
}

export function summarizeToolInput(
  name: ReturnType<typeof toolNameOf>,
  input: ToolUIPart["input"],
) {
  if (!input || typeof input !== "object") {
    return "";
  }

  const record = input as Record<string, unknown>;
  const source = typeof record.sourceTitle === "string" ? record.sourceTitle : null;
  const search =
    typeof record.search === "string"
      ? record.search
      : Array.isArray(record.searchTerms)
        ? record.searchTerms.join(" / ")
        : null;
  const status = typeof record.status === "string" ? record.status : null;
  const priority = typeof record.priority === "string" ? record.priority : null;

  const changes: string[] = [];

  if (typeof record.title === "string") {
    changes.push(`タイトル → ${record.title}`);
  }

  if (priority && name !== "bulk_delete_tasks") {
    changes.push(`優先度 → ${priority}`);
  }

  if (typeof record.completed === "boolean") {
    changes.push(record.completed ? "完了にする" : "未完了に戻す");
  }

  if (name === "delete_all_tasks") {
    return "ボード上のすべてのタスクが対象です。";
  }

  const target =
    source ??
    (search ? `「${search}」を含むタスク` : null) ??
    (status === "completed" ? "完了済みのタスク" : status === "active" ? "未完了のタスク" : null) ??
    (priority ? `優先度 ${priority} のタスク` : "対象タスク");

  return changes.length > 0 ? `${target}（${changes.join(" / ")}）` : target;
}
