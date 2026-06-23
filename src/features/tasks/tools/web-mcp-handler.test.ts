import { beforeEach, expect, test, vi } from "vite-plus/test";

import { type ElicitInput, executeWebMcpTool } from "~/features/tasks/tools/adapters/web-mcp";
import { addTaskTool } from "~/features/tasks/tools/add-task";
import { deleteAllTasksTool } from "~/features/tasks/tools/delete-all-tasks";
import { listTasksTool } from "~/features/tasks/tools/list-tasks";

const { RESULT, runTaskTool } = vi.hoisted(() => {
  const result = { ok: true };

  return { RESULT: result, runTaskTool: vi.fn(() => Promise.resolve(result)) };
});
vi.mock("~/features/tasks/tools", () => ({ runTaskTool }));

const accept: ElicitInput = async () => ({ action: "accept" });
const decline: ElicitInput = async () => ({ action: "decline" });
const reject: ElicitInput = async () => {
  throw new Error("client does not support elicitation");
};

beforeEach(() => {
  runTaskTool.mockClear();
});

test("read-only tool runs without requesting confirmation", async () => {
  //? list_tasks は mutates:false。Web MCP では確認なしで実行できる（decline でも素通り）。
  await expect(executeWebMcpTool(listTasksTool, {}, decline)).resolves.toBe(RESULT);
  expect(runTaskTool).toHaveBeenCalledTimes(1);
});

test("mutating tool runs when the user accepts the elicitation", async () => {
  //? add_task は additive だが mutates:true。Web MCP では確認を要求する。
  await expect(
    executeWebMcpTool(addTaskTool, { priority: "medium", title: "x" }, accept),
  ).resolves.toBe(RESULT);
  expect(runTaskTool).toHaveBeenCalledTimes(1);
});

test("destructive tool runs when the user accepts the elicitation", async () => {
  await expect(executeWebMcpTool(deleteAllTasksTool, {}, accept)).resolves.toBe(RESULT);
  expect(runTaskTool).toHaveBeenCalledTimes(1);
});

test("mutating tool is refused when the user declines (run is never called)", async () => {
  await expect(executeWebMcpTool(deleteAllTasksTool, {}, decline)).rejects.toThrow(/canceled/);
  expect(runTaskTool).not.toHaveBeenCalled();
});

test("mutating tool fails safe when the client cannot elicit", async () => {
  await expect(executeWebMcpTool(deleteAllTasksTool, {}, reject)).rejects.toThrow(/canceled/);
  expect(runTaskTool).not.toHaveBeenCalled();
});
