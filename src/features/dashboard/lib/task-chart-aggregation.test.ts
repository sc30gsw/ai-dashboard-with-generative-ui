import { expect, test } from "vite-plus/test";

import {
  aggregateCompletionByPriority,
  aggregateTasksByDay,
} from "~/features/dashboard/lib/task-chart-aggregation";

test("aggregateCompletionByPriority returns all priorities with zero counts for empty input", () => {
  expect(aggregateCompletionByPriority([])).toEqual([
    { completed: 0, incomplete: 0, priority: "low" },
    { completed: 0, incomplete: 0, priority: "medium" },
    { completed: 0, incomplete: 0, priority: "high" },
  ]);
});

test("aggregateCompletionByPriority counts completed/incomplete per priority, including a zero-task priority", () => {
  const tasks = [
    { completed: true, priority: "high" as const },
    { completed: false, priority: "high" as const },
    { completed: false, priority: "high" as const },
    { completed: true, priority: "medium" as const },
    { completed: true, priority: "medium" as const },
    // "low" has no tasks at all — must still appear as 0/0.
  ];

  expect(aggregateCompletionByPriority(tasks)).toEqual([
    { completed: 0, incomplete: 0, priority: "low" },
    { completed: 2, incomplete: 0, priority: "medium" },
    { completed: 1, incomplete: 2, priority: "high" },
  ]);
});

test("aggregateCompletionByPriority counts all three priorities when each has non-zero completed and incomplete tasks", () => {
  const tasks = [
    { completed: true, priority: "low" as const },
    { completed: false, priority: "low" as const },
    { completed: true, priority: "medium" as const },
    { completed: false, priority: "medium" as const },
    { completed: false, priority: "medium" as const },
    { completed: true, priority: "high" as const },
    { completed: true, priority: "high" as const },
    { completed: false, priority: "high" as const },
  ];

  expect(aggregateCompletionByPriority(tasks)).toEqual([
    { completed: 1, incomplete: 1, priority: "low" },
    { completed: 1, incomplete: 2, priority: "medium" },
    { completed: 2, incomplete: 1, priority: "high" },
  ]);
});

test("aggregateTasksByDay returns an empty array for empty input", () => {
  expect(aggregateTasksByDay([])).toEqual([]);
});

test("aggregateTasksByDay buckets by the Asia/Tokyo calendar day (JST = UTC+9), grouping same-day tasks and sorting multi-day results ascending", () => {
  const tasks = [
    // UTC 2026-07-02T23:00 + 9h = 2026-07-03T08:00 JST -> JST date 2026-07-03
    { completed: true, createdAt: new Date("2026-07-02T23:00:00.000Z") },
    // UTC 2026-07-03T01:00 + 9h = 2026-07-03T10:00 JST -> JST date 2026-07-03
    // (same JST day as above despite a different UTC calendar day -- this is the
    // case naive UTC bucketing got wrong and this fix corrects.)
    { completed: false, createdAt: new Date("2026-07-03T01:00:00.000Z") },
    // UTC 2026-06-30T10:00 + 9h = 2026-06-30T19:00 JST -> JST date 2026-06-30
    { completed: false, createdAt: new Date("2026-06-30T10:00:00.000Z") },
    // UTC 2026-07-01T05:00 + 9h = 2026-07-01T14:00 JST -> JST date 2026-07-01
    { completed: true, createdAt: new Date("2026-07-01T05:00:00.000Z") },
  ];

  expect(aggregateTasksByDay(tasks)).toEqual([
    { completed: 0, created: 1, date: "2026-06-30" },
    { completed: 1, created: 1, date: "2026-07-01" },
    { completed: 1, created: 2, date: "2026-07-03" },
  ]);
});

test("aggregateTasksByDay reports completed:0 for a day with only incomplete tasks", () => {
  const tasks = [
    // UTC 2026-07-03T00:00 + 9h = 2026-07-03T09:00 JST -> JST date 2026-07-03 (same as UTC date)
    { completed: false, createdAt: new Date("2026-07-03T00:00:00.000Z") },
    // UTC 2026-07-03T12:00 + 9h = 2026-07-03T21:00 JST -> JST date 2026-07-03 (same as UTC date)
    { completed: false, createdAt: new Date("2026-07-03T12:00:00.000Z") },
  ];

  expect(aggregateTasksByDay(tasks)).toEqual([{ completed: 0, created: 2, date: "2026-07-03" }]);
});
