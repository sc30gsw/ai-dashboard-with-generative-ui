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
