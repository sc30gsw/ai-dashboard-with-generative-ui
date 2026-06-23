import { toast } from "@heroui/react";
import React, { useState } from "react";

import { useAppForm } from "~/features/chat/hooks/form";
import {
  CreateTaskDraftSchema,
  CreateTaskSchema,
  type TaskView,
} from "~/features/tasks/api/task-model";
import { tasksCollection } from "~/features/tasks/collections/tasks-collection";
import { TaskDetailEditForm } from "~/features/tasks/components/task-detail-edit-form";
import { TaskDetailInfo } from "~/features/tasks/components/task-detail-info";

export function TaskDetailCardContent({ task }: Record<"task", TaskView>) {
  const [isEditing, setIsEditing] = useState(false);

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

      setIsEditing(false);
    },
  });

  function startEditing() {
    //? 最新の task 値でフォームを同期してから編集モードへ（前回のキャンセル値を持ち越さない）。
    form.reset({ priority: task.priority, title: task.title });
    setIsEditing(true);
  }

  function cancelEditing() {
    form.reset({ priority: task.priority, title: task.title });
    setIsEditing(false);
  }

  return isEditing ? (
    <TaskDetailEditForm form={form} onCancel={cancelEditing} />
  ) : (
    <TaskDetailInfo onEdit={startEditing} task={task} />
  );
}
