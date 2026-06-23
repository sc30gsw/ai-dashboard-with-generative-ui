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
