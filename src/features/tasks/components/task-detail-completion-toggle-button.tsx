import { ArrowRotateLeft, CircleCheck } from "@gravity-ui/icons";
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
      <span className="inline-flex items-center gap-1.5">
        {task.completed ? (
          <>
            <ArrowRotateLeft aria-hidden="true" />
            Reopen
          </>
        ) : (
          <>
            <CircleCheck aria-hidden="true" />
            Mark complete
          </>
        )}
      </span>
    </Button>
  );
}
