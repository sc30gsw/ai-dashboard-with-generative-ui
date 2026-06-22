import { useWebMCP } from "@mcp-b/react-webmcp";
import { z } from "zod";

import { addTaskTool } from "~/features/tasks/tools/add-task";
import { completeTaskTool } from "~/features/tasks/tools/complete-task";
import { listTasksTool } from "~/features/tasks/tools/list-tasks";

export function useTaskTools() {
  useWebMCP({
    description: addTaskTool.description,
    handler: (args) => addTaskTool.run(args),
    inputSchema: z.toJSONSchema(addTaskTool.inputSchema),
    name: addTaskTool.name,
  });
  useWebMCP({
    description: listTasksTool.description,
    handler: () => listTasksTool.run(),
    inputSchema: z.toJSONSchema(listTasksTool.inputSchema),
    name: listTasksTool.name,
  });
  useWebMCP({
    description: completeTaskTool.description,
    handler: (args) => completeTaskTool.run(args),
    inputSchema: z.toJSONSchema(completeTaskTool.inputSchema),
    name: completeTaskTool.name,
  });
}
