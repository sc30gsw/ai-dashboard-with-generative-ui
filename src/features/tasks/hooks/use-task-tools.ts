import { useWebMCP } from "@mcp-b/react-webmcp";
import { z } from "zod";

import { addTaskTool } from "~/features/tasks/tools/add-task";
import { bulkAddTasksTool } from "~/features/tasks/tools/bulk-add-tasks";
import { bulkDeleteTasksTool } from "~/features/tasks/tools/bulk-delete-tasks";
import { bulkUpdateTasksTool } from "~/features/tasks/tools/bulk-update-tasks";
import { completeTaskTool } from "~/features/tasks/tools/complete-task";
import { deleteAllTasksTool } from "~/features/tasks/tools/delete-all-tasks";
import { deleteTaskTool } from "~/features/tasks/tools/delete-task";
import { listTasksTool } from "~/features/tasks/tools/list-tasks";
import type { TaskTool } from "~/features/tasks/tools/tool";
import { updateTaskTool } from "~/features/tasks/tools/update-task";
import { type ElicitInput, executeWebMcpTool } from "~/features/tasks/tools/web-mcp-handler";

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
  //? `exposeToWebMcp` フラグ付きツールのみを登録する。hooks のルールを満たすため、
  //? 配列の map ではなく呼び出しを展開している。
  useRegisteredTaskTool(addTaskTool, elicitInput);
  useRegisteredTaskTool(bulkAddTasksTool, elicitInput);
  useRegisteredTaskTool(listTasksTool, elicitInput);
  useRegisteredTaskTool(completeTaskTool, elicitInput);
  useRegisteredTaskTool(updateTaskTool, elicitInput);
  useRegisteredTaskTool(bulkUpdateTasksTool, elicitInput);
  useRegisteredTaskTool(deleteTaskTool, elicitInput);
  useRegisteredTaskTool(bulkDeleteTasksTool, elicitInput);
  useRegisteredTaskTool(deleteAllTasksTool, elicitInput);
}
