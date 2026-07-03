import { countBy, partition, sortBy } from "remeda";

import { TASK_PRIORITIES, type Task, type TaskPriority } from "~/features/tasks/api/task-model";

export type CompletionByPriorityDatum = {
  completed: number;
  incomplete: number;
  priority: TaskPriority;
};

export function aggregateCompletionByPriority(
  tasks: Pick<Task, "completed" | "priority">[],
): CompletionByPriorityDatum[] {
  const [completedTasks, incompleteTasks] = partition(tasks, (task) => task.completed);
  const completedByPriority = countBy(completedTasks, (task) => task.priority);
  const incompleteByPriority = countBy(incompleteTasks, (task) => task.priority);

  return TASK_PRIORITIES.map((priority) => ({
    completed: completedByPriority[priority] ?? 0,
    incomplete: incompleteByPriority[priority] ?? 0,
    priority,
  }));
}

export type TasksByDayDatum = {
  completed: number;
  created: number;
  date: string;
};

//? スキーマに完了日時が無いため、「その日に完了」は表現できない。
//? ここでの completed は「その日に作成され、かつ現在完了している」タスク数を指す近似値。
export function aggregateTasksByDay(
  tasks: Pick<Task, "completed" | "createdAt">[],
): TasksByDayDatum[] {
  const byDate = new Map<string, TasksByDayDatum>();

  for (const task of tasks) {
    const date = task.createdAt.toISOString().slice(0, 10);
    const existing = byDate.get(date) ?? { completed: 0, created: 0, date };

    byDate.set(date, {
      completed: existing.completed + (task.completed ? 1 : 0),
      created: existing.created + 1,
      date,
    });
  }

  return sortBy([...byDate.values()], (datum) => datum.date);
}
