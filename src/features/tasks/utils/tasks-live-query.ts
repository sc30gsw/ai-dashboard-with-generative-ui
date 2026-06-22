import { and, caseWhen, eq, ilike, type InitialQueryBuilder } from "@tanstack/react-db";

import type {
  ListTasksInput,
  TaskBoardItem,
  TaskPriorityFilter,
  TaskListFilterFormValues,
} from "~/features/tasks/api/task-model";
import { TASK_PRIORITY_RANK } from "~/features/tasks/api/task-model";
import { tasksCollection } from "~/features/tasks/collections/tasks-collection";

export type TasksQueryFilters = {
  priority: TaskPriorityFilter;
  search: string;
  sortBy: ListTasksInput["sortBy"];
  sortDirection: ListTasksInput["sortDirection"];
  status: ListTasksInput["status"];
};

export type TaskQueryRow = TaskBoardItem;

export function taskListFiltersToQuery(filters: TaskListFilterFormValues): TasksQueryFilters {
  return {
    priority: filters.priority,
    search: filters.search,
    sortBy: "createdAt",
    sortDirection: "desc",
    status: filters.status,
  };
}

export function listTasksInputToQuery(filters: ListTasksInput): TasksQueryFilters {
  return {
    priority: filters.priority ?? "all",
    search: filters.search ?? "",
    sortBy: filters.sortBy,
    sortDirection: filters.sortDirection,
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

  return builder.orderBy(({ task }) => task.createdAt, filters.sortDirection);
}

export function taskMatchesFilters(task: TaskQueryRow, filters: TasksQueryFilters) {
  if (filters.status === "active" && task.completed) {
    return false;
  }

  if (filters.status === "completed" && !task.completed) {
    return false;
  }

  if (filters.priority !== "all" && task.priority !== filters.priority) {
    return false;
  }

  const search = filters.search.trim().toLowerCase();

  if (search && !task.title.toLowerCase().includes(search)) {
    return false;
  }

  return true;
}

function compareByPriority(a: TaskQueryRow, b: TaskQueryRow) {
  return TASK_PRIORITY_RANK[a.priority] - TASK_PRIORITY_RANK[b.priority];
}

export function sortTasksForBoard(tasks: readonly TaskQueryRow[], filters: TasksQueryFilters) {
  const direction = filters.sortDirection === "desc" ? -1 : 1;

  return tasks.slice().sort((a, b) => {
    const completedOrder = Number(a.completed) - Number(b.completed);

    if (completedOrder !== 0) {
      return completedOrder;
    }

    if (filters.sortBy === "priority") {
      return compareByPriority(a, b) * direction;
    }

    if (filters.sortBy === "title") {
      return a.title.localeCompare(b.title) * direction;
    }

    const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : Number(a.createdAt ?? 0);
    const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : Number(b.createdAt ?? 0);

    return (aTime - bTime) * direction;
  });
}

export function filterTasksForBoardFallback(
  tasks: readonly TaskQueryRow[],
  filters: TasksQueryFilters,
) {
  return sortTasksForBoard(
    tasks.filter((task) => taskMatchesFilters(task, filters)),
    filters,
  );
}
