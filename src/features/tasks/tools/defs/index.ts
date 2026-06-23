//* タスクツールの確認ポリシー単一ソース。AI SDK / Web MCP の両アダプタがここを参照する。
//* - mutates:       書き込みか（Web MCP の elicitation ゲート判定）。read(list_tasks) 以外すべて true。
//* - needsApproval: AI SDK 側でチャット承認カードを挟むか。add 系は additive のため false。
//* これを一元化することで、サーフェス間でフラグがドリフトしない（REVIEW #2 / #7）。

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
  update_task: { mutates: true, needsApproval: true },
} as const satisfies Record<TaskTool["name"], TaskToolPolicy>;

type TaskToolName = keyof typeof TASK_TOOL_POLICY;

export function isMutatingTool(name: TaskTool["name"]) {
  return TASK_TOOL_POLICY[name as TaskToolName]?.mutates ?? true;
}
