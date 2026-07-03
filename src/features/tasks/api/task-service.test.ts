import { createClient } from "@libsql/client";
import { Result } from "better-result";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, expect, test, vi } from "vite-plus/test";

import { tasks } from "~/db/schema";

//? in-memory libsql で実 SQL を流し、bulkUpdate のフィルタ挙動を SQL レベルで検証する。
const { testDb } = vi.hoisted(() => {
  return { testDb: { current: null as ReturnType<typeof makeDb> | null } };
});

function makeDb() {
  const client = createClient({ url: ":memory:" });

  return drizzle({ client, schema: { tasks } });
}

async function createTasksTable(db: ReturnType<typeof makeDb>) {
  await db.run(
    `CREATE TABLE tasks (
      id text PRIMARY KEY NOT NULL,
      title text NOT NULL,
      priority text DEFAULT 'medium' NOT NULL,
      completed integer DEFAULT 0 NOT NULL,
      created_at integer DEFAULT (unixepoch()) NOT NULL,
      due_date integer,
      location text,
      sort_order integer
    )`,
  );
}

vi.mock("~/db", () => ({
  get db() {
    if (!testDb.current) {
      throw new Error("test db not initialized");
    }

    return testDb.current;
  },
}));

async function seed() {
  const db = makeDb();
  testDb.current = db;

  await createTasksTable(db);

  await db.insert(tasks).values([
    { id: "h1", priority: "high", title: "high one", completed: false },
    { id: "h2", priority: "high", title: "high two", completed: false },
    { id: "m1", priority: "medium", title: "medium one", completed: false },
    { id: "l1", priority: "low", title: "low one", completed: false },
  ]);
}

beforeEach(async () => {
  await seed();
});

test("bulkUpdate with priorityFilter:high + completed:true updates ONLY high tasks (#1)", async () => {
  const { TaskService } = await import("~/features/tasks/api/task-service");

  const result = await TaskService.bulkUpdate({
    completed: true,
    priorityFilter: "high",
    status: "all",
  });

  expect(Result.isOk(result)).toBe(true);

  if (Result.isOk(result)) {
    expect(result.value.updatedCount).toBe(2);
  }

  const all = await TaskService.list({
    sortBy: "createdAt",
    sortDirection: "asc",
    status: "all",
  });

  expect(Result.isOk(all)).toBe(true);

  if (Result.isOk(all)) {
    const completed = all.value
      .filter((task) => task.completed)
      .map((task) => task.id)
      .sort();
    expect(completed).toEqual(["h1", "h2"]);
  }
});

test("bulkUpdate with no filter and no confirmAll throws (#6)", async () => {
  const { TaskService } = await import("~/features/tasks/api/task-service");

  const result = await TaskService.bulkUpdate({ completed: true, status: "all" });

  expect(Result.isError(result)).toBe(true);

  if (Result.isError(result)) {
    //? service は throw を TaskError でラップする。元メッセージは cause に入る。
    const cause = result.error.cause;
    expect(cause instanceof Error ? cause.message : String(cause)).toMatch(/filter|confirmAll/i);
  }

  const all = await TaskService.list({
    sortBy: "createdAt",
    sortDirection: "asc",
    status: "all",
  });

  //? ガードにより全件は更新されない（どのタスクも completed にならない）。
  if (Result.isOk(all)) {
    expect(all.value.every((task) => !task.completed)).toBe(true);
  }
});

test("bulkUpdate with confirmAll:true updates every task (#6)", async () => {
  const { TaskService } = await import("~/features/tasks/api/task-service");

  const result = await TaskService.bulkUpdate({
    completed: true,
    confirmAll: true,
    status: "all",
  });

  expect(Result.isOk(result)).toBe(true);

  if (Result.isOk(result)) {
    expect(result.value.updatedCount).toBe(4);
  }
});

test("list() with default sortBy orders by sortOrder ascending, nulls last, tie-broken by createdAt", async () => {
  const { TaskService } = await import("~/features/tasks/api/task-service");

  //? 既存の seed() の4件を削除し、sortOrder と createdAt を明示制御したデータで並び順を検証する。
  const db = makeDb();
  testDb.current = db;

  await createTasksTable(db);

  await db.insert(tasks).values([
    { id: "no-order-early", createdAt: new Date(1_000), priority: "medium", title: "a" },
    { id: "order-2", createdAt: new Date(4_000), priority: "medium", sortOrder: 2, title: "b" },
    {
      id: "order-1-late",
      createdAt: new Date(3_000),
      priority: "medium",
      sortOrder: 1,
      title: "c",
    },
    {
      id: "order-1-early",
      createdAt: new Date(2_000),
      priority: "medium",
      sortOrder: 1,
      title: "d",
    },
    { id: "no-order-late", createdAt: new Date(5_000), priority: "medium", title: "e" },
  ]);

  const result = await TaskService.list({
    sortBy: "createdAt",
    sortDirection: "asc",
    status: "all",
  });

  expect(Result.isOk(result)).toBe(true);

  if (Result.isOk(result)) {
    expect(result.value.map((task) => task.id)).toEqual([
      "order-1-early",
      "order-1-late",
      "order-2",
      "no-order-early",
      "no-order-late",
    ]);
  }
});

