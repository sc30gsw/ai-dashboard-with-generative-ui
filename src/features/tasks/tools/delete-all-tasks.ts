import {
  DeleteAllTasksOutputSchema,
  DeleteAllTasksSchema,
} from "~/features/tasks/api/task-model";
import type { TaskTool } from "~/features/tasks/tools/tool";
import { edenClient } from "~/lib/eden";

export const deleteAllTasksTool = {
  description:
    "Permanently delete every task on the board. Use only after the user confirms via a destructive button.",
  inputSchema: DeleteAllTasksSchema,
  name: "delete_all_tasks",
  outputSchema: DeleteAllTasksOutputSchema,
  run: async (args) => {
    DeleteAllTasksSchema.parse(args ?? {});
    const { data, error } = await edenClient().tasks["delete-all"].post({});

    if (error) {
      throw new Error(`delete_all_tasks failed: ${String(error.status)}`);
    }

    if (!data.ok) {
      throw new Error(data.message);
    }

    return data.result;
  },
} as const satisfies TaskTool;
