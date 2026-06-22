import { z } from "zod";

import { TaskViewSchema } from "~/features/tasks/schemas/task-schema";
import type { TaskTool } from "~/features/tasks/tools/tool";
import { edenClient } from "~/lib/eden";

export const listTasksTool = {
  description: "List all tasks on the board, oldest first.",
  inputSchema: z.object({}),
  name: "list_tasks",
  outputSchema: z.array(TaskViewSchema),
  run: async () => {
    const { data, error } = await edenClient().tasks.list.get();

    if (error) {
      throw new Error(`list_tasks failed: ${String(error.status)}`);
    }

    if (!data.ok) {
      throw new Error(data.message);
    }

    return data.tasks;
  },
} as const satisfies TaskTool;
