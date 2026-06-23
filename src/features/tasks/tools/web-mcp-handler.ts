import type { UseElicitationReturn } from "@mcp-b/react-webmcp";

import { runTaskTool } from "~/features/tasks/tools";
import type { TaskTool } from "~/features/tasks/tools/tool";

export type ElicitInput = UseElicitationReturn["elicitInput"];

//* Web MCP 上でタスクツールを実行し、破壊的操作は MCP elicitation 確認でゲートする。
//* 外部エージェントには UI クリックがないため、接続クライアントに確認を要求する。
//* クライアントが elicitation 非対応の場合、`elicitInput` は reject し、安全側で拒否する。
//*
//* `useRegisteredTaskTool` から切り出し、React や polyfill なしでゲートロジックをユニットテスト可能にした。
export async function executeWebMcpTool(
  tool: TaskTool,
  args: Record<string, unknown>,
  elicitInput: ElicitInput,
) {
  if (tool.destructive) {
    const confirmation = await elicitInput({
      message: `「${tool.name}」は取り消せない破壊的な操作です。実行を承認しますか？`,
      requestedSchema: { properties: {}, type: "object" },
    }).catch(() => null);

    if (confirmation?.action !== "accept") {
      throw new Error(`${tool.name} canceled: destructive action was not confirmed by the user`);
    }
  }

  return runTaskTool(tool, args);
}
