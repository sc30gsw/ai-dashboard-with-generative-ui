import { defineComponent } from "@openuidev/react-lang";
import { getRouteApi } from "@tanstack/react-router";
import { Result } from "better-result";
import { cn } from "cnfast";
import { useState } from "react";
import { z } from "zod/v4";

import { AddTaskForm } from "~/features/chat/genui/task-board-add-form";
import { FilterTaskForm } from "~/features/chat/genui/task-board-filter-form";
import { TaskRow } from "~/features/chat/genui/task-board-row";
import { taskItemSchema } from "~/features/chat/genui/task-board-types";
import {
  TaskSortBySchema,
  TaskSortDirectionSchema,
  TaskStatusFilterSchema,
} from "~/features/tasks/api/task-model";
import { tasksCollection } from "~/features/tasks/collections/tasks-collection";
import {
  useAllTasksQuery,
  useFilteredTasksQuery,
} from "~/features/tasks/hooks/use-filtered-tasks-query";
import { runTaskMutation } from "~/features/tasks/utils/run-task-mutation";
import {
  resolveTaskBoardFilters,
  taskBoardSearchKey,
  type TaskBoardInitialFilters,
} from "~/features/tasks/utils/task-board-search";
import {
  filterTasksForBoardFallback,
  listTasksInputToQuery,
} from "~/features/tasks/utils/tasks-live-query";

export const TaskBoard = defineComponent({
  name: "TaskBoard",
  props: z.object({
    tasks: z.array(taskItemSchema),
    initialTitle: z.string().optional(),
    initialPriority: taskItemSchema.shape.priority.optional(),
    initialSearch: z.string().optional(),
    initialStatus: TaskStatusFilterSchema.optional(),
    initialPriorityFilter: taskItemSchema.shape.priority.optional(),
    initialSortBy: TaskSortBySchema.optional(),
    initialSortDirection: TaskSortDirectionSchema.optional(),
  }),
  description:
    "Interactive task board with add, inline edit, complete, delete, search, filter, and sort controls. Completed tasks are shown muted below active tasks.",
  component: ({ props }) => <TaskBoardView {...props} />,
});

const routeApi = getRouteApi("/_app/chat");

function TaskBoardView({
  initialPriority,
  initialPriorityFilter,
  initialSearch,
  initialSortBy,
  initialSortDirection,
  initialStatus,
  initialTitle,
  tasks,
}: z.infer<typeof TaskBoard.props>) {
  const search = routeApi.useSearch();
  const initialFilters = {
    initialPriorityFilter,
    initialSearch,
    initialSortBy,
    initialSortDirection,
    initialStatus,
  } satisfies TaskBoardInitialFilters;
  const filters = resolveTaskBoardFilters(search, initialFilters);
  const queryFilters = listTasksInputToQuery(filters);
  const initialTasks = taskItemSchema.array().parse(tasks);
  const { data: liveTasks } = useFilteredTasksQuery(queryFilters, {
    groupCompletedLast: true,
  });
  const { data: allTasks } = useAllTasksQuery("asc");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const sourceTasks = liveTasks?.length ? liveTasks : initialTasks;
  const rows =
    liveTasks?.length || allTasks?.length
      ? (liveTasks ?? [])
      : filterTasksForBoardFallback(initialTasks, queryFilters);
  const countSource = allTasks?.length ? allTasks : sourceTasks;
  const activeCount = countSource.filter((task) => !task.completed).length;
  const completedCount = countSource.length - activeCount;

  async function runMutation(label: string, action: () => Promise<void> | void) {
    setPendingLabel(label);
    setMessage("");

    const result = await runTaskMutation(action);

    if (Result.isError(result)) {
      setMessage(result.error.message);
    }

    setPendingLabel(null);
  }

  return (
    <section
      aria-label="Task board"
      className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-950 text-zinc-50 shadow-sm"
    >
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Your tasks</h2>
            <p className="mt-1 text-sm text-zinc-400">
              {activeCount} active / {completedCount} completed
            </p>
          </div>
          {pendingLabel ? (
            <p className="rounded-md bg-white/10 px-3 py-2 text-sm text-zinc-200">{pendingLabel}</p>
          ) : null}
        </div>
      </div>

      <AddTaskForm
        initialPriority={initialPriority ?? "medium"}
        initialTitle={initialTitle ?? ""}
        isDisabled={pendingLabel !== null}
        onAdd={(task) =>
          runMutation("Adding task...", () => {
            tasksCollection.insert(task);
            setMessage(`Added "${task.title}"`);
          })
        }
      />

      <FilterTaskForm
        filters={filters}
        isDisabled={pendingLabel !== null}
        onApplied={() => setMessage("Task list updated")}
        searchKey={taskBoardSearchKey(search)}
      />

      <div aria-live="polite" className="sr-only">
        {message}
      </div>
      {message ? (
        <p className="border-b border-white/10 px-5 py-3 text-sm text-zinc-300">{message}</p>
      ) : null}

      <ul className="divide-y divide-white/10">
        {rows.length ? (
          rows.map((task) => (
            <li
              className={cn("px-5 py-4", task.completed && "bg-white/3 text-zinc-400")}
              key={task.id}
            >
              <TaskRow
                isDisabled={pendingLabel !== null}
                isEditing={editingId === task.id}
                onCancelEdit={() => setEditingId(null)}
                onDelete={() =>
                  runMutation("Deleting task...", () => {
                    tasksCollection.delete(task.id);
                    setMessage(`Deleted "${task.title}"`);
                  })
                }
                onEdit={() => setEditingId(task.id)}
                onSave={(input) =>
                  runMutation("Saving task...", () => {
                    tasksCollection.update(task.id, (draft) => {
                      draft.priority = input.priority;
                      draft.title = input.title;
                    });
                    setEditingId(null);
                    setMessage(`Saved "${input.title}"`);
                  })
                }
                onToggleComplete={() =>
                  runMutation("Updating task...", () => {
                    tasksCollection.update(task.id, (draft) => {
                      draft.completed = !task.completed;
                    });
                    setMessage(
                      task.completed ? `Reopened "${task.title}"` : `Completed "${task.title}"`,
                    );
                  })
                }
                task={task}
              />
            </li>
          ))
        ) : (
          <li className="px-5 py-8 text-center text-zinc-400">No tasks found</li>
        )}
      </ul>
    </section>
  );
}
