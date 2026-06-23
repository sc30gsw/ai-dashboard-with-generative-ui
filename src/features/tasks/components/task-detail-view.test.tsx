// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";

import type { TaskView } from "~/features/tasks/api/task-model";
import { TaskDetailView } from "~/features/tasks/components/task-detail-view";

const { deleteMock, updateMock } = vi.hoisted(() => ({
  deleteMock: vi.fn(),
  updateMock: vi.fn(),
}));

const navigateMock = vi.fn();

vi.mock("~/features/tasks/collections/tasks-collection", () => ({
  tasksCollection: { delete: deleteMock, update: updateMock },
}));

//? view は router の <Link> / useNavigate を使う。RouterProvider 無しのコンポーネント単体テストで
//? useLinkProps が落ちるため、Link を素の anchor にスタブする。
vi.mock("@tanstack/react-router", () => ({
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

test("editing the title updates the task while keeping priority", async () => {
  render(<TaskDetailView task={makeTask()} />);

  fireEvent.click(screen.getByRole("button", { name: "Edit" }));

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
});

test("deleting a task confirms, calls the collection, then navigates away", async () => {
  render(<TaskDetailView task={makeTask()} />);

  fireEvent.click(screen.getByRole("button", { name: "Delete" }));

  const confirm = await screen.findByRole("button", { name: "Delete task" });
  fireEvent.click(confirm);

  await waitFor(() => expect(deleteMock).toHaveBeenCalledWith("t1"));
  expect(navigateMock).toHaveBeenCalledWith({ to: "/tasks" });
});
