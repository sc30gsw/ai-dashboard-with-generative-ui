import { beforeEach, expect, test, vi } from "vite-plus/test";

const { reorderPatchMock, refetchTasksCollectionMock, toastDangerMock, toastSuccessMock } =
  vi.hoisted(() => ({
    reorderPatchMock: vi.fn(),
    refetchTasksCollectionMock: vi.fn(),
    toastDangerMock: vi.fn(),
    toastSuccessMock: vi.fn(),
  }));

vi.mock("~/lib/eden", () => ({
  edenClient: () => ({
    tasks: {
      reorder: {
        patch: reorderPatchMock,
      },
    },
  }),
}));

vi.mock("~/features/tasks/collections/tasks-collection", () => ({
  refetchTasksCollection: refetchTasksCollectionMock,
}));

vi.mock("@heroui/react", () => ({
  toast: {
    danger: toastDangerMock,
    success: toastSuccessMock,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

test("calls the reorder endpoint with orderedIds and refetches on success", async () => {
  reorderPatchMock.mockResolvedValueOnce({
    data: { ok: true, tasks: [] },
    error: null,
  });

  const { applyReorderSuggestion } = await import("~/lib/apply-reorder");

  await applyReorderSuggestion(["t2", "t1"]);

  expect(reorderPatchMock).toHaveBeenCalledWith({ orderedIds: ["t2", "t1"] });
  expect(refetchTasksCollectionMock).toHaveBeenCalledTimes(1);
  expect(toastSuccessMock).toHaveBeenCalledTimes(1);
  expect(toastDangerMock).not.toHaveBeenCalled();
});

test("shows a danger toast and does not refetch on transport error", async () => {
  reorderPatchMock.mockResolvedValueOnce({
    data: null,
    error: { status: 500 },
  });

  const { applyReorderSuggestion } = await import("~/lib/apply-reorder");

  await applyReorderSuggestion(["t1"]);

  expect(refetchTasksCollectionMock).not.toHaveBeenCalled();
  expect(toastDangerMock).toHaveBeenCalledTimes(1);
});

test("shows a danger toast and does not refetch when the server reports failure", async () => {
  reorderPatchMock.mockResolvedValueOnce({
    data: { message: "更新に失敗しました。", ok: false },
    error: null,
  });

  const { applyReorderSuggestion } = await import("~/lib/apply-reorder");

  await applyReorderSuggestion(["t1"]);

  expect(refetchTasksCollectionMock).not.toHaveBeenCalled();
  expect(toastDangerMock).toHaveBeenCalledWith("更新に失敗しました。");
});

test("shows a danger toast when refetching the tasks collection rejects", async () => {
  reorderPatchMock.mockResolvedValueOnce({
    data: { ok: true, tasks: [] },
    error: null,
  });
  refetchTasksCollectionMock.mockRejectedValueOnce(new Error("network down"));

  const { applyReorderSuggestion } = await import("~/lib/apply-reorder");

  await applyReorderSuggestion(["t1"]);

  expect(toastDangerMock).toHaveBeenCalledWith("タスク一覧の再取得に失敗しました。");
  expect(toastSuccessMock).not.toHaveBeenCalled();
});
