import { Result } from "better-result";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";

//? 楽観的 mutation の API 失敗時に、トランザクションが reject し（→ TanStack DB が自動ロールバック）、
//? 楽観的に挿入したアイテムがコレクションから消えることを検証する（REVIEW 楽観ロールバック）。
const { addPost, completePost, listGet, updatePost } = vi.hoisted(() => ({
  addPost: vi.fn(),
  completePost: vi.fn(),
  listGet: vi.fn(),
  updatePost: vi.fn(),
}));

vi.mock("~/lib/eden", () => ({
  edenClient: () => ({
    tasks: {
      add: { post: addPost },
      complete: { post: completePost },
      list: { get: listGet },
      update: { post: updatePost },
    },
  }),
}));

beforeEach(() => {
  listGet.mockReset();
  listGet.mockResolvedValue({ data: { ok: true, tasks: [] }, error: null });
  addPost.mockReset();
  completePost.mockReset();
  updatePost.mockReset();
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

test("update changing title + completed sends the full field set, not complete-only (R5)", async () => {
  const id = crypto.randomUUID();
  //? 既存タスクを 1件シードする（list が返す）。
  listGet.mockResolvedValue({
    data: {
      ok: true,
      tasks: [{ completed: false, createdAt: new Date(), id, priority: "medium", title: "old" }],
    },
    error: null,
  });
  updatePost.mockResolvedValue({
    data: {
      ok: true,
      task: { completed: true, createdAt: new Date(), id, priority: "medium", title: "new" },
    },
    error: null,
  });

  const { tasksCollection } = await import("~/features/tasks/collections/tasks-collection");
  await tasksCollection.stateWhenReady();

  //? title と completed を同時に変更。complete-only ルートに落ちず /tasks/update に流れること。
  const tx = tasksCollection.update(id, (draft) => {
    draft.completed = true;
    draft.title = "new";
  });

  await tx.isPersisted.promise;

  expect(updatePost).toHaveBeenCalledTimes(1);
  expect(completePost).not.toHaveBeenCalled();

  const [payload] = updatePost.mock.calls[0] ?? [];
  expect(payload).toMatchObject({ completed: true, id, title: "new" });
});

test("queryFn coerces a serialized (string) createdAt from the HTTP response (N1)", async () => {
  const id = crypto.randomUUID();
  //? Eden(HTTP) は createdAt を ISO 文字列で返す。z.date() のままだと parse が throw し、
  //? コレクションがブラウザで一切ロードできなくなる回帰を防ぐ。
  listGet.mockResolvedValue({
    data: {
      ok: true,
      tasks: [
        {
          completed: false,
          createdAt: "2026-06-23T00:00:00.000Z",
          id,
          priority: "medium",
          title: "wire",
        },
      ],
    },
    error: null,
  });

  const { tasksCollection } = await import("~/features/tasks/collections/tasks-collection");
  await tasksCollection.stateWhenReady();

  //? 文字列 createdAt が Date に正規化され、アイテムがロードされること。
  expect(tasksCollection.has(id)).toBe(true);
  expect(tasksCollection.get(id)?.createdAt).toBeInstanceOf(Date);
});
