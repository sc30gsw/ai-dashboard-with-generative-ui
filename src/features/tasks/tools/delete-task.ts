import { DeleteTaskSchema, TaskViewToolOutputSchema } from "~/features/tasks/api/task-model";
import type { TaskTool } from "~/features/tasks/tools/tool";
import { edenClient } from "~/lib/eden";

export const deleteTaskTool = {
  description: "Delete an existing task by id. This permanently removes the task.",
  inputSchema: DeleteTaskSchema,
  name: "delete_task",
  outputSchema: TaskViewToolOutputSchema,
  run: async (args) => {
    const input = DeleteTaskSchema.parse(args);
    const { data, error } = await edenClient().tasks.delete.post(input);

    if (error) {
      throw new Error(`delete_task failed: ${String(error.status)}`);
    }

    if (!data.ok) {
      throw new Error(data.message);
    }

    return data.task;
  },
} as const satisfies TaskTool;
