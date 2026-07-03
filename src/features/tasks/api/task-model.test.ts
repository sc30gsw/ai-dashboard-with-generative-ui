import { expect, test } from "vite-plus/test";

import {
  BulkUpdateTasksSchema,
  CreateTaskSchema,
  ReorderTasksSchema,
} from "~/features/tasks/api/task-model";

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

test("ReorderTasksSchema rejects an orderedIds array longer than 100 entries", () => {
  const result = ReorderTasksSchema.safeParse({
    orderedIds: Array.from({ length: 101 }, (_, index) => `id-${index}`),
  });

  expect(result.success).toBe(false);
});

test("ReorderTasksSchema rejects an id longer than 64 characters", () => {
  const result = ReorderTasksSchema.safeParse({
    orderedIds: ["a".repeat(65)],
  });

  expect(result.success).toBe(false);
});

test("ReorderTasksSchema accepts an orderedIds array of exactly 100 valid-length ids", () => {
  const result = ReorderTasksSchema.safeParse({
    orderedIds: Array.from({ length: 100 }, (_, index) => `id-${index}`),
  });

  expect(result.success).toBe(true);
});
