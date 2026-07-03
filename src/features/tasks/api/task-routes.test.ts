import { Result } from "better-result";
import { beforeEach, expect, test, vi } from "vite-plus/test";

//? service を差し替え、エラー分岐（内部メッセージ）でも汎用メッセージへ変換されることを検証する。
const { listResult, reorderResult } = vi.hoisted(() => {
  return {
    listResult: { current: null as unknown },
    reorderResult: { current: null as unknown },
  };
});

vi.mock("~/features/tasks/api/task-service", () => ({
  TaskService: {
    list: async () => listResult.current,
    reorder: async () => reorderResult.current,
  },
}));

//? errorResponse は内部メッセージを console.error に出す。テスト出力を汚さないよう抑制する。
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const INTERNAL_MESSAGE = "Failed to list tasks (INTERNAL DETAIL)";

test("error branch returns a generic message, not the internal TaskError message", async () => {
  const { taskRoutes } = await import("~/features/tasks/api/task-routes");

  listResult.current = Result.err({ message: INTERNAL_MESSAGE });

  const response = await taskRoutes.handle(new Request("http://localhost/tasks/list"));
  const data = await response.json();

  expect(data.ok).toBe(false);
  expect(data.message).toBe("操作に失敗しました。");
  //? 内部の TaskError メッセージがクライアントへ漏れていないこと。
  expect(data.message).not.toContain("INTERNAL DETAIL");
});

test("success branch returns the real tasks unchanged", async () => {
  const { taskRoutes } = await import("~/features/tasks/api/task-routes");

  const tasks = [{ completed: false, id: "1", priority: "high", title: "t" }];
  listResult.current = Result.ok(tasks);

  const response = await taskRoutes.handle(new Request("http://localhost/tasks/list"));
  const data = await response.json();

  expect(data.ok).toBe(true);
  expect(data.tasks).toEqual(tasks);
});

test("POST /tasks/reorder with a valid body returns ok:true", async () => {
  const { taskRoutes } = await import("~/features/tasks/api/task-routes");

  const tasks = [{ completed: false, id: "1", priority: "high", title: "t", sortOrder: 1 }];
  reorderResult.current = Result.ok(tasks);

  const response = await taskRoutes.handle(
    new Request("http://localhost/tasks/reorder", {
      body: JSON.stringify({ orderedIds: ["1"] }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }),
  );
  const data = await response.json();

  expect(data.ok).toBe(true);
  expect(data.tasks).toEqual(tasks);
});

test("POST /tasks/reorder with an empty orderedIds fails validation", async () => {
  const { taskRoutes } = await import("~/features/tasks/api/task-routes");

  const response = await taskRoutes.handle(
    new Request("http://localhost/tasks/reorder", {
      body: JSON.stringify({ orderedIds: [] }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }),
  );

  expect(response.status).not.toBe(200);
});
