import { createLiveQueryCollection } from "@tanstack/react-db";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";

//? buildFilteredTasksQuery が sortOrder 優先（asc, null は末尾）+ createdAt tie-break の
//? サーバー側 orderFor() と同じ規約でクライアントの live query を並べることを検証する。
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

beforeEach(() => {
  listGet.mockReset();
});

afterEach(() => {
  vi.resetModules();
});

test("default (createdAt/asc) orders by sortOrder ascending, nulls last, tie-broken by createdAt", async () => {
  listGet.mockResolvedValue({
    data: {
      ok: true,
      tasks: [
        {
          completed: false,
          createdAt: new Date(1_000),
          id: "no-order-early",
          priority: "medium",
          sortOrder: null,
          title: "a",
        },
        {
          completed: false,
          createdAt: new Date(4_000),
          id: "order-2",
          priority: "medium",
          sortOrder: 2,
          title: "b",
        },
        {
          completed: false,
          createdAt: new Date(2_000),
          id: "order-1-early",
          priority: "medium",
          sortOrder: 1,
          title: "c",
        },
        {
          completed: false,
          createdAt: new Date(3_000),
          id: "order-1-late",
          priority: "medium",
          sortOrder: 1,
          title: "d",
        },
        {
          completed: false,
          createdAt: new Date(5_000),
          id: "no-order-late",
          priority: "medium",
          sortOrder: null,
          title: "e",
        },
      ],
    },
    error: null,
  });

  const { tasksCollection } = await import("~/features/tasks/collections/tasks-collection");
  const { buildFilteredTasksQuery } = await import("~/features/tasks/utils/tasks-live-query");
  await tasksCollection.stateWhenReady();

  const liveCollection = createLiveQueryCollection((q) =>
    buildFilteredTasksQuery(q, {
      priority: "all",
      search: "",
      sortBy: "createdAt",
      sortDirection: "asc",
      status: "all",
    }),
  );
  await liveCollection.stateWhenReady();

  expect(liveCollection.toArray.map((task) => task.id)).toEqual([
    "order-1-early",
    "order-1-late",
    "order-2",
    "no-order-early",
    "no-order-late",
  ]);
});

test("explicit createdAt/desc still prioritizes sortOrder when any task has one set (overrides requested direction)", async () => {
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
          title: "a",
        },
        {
          completed: false,
          createdAt: new Date(3_000),
          id: "mid-no-order",
          priority: "medium",
          sortOrder: null,
          title: "b",
        },
        {
          completed: false,
          createdAt: new Date(5_000),
          id: "new-low-order",
          priority: "medium",
          sortOrder: 1,
          title: "c",
        },
      ],
    },
    error: null,
  });

  const { tasksCollection } = await import("~/features/tasks/collections/tasks-collection");
  const { buildFilteredTasksQuery } = await import("~/features/tasks/utils/tasks-live-query");
  await tasksCollection.stateWhenReady();

  const liveCollection = createLiveQueryCollection((q) =>
    buildFilteredTasksQuery(q, {
      priority: "all",
      search: "",
      sortBy: "createdAt",
      sortDirection: "desc",
      status: "all",
    }),
  );
  await liveCollection.stateWhenReady();

  expect(liveCollection.toArray.map((task) => task.id)).toEqual([
    "new-low-order",
    "old-high-order",
    "mid-no-order",
  ]);
});

test("createdAt/desc falls back to createdAt descending when NO task has sortOrder set", async () => {
  listGet.mockResolvedValue({
    data: {
      ok: true,
      tasks: [
        {
          completed: false,
          createdAt: new Date(1_000),
          id: "early",
          priority: "medium",
          sortOrder: null,
          title: "a",
        },
        {
          completed: false,
          createdAt: new Date(3_000),
          id: "mid",
          priority: "medium",
          sortOrder: null,
          title: "b",
        },
        {
          completed: false,
          createdAt: new Date(5_000),
          id: "late",
          priority: "medium",
          sortOrder: null,
          title: "c",
        },
      ],
    },
    error: null,
  });

  const { tasksCollection } = await import("~/features/tasks/collections/tasks-collection");
  const { buildFilteredTasksQuery } = await import("~/features/tasks/utils/tasks-live-query");
  await tasksCollection.stateWhenReady();

  const liveCollection = createLiveQueryCollection((q) =>
    buildFilteredTasksQuery(q, {
      priority: "all",
      search: "",
      sortBy: "createdAt",
      sortDirection: "desc",
      status: "all",
    }),
  );
  await liveCollection.stateWhenReady();

  expect(liveCollection.toArray.map((task) => task.id)).toEqual(["late", "mid", "early"]);
});
