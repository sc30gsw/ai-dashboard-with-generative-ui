import { refetchTasksCollection } from "~/features/tasks/collections/tasks-collection";
import { addTaskTool } from "~/features/tasks/tools/add-task";
import { bulkAddTasksTool } from "~/features/tasks/tools/bulk-add-tasks";
import { bulkDeleteTasksTool } from "~/features/tasks/tools/bulk-delete-tasks";
import { bulkUpdateTasksTool } from "~/features/tasks/tools/bulk-update-tasks";
import { completeTaskTool } from "~/features/tasks/tools/complete-task";
import { deleteAllTasksTool } from "~/features/tasks/tools/delete-all-tasks";
import { deleteTaskTool } from "~/features/tasks/tools/delete-task";
import { listTasksTool } from "~/features/tasks/tools/list-tasks";
import type { TaskTool, TaskToolProviderMap } from "~/features/tasks/tools/tool";
import { updateTaskTool } from "~/features/tasks/tools/update-task";

export const taskTools = [
  addTaskTool,
  bulkAddTasksTool,
  bulkDeleteTasksTool,
  bulkUpdateTasksTool,
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

export function createReadToolMap() {
  return {
    [listTasksTool.name]: (args: Record<string, unknown>) => listTasksTool.run(args),
  } satisfies TaskToolProviderMap;
}
