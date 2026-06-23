import {
  AlertDialog,
  Button,
  CloseIcon,
  Code,
  DangerIcon,
  Description,
  toast,
} from "@heroui/react";
import { useNavigate } from "@tanstack/react-router";

import type { TaskView } from "~/features/tasks/api/task-model";
import { tasksCollection } from "~/features/tasks/collections/tasks-collection";

export function TaskDeleteDialog({ task }: { task: TaskView }) {
  const navigate = useNavigate();

  function handleDelete() {
    const tx = tasksCollection.delete(task.id);

    tx.isPersisted.promise.catch(() => {
      toast.danger("タスクの削除に失敗しました。");
    });

    //? 楽観的に即遷移。失敗時はロールバックで一覧に再出現し、toast で通知される。
    void navigate({ to: "/tasks" });
  }

  return (
    <AlertDialog>
      <Button variant="danger">
        <span className="inline-flex items-center gap-1.5">
          <DangerIcon />
          Delete
        </span>
      </Button>
      <AlertDialog.Backdrop>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-[400px]">
            <AlertDialog.CloseTrigger />
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>Delete this task?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <Description>
                This will permanently delete <Code>{task.title}</Code>. This action cannot be
                undone.
              </Description>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary">
                <span className="inline-flex items-center gap-1.5">
                  <CloseIcon />
                  Cancel
                </span>
              </Button>
              <Button slot="close" variant="danger" onPress={handleDelete}>
                <span className="inline-flex items-center gap-1.5">
                  <DangerIcon />
                  Delete task
                </span>
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}
