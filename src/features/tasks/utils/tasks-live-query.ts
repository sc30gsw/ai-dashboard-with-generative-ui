import { and, caseWhen, eq, ilike, type InitialQueryBuilder } from "@tanstack/react-db";

import type {
  ListTasksInput,
  TaskPriorityFilter,
  TaskListFilterFormValues,
} from "~/features/tasks/api/task-model";
import { tasksCollection } from "~/features/tasks/collections/tasks-collection";

export type TasksQueryFilters = {
  priority: TaskPriorityFilter;
  search: string;
  sortBy: ListTasksInput["sortBy"];
  sortDirection: ListTasksInput["sortDirection"];
  status: ListTasksInput["status"];
};

export function taskListFiltersToQuery(filters: TaskListFilterFormValues): TasksQueryFilters {
  return {
    priority: filters.priority,
    search: filters.search,
    sortBy: "createdAt",
    sortDirection: "desc",
    status: filters.status,
  };
}

export function tasksQueryFilterKey(filters: TasksQueryFilters) {
  return [
    filters.status,
    filters.priority,
    filters.search.trim(),
    filters.sortBy,
    filters.sortDirection,
  ].join("|");
}

function hasTaskFilters(filters: TasksQueryFilters) {
  return filters.status !== "all" || filters.priority !== "all" || filters.search.trim().length > 0;
}

function matchesTaskFilters(
  task: { completed: boolean; priority: TaskPriorityFilter; title: string },
  filters: TasksQueryFilters,
) {
  if (filters.status === "active" && task.completed) {
    return false;
  }

  if (filters.status === "completed" && !task.completed) {
    return false;
  }

  if (filters.priority !== "all" && task.priority !== filters.priority) {
    return false;
  }

  const search = filters.search.trim();

  return !search || task.title.toLowerCase().includes(search.toLowerCase());
}

//? "現在の結果集合" のいずれかに sortOrder が設定されているかをクライアントの手持ちコレクションから
//? 判定する（サーバー側 orderFor() の事前カウントクエリと同じ規約）。
function hasSortOrderInResultSet(filters: TasksQueryFilters) {
  return tasksCollection.toArray.some(
    (task) => matchesTaskFilters(task, filters) && task.sortOrder != null,
  );
}

export function buildFilteredTasksQuery(
  query: InitialQueryBuilder,
  filters: TasksQueryFilters,
  options?: { groupCompletedLast?: boolean },
) {
  let builder = query.from({ task: tasksCollection });

  if (hasTaskFilters(filters)) {
    builder = builder.where(({ task }) => {
      const conditions = [];

      if (filters.status === "active") {
        conditions.push(eq(task.completed, false));
      }

      if (filters.status === "completed") {
        conditions.push(eq(task.completed, true));
      }

      if (filters.priority !== "all") {
        conditions.push(eq(task.priority, filters.priority));
      }

      const search = filters.search.trim();

      if (search) {
        conditions.push(ilike(task.title, `%${search}%`));
      }

      if (conditions.length === 0) {
        throw new Error("Expected task filter expression");
      }

      if (conditions.length === 1) {
        return conditions[0]!;
      }

      return conditions
        .slice(1)
        .reduce((combined, condition) => and(combined, condition), conditions[0]!);
    });
  }

  if (options?.groupCompletedLast) {
    builder = builder.orderBy(({ task }) => task.completed, "asc");
  }

  if (filters.sortBy === "priority") {
    return builder.orderBy(
      ({ task }) => caseWhen(eq(task.priority, "high"), 0, eq(task.priority, "medium"), 1, 2),
      filters.sortDirection,
    );
  }

  if (filters.sortBy === "title") {
    return builder.orderBy(({ task }) => task.title, filters.sortDirection);
  }

  //? sortBy: "createdAt" の場合、結果集合内のいずれかに sortOrder が設定されていれば、
  //? 要求された sortDirection に関わらず sortOrder 優先（昇順・NULL は末尾）で並べる
  //? （並べ替え操作が行われた意図を尊重する。サーバー側 orderFor() と同じ規約）。
  if (hasSortOrderInResultSet(filters)) {
    return builder
      .orderBy(({ task }) => task.sortOrder, { direction: "asc", nulls: "last" })
      .orderBy(({ task }) => task.createdAt, "asc");
  }

  //? sortOrder が誰にも設定されていなければ、従来通り createdAt を要求された方向で並べる。
  return builder.orderBy(({ task }) => task.createdAt, filters.sortDirection);
}
