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

  await db.run(
    `CREATE TABLE tasks (
      id text PRIMARY KEY NOT NULL,
      title text NOT NULL,
      priority text DEFAULT 'medium' NOT NULL,
      completed integer DEFAULT 0 NOT NULL,
      created_at integer DEFAULT (unixepoch()) NOT NULL
    )`,
  );

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
