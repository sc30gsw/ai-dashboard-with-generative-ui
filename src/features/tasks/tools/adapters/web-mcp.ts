import type { UseElicitationReturn } from "@mcp-b/react-webmcp";

import { runTaskTool } from "~/features/tasks/tools";
import { isMutatingTool } from "~/features/tasks/tools/defs";
import type { TaskTool } from "~/features/tasks/tools/tool";

export type ElicitInput = UseElicitationReturn["elicitInput"];

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
      message: `「${tool.name}」はボードを変更する操作です。実行を承認しますか？`,
      requestedSchema: { properties: {}, type: "object" },
    }).catch(() => null);

    if (confirmation?.action !== "accept") {
      throw new Error(`${tool.name} canceled: the mutation was not confirmed by the user`);
    }
  }

  return runTaskTool(tool, args);
}
