// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";

//? TaskTable は taskListFiltersToQuery() 経由で sortBy:"createdAt", sortDirection:"desc" を
//? ハードコードして要求する（フィルタフォームにソート UI は無い）。この結合テストは、実際の
//? TaskTable コンポーネントを描画し、sortOrder が1件でも設定されていれば要求方向(desc)を無視して
//? sortOrder 優先で並ぶことを、ビルダー単体テストではなく実 UI 呼び出し経路で証明する。
const { listGet } = vi.hoisted(() => ({ listGet: vi.fn() }));

vi.mock("~/lib/eden", () => ({
  edenClient: () => ({
    tasks: {
      add: { post: vi.fn() },
      complete: { post: vi.fn() },
      delete: { post: vi.fn() },
      list: { get: listGet },
      update: { post: vi.fn() },
    },
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to?: string }) => (
    <a href={typeof to === "string" ? to : "#"} {...props}>
      {children}
    </a>
  ),
}));

beforeEach(() => {
  listGet.mockReset();
});

afterEach(() => {
  cleanup();
  vi.resetModules();
});

test("TaskTable (hardcoded createdAt/desc request) shows sortOrder-based order once any task has a sortOrder set", async () => {
  listGet.mockResolvedValue({
    data: {
      ok: true,
      tasks: [
        {
          completed: false,
          createdAt: new Date(1_000),
          id: "old-high-order",
          priority: "medium",
          sortOrder: 5,
          title: "Old high order",
        },
        {
          completed: false,
          createdAt: new Date(3_000),
          id: "mid-no-order",
          priority: "medium",
          sortOrder: null,
          title: "Mid no order",
        },
        {
          completed: false,
          createdAt: new Date(5_000),
          id: "new-low-order",
          priority: "medium",
          sortOrder: 1,
          title: "New low order",
        },
      ],
    },
    error: null,
  });

  const { tasksCollection } = await import("~/features/tasks/collections/tasks-collection");
  const { TaskTable } = await import("~/features/tasks/components/task-table");
  await tasksCollection.stateWhenReady();

  render(
    <Suspense fallback={<p>loading</p>}>
      <TaskTable filters={{ priority: "all", search: "", status: "all" }} />
    </Suspense>,
  );

  const links = await screen.findAllByRole("link");

  expect(links.map((link) => link.textContent)).toEqual([
    "New low order",
    "Old high order",
    "Mid no order",
  ]);
});
