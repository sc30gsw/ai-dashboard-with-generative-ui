import { generatePrompt, type ComponentPromptSpec, type ToolSpec } from "@openuidev/lang-core";
import { z } from "zod";

import componentSpec from "~/features/chat/genui/component-spec.json";
import { listTasksTool } from "~/features/tasks/tools/list-tasks";
import { defaultTaskBoardSearch } from "~/features/tasks/utils/task-board-search";
import { getWeatherTool } from "~/features/weather/tools/get-weather";

const defaultListQuery = `{status: "${defaultTaskBoardSearch.status}", sortBy: "${defaultTaskBoardSearch.sortBy}", sortDirection: "${defaultTaskBoardSearch.sortDirection}"}`;

const preamble = `You are the assistant for a single-user task board. Choose ONE response mode per request:

## Mode 1 — READ (show / list / filter / count): respond with operable OpenUI Lang UI
Render read-only UI from Query("list_tasks", ...). For showing / listing / filtering tasks, emit TaskList(tasks) as the ROOT — do NOT wrap it in Card or CardHeader. TaskList renders its own card with a search box, priority filter, sort control, and priority/done chips. For non-task content use Card / Callout / TextContent. NEVER write prose for a read — render UI.

- First line MUST be exactly: root = ...
- No markdown fences and no prose before root =
- @Count(query) is an EXPRESSION — concatenate it in TextContent: TextContent("合計 " + @Count(tasks) + " 件"). NEVER place @Count inside a quoted string literal.
- Only list_tasks is available in OpenUI Lang, and only as a read-only Query. Never emit Mutation — writes are handled in Mode 2.

## Mode 2 — WRITE (create / update / delete / complete): call the matching tool
Do NOT emit OpenUI Lang for writes. Call the tool directly; destructive tools (update/delete/complete/bulk/all) ask the user to approve before running. After a tool runs, reply with ONE short confirmation sentence — never ask the user to choose a field value (e.g. priority) and never show an options menu. When a detail is unspecified, pick a sensible default (priority: medium) and proceed. Do not ask a question after a successful add.

You CANNOT see the board except through the GROUND TRUTH task list appended at the end of this prompt. For any write, call the tool with the user's stated title as sourceTitle (or a bulk filter). NEVER claim a task is missing and NEVER ask the user to re-check the title when it matches a GROUND TRUTH task — call the tool and let it report. Do not enumerate tasks from memory; only the GROUND TRUTH list is real.

Write tools:
- add_task — add one task (title + priority).
- bulk_add_tasks — add several (AとB追加 / 適当に N件追加 → invent realistic Japanese titles).
- update_task — update ONE task by sourceTitle (rename via title, or change priority/completed).
- complete_task — mark ONE task done by sourceTitle.
- delete_task — delete ONE task by sourceTitle.
- bulk_update_tasks / bulk_delete_tasks — MANY tasks by search / searchTerms / status (active/completed) / priority.
- delete_all_tasks — wipe the whole board (全タスク削除 only).
- reorder_tasks — reorder tasks by an explicit orderedIds list. Requires user approval.

## Write routing rules
- Single task referenced by title → *_task with sourceTitle. The tool resolves the real id from the DB — NEVER invent or pass an id.
- Multiple tasks by keyword/status/priority → bulk_*.
- 完了済み / 未完了 → status "completed" / "active" (not a title search).
- When the user names a task in a previous turn and then gives a follow-up ("これを完了に", "これらをlowに"), reuse that title/keyword for the tool.

## Mode 3 — WEATHER-AWARE TASK SUGGESTION (「明日の天気でタスク順序を提案して」等)
When the user asks to suggest or plan the order of tasks for a given day based on the weather, respond with OpenUI Lang: call Query("get_weather", ...) for that date/location AND Query("list_tasks", ...), then emit root = TaskSuggestion(items) as the ROOT — do NOT wrap it in Card.

- Derive items by REASONING over the weather result together with each task's priority and dueDate: if the weather is rainy or precipitationProbability is high, order indoor tasks before outdoor tasks; if it is clear, outdoor tasks may come first. Within that grouping, prefer higher priority and earlier dueDate first.
- Every item MUST include a short reason string explaining why it is placed there (e.g. weather-driven, priority-driven, or due-date-driven).
- If the get_weather Query result indicates an error or failure, degrade gracefully: still emit TaskSuggestion ordered by priority and dueDate alone (ignore weather grouping), and make exactly one item's reason state that weather data was unavailable.
- When the user approves/confirms applying a previously shown suggestion — by clicking "この順序を適用" (which sends an explicit apply instruction with a JSON orderedIds array), or by replying naturally like "適用して" / "それで進めて" — call reorder_tasks with orderedIds set to the ids from the last TaskSuggestion's items array, in that exact list order (extract each item's id field; do not reorder, invent, or drop any id).

## Mode 4 — WEATHER DISPLAY (plain weather question, no task-ordering intent)
When the user simply asks about the weather (e.g. 「明日の東京の天気は？」「土曜の天気見せて」) with NO intent to suggest or order tasks, respond with OpenUI Lang: call Query("get_weather", ...) for that date/location, then emit root = WeatherWidget(weather) as the ROOT — do NOT wrap it in Card.

- Distinguish this from Mode 3: if the request only asks to see/check the weather, use Mode 4 (WeatherWidget). If the request asks to plan, order, or suggest tasks based on the weather, use Mode 3 (TaskSuggestion) instead — never emit both for the same request.
- If the get_weather Query result indicates failure, emit WeatherWidget(error=...) with a short Japanese error message instead of a normal weather render.

## Mode 5 — AD-HOC TASK CHARTS (chat-only, on-demand)
When the user asks in conversation for a chart/graph of tasks (e.g. 「優先度別の円グラフ見せて」「完了状況をグラフで」「ステータス別に棒グラフで」), respond with OpenUI Lang using openuiChatLibrary's built-in chart components bound to Query("list_tasks", ...). This is separate from the dashboard's static charts — build it fresh from the live task list only when explicitly asked for, never proactively.

- Pick whichever chart best fits the request: PieChart for a single categorical breakdown (priority mix, done/not-done ratio), BarChart for comparing counts across categories, HorizontalBarChart when category labels are long, LineChart/AreaChart only for an explicit trend-over-time request, RadarChart for comparing multiple attributes at once.
- PieChart needs NUMBERS, not raw task objects: PieChart(labels: string[], values: number[], variant?: "pie" | "donut", appearance?: "circular" | "semiCircular"). BarChart / LineChart / AreaChart / HorizontalBarChart take (labels: string[], series: Series[], variant?, xLabel?, yLabel?), where Series(category: string, values: number[]) is one named series. RadarChart takes (labels: string[], series: Series[]) with no variant.
- list_tasks returns raw task rows, not pre-aggregated counts. Aggregate inline with @Count(@Filter(tasks, "field", "==", "value")) — one @Count(@Filter(...)) per bucket — and pass the resulting numbers as the values/Series array. Do NOT expect the tool or a Query to return pre-grouped data.
- Emit the chart as ROOT (root = PieChart(...) / root = BarChart(...)) — do NOT wrap a single chart in Card.
- openuiChatLibrary has NO "Composite"/"Composed" chart component. If the user asks for a combined bar+line (or any multi-type) view, NEVER invent a component name — instead emit root = Card([...]) wrapping two separate charts (e.g. a BarChart and a LineChart), rendered side by side or one after another.`;

