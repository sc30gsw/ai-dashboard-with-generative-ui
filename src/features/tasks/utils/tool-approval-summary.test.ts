import { expect, test } from "vite-plus/test";

import { summarizeToolInput } from "~/features/tasks/utils/tool-approval-summary";

test("bulk_update_tasks surfaces the priorityFilter scope, not the generic target (R1)", () => {
  const summary = summarizeToolInput("bulk_update_tasks", {
    completed: true,
    priorityFilter: "high",
    status: "all",
  });

  //? priorityFilter スコープが文言に出ること（裸の「対象タスク」に落ちない）。
  expect(summary).toContain("優先度 high");
  expect(summary).not.toContain("対象タスク");
  //? SET 変更（完了にする）は引き続き表示される。
  expect(summary).toContain("完了にする");
});

test("bulk_update_tasks composes every active filter into the scope (R1)", () => {
  const summary = summarizeToolInput("bulk_update_tasks", {
    priority: "low",
    priorityFilter: "high",
    search: "報告",
    status: "active",
    title: undefined,
  });

  //? 未完了 + 優先度 high + 「報告」を含む、を全て連結。priority は SET 行として別表示。
  expect(summary).toContain("未完了");
  expect(summary).toContain("優先度 high");
  expect(summary).toContain("報告");
  expect(summary).toContain("優先度 → low");
});

test("reorder_tasks surfaces the ordered task titles via the resolver (Sec LOW-2)", () => {
  const titles: Record<string, string> = {
    "task-1": "買い物に行く",
    "task-2": "レポートを提出する",
  };

  const summary = summarizeToolInput(
    "reorder_tasks",
    { orderedIds: ["task-1", "task-2"] },
    (id) => titles[id],
  );

  expect(summary).toContain("2件のタスク");
  expect(summary).toContain("買い物に行く → レポートを提出する");
});

test("reorder_tasks falls back to the raw id when the title cannot be resolved (Sec LOW-2)", () => {
  const summary = summarizeToolInput(
    "reorder_tasks",
    { orderedIds: ["task-1", "stale-id"] },
    (id) => (id === "task-1" ? "買い物に行く" : undefined),
  );

  expect(summary).toContain("買い物に行く → stale-id");
});

test("bulk_update_tasks with confirmAll and no filter surfaces the full-board scope (N2)", () => {
  const summary = summarizeToolInput("bulk_update_tasks", {
    completed: true,
    confirmAll: true,
    status: "all",
  });

  //? confirmAll の全件適用は「ボード上のすべてのタスク」として明示し、裸の「対象タスク」に落ちない。
  expect(summary).toContain("ボード上のすべてのタスク");
  expect(summary).not.toContain("対象タスク");
  expect(summary).toContain("完了にする");
});
