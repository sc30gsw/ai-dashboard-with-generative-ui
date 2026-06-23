import { Result } from "better-result";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";

//? 楽観的 mutation の API 失敗時に、トランザクションが reject し（→ TanStack DB が自動ロールバック）、
//? 楽観的に挿入したアイテムがコレクションから消えることを検証する（REVIEW 楽観ロールバック）。
const { addPost, listGet } = vi.hoisted(() => ({ addPost: vi.fn(), listGet: vi.fn() }));

vi.mock("~/lib/eden", () => ({
  edenClient: () => ({ tasks: { add: { post: addPost }, list: { get: listGet } } }),
}));

beforeEach(() => {
  listGet.mockReset();
  listGet.mockResolvedValue({ data: { ok: true, tasks: [] }, error: null });
  addPost.mockReset();
});

afterEach(() => {
  vi.resetModules();
});

test("optimistic insert rolls back when the API call fails", async () => {
  addPost.mockResolvedValue({ data: null, error: { status: 500 } });

  const { tasksCollection } = await import("~/features/tasks/collections/tasks-collection");
  await tasksCollection.stateWhenReady();

  const id = crypto.randomUUID();
  const tx = tasksCollection.insert({
    completed: false,
    createdAt: new Date(),
    id,
    priority: "medium",
    title: "will fail",
  });

  //? 楽観的に即時反映されている。
  expect(tasksCollection.has(id)).toBe(true);

  //? API 失敗で persist は reject する（呼び出し側はこれを catch して toast する）。
  const settled = await Result.tryPromise({
    catch: (cause) => cause as Error,
    try: () => tx.isPersisted.promise,
  });

  expect(Result.isError(settled)).toBe(true);

  //? ロールバックで楽観的アイテムは取り除かれる。
  expect(tasksCollection.has(id)).toBe(false);
});
