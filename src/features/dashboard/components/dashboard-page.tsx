import { Card } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { Suspense, lazy } from "react";
import { countBy, partition, take } from "remeda";

import {
  aggregateCompletionByPriority,
  aggregateTasksByDay,
  type CompletionByPriorityDatum,
  type TasksByDayDatum,
} from "~/features/dashboard/lib/task-chart-aggregation";
import { TASK_PRIORITIES, type TaskPriority } from "~/features/tasks/api/task-model";
import { PriorityChip } from "~/features/tasks/components/priority-chip";
import { TaskQuickAdd } from "~/features/tasks/components/task-quick-add";
import { useAllTasksQuery } from "~/features/tasks/hooks/use-filtered-tasks-query";
import { WeatherSuggestionPanel } from "~/features/weather/components/weather-suggestion-panel";

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

const CompletionByPriorityChart = lazy(async () => {
  const { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } =
    await import("recharts");

  return {
    default: function CompletionByPriorityChart({
      data,
    }: Record<"data", CompletionByPriorityDatum[]>) {
      return (
        <ResponsiveContainer height="100%" width="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="priority" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="completed" fill="var(--accent)" radius={[4, 4, 0, 0]} stackId="status" />
            <Bar dataKey="incomplete" fill="var(--muted)" radius={[4, 4, 0, 0]} stackId="status" />
          </BarChart>
        </ResponsiveContainer>
      );
    },
  };
});

const DailyActivityChart = lazy(async () => {
  const { Bar, ComposedChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } =
    await import("recharts");

  return {
    default: function DailyActivityChart({ data }: Record<"data", TasksByDayDatum[]>) {
      return (
        <ResponsiveContainer height="100%" width="100%">
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="created" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            <Line dataKey="completed" stroke="var(--muted)" type="monotone" />
          </ComposedChart>
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

  const completionByPriorityData = aggregateCompletionByPriority(rows);
  const dailyActivityData = aggregateTasksByDay(rows);

  const recentTasks = take(rows, 5);

  const priorityChartSummary = `優先度別タスク数: ${priorityChartData
    .map((datum) => `${datum.priority} ${datum.count}件`)
    .join("、")}`;
  const completionByPriorityChartSummary = `優先度別の完了・未完了件数: ${completionByPriorityData
    .map((datum) => `${datum.priority} 完了${datum.completed}件・未完了${datum.incomplete}件`)
    .join("、")}`;
  const dailyActivityChartSummary =
    dailyActivityData.length === 0
      ? "日別の新規作成・完了タスク数の推移データはまだありません。"
      : `日別の新規作成・完了タスク数の推移（${dailyActivityData[0]?.date}から${dailyActivityData.at(-1)?.date}まで）: ${dailyActivityData
          .map((datum) => `${datum.date} 新規${datum.created}件・完了${datum.completed}件`)
          .join("、")}`;

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
            <span className="sr-only">{priorityChartSummary}</span>
            <Suspense fallback={<p className="text-muted text-sm">Loading chart...</p>}>
              <div aria-hidden="true" className="h-full w-full">
                <PriorityDistributionChart data={priorityChartData} />
              </div>
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

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <Card.Header>
            <Card.Title>Completion by priority</Card.Title>
          </Card.Header>
          <Card.Content className="h-72">
            <span className="sr-only">{completionByPriorityChartSummary}</span>
            <Suspense fallback={<p className="text-muted text-sm">Loading chart...</p>}>
              <div aria-hidden="true" className="h-full w-full">
                <CompletionByPriorityChart data={completionByPriorityData} />
              </div>
            </Suspense>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>Daily activity</Card.Title>
          </Card.Header>
          <Card.Content className="h-72">
            <span className="sr-only">{dailyActivityChartSummary}</span>
            <Suspense fallback={<p className="text-muted text-sm">Loading chart...</p>}>
              <div aria-hidden="true" className="h-full w-full">
                <DailyActivityChart data={dailyActivityData} />
              </div>
            </Suspense>
          </Card.Content>
        </Card>
      </div>

      <WeatherSuggestionPanel />

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
