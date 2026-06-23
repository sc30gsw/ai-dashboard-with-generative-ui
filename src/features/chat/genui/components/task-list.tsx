import { type ComponentRenderProps, defineComponent } from "@openuidev/react-lang";
import { cn } from "cnfast";
import { useState } from "react";
import { filter, pipe, sort } from "remeda";

import {
  PRIORITY_FILTER_LABELS,
  PRIORITY_FILTERS,
  SORT_LABELS,
  SORTS,
} from "~/features/chat/constants/tasks-list-options";
import { taskListPropsSchema, type TaskRow } from "~/features/chat/schemas/task-list-schema";
import { TASK_PRIORITY_RANK } from "~/features/tasks/api/task-model";

const PRIORITY_CHIP = {
  high: "bg-red-500/20 text-red-200 ring-red-400/30",
  medium: "bg-amber-500/20 text-amber-100 ring-amber-400/30",
  low: "bg-zinc-500/20 text-zinc-200 ring-zinc-400/30",
} as const satisfies Record<TaskRow["priority"], string>;

const DONE_CHIP = {
  done: "bg-emerald-500/20 text-emerald-200 ring-emerald-400/30",
  active: "bg-white/10 text-zinc-300 ring-white/20",
} as const satisfies Record<"active" | "done", string>;

function sortTasks(tasks: TaskRow[], sortKey: (typeof SORTS)[number]) {
  if (sortKey === "priority") {
    return sort(tasks, (a, b) => TASK_PRIORITY_RANK[a.priority] - TASK_PRIORITY_RANK[b.priority]);
  }

  if (sortKey === "title") {
    return sort(tasks, (a, b) => a.title.localeCompare(b.title, "ja"));
  }

  return tasks;
}

export const taskList = defineComponent({
  component: function TaskListView({ props }: ComponentRenderProps<Record<"tasks", TaskRow[]>>) {
    const { tasks } = props;

    const [query, setQuery] = useState("");
    const [priority, setPriority] = useState<(typeof PRIORITY_FILTERS)[number]>("all");
    const [sortKey, setSortKey] = useState<(typeof SORTS)[number]>("default");

    const normalized = query.trim().toLowerCase();
    const visible = pipe(
      tasks,
      filter(
        (task) =>
          (priority === "all" || task.priority === priority) &&
          (!normalized || task.title.toLowerCase().includes(normalized)),
      ),
      (filtered) => sortTasks(filtered, sortKey),
    );

    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-zinc-100">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <input
            aria-label="タスクを検索"
            className={cn(
              "min-h-9 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-zinc-50 outline-offset-2 placeholder:text-zinc-400 focus-visible:outline-2 focus-visible:outline-white/60 [&>option]:text-zinc-900",
              "flex-1",
            )}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="タスクを検索..."
            type="search"
            value={query}
          />
          <select
            aria-label="優先度で絞り込み"
            className={
              "min-h-9 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-zinc-50 outline-offset-2 placeholder:text-zinc-400 focus-visible:outline-2 focus-visible:outline-white/60 [&>option]:text-zinc-900"
            }
            onChange={(event) =>
              setPriority(event.target.value as (typeof PRIORITY_FILTERS)[number])
            }
            value={priority}
          >
            {PRIORITY_FILTERS.map((value) => (
              <option key={value} value={value}>
                {PRIORITY_FILTER_LABELS[value]}
              </option>
            ))}
          </select>
          <select
            aria-label="並び替え"
            className={
              "min-h-9 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-zinc-50 outline-offset-2 placeholder:text-zinc-400 focus-visible:outline-2 focus-visible:outline-white/60 [&>option]:text-zinc-900"
            }
            onChange={(event) => setSortKey(event.target.value as (typeof SORTS)[number])}
            value={sortKey}
          >
            {SORTS.map((value) => (
              <option key={value} value={value}>
                {SORT_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        {visible.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-400">該当なし</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs font-medium tracking-wide text-zinc-400 uppercase">
                <th className="py-2 pr-3">Title</th>
                <th className="py-2 pr-3">Priority</th>
                <th className="py-2">Done</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((task) => (
                <tr className="border-b border-white/5 last:border-0" key={task.id}>
                  <td className="py-2 pr-3 text-zinc-100">{task.title}</td>
                  <td className="py-2 pr-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                        PRIORITY_CHIP[task.priority],
                      )}
                    >
                      {task.priority}
                    </span>
                  </td>
                  <td className="py-2">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                        task.completed ? DONE_CHIP.done : DONE_CHIP.active,
                      )}
                    >
                      {task.completed ? "完了" : "未完了"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  },
  description:
    "Task list with a built-in search box, priority filter, sort control, and priority/done status chips. Use this instead of Table to show, list, or filter tasks.",
  name: "TaskList",
  props: taskListPropsSchema,
});
