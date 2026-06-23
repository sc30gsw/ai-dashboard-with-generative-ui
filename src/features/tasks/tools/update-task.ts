import { TaskViewToolOutputSchema, UpdateTaskSchema } from "~/features/tasks/api/task-model";
import type { TaskTool } from "~/features/tasks/tools/tool";
import { edenClient } from "~/lib/eden";

export const updateTaskTool = {
  additive: false,
  description:
    "Update one task by id (title, priority, completed). Requires user confirmation. For rename use sourceTitle to find + title for new value.",
  destructive: false,
  exposeToWebMcp: true,
  inputSchema: UpdateTaskSchema,
  mutates: true,
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
