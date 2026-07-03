import { ReorderTasksOutputSchema, ReorderTasksSchema } from "~/features/tasks/api/task-model";
import type { TaskTool } from "~/features/tasks/tools/tool";
import { edenClient } from "~/lib/eden";

export const reorderTasksTool = {
  additive: false,
  description:
    "Reorder tasks by an explicit list of task ids (the new order). Use ONLY when the user has approved a proposed order. Requires user approval.",
  destructive: false,
  exposeToWebMcp: true,
  inputSchema: ReorderTasksSchema,
  mutates: true,
  name: "reorder_tasks",
  outputSchema: ReorderTasksOutputSchema,
  run: async (args) => {
    const input = ReorderTasksSchema.parse(args);
    const { data, error } = await edenClient().tasks.reorder.post(input);

    if (error) {
      throw new Error(`reorder_tasks failed: ${String(error.status)}`);
    }

    if (!data.ok) {
      throw new Error(data.message);
    }

    return { tasks: data.tasks };
  },
} as const satisfies TaskTool;
