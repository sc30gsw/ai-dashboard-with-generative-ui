import { useForm, useStore } from "@tanstack/react-form";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect } from "react";

import { TaskListFilterFormSchema } from "~/features/tasks/api/task-model";
import {
  listInputFromTaskListFilterForm,
  taskListFilterFormFromSearch,
} from "~/features/tasks/utils/task-board-search";

const routeApi = getRouteApi("/_app/tasks/");

export function useTaskListFilters() {
  const search = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const form = useForm({
    defaultValues: taskListFilterFormFromSearch(search),
    validators: { onChange: TaskListFilterFormSchema },
    listeners: {
      onChange: ({ formApi }) => {
        void navigate({
          replace: true,
          search: listInputFromTaskListFilterForm(formApi.state.values),
        });
      },
    },
  });

  useEffect(() => {
    form.reset(taskListFilterFormFromSearch(search));
  }, [form, search]);

  const filters = useStore(form.store, (state) => state.values);

  return { filters, form } as const;
}
