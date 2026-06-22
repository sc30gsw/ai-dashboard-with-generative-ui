import type { ToolSpec } from "@openuidev/react-lang";
import { z } from "zod";

import { addTaskTool } from "~/features/tasks/tools/add-task";
import { completeTaskTool } from "~/features/tasks/tools/complete-task";
import { listTasksTool } from "~/features/tasks/tools/list-tasks";
import type { TaskTool, TaskToolProviderMap } from "~/features/tasks/tools/tool";

export const taskTools = [
  addTaskTool,
  listTasksTool,
  completeTaskTool,
] as const satisfies readonly TaskTool[];

export const taskToolMap = Object.fromEntries(
  taskTools.map((tool) => [tool.name, (args) => tool.run(args)]),
) satisfies TaskToolProviderMap;

export const taskToolSpecs = taskTools.map((tool) => ({
  annotations: { readOnlyHint: tool.name === "list_tasks" },
  description: tool.description,
  inputSchema: z.toJSONSchema(tool.inputSchema),
  name: tool.name,
  outputSchema: z.toJSONSchema(tool.outputSchema),
})) satisfies ToolSpec[];
