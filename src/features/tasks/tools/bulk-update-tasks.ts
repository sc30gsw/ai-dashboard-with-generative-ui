import {
  BulkUpdateTasksOutputSchema,
  BulkUpdateTasksSchema,
} from "~/features/tasks/api/task-model";
import type { TaskTool } from "~/features/tasks/tools/tool";
import { edenClient } from "~/lib/eden";

export const bulkUpdateTasksTool = {
  description:
    "Update multiple tasks whose titles match a search substring (same as list_tasks search). Set priority and/or completed for all matches in one call. Use for category updates (e.g. all メール-related tasks) — not update_task.",
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
