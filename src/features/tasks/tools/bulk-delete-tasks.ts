import {
  BulkDeleteTasksOutputSchema,
  BulkDeleteTasksSchema,
} from "~/features/tasks/api/task-model";
import type { TaskTool } from "~/features/tasks/tools/tool";
import { edenClient } from "~/lib/eden";

export const bulkDeleteTasksTool = {
  description:
    "Delete tasks matching search (title substring), searchTerms (OR), or status (completed/active). Use search for keyword filters — not sourceTitle. Requires confirmation button.",
  inputSchema: BulkDeleteTasksSchema,
  name: "bulk_delete_tasks",
  outputSchema: BulkDeleteTasksOutputSchema,
  run: async (args: Record<string, unknown>) => {
    const input = BulkDeleteTasksSchema.parse(args);
    const { data, error } = await edenClient().tasks["bulk-delete"].post(input);

    if (error) {
      throw new Error(`bulk_delete_tasks failed: ${String(error.status)}`);
    }

    if (!data.ok) {
      throw new Error(data.message);
    }

    return data.result;
  },
} as const satisfies TaskTool;
