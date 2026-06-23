import { Button, toast } from "@heroui/react";

import type { TaskView } from "~/features/tasks/api/task-model";
import { tasksCollection } from "~/features/tasks/collections/tasks-collection";

export function TaskDetailCompletionToggleButton({ task }: Record<"task", TaskView>) {
  function toggleCompleted() {
    const tx = tasksCollection.update(task.id, (draft) => {
      draft.completed = !task.completed;
    });

    tx.isPersisted.promise.catch(() => {
      toast.danger(
        task.completed ? "タスクの再オープンに失敗しました。" : "タスクの完了に失敗しました。",
      );
    });
  }

  return (
    <Button variant={task.completed ? "secondary" : "primary"} onPress={toggleCompleted}>
      {task.completed ? "Reopen" : "Mark complete"}
    </Button>
  );
}
