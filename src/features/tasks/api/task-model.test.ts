import { expect, test } from "vite-plus/test";

import { BulkUpdateTasksSchema, CreateTaskSchema } from "~/features/tasks/api/task-model";

test("BulkUpdateTasksSchema accepts location as a SET field", () => {
  const result = BulkUpdateTasksSchema.safeParse({
    confirmAll: true,
    location: "outdoor",
    status: "all",
  });

  expect(result.success).toBe(true);
});

test("CreateTaskSchema accepts optional dueDate and location", () => {
  const result = CreateTaskSchema.safeParse({
    dueDate: new Date().toISOString().slice(0, 10),
    location: "indoor",
    priority: "low",
    title: "x",
  });

  expect(result.success).toBe(true);
});
