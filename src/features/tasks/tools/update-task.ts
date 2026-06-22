import { TaskViewToolOutputSchema, UpdateTaskSchema } from "~/features/tasks/api/task-model";
import type { TaskTool } from "~/features/tasks/tools/tool";
import { edenClient } from "~/lib/eden";

export const updateTaskTool = {
  description:
    "Update an existing task by id. Set title, priority, and/or completed in one call. Use this instead of complete_task when changing multiple fields.",
  inputSchema: UpdateTaskSchema,
  name: "update_task",
  outputSchema: TaskViewToolOutputSchema,
  run: async (args) => {
    const input = UpdateTaskSchema.parse(args);
    const { data, error } = await edenClient().tasks.update.post(input);

    if (error) {
      throw new Error(`update_task failed: ${String(error.status)}`);
    }

    if (!data.ok) {
      throw new Error(data.message);
    }

    return data.task;
  },
} as const satisfies TaskTool;
