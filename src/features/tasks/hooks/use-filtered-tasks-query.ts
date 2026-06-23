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
    (query) =>
      query.from({ task: tasksCollection }).orderBy(({ task }) => task.createdAt, sortDirection),
    [sortDirection],
  );
}
