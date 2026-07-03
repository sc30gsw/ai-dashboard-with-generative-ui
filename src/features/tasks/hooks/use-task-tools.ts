import { useWebMCP } from "@mcp-b/react-webmcp";
import { z } from "zod";

import { type ElicitInput, executeWebMcpTool } from "~/features/tasks/tools/adapters/web-mcp";
import { addTaskTool } from "~/features/tasks/tools/add-task";
import { bulkAddTasksTool } from "~/features/tasks/tools/bulk-add-tasks";
import { bulkDeleteTasksTool } from "~/features/tasks/tools/bulk-delete-tasks";
import { bulkUpdateTasksTool } from "~/features/tasks/tools/bulk-update-tasks";
import { completeTaskTool } from "~/features/tasks/tools/complete-task";
import { deleteAllTasksTool } from "~/features/tasks/tools/delete-all-tasks";
import { deleteTaskTool } from "~/features/tasks/tools/delete-task";
import { listTasksTool } from "~/features/tasks/tools/list-tasks";
import { reorderTasksTool } from "~/features/tasks/tools/reorder-tasks";
import type { TaskTool } from "~/features/tasks/tools/tool";
import { updateTaskTool } from "~/features/tasks/tools/update-task";

function useRegisteredTaskTool(tool: TaskTool, elicitInput: ElicitInput) {
  const inputSchema = z.toJSONSchema(tool.inputSchema) as Parameters<
    typeof useWebMCP
  >[0]["inputSchema"];

  useWebMCP({
    description: tool.description,
    handler: (args) => executeWebMcpTool(tool, args, elicitInput),
    inputSchema,
    name: tool.name,
  });
}

export function useTaskTools(elicitInput: ElicitInput) {
  //? 全タスクツールを無条件に Web MCP サーフェスへ登録する（`exposeToWebMcp` は現状すべて true —
  //? task-tools.test.ts が保証）。`exposeToWebMcp` を条件分岐で見るには useWebMCP 自体を
  //? 条件付きで呼ぶ必要があり、hooks のルール違反になるため行わない。配列の map ではなく
  //? 呼び出しを展開しているのも同じ理由（hooks のルールを満たすため）。
  useRegisteredTaskTool(addTaskTool, elicitInput);
  useRegisteredTaskTool(bulkAddTasksTool, elicitInput);
  useRegisteredTaskTool(listTasksTool, elicitInput);
  useRegisteredTaskTool(completeTaskTool, elicitInput);
  useRegisteredTaskTool(updateTaskTool, elicitInput);
  useRegisteredTaskTool(bulkUpdateTasksTool, elicitInput);
  useRegisteredTaskTool(deleteTaskTool, elicitInput);
  useRegisteredTaskTool(bulkDeleteTasksTool, elicitInput);
  useRegisteredTaskTool(deleteAllTasksTool, elicitInput);
  useRegisteredTaskTool(reorderTasksTool, elicitInput);
}