test("list() with sortBy:createdAt and sortDirection:desc still prioritizes sortOrder when any task has one set (overrides requested direction)", async () => {
  const { TaskService } = await import("~/features/tasks/api/task-service");

  //? sortOrder が createdAt の並びと矛盾するデータを用意する。以前は desc 指定時に sortOrder を
  //? 無視していたが、現在の決定では sortOrder が1件でもあれば要求された方向に関わらず
  //? sortOrder 優先（昇順・NULL は末尾）で並ぶ（並べ替え操作の意図を尊重するため）。
  const db = makeDb();
  testDb.current = db;

  await createTasksTable(db);

  await db.insert(tasks).values([
    {
      id: "old-high-order",
      createdAt: new Date(1_000),
      priority: "medium",
      sortOrder: 5,
      title: "a",
    },
    { id: "mid-no-order", createdAt: new Date(3_000), priority: "medium", title: "b" },
    {
      id: "new-low-order",
      createdAt: new Date(5_000),
      priority: "medium",
      sortOrder: 1,
      title: "c",
    },
  ]);

  const result = await TaskService.list({
    sortBy: "createdAt",
    sortDirection: "desc",
    status: "all",
  });

  expect(Result.isOk(result)).toBe(true);

  if (Result.isOk(result)) {
    expect(result.value.map((task) => task.id)).toEqual([
      "new-low-order",
      "old-high-order",
      "mid-no-order",
    ]);
  }
});

test("list() with sortBy:createdAt and sortDirection:desc falls back to createdAt descending when NO task has sortOrder set", async () => {
  const { TaskService } = await import("~/features/tasks/api/task-service");

  //? どのタスクにも sortOrder が設定されていない場合は、従来通り要求された方向
  //? （createdAt 降順）で並ぶことを検証する。
  const db = makeDb();
  testDb.current = db;

  await createTasksTable(db);

  await db.insert(tasks).values([
    { id: "early", createdAt: new Date(1_000), priority: "medium", title: "a" },
    { id: "mid", createdAt: new Date(3_000), priority: "medium", title: "b" },
    { id: "late", createdAt: new Date(5_000), priority: "medium", title: "c" },
  ]);

  const result = await TaskService.list({
    sortBy: "createdAt",
    sortDirection: "desc",
    status: "all",
  });

  expect(Result.isOk(result)).toBe(true);

  if (Result.isOk(result)) {
    expect(result.value.map((task) => task.id)).toEqual(["late", "mid", "early"]);
  }
});

test("bulkDelete with an all-undefined filter throws and deletes nothing (R2)", async () => {
  const { TaskService } = await import("~/features/tasks/api/task-service");

  //? schema の refine をすり抜けても、service 層の防御が空フィルタの全件 DELETE を止める。
  const result = await TaskService.bulkDelete({ status: "all" });

  expect(Result.isError(result)).toBe(true);

  if (Result.isError(result)) {
    const cause = result.error.cause;
    expect(cause instanceof Error ? cause.message : String(cause)).toMatch(/filter/i);
  }

  const all = await TaskService.list({
    sortBy: "createdAt",
    sortDirection: "asc",
    status: "all",
  });

  //? ガードにより全件 DELETE は起きず、4件残ったまま。
  if (Result.isOk(all)) {
    expect(all.value.length).toBe(4);
  }
});

test("reorder applies sortOrder 1..N in the given orderedIds order", async () => {
  const { TaskService } = await import("~/features/tasks/api/task-service");

  const result = await TaskService.reorder({ orderedIds: ["l1", "h1", "m1"] });

  expect(Result.isOk(result)).toBe(true);

  const all = await TaskService.list({
    sortBy: "createdAt",
    sortDirection: "asc",
    status: "all",
  });

  expect(Result.isOk(all)).toBe(true);

  if (Result.isOk(all)) {
    const byId = new Map(all.value.map((task) => [task.id, task.sortOrder]));
    expect(byId.get("l1")).toBe(1);
    expect(byId.get("h1")).toBe(2);
    expect(byId.get("m1")).toBe(3);
    //? orderedIds に含まれない h2 の sortOrder は変更されない（未設定のまま）。
    expect(byId.get("h2")).toBeNull();
  }
});

test("reorder with an unknown id fails all-or-nothing (no sortOrder is changed)", async () => {
  const { TaskService } = await import("~/features/tasks/api/task-service");

  const result = await TaskService.reorder({ orderedIds: ["h1", "does-not-exist"] });

  expect(Result.isError(result)).toBe(true);

  const all = await TaskService.list({
    sortBy: "createdAt",
    sortDirection: "asc",
    status: "all",
  });

  expect(Result.isOk(all)).toBe(true);

  if (Result.isOk(all)) {
    //? 未知 id を含む場合は書き込み前に検証で弾かれ、既存の sortOrder は誰も変更されていない。
    expect(all.value.every((task) => task.sortOrder === null)).toBe(true);
  }
});
