import { CompleteTaskSchema } from "~/features/tasks/schemas/task-schema";
import type { TaskTool } from "~/features/tasks/tools/tool";
import { edenClient } from "~/lib/eden";

export const completeTaskTool = {
  description: "Mark a task as completed by its id.",
  inputSchema: CompleteTaskSchema,
  name: "complete_task",
  run: async (args) => {
    const input = CompleteTaskSchema.parse(args);
    const { data, error } = await edenClient().tasks.complete.post(input);

    if (error) {
      throw new Error(`complete_task failed: ${String(error.status)}`);
    }

    if (!data.ok) {
      throw new Error(data.message);
    }

    return data.task;
  },
} as const satisfies TaskTool;
