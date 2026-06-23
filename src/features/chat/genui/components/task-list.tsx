import { type ComponentRenderProps, defineComponent } from "@openuidev/react-lang";
import { cn } from "cnfast";
import { useState } from "react";
import { z } from "zod";

const TaskRowSchema = z.object({
  id: z.string().describe("Task id"),
  title: z.string().describe("Task title"),
  priority: z.enum(["low", "medium", "high"]).describe("Priority level"),
  completed: z.boolean().describe("Whether the task is done"),
});

type TaskRow = z.infer<typeof TaskRowSchema>;

const taskListProps = z.object({
  tasks: z
    .array(TaskRowSchema)
    .describe("Tasks to display — pass the list_tasks Query result array"),
});

const CHIP_BASE = "inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset";

const PRIORITY_CHIP = {
  high: "bg-red-100 text-red-700 ring-red-200",
  medium: "bg-amber-100 text-amber-700 ring-amber-200",
  low: "bg-zinc-100 text-zinc-600 ring-zinc-200",
} as const satisfies Record<TaskRow["priority"], string>;

const DONE_CHIP = {
  done: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  active: "bg-zinc-100 text-zinc-500 ring-zinc-200",
} as const satisfies Record<"active" | "done", string>;

export const taskList = defineComponent({
  component: function TaskListView({ props }: ComponentRenderProps<Record<"tasks", TaskRow[]>>) {
    const { tasks } = props;

    const [query, setQuery] = useState("");
    const normalized = query.trim().toLowerCase();
    const filtered = normalized
      ? tasks.filter((task) => task.title.toLowerCase().includes(normalized))
      : tasks;

    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <input
          aria-label="タスクを検索"
          className="mb-3 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-offset-2 placeholder:text-zinc-400 focus-visible:outline-2 focus-visible:outline-zinc-900"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="タスクを検索..."
          type="search"
          value={query}
        />
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-400">該当なし</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs font-medium tracking-wide text-zinc-500 uppercase">
                <th className="py-2 pr-3">Title</th>
                <th className="py-2 pr-3">Priority</th>
                <th className="py-2">Done</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((task) => (
                <tr className="border-b border-zinc-100 last:border-0" key={task.id}>
                  <td className="py-2 pr-3 text-zinc-800">{task.title}</td>
                  <td className="py-2 pr-3">
                    <span className={cn(CHIP_BASE, PRIORITY_CHIP[task.priority])}>
                      {task.priority}
                    </span>
                  </td>
                  <td className="py-2">
                    <span
                      className={cn(CHIP_BASE, task.completed ? DONE_CHIP.done : DONE_CHIP.active)}
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
    "Task list with a built-in search box and priority/done status chips. Use this instead of Table to show, list, or filter tasks.",
  name: "TaskList",
  props: taskListProps,
});
