import { CompleteTaskSchema, TaskViewToolOutputSchema } from "~/features/tasks/api/task-model";
import type { TaskTool } from "~/features/tasks/tools/tool";
import { edenClient } from "~/lib/eden";

export const completeTaskTool = {
  description:
    "Mark a task as completed by id. Use Mutation(complete_task, {}) in UI — server pins id on click.",
  inputSchema: CompleteTaskSchema,
  name: "complete_task",
  outputSchema: TaskViewToolOutputSchema,
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
