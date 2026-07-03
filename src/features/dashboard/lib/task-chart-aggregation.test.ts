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

test("aggregateTasksByDay groups multiple same-day tasks and sorts multi-day results ascending", () => {
  const tasks = [
    { completed: true, createdAt: new Date("2026-07-02T23:00:00.000Z") },
    { completed: false, createdAt: new Date("2026-07-02T01:00:00.000Z") },
    { completed: false, createdAt: new Date("2026-06-30T10:00:00.000Z") },
    { completed: true, createdAt: new Date("2026-07-01T05:00:00.000Z") },
  ];

  expect(aggregateTasksByDay(tasks)).toEqual([
    { completed: 0, created: 1, date: "2026-06-30" },
    { completed: 1, created: 1, date: "2026-07-01" },
    { completed: 1, created: 2, date: "2026-07-02" },
  ]);
});

test("aggregateTasksByDay reports completed:0 for a day with only incomplete tasks", () => {
  const tasks = [
    { completed: false, createdAt: new Date("2026-07-03T00:00:00.000Z") },
    { completed: false, createdAt: new Date("2026-07-03T12:00:00.000Z") },
  ];

  expect(aggregateTasksByDay(tasks)).toEqual([{ completed: 0, created: 2, date: "2026-07-03" }]);
});
