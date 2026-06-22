import type { ToolSpec } from "@openuidev/lang-core";
import { z } from "zod";

import { refetchTasksCollection } from "~/features/tasks/collections/tasks-collection";
import { addTaskTool } from "~/features/tasks/tools/add-task";
import { completeTaskTool } from "~/features/tasks/tools/complete-task";
import { deleteAllTasksTool } from "~/features/tasks/tools/delete-all-tasks";
import { deleteTaskTool } from "~/features/tasks/tools/delete-task";
import { listTasksTool } from "~/features/tasks/tools/list-tasks";
import { updateTaskTool } from "~/features/tasks/tools/update-task";
import type { TaskTool, TaskToolProviderMap } from "~/features/tasks/tools/tool";

export const taskTools = [
  addTaskTool,
  listTasksTool,
  completeTaskTool,
  updateTaskTool,
  deleteTaskTool,
  deleteAllTasksTool,
] as const satisfies readonly TaskTool[];

export async function runTaskTool(tool: TaskTool, args: Record<string, unknown>) {
  const result = await tool.run(args);

  if (tool.name !== "list_tasks") {
    await refetchTasksCollection();
  }

  return result;
}

export const taskToolMap = Object.fromEntries(
  taskTools.map((tool) => [tool.name, (args) => runTaskTool(tool, args)]),
) satisfies TaskToolProviderMap;

export const taskToolSpecs = taskTools.map((tool) => ({
  annotations: { readOnlyHint: tool.name === "list_tasks" },
  description: tool.description,
  inputSchema: z.toJSONSchema(tool.inputSchema),
  name: tool.name,
  outputSchema: z.toJSONSchema(tool.outputSchema),
})) satisfies ToolSpec[];
