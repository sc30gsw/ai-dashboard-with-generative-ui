import { useLiveSuspenseQuery } from "@tanstack/react-db";

import type { TaskSortDirection } from "~/features/tasks/api/task-model";
import { tasksCollection } from "~/features/tasks/collections/tasks-collection";
import {
  buildFilteredTasksQuery,
  tasksQueryFilterKey,
  type TasksQueryFilters,
} from "~/features/tasks/utils/tasks-live-query";

export function useFilteredTasksQuery(
  filters: TasksQueryFilters,
  options?: Partial<Record<"groupCompletedLast", boolean>>,
) {
  const filterKey = tasksQueryFilterKey(filters);

  return useLiveSuspenseQuery(
    (query) => buildFilteredTasksQuery(query, filters, options),
    [filterKey, options?.groupCompletedLast],
  );
}

export function useAllTasksQuery(sortDirection: TaskSortDirection = "desc") {
  return useLiveSuspenseQuery(
    (query) => {
      const builder = query.from({ task: tasksCollection });

      //? コレクション内のいずれかに sortOrder が設定されていれば、要求された sortDirection に
      //? 関わらず sortOrder 優先（昇順・NULL は末尾）で並べる（サーバー側 orderFor() と同じ規約）。
      const hasSortOrder = tasksCollection.toArray.some((task) => task.sortOrder != null);

      if (hasSortOrder) {
        return builder
          .orderBy(({ task }) => task.sortOrder, { direction: "asc", nulls: "last" })
          .orderBy(({ task }) => task.createdAt, "asc");
      }

      return builder.orderBy(({ task }) => task.createdAt, sortDirection);
    },
    [sortDirection],
  );
}
