import { useWebMCP } from "@mcp-b/react-webmcp";
import { z } from "zod";

import { runTaskTool, taskTools } from "~/features/tasks/tools";
import type { TaskTool } from "~/features/tasks/tools/tool";

function useRegisteredTaskTool(tool: TaskTool) {
  const inputSchema = z.toJSONSchema(tool.inputSchema) as Parameters<
    typeof useWebMCP
  >[0]["inputSchema"];

  useWebMCP({
    description: tool.description,
    handler: (args) => runTaskTool(tool, args),
    inputSchema,
    name: tool.name,
  });
}

export function useTaskTools() {
  useRegisteredTaskTool(taskTools[0]);
  useRegisteredTaskTool(taskTools[1]);
  useRegisteredTaskTool(taskTools[2]);
}
