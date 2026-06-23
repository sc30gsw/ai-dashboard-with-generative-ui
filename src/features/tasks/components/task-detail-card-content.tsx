import { toast } from "@heroui/react";
import { getRouteApi } from "@tanstack/react-router";

import { useAppForm } from "~/features/chat/hooks/form";
import {
  CreateTaskDraftSchema,
  CreateTaskSchema,
  type TaskView,
} from "~/features/tasks/api/task-model";
import { tasksCollection } from "~/features/tasks/collections/tasks-collection";
import { TaskDetailEditForm } from "~/features/tasks/components/task-detail-edit-form";
import { TaskDetailInfo } from "~/features/tasks/components/task-detail-info";

const routeApi = getRouteApi("/_app/tasks/$taskId");

export function TaskDetailCardContent({ task }: Record<"task", TaskView>) {
  const { edit } = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const isEditing = edit === true;

  const form = useAppForm({
    defaultValues: {
      priority: task.priority,
      title: task.title,
    },
    validators: {
      onChange: CreateTaskDraftSchema,
      onSubmit: CreateTaskSchema,
    },
    onSubmit: ({ value }) => {
      const tx = tasksCollection.update(task.id, (draft) => {
        draft.title = value.title.trim();
        draft.priority = value.priority;
      });

      //? 楽観更新。API 失敗時は TanStack DB が自動ロールバックするので toast で通知する。
      tx.isPersisted.promise.catch(() => {
        toast.danger("タスクの更新に失敗しました。");
      });

      void navigate({ replace: true, search: { edit: undefined } });
    },
  });

  function startEditing() {
    //? 最新の task 値でフォームを同期してから編集モードへ（前回のキャンセル値を持ち越さない）。
    form.reset({ priority: task.priority, title: task.title });
    void navigate({ replace: true, search: { edit: true } });
  }

  function cancelEditing() {
    form.reset({ priority: task.priority, title: task.title });
    void navigate({ replace: true, search: { edit: undefined } });
  }

  return isEditing ? (
    <TaskDetailEditForm form={form} onCancel={cancelEditing} />
  ) : (
    <TaskDetailInfo onEdit={startEditing} task={task} />
  );
}
