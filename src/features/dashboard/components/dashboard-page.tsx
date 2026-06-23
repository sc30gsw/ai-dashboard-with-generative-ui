import { Card } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { Suspense, lazy } from "react";
import { countBy, partition, take } from "remeda";

import { TASK_PRIORITIES, type TaskPriority } from "~/features/tasks/api/task-model";
import { PriorityChip } from "~/features/tasks/components/priority-chip";
import { TaskQuickAdd } from "~/features/tasks/components/task-quick-add";
import { useAllTasksQuery } from "~/features/tasks/hooks/use-filtered-tasks-query";

type PriorityChartDatum = {
  count: number;
  priority: TaskPriority;
};

const PriorityDistributionChart = lazy(async () => {
  const { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } =
    await import("recharts");

  return {
    default: function PriorityDistributionChart({ data }: Record<"data", PriorityChartDatum[]>) {
      return (
        <ResponsiveContainer height="100%" width="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="priority" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    },
  };
});

type StatsCardProps = {
  label: string;
  value: number;
};

function StatsCard({ label, value }: StatsCardProps) {
  return (
    <Card>
      <Card.Content className="py-5">
        <p className="text-muted text-sm">{label}</p>
        <p className="mt-1 text-3xl font-semibold">{value}</p>
      </Card.Content>
    </Card>
  );
}

export function DashboardPage() {
  const { data: tasks } = useAllTasksQuery("desc");

  const rows = tasks;
  const [, openTasks] = partition(rows, (task) => task.completed);

  const byPriority = countBy(rows, (task) => task.priority);
  const stats = {
    completed: rows.length - openTasks.length,
    highPriority: openTasks.filter((task) => task.priority === "high").length,
    open: openTasks.length,
    total: rows.length,
  } as const satisfies Record<string, number>;

  const priorityChartData = TASK_PRIORITIES.map((priority) => ({
    count: byPriority[priority] ?? 0,
    priority,
  }));

  const recentTasks = take(rows, 5);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold">Dashboard</h2>
        <p className="text-muted text-sm">Task overview with live collection data.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Total tasks" value={stats.total} />
        <StatsCard label="Open" value={stats.open} />
        <StatsCard label="Completed" value={stats.completed} />
        <StatsCard label="High priority open" value={stats.highPriority} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <Card.Header>
            <Card.Title>Priority distribution</Card.Title>
          </Card.Header>
          <Card.Content className="h-72">
            <Suspense fallback={<p className="text-muted text-sm">Loading chart...</p>}>
              <PriorityDistributionChart data={priorityChartData} />
            </Suspense>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>Quick add</Card.Title>
          </Card.Header>
          <Card.Content>
            <TaskQuickAdd />
          </Card.Content>
        </Card>
      </div>

      <Card>
        <Card.Header>
          <Card.Title>Recent tasks</Card.Title>
        </Card.Header>
        <Card.Content>
          {recentTasks.length === 0 ? (
            <p className="text-muted text-sm">No tasks yet. Add one above or use Chat.</p>
          ) : (
            <ul className="divide-separator divide-y">
              {recentTasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <Link
                      className="text-accent hover:text-accent/80 block truncate font-medium hover:underline"
                      params={{ taskId: task.id }}
                      to="/tasks/$taskId"
                    >
                      {task.title}
                    </Link>
                    <p className="text-muted text-xs">{task.completed ? "Done" : "Open"}</p>
                  </div>
                  <PriorityChip priority={task.priority} />
                </li>
              ))}
            </ul>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}
