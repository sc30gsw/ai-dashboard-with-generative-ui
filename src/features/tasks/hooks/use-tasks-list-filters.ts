import { useForm, useStore } from "@tanstack/react-form";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { TaskListFilterFormSchema } from "~/features/tasks/api/task-model";
import {
  listInputFromTaskListFilterForm,
  taskListFilterFormFromSearch,
} from "~/features/tasks/utils/task-board-search";

const routeApi = getRouteApi("/_app/tasks/");

export function useTaskListFilters() {
  const search = routeApi.useSearch();
  const navigate = routeApi.useNavigate();

  //? フォーム自身が最後にナビゲートした search を覚えておく。同期 effect はこの値と
  //? 異なる search（戻る/進む等の外部変更）が来たときだけ reset する。これをしないと
  //? キーストロークごとの自己ナビゲーションでも reset が走り、日本語 IME 変換が壊れる（R4）。
  const lastNavigatedSearch = useRef(search);

  const form = useForm({
    defaultValues: taskListFilterFormFromSearch(search),
    validators: { onChange: TaskListFilterFormSchema },
    listeners: {
      onChange: ({ formApi }) => {
        const nextSearch = listInputFromTaskListFilterForm(formApi.state.values);
        lastNavigatedSearch.current = nextSearch;
        void navigate({ replace: true, search: nextSearch });
      },
    },
  });

  useEffect(() => {
    //? 自己ナビゲーション由来（lastNavigatedSearch と一致）なら reset しない。外部変更のみ反映する。
    if (JSON.stringify(search) === JSON.stringify(lastNavigatedSearch.current)) {
      return;
    }

    lastNavigatedSearch.current = search;
    form.reset(taskListFilterFormFromSearch(search));
  }, [form, search]);

  const filters = useStore(form.store, (state) => state.values);

  return { filters, form } as const;
}