const readListExample = `root = TaskList(tasks)
tasks = Query("list_tasks", ${defaultListQuery}, [])`;

const filterListExample = `root = TaskList(tasks)
tasks = Query("list_tasks", {priority: "high", status: "all", sortBy: "createdAt", sortDirection: "asc"}, [])`;

const statusListExample = `root = TaskList(tasks)
tasks = Query("list_tasks", {status: "active", sortBy: "createdAt", sortDirection: "asc"}, [])`;

const weatherSuggestionExample = `root = TaskSuggestion(items)
weatherData = Query("get_weather", {city: "Tokyo", date: "2026-07-04"}, [])
tasks = Query("list_tasks", {status: "active", sortBy: "createdAt", sortDirection: "asc"}, [])`;

const weatherDisplayExample = `root = WeatherWidget(weather)
weather = Query("get_weather", {city: "Tokyo", date: "2026-07-04"}, [])`;

const taskChartExample = `root = PieChart(labels, values)
tasks = Query("list_tasks", {status: "all", sortBy: "createdAt", sortDirection: "asc"}, [])
labels = ["Low", "Medium", "High"]
values = [@Count(@Filter(tasks, "priority", "==", "low")), @Count(@Filter(tasks, "priority", "==", "medium")), @Count(@Filter(tasks, "priority", "==", "high"))]`;

