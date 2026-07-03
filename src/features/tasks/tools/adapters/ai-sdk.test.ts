import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, expect, test, vi } from "vite-plus/test";

import { tasks } from "~/db/schema";

//? in-memory libsql で実 SQL を流し、resolveSingleTask の完全一致解決を検証する（R8）。
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
      created_at integer DEFAULT (unixepoch()) NOT NULL,
      due_date integer,
      location text,
      sort_order integer
    )`,
  );

  //? "報告書を作成" だけが存在。sourceTitle "報告書" は substring 一致するが完全一致ではない。
  await db
    .insert(tasks)
    .values([{ id: "t1", priority: "medium", title: "報告書を作成", completed: false }]);
}

beforeEach(async () => {
  await seed();
});

//? tool().execute は省略可能かつ戻り値が AsyncIterable も取りうる型。実行時は常にプレーンな
//? 結果オブジェクトを返すので、ここで型を絞ってから status/message を検証する。
async function runUpdateTask(input: { sourceTitle: string; title: string }) {
  const { chatTools } = await import("~/features/tasks/tools/adapters/ai-sdk");
  const execute = chatTools.update_task.execute;

  if (!execute) {
    throw new Error("update_task.execute is not defined");
  }

  const output = await execute(input, {
    experimental_context: undefined,
    messages: [],
    toolCallId: "t",
  });

  if (typeof output !== "object" || output === null || !("status" in output)) {
    throw new Error("update_task.execute did not return a result object");
  }

  return output;
}

test("update_task with a non-exact (substring-only) title returns the not-found error (R8)", async () => {
  //? 部分一致のフォールバックは無いので、別タイトルのタスクを解決せず not-found を返す。
  const output = await runUpdateTask({ sourceTitle: "報告書", title: "新タイトル" });

  expect(output.status).toBe("error");

  if (output.status === "error") {
    expect(output.message).toContain("見つかりませんでした");
  }

  //? タスクは更新されていない（タイトルは元のまま）。
  const { TaskService } = await import("~/features/tasks/api/task-service");
  const { Result } = await import("better-result");
  const all = await TaskService.list({ sortBy: "createdAt", sortDirection: "asc", status: "all" });

  if (Result.isOk(all)) {
    expect(all.value[0]?.title).toBe("報告書を作成");
  }
});

test("update_task with an exact title resolves and updates that task (R8)", async () => {
  const output = await runUpdateTask({ sourceTitle: "報告書を作成", title: "報告書を提出" });

  expect(output.status).toBe("success");

  const { TaskService } = await import("~/features/tasks/api/task-service");
  const { Result } = await import("better-result");
  const all = await TaskService.list({ sortBy: "createdAt", sortDirection: "asc", status: "all" });

  if (Result.isOk(all)) {
    expect(all.value[0]?.title).toBe("報告書を提出");
  }
});

test("reorder_tasks.needsApproval is true (read from TASK_TOOL_POLICY)", async () => {
  const { chatTools } = await import("~/features/tasks/tools/adapters/ai-sdk");

  expect(chatTools.reorder_tasks.needsApproval).toBe(true);
});

async function runReorderTasks(input: { orderedIds: string[] }) {
  const { chatTools } = await import("~/features/tasks/tools/adapters/ai-sdk");
  const execute = chatTools.reorder_tasks.execute;

  if (!execute) {
    throw new Error("reorder_tasks.execute is not defined");
  }

  const output = await execute(input, {
    experimental_context: undefined,
    messages: [],
    toolCallId: "t",
  });

  if (typeof output !== "object" || output === null || !("status" in output)) {
    throw new Error("reorder_tasks.execute did not return a result object");
  }

  return output;
}

test("reorder_tasks with a valid ordered id list reorders and returns success with tasks (R8)", async () => {
  const db = makeDb();
  testDb.current = db;

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

  await db.insert(tasks).values([
    { id: "t1", priority: "medium", title: "タスク1", completed: false, sortOrder: 1 },
    { id: "t2", priority: "medium", title: "タスク2", completed: false, sortOrder: 2 },
  ]);

  const output = await runReorderTasks({ orderedIds: ["t2", "t1"] });

  expect(output.status).toBe("success");

  if (output.status === "success") {
    expect(output.message).toContain("2件");
    expect(output.tasks).toHaveLength(2);
  }
});

test("reorder_tasks with an unknown id returns the error result from TaskService.reorder", async () => {
  const output = await runReorderTasks({ orderedIds: ["t1", "unknown-id"] });

  expect(output.status).toBe("error");

  if (output.status === "error") {
    expect(output.message).toBe("Failed to reorder tasks");
  }
});
