import { Card } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { Suspense, lazy } from "react";
import { countBy, partition, take } from "remeda";

import { WeatherSuggestionPanel } from "~/components/weather-suggestion-panel";
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
import { CurrentLocationMapCard } from "~/features/weather/components/current-location-map-card";

type PriorityChartDatum = {
  count: number;
  priority: TaskPriority;
};

//? PriorityChip の色分け（high=danger/medium=warning/low=default）に沿った、視認しやすい3色。
const PRIORITY_CHART_COLORS = {
  high: "#ef4444",
  low: "#94a3b8",
  medium: "#f59e0b",
} as const satisfies Record<TaskPriority, string>;

const STATUS_CHART_COLORS = {
  completed: "#2563eb",
  incomplete: "#cbd5e1",
} as const satisfies Record<"completed" | "incomplete", string>;

const ACTIVITY_CHART_COLORS = {
  completed: "#0f766e",
  created: "#2563eb",
} as const satisfies Record<"completed" | "created", string>;

const CHART_HEIGHT = 240;

const PriorityDistributionChart = lazy(async () => {
  const { Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip } = await import("recharts");

  return {
    default: function PriorityDistributionChart({ data }: Record<"data", PriorityChartDatum[]>) {
      return (
        <ResponsiveContainer height={CHART_HEIGHT} width="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              innerRadius="52%"
              nameKey="priority"
              outerRadius="76%"
              paddingAngle={2}
            >
              <LabelList
                dataKey="count"
                fill="#111827"
                fontSize={12}
                formatter={(value: number) => (value > 0 ? String(value) : "")}
                position="outside"
              />
              {data.map((datum) => (
                <Cell fill={PRIORITY_CHART_COLORS[datum.priority]} key={datum.priority} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
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

function LegendItem({ color, label }: Record<"color" | "label", string>) {
  return (
    <span className="text-muted inline-flex items-center gap-1.5 text-xs">
      <span className="size-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function EmptyChartState({ message }: Record<"message", string>) {
  return (
    <div className="border-separator bg-surface-secondary/40 text-muted flex min-h-40 items-center justify-center rounded-md border text-center text-sm">
      {message}
    </div>
  );
}

function percent(value: number, max: number) {
  if (max <= 0) {
    return "0%";
  }

  return `${Math.max(4, Math.round((value / max) * 100))}%`;
}

function CompletionByPriorityBars({ data }: Record<"data", CompletionByPriorityDatum[]>) {
  const max = Math.max(...data.map((datum) => datum.completed + datum.incomplete), 1);

  return (
    <div className="flex flex-col gap-4">
      {data.map((datum) => {
        const total = datum.completed + datum.incomplete;

        return (
          <div className="grid grid-cols-[5rem_1fr_4rem] items-center gap-3" key={datum.priority}>
            <span className="text-sm font-medium capitalize">{datum.priority}</span>
            <div
              aria-label={`${datum.priority}: completed ${datum.completed}, open ${datum.incomplete}`}
              className="bg-surface-secondary flex h-7 overflow-hidden rounded-md"
            >
              {datum.completed > 0 ? (
                <div
                  className="h-full"
                  style={{
                    backgroundColor: STATUS_CHART_COLORS.completed,
                    width: percent(datum.completed, max),
                  }}
                />
              ) : null}
              {datum.incomplete > 0 ? (
                <div
                  className="h-full"
                  style={{
                    backgroundColor: STATUS_CHART_COLORS.incomplete,
                    width: percent(datum.incomplete, max),
                  }}
                />
              ) : null}
            </div>
            <span className="text-muted text-right text-sm">
              {datum.completed}/{total}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DailyActivityBars({ data }: Record<"data", TasksByDayDatum[]>) {
  const max = Math.max(...data.map((datum) => datum.created), 1);

  return (
    <div className="flex flex-col gap-4">
      {data.map((datum) => (
        <div className="grid grid-cols-[6.5rem_1fr_4rem] items-center gap-3" key={datum.date}>
          <span className="text-muted text-sm tabular-nums">{datum.date}</span>
          <div className="flex flex-col gap-1.5">
            <div
              aria-label={`${datum.date}: created ${datum.created}`}
              className="bg-surface-secondary h-5 overflow-hidden rounded-md"
            >
              <div
                className="h-full"
                style={{
                  backgroundColor: ACTIVITY_CHART_COLORS.created,
                  width: percent(datum.created, max),
                }}
              />
            </div>
            <div
              aria-label={`${datum.date}: completed now ${datum.completed}`}
              className="bg-surface-secondary h-2 overflow-hidden rounded-full"
            >
              {datum.completed > 0 ? (
                <div
                  className="h-full"
                  style={{
                    backgroundColor: ACTIVITY_CHART_COLORS.completed,
                    width: percent(datum.completed, max),
                  }}
                />
              ) : null}
            </div>
          </div>
          <span className="text-muted text-right text-sm">{datum.created}件</span>
        </div>
      ))}
    </div>
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
  const hasTasks = rows.length > 0;

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
          <Card.Content className="flex flex-col gap-3">
            <span className="sr-only">{priorityChartSummary}</span>
            <div className="flex flex-wrap gap-3">
              {priorityChartData.map((datum) => (
                <LegendItem
                  color={PRIORITY_CHART_COLORS[datum.priority]}
                  key={datum.priority}
                  label={`${datum.priority}: ${datum.count}`}
                />
              ))}
            </div>
            <div className="min-h-60">
              {hasTasks ? (
                <Suspense fallback={<p className="text-muted text-sm">Loading chart...</p>}>
                  <div aria-hidden="true" className="h-full w-full">
                    <PriorityDistributionChart data={priorityChartData} />
                  </div>
                </Suspense>
              ) : (
                <EmptyChartState message="まだタスクがありません。" />
              )}
            </div>
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
          <Card.Content className="flex flex-col gap-3">
            <span className="sr-only">{completionByPriorityChartSummary}</span>
            <div className="flex flex-wrap gap-3">
              <LegendItem color={STATUS_CHART_COLORS.completed} label="Completed" />
              <LegendItem color={STATUS_CHART_COLORS.incomplete} label="Open" />
            </div>
            <p className="text-muted text-xs">{completionByPriorityChartSummary}</p>
            <div>
              {hasTasks ? (
                <CompletionByPriorityBars data={completionByPriorityData} />
              ) : (
                <EmptyChartState message="完了状況を集計するタスクがありません。" />
              )}
            </div>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>Daily activity</Card.Title>
          </Card.Header>
          <Card.Content className="flex flex-col gap-3">
            <span className="sr-only">{dailyActivityChartSummary}</span>
            <div className="flex flex-wrap gap-3">
              <LegendItem color={ACTIVITY_CHART_COLORS.created} label="Created" />
              <LegendItem color={ACTIVITY_CHART_COLORS.completed} label="Completed now" />
            </div>
            <p className="text-muted text-xs">
              完了日は保存していないため、完了数は「その日に作成され、現在完了しているタスク」です。
            </p>
            <div>
              {dailyActivityData.length > 0 ? (
                <DailyActivityBars data={dailyActivityData} />
              ) : (
                <EmptyChartState message="日別に集計できるタスクがありません。" />
              )}
            </div>
          </Card.Content>
        </Card>
      </div>

      <WeatherSuggestionPanel />

      <CurrentLocationMapCard />

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
