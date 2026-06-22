import {
  defaultListTasksSchema,
  ListTasksSchema,
  type ListTasksInput,
  type TaskListFilterFormValues,
} from "~/features/tasks/api/task-model";

export const defaultTaskBoardSearch = {
  sortBy: defaultListTasksSchema.sortBy,
  sortDirection: defaultListTasksSchema.sortDirection,
  status: defaultListTasksSchema.status,
} as const satisfies ListTasksInput;

export type TaskBoardInitialFilters = {
  initialPriorityFilter?: ListTasksInput["priority"];
  initialSearch?: ListTasksInput["search"];
  initialSortBy?: ListTasksInput["sortBy"];
  initialSortDirection?: ListTasksInput["sortDirection"];
  initialStatus?: ListTasksInput["status"];
};

function normalizeTaskBoardFilters(filters: ListTasksInput): ListTasksInput {
  return ListTasksSchema.parse({
    ...filters,
    search: filters.search?.trim() || undefined,
  });
}

function isDefaultTaskBoardSearch(search: ListTasksInput) {
  return (
    search.status === defaultTaskBoardSearch.status &&
    search.sortBy === defaultTaskBoardSearch.sortBy &&
    search.sortDirection === defaultTaskBoardSearch.sortDirection &&
    !search.search &&
    !search.priority
  );
}

export function resolveTaskBoardFilters(
  search: ListTasksInput,
  initial: TaskBoardInitialFilters,
): ListTasksInput {
  if (!isDefaultTaskBoardSearch(search)) {
    return normalizeTaskBoardFilters(search);
  }

  return normalizeTaskBoardFilters({
    priority: initial.initialPriorityFilter,
    search: initial.initialSearch,
    sortBy: initial.initialSortBy ?? defaultTaskBoardSearch.sortBy,
    sortDirection: initial.initialSortDirection ?? defaultTaskBoardSearch.sortDirection,
    status: initial.initialStatus ?? defaultTaskBoardSearch.status,
  });
}

export function taskListFilterFormFromSearch(search: ListTasksInput) {
  return {
    priority: search.priority ?? "all",
    search: search.search ?? "",
    status: search.status,
  } satisfies TaskListFilterFormValues;
}

export function listInputFromTaskListFilterForm(value: TaskListFilterFormValues): ListTasksInput {
  return ListTasksSchema.parse({
    priority: value.priority === "all" ? undefined : value.priority,
    search: value.search,
    status: value.status,
  });
}

export function taskBoardSearchKey(search: ListTasksInput) {
  return [
    search.status,
    search.search ?? "",
    search.priority ?? "all",
    search.sortBy,
    search.sortDirection,
  ].join("|");
}
