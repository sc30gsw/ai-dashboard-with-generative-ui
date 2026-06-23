import type { UseElicitationReturn } from "@mcp-b/react-webmcp";

import { runTaskTool } from "~/features/tasks/tools";
import type { TaskTool } from "~/features/tasks/tools/tool";

export type ElicitInput = UseElicitationReturn["elicitInput"];

/**
 * Runs a task tool on the Web MCP surface, gating destructive tools behind an
 * MCP elicitation confirmation. An external agent has no UI click, so the
 * confirmation is requested from the connected client; if the client does not
 * support elicitation, `elicitInput` rejects and we fail safe by refusing.
 *
 * Extracted from `useRegisteredTaskTool` so the gate logic is unit-testable
 * without React or the polyfill.
 */
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
