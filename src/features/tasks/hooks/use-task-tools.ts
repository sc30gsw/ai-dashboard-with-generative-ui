import { useWebMCP, type UseElicitationReturn } from "@mcp-b/react-webmcp";
import { z } from "zod";

import { runTaskTool } from "~/features/tasks/tools";
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

type ElicitInput = UseElicitationReturn["elicitInput"];

function useRegisteredTaskTool(tool: TaskTool, elicitInput: ElicitInput) {
  const inputSchema = z.toJSONSchema(tool.inputSchema) as Parameters<
    typeof useWebMCP
  >[0]["inputSchema"];

  useWebMCP({
    description: tool.description,
    handler: async (args) => {
      //* Human-in-the-loop for destructive tools: an external Web MCP agent has no
      //* UI click, so we request confirmation through MCP elicitation. If the client
      //* does not support elicitation, elicitInput rejects → we fail safe and refuse.
      if (tool.destructive) {
        const confirmation = await elicitInput({
          message: `「${tool.name}」は取り消せない破壊的な操作です。実行を承認しますか？`,
          requestedSchema: { properties: {}, type: "object" },
        }).catch(() => null);

        if (confirmation?.action !== "accept") {
          throw new Error(
            `${tool.name} canceled: destructive action was not confirmed by the user`,
          );
        }
      }

      return runTaskTool(tool, args);
    },
    inputSchema,
    name: tool.name,
  });
}

export function useTaskTools(elicitInput: ElicitInput) {
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
