import { toast } from "@heroui/react";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { createCollection } from "@tanstack/react-db";
import { z } from "zod";

import { TaskViewSchema, type TaskView } from "~/features/tasks/api/task-model";
import { edenClient } from "~/lib/eden";
import { queryClient } from "~/lib/query-client";

const taskViewsSchema = z.array(TaskViewSchema);

//? 楽観更新の API 失敗は throw で TanStack DB が自動ロールバックする。失敗が無言で戻ると
//? ユーザーが気づけないため、ここで toast.danger を出してから rethrow（ロールバックは維持）。
async function withFailureToast<T>(fallback: string, action: () => Promise<T>) {
  try {
    return await action();
  } catch (error) {
    toast.danger(error instanceof Error ? error.message : fallback);
    throw error;
  }
}

export const tasksCollection = createCollection(
  queryCollectionOptions<TaskView>({
    getKey: (item) => item.id,
    queryClient,
    queryFn: async () => {
      const { data, error } = await edenClient().tasks.list.get();

      if (error) {
        throw new Error(`Failed to load tasks: ${String(error.status)}`);
      }

      if (!data.ok) {
        throw new Error(data.message);
      }

      return taskViewsSchema.parse(data.tasks);
    },
    queryKey: ["tasks"],
    onInsert: ({ transaction }) =>
      withFailureToast("タスクの追加に失敗しました。", async () => {
        await Promise.all(
          transaction.mutations.map(async (mutation) => {
            const { priority, title } = mutation.modified;
            const { data, error } = await edenClient().tasks.add.post({ priority, title });

            if (error) {
              throw new Error(`Failed to add task: ${String(error.status)}`);
            }

            if (!data.ok) {
              throw new Error(data.message);
            }

            const task = TaskViewSchema.parse(data.task);

            tasksCollection.utils.writeBatch(() => {
              tasksCollection.utils.writeInsert(task);
            });
          }),
        );

        return { refetch: false };
      }),
    onUpdate: ({ transaction }) =>
      withFailureToast("タスクの更新に失敗しました。", async () => {
        await Promise.all(
          transaction.mutations.map(async (mutation) => {
            const id = String(mutation.key);

            if (mutation.changes.completed === true) {
              const { data, error } = await edenClient().tasks.complete.post({ id });

              if (error) {
                throw new Error(`Failed to complete task: ${String(error.status)}`);
              }

              if (!data.ok) {
                throw new Error(data.message);
              }

              const task = TaskViewSchema.parse(data.task);

              tasksCollection.utils.writeBatch(() => {
                tasksCollection.utils.writeUpdate(task);
              });
            } else {
              const { data, error } = await edenClient().tasks.update.post({
                completed: mutation.changes.completed,
                id,
                priority: mutation.changes.priority,
                title: mutation.changes.title,
              });

              if (error) {
                throw new Error(`Failed to update task: ${String(error.status)}`);
              }

              if (!data.ok) {
                throw new Error(data.message);
              }

              const task = TaskViewSchema.parse(data.task);

              tasksCollection.utils.writeBatch(() => {
                tasksCollection.utils.writeUpdate(task);
              });
            }
          }),
        );

        return { refetch: false };
      }),
    onDelete: ({ transaction }) =>
      withFailureToast("タスクの削除に失敗しました。", async () => {
        await Promise.all(
          transaction.mutations.map(async (mutation) => {
            const id = String(mutation.key);
            const { data, error } = await edenClient().tasks.delete.post({ id });

            if (error) {
              throw new Error(`Failed to delete task: ${String(error.status)}`);
            }

            if (!data.ok) {
              throw new Error(data.message);
            }

            tasksCollection.utils.writeBatch(() => {
              tasksCollection.utils.writeDelete(id);
            });
          }),
        );

        return { refetch: false };
      }),
  }),
);

export async function refetchTasksCollection() {
  await tasksCollection.utils.refetch();
}
