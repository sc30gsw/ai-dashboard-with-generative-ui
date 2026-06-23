// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";

import type { TaskView } from "~/features/tasks/api/task-model";
import { TaskDetailView } from "~/features/tasks/components/task-detail-view";

const { deleteMock, searchState, updateMock } = vi.hoisted(() => ({
  deleteMock: vi.fn(),
  searchState: { edit: undefined as boolean | undefined },
  updateMock: vi.fn(),
}));

const navigateMock = vi.fn();

vi.mock("~/features/tasks/collections/tasks-collection", () => ({
  tasksCollection: { delete: deleteMock, update: updateMock },
}));

//? view は router の <Link> / useNavigate / getRouteApi(...).useSearch を使う。RouterProvider 無しの
//? コンポーネント単体テストで落ちるため、これらをスタブする。編集モードは getRouteApi().useSearch() の
//? edit で駆動するので、searchState を可変にしてテストごとに制御する。
vi.mock("@tanstack/react-router", () => ({
  getRouteApi: () => ({
    useNavigate: () => navigateMock,
    useSearch: () => searchState,
  }),
  Link: ({ children, to, ...props }: { children: ReactNode; to?: string }) => (
    <a href={typeof to === "string" ? to : "#"} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => navigateMock,
}));

function makeTask(overrides: Partial<TaskView> = {}): TaskView {
  return {
    completed: false,
    createdAt: new Date("2026-06-23T00:00:00.000Z"),
    id: "t1",
    priority: "medium",
    title: "Buy milk",
    ...overrides,
  };
}

beforeEach(() => {
  updateMock.mockReset();
  updateMock.mockReturnValue({ isPersisted: { promise: Promise.resolve() } });
  deleteMock.mockReset();
  deleteMock.mockReturnValue({ isPersisted: { promise: Promise.resolve() } });
  navigateMock.mockReset();
  searchState.edit = undefined;
});

afterEach(cleanup);

test("an open task shows Mark complete and sets completed=true on press", async () => {
  render(<TaskDetailView task={makeTask()} />);

  fireEvent.click(screen.getByRole("button", { name: "Mark complete" }));

  await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
  const [id, recipe] = updateMock.mock.calls[0] ?? [];
  expect(id).toBe("t1");

  const draft = makeTask();
  recipe(draft);
  expect(draft.completed).toBe(true);
});

test("a completed task shows Reopen and sets completed=false on press", async () => {
  render(<TaskDetailView task={makeTask({ completed: true })} />);

  fireEvent.click(screen.getByRole("button", { name: "Reopen" }));

  await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
  const [, recipe] = updateMock.mock.calls[0] ?? [];

  const draft = makeTask({ completed: true });
  recipe(draft);
  expect(draft.completed).toBe(false);
});

test("clicking Edit switches to edit mode via the URL query", () => {
  render(<TaskDetailView task={makeTask()} />);

  fireEvent.click(screen.getByRole("button", { name: "Edit" }));

  expect(navigateMock).toHaveBeenCalledWith({ replace: true, search: { edit: true } });
});

test("editing the title (edit mode driven by ?edit) updates the task while keeping priority", async () => {
  searchState.edit = true;
  render(<TaskDetailView task={makeTask()} />);

  const input = await screen.findByRole("textbox", { name: "Task title" });
  fireEvent.change(input, { target: { value: "Buy oat milk" } });

  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
  const [id, recipe] = updateMock.mock.calls[0] ?? [];
  expect(id).toBe("t1");

  const draft = makeTask();
  recipe(draft);
  expect(draft.title).toBe("Buy oat milk");
  expect(draft.priority).toBe("medium");

  //? 保存後は ?edit を外して閲覧モードへ戻す。
  expect(navigateMock).toHaveBeenCalledWith({ replace: true, search: { edit: undefined } });
});

test("deleting a task confirms, calls the collection, then navigates away", async () => {
  render(<TaskDetailView task={makeTask()} />);

  fireEvent.click(screen.getByRole("button", { name: "Delete" }));

  const confirm = await screen.findByRole("button", { name: "Delete task" });
  fireEvent.click(confirm);

  await waitFor(() => expect(deleteMock).toHaveBeenCalledWith("t1"));
  expect(navigateMock).toHaveBeenCalledWith({ to: "/tasks" });
});
