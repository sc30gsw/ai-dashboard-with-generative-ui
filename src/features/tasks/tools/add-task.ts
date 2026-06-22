import { CreateTaskSchema, TaskViewToolOutputSchema } from "~/features/tasks/api/task-model";
import type { TaskTool } from "~/features/tasks/tools/tool";
import { edenClient } from "~/lib/eden";

export const addTaskTool = {
  description:
    "Add a new task to the board. Provide a title and a priority (low, medium, or high).",
  inputSchema: CreateTaskSchema,
  name: "add_task",
  outputSchema: TaskViewToolOutputSchema,
  run: async (args) => {
    const input = CreateTaskSchema.parse(args);
    const { data, error } = await edenClient().tasks.add.post(input);

    if (error) {
      throw new Error(`add_task failed: ${String(error.status)}`);
    }

    if (!data.ok) {
      throw new Error(data.message);
    }

    return data.task;
  },
} as const satisfies TaskTool;
