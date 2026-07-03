//* タスクツールの確認ポリシー単一ソース。AI SDK アダプタがここを参照する。
//* - mutates:       書き込みか。read(list_tasks) 以外すべて true。Web MCP の elicitation ゲートは
//*                   TaskTool.mutates を直接見る（このテーブル経由ではない。フェイルクローズにするため）。
//* - needsApproval: AI SDK 側でチャット承認カードを挟むか。add 系は additive のため false。

import type { Tool } from "ai";

import type { TaskTool } from "~/features/tasks/tools/tool";

type TaskToolPolicy = Pick<TaskTool, "mutates"> & Pick<Tool, "needsApproval">;

export const TASK_TOOL_POLICY = {
  add_task: { mutates: true, needsApproval: false },
  bulk_add_tasks: { mutates: true, needsApproval: false },
  bulk_delete_tasks: { mutates: true, needsApproval: true },
  bulk_update_tasks: { mutates: true, needsApproval: true },
  complete_task: { mutates: true, needsApproval: true },
  delete_all_tasks: { mutates: true, needsApproval: true },
  delete_task: { mutates: true, needsApproval: true },
  list_tasks: { mutates: false, needsApproval: false },
  reorder_tasks: { mutates: true, needsApproval: true },
  update_task: { mutates: true, needsApproval: true },
} as const satisfies Record<TaskTool["name"], TaskToolPolicy>;
