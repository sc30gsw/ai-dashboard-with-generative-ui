import { z } from "zod";

import { ListTasksSchema, TaskViewToolOutputSchema } from "~/features/tasks/api/task-model";
import type { TaskTool } from "~/features/tasks/tools/tool";
import { edenClient } from "~/lib/eden";

export const listTasksTool = {
  additive: false,
  description: "List tasks on the board. Supports search, status, priority, and sorting filters.",
  destructive: false,
  exposeToWebMcp: true,
  inputSchema: ListTasksSchema,
  mutates: false,
  name: "list_tasks",
  outputSchema: z.array(TaskViewToolOutputSchema),
  run: async (args) => {
    const input = ListTasksSchema.parse(args ?? {});
    const { data, error } = await edenClient().tasks.list.post(input);

    if (error) {
      throw new Error(`list_tasks failed: ${String(error.status)}`);
    }

    if (!data.ok) {
      throw new Error(data.message);
    }

    return data.tasks;
  },
} as const satisfies TaskTool;
