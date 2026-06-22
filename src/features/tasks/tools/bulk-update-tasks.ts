import {
  BulkUpdateTasksOutputSchema,
  BulkUpdateTasksSchema,
} from "~/features/tasks/api/task-model";
import type { TaskTool } from "~/features/tasks/tools/tool";
import { edenClient } from "~/lib/eden";

export const bulkUpdateTasksTool = {
  description:
    "Bulk update by search (title substring), searchTerms (OR), or status filter (active/completed). Set title, priority, and/or completed. For keyword filters use search — not sourceTitle. Requires confirmation button.",
  inputSchema: BulkUpdateTasksSchema,
  name: "bulk_update_tasks",
  outputSchema: BulkUpdateTasksOutputSchema,
  run: async (args) => {
    const input = BulkUpdateTasksSchema.parse(args);
    const { data, error } = await edenClient().tasks["bulk-update"].post(input);

    if (error) {
      throw new Error(`bulk_update_tasks failed: ${String(error.status)}`);
    }

    if (!data.ok) {
      throw new Error(data.message);
    }

    return data.result;
  },
} as const satisfies TaskTool;
