// @vitest-environment happy-dom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";

import { WebMcpTools } from "~/features/tasks/components/web-mcp-tools";
import type { TaskTool } from "~/features/tasks/tools/tool";

const { addPost, listPost } = vi.hoisted(() => ({ addPost: vi.fn(), listPost: vi.fn() }));

vi.mock("~/lib/eden", () => ({
  edenClient: () => ({ tasks: { add: { post: addPost }, list: { post: listPost } } }),
}));
vi.mock("~/features/tasks/collections/tasks-collection", () => ({
  refetchTasksCollection: vi.fn(),
}));

const EXPECTED_TOOL_NAMES = [
  "add_task",
  "bulk_add_tasks",
  "list_tasks",
  "complete_task",
  "update_task",
  "bulk_update_tasks",
  "delete_task",
  "bulk_delete_tasks",
  "delete_all_tasks",
] as const satisfies readonly TaskTool["name"][];

type TestModelContext = {
  listTools: () => { name: string }[];
  callTool: (params: {
    name: TaskTool["name"];
    arguments?: Record<string, unknown>;
  }) => Promise<{ isError?: boolean }>;
};

function modelContext() {
  return (navigator as unknown as { modelContext: TestModelContext }).modelContext;
}

beforeEach(() => {
  addPost.mockReset();
  addPost.mockResolvedValue({
    data: { ok: true, task: { completed: false, id: "t1", priority: "medium", title: "test" } },
    error: null,
  });
  listPost.mockReset();
  listPost.mockResolvedValue({ data: { ok: true, tasks: [] }, error: null });
});
afterEach(cleanup);

test("registers every exposed task tool on navigator.modelContext", async () => {
  render(<WebMcpTools />);

  await waitFor(() => {
    const names = modelContext()
      .listTools()
      .map((tool) => tool.name);
    for (const expected of EXPECTED_TOOL_NAMES) {
      expect(names).toContain(expected);
    }
  });
});

test("calling a read-only tool reaches the Eden client without confirmation", async () => {
  render(<WebMcpTools />);
  await waitFor(() => expect(modelContext().listTools().length).toBeGreaterThan(0));

  //? list_tasks は mutates:false なので elicitation 不要で Eden に到達する。
  const result = await modelContext().callTool({ arguments: {}, name: "list_tasks" });

  expect(listPost).toHaveBeenCalledTimes(1);
  expect(result.isError ?? false).toBe(false);
});

test("a mutating tool is refused when no client can confirm (fail safe)", async () => {
  render(<WebMcpTools />);
  await waitFor(() => expect(modelContext().listTools().length).toBeGreaterThan(0));

  //? add_task は mutates:true。確認できるクライアントが無い環境では安全側で拒否し、Eden に到達しない。
  const result = await modelContext().callTool({
    arguments: { priority: "medium", title: "test" },
    name: "add_task",
  });

  expect(result.isError).toBe(true);
  expect(addPost).not.toHaveBeenCalled();
});

test("a destructive tool is refused when no client can confirm (fail safe)", async () => {
  render(<WebMcpTools />);
  await waitFor(() => expect(modelContext().listTools().length).toBeGreaterThan(0));

  const result = await modelContext().callTool({ arguments: {}, name: "delete_all_tasks" });

  expect(result.isError).toBe(true);
});
