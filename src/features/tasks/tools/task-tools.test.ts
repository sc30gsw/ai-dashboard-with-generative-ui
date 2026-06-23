import { expect, test } from "vite-plus/test";

import { taskTools } from "~/features/tasks/tools";

const DESTRUCTIVE_TOOL_NAMES = new Set(["delete_task", "bulk_delete_tasks", "delete_all_tasks"]);

test("every task tool is exposed on the Web MCP surface", () => {
  for (const tool of taskTools) {
    expect(tool.exposeToWebMcp, tool.name).toBe(true);
  }
});

test("destructive flag is set exactly on the irreversible tools", () => {
  for (const tool of taskTools) {
    expect(tool.destructive, tool.name).toBe(DESTRUCTIVE_TOOL_NAMES.has(tool.name));
  }
});
