import {
  BulkUpdateTasksOutputSchema,
  BulkUpdateTasksSchema,
} from "~/features/tasks/api/task-model";
import type { TaskTool } from "~/features/tasks/tools/tool";
import { edenClient } from "~/lib/eden";

export const bulkUpdateTasksTool = {
  additive: false,
  description:
    "Bulk update by search (title substring), searchTerms (OR), priorityFilter (target only that priority), or status filter (active/completed). Set fields: title, priority (new value), completed. priorityFilter selects which tasks; priority sets the value. For full-board updates with no filter pass confirmAll: true. Requires confirmation button.",
  destructive: false,
  exposeToWebMcp: true,
  inputSchema: BulkUpdateTasksSchema,
  mutates: true,
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
