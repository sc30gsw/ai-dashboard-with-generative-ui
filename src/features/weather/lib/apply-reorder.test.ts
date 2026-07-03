import { beforeEach, expect, test, vi } from "vite-plus/test";

const { reorderPostMock, refetchTasksCollectionMock, toastDangerMock, toastSuccessMock } =
  vi.hoisted(() => ({
    reorderPostMock: vi.fn(),
    refetchTasksCollectionMock: vi.fn(),
    toastDangerMock: vi.fn(),
    toastSuccessMock: vi.fn(),
  }));

vi.mock("~/lib/eden", () => ({
  edenClient: () => ({
    tasks: {
      reorder: {
        post: reorderPostMock,
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
  reorderPostMock.mockResolvedValueOnce({
    data: { ok: true, tasks: [] },
    error: null,
  });

  const { applyReorderSuggestion } = await import("~/features/weather/lib/apply-reorder");

  await applyReorderSuggestion(["t2", "t1"]);

  expect(reorderPostMock).toHaveBeenCalledWith({ orderedIds: ["t2", "t1"] });
  expect(refetchTasksCollectionMock).toHaveBeenCalledTimes(1);
  expect(toastSuccessMock).toHaveBeenCalledTimes(1);
  expect(toastDangerMock).not.toHaveBeenCalled();
});

test("shows a danger toast and does not refetch on transport error", async () => {
  reorderPostMock.mockResolvedValueOnce({
    data: null,
    error: { status: 500 },
  });

  const { applyReorderSuggestion } = await import("~/features/weather/lib/apply-reorder");

  await applyReorderSuggestion(["t1"]);

  expect(refetchTasksCollectionMock).not.toHaveBeenCalled();
  expect(toastDangerMock).toHaveBeenCalledTimes(1);
});

test("shows a danger toast and does not refetch when the server reports failure", async () => {
  reorderPostMock.mockResolvedValueOnce({
    data: { message: "更新に失敗しました。", ok: false },
    error: null,
  });

  const { applyReorderSuggestion } = await import("~/features/weather/lib/apply-reorder");

  await applyReorderSuggestion(["t1"]);

  expect(refetchTasksCollectionMock).not.toHaveBeenCalled();
  expect(toastDangerMock).toHaveBeenCalledWith("更新に失敗しました。");
});