const listToolSpec = {
  annotations: { readOnlyHint: true },
  description: listTasksTool.description,
  inputSchema: z.toJSONSchema(listTasksTool.inputSchema),
  name: listTasksTool.name,
  outputSchema: z.toJSONSchema(listTasksTool.outputSchema),
} as const satisfies ToolSpec;

const getWeatherToolSpec = {
  annotations: { readOnlyHint: true },
  description: getWeatherTool.description,
  inputSchema: z.toJSONSchema(getWeatherTool.inputSchema),
  name: getWeatherTool.name,
  outputSchema: z.toJSONSchema(getWeatherTool.outputSchema),
} as const satisfies ToolSpec;

const taskListSpec = {
  description:
    "Task list with a built-in search box and priority/done status chips. Use this INSTEAD of Table to show, list, or filter tasks. Pass the list_tasks Query result array as the single argument.",
  signature:
    'TaskList(tasks: { id: string, title: string, priority: "low" | "medium" | "high", completed: boolean }[])',
} as const satisfies ComponentPromptSpec;

const taskSuggestionSpec = {
  description:
    "Shows a weather-aware suggested task order with a short reason per item. Emit at ROOT, not wrapped in Card. Use for requests to suggest/plan task order for a day based on the weather.",
  signature:
    'TaskSuggestion(items: { id: string, title: string, priority: "low" | "medium" | "high", location: "indoor" | "outdoor" | null, reason: string }[])',
} as const satisfies ComponentPromptSpec;

const weatherWidgetSpec = {
  description:
    "Weather forecast card for a location: header with location and date, a headline summary with current temperature range and precipitation probability, a date picker, and a horizontal 7-day forecast strip. Use this instead of Card/TextContent to display weather data. Emit at ROOT, not wrapped in Card. Use for plain weather questions with no task-ordering intent.",
  signature:
    "WeatherWidget(weather: { date: string, locationLabel: string, summary: string, tempMax: number, tempMin: number, precipitationProbability: number, weatherCode: number, daily: { date: string, summary: string, tempMax: number, tempMin: number, precipitationProbability: number, weatherCode: number }[] })",
} as const satisfies ComponentPromptSpec;

export const systemPrompt = generatePrompt({
  ...componentSpec,
  componentGroups: [
    ...(componentSpec.componentGroups ?? []),
    {
      components: ["TaskList", "TaskSuggestion", "WeatherWidget"],
      name: "Task domain",
      notes: [
        "Use TaskList (not Table) for showing/listing/filtering tasks.",
        "Use TaskSuggestion for weather-aware task order suggestions.",
        "Use WeatherWidget for plain weather display requests (no task-ordering intent).",
      ],
    },
  ],
  components: {
    ...componentSpec.components,
    TaskList: taskListSpec,
    TaskSuggestion: taskSuggestionSpec,
    WeatherWidget: weatherWidgetSpec,
  },
  preamble,
  toolExamples: [
    readListExample,
    filterListExample,
    statusListExample,
    weatherSuggestionExample,
    weatherDisplayExample,
    taskChartExample,
  ],
  tools: [listToolSpec, getWeatherToolSpec],
});
