import { beforeEach, expect, test, vi } from "vite-plus/test";

import { addTaskTool } from "~/features/tasks/tools/add-task";
import { deleteAllTasksTool } from "~/features/tasks/tools/delete-all-tasks";
import { type ElicitInput, executeWebMcpTool } from "~/features/tasks/tools/web-mcp-handler";

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

test("non-destructive tool runs without requesting confirmation", async () => {
  //? decline は破壊的操作をブロックするが、add_task は確認ゲートを完全にスキップしなければならない。
  await expect(executeWebMcpTool(addTaskTool, { title: "x" }, decline)).resolves.toBe(RESULT);
  expect(runTaskTool).toHaveBeenCalledTimes(1);
});

test("destructive tool runs when the user accepts the elicitation", async () => {
  await expect(executeWebMcpTool(deleteAllTasksTool, {}, accept)).resolves.toBe(RESULT);
  expect(runTaskTool).toHaveBeenCalledTimes(1);
});

test("destructive tool is refused when the user declines", async () => {
  await expect(executeWebMcpTool(deleteAllTasksTool, {}, decline)).rejects.toThrow(/canceled/);
  expect(runTaskTool).not.toHaveBeenCalled();
});

test("destructive tool fails safe when the client cannot elicit", async () => {
  await expect(executeWebMcpTool(deleteAllTasksTool, {}, reject)).rejects.toThrow(/canceled/);
  expect(runTaskTool).not.toHaveBeenCalled();
});
