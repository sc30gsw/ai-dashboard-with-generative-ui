import type { UseElicitationReturn } from "@mcp-b/react-webmcp";

import { runTaskTool } from "~/features/tasks/tools";
import { isMutatingTool } from "~/features/tasks/tools/defs";
import type { TaskTool } from "~/features/tasks/tools/tool";
import {
  DESTRUCTIVE_TOOLS,
  summarizeToolInput,
  TOOL_LABELS,
} from "~/features/tasks/utils/tool-approval-summary";

export type ElicitInput = UseElicitationReturn["elicitInput"];

//? AI-SDK 承認カードと同じ素材（ラベル / 破壊的マーカー / 引数由来のスコープ）から elicitation 文言を組み立てる。
//? DB は引かない（件数なし）。外部エージェント向けに、操作の種類とブラスト半径が文言だけで判断できるようにする。
function buildElicitationMessage(tool: TaskTool, args: Record<string, unknown>) {
  const label = TOOL_LABELS[tool.name as keyof typeof TOOL_LABELS] ?? tool.name;
  const marker = DESTRUCTIVE_TOOLS.has(tool.name) ? "【破壊的】" : "";
  const scope = summarizeToolInput(tool.name, args);

  return `${marker}${label}を実行します。${scope ? `対象: ${scope}。` : ""}承認しますか？`;
}

//* Web MCP アダプタ: タスクツールを実行し、書き込み（mutation）はすべて elicitation 確認でゲートする。
//* 外部エージェントには UI クリック（人間のジェスチャ）が無いため、read(list_tasks) 以外の全 mutation で
//* 接続クライアントに確認を要求する（REVIEW #2）。destructive フラグ単体に依存しない。
//* クライアントが elicitation 非対応の場合、`elicitInput` は reject し、安全側で拒否する。
//*
//* `useRegisteredTaskTool` から切り出し、React や polyfill なしでゲートロジックをユニットテスト可能にした。
export async function executeWebMcpTool(
  tool: TaskTool,
  args: Record<string, unknown>,
  elicitInput: ElicitInput,
) {
  if (isMutatingTool(tool.name)) {
    const confirmation = await elicitInput({
      message: buildElicitationMessage(tool, args),
      requestedSchema: { properties: {}, type: "object" },
    }).catch(() => null);

    if (confirmation?.action !== "accept") {
      throw new Error(`${tool.name} canceled: the mutation was not confirmed by the user`);
    }
  }

  return runTaskTool(tool, args);
}
