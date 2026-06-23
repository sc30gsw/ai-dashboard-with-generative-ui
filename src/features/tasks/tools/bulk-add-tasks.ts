import { BulkAddTasksOutputSchema, BulkAddTasksSchema } from "~/features/tasks/api/task-model";
import type { TaskTool } from "~/features/tasks/tools/tool";
import { edenClient } from "~/lib/eden";

export const bulkAddTasksTool = {
  description:
    "Add multiple tasks in one operation. Provide a tasks array with title and priority for each item. Use for bulk registration, repeated titles, or sample/random tasks — invent appropriate titles when the user asks for サンプル/ランダム/適当.",
  destructive: false,
  exposeToWebMcp: true,
  inputSchema: BulkAddTasksSchema,
  name: "bulk_add_tasks",
  outputSchema: BulkAddTasksOutputSchema,
  run: async (args) => {
    const input = BulkAddTasksSchema.parse(args);
    const { data, error } = await edenClient().tasks["bulk-add"].post(input);

    if (error) {
      throw new Error(`bulk_add_tasks failed: ${String(error.status)}`);
    }

    if (!data.ok) {
      throw new Error(data.message);
    }

    return data.result;
  },
} as const satisfies TaskTool;
