import { gateway } from "@ai-sdk/gateway";
import { generateObject } from "ai";
import { Result } from "better-result";
import { z } from "zod";

import { chatModel } from "~/features/chat/lib/model";
import type { PinnedMutations } from "~/features/chat/lib/pinned-mutations";
import {
  BulkAddTasksSchema,
  BulkDeleteTasksSchema,
  BulkUpdateTasksSchema,
  CompleteTaskSchema,
  CreateTaskSchema,
  DeleteAllTasksSchema,
  DeleteTaskSchema,
  defaultListTasksSchema,
  ListTasksSchema,
  TaskPrioritySchema,
  UpdateTaskSchema,
  type ListTasksInput,
  type TaskPriority,
  type TaskView,
} from "~/features/tasks/api/task-model";
import { TaskService } from "~/features/tasks/api/task-service";

export type MatchedTaskSnapshot = {
  completed: boolean;
  id: string;
  priority: TaskPriority;
  title: string;
};

export type ToolExecution = {
  addedCount?: number;
  error?: string;
  ok: boolean;
  taskTitles?: string[];
};

export type ResolvedToolIntent = {
  clarifyMessage: string | null;
  execution: ToolExecution | null;
  groundTruth: string;
  listQuery: ListTasksInput;
  matchedTasks: MatchedTaskSnapshot[];
  pinnedMutations: PinnedMutations;
  uiContext: string;
};

/** LLM may pass sourceTitle before server resolves id from DB. */
const DeleteTaskIntentArgsSchema = z.object({
  id: z.string().min(1).optional(),
  sourceTitle: z.string().trim().min(1).optional(),
  searchTitle: z.string().trim().min(1).optional(),
});

const UpdateTaskIntentArgsSchema = z
  .object({
    completed: z.boolean().optional(),
    id: z.string().min(1).optional(),
    priority: TaskPrioritySchema.optional(),
    sourceTitle: z.string().trim().min(1).optional(),
    searchTitle: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1).optional(),
  })
  .refine(
    (input) =>
      input.title !== undefined || input.priority !== undefined || input.completed !== undefined,
    "Provide at least one field to update",
  );

const AUTO_TOOLS = z.enum(["add_task", "bulk_add_tasks"]);
const CUD_TOOLS = z.enum([
  "bulk_delete_tasks",
  "bulk_update_tasks",
  "complete_task",
  "delete_all_tasks",
  "delete_task",
  "update_task",
]);

const ToolIntentSchema = z.discriminatedUnion("resolution", [
  z.object({
    message: z.string().min(1),
    resolution: z.literal("clarify"),
  }),
  z.object({
    args: z.record(z.string(), z.unknown()),
    resolution: z.literal("auto"),
    tool: AUTO_TOOLS,
  }),
  z.object({
    args: z.record(z.string(), z.unknown()),
    resolution: z.literal("confirm"),
    tool: CUD_TOOLS,
  }),
  z.object({
    listQuery: ListTasksSchema.default(defaultListTasksSchema),
    resolution: z.literal("browse"),
  }),
]);

type ToolIntent = z.infer<typeof ToolIntentSchema>;

const TOOL_SCHEMAS = {
  add_task: CreateTaskSchema,
  bulk_add_tasks: BulkAddTasksSchema,
  bulk_delete_tasks: BulkDeleteTasksSchema,
  bulk_update_tasks: BulkUpdateTasksSchema,
  complete_task: CompleteTaskSchema,
  delete_all_tasks: DeleteAllTasksSchema,
  delete_task: DeleteTaskSchema,
  update_task: UpdateTaskSchema,
} as const;

const postCudUxRules = `POST-ACTION UX (delete/update):
- TWO Queries: matched (filter) + allTasks (full board).
- Button Action: [@Run(mutation), @Run(matched), @Run(allTasks)].
- Counts via @Count in TextContent with + concatenation — e.g. TextContent("更新対象 " + @Count(matched) + " 件"). Never @Count inside quoted strings.
- Mutation args are pinned server-side; use Mutation(toolName, {}) in OpenUI Lang.`;

const postAddUxRules = `POST-ADD UX (auto-executed adds):
- allTasks = Query("list_tasks", ${JSON.stringify(defaultListTasksSchema)}).
- Show Callout + Table from allTasks only — no Mutation, no confirm Button.
- Count MUST be @Count(allTasks) — never literal numbers like "合計 0 件" in TextContent.`;

function schemaHint(schema: z.ZodType) {
  return JSON.stringify(z.toJSONSchema(schema));
}

const toolIntentSystem = `You are the sole router for task-board natural language. Your structured output is executed directly — the server does NOT reinterpret user text with keyword rules or second-pass LLM calls.

## Resolution modes
- auto: add_task, bulk_add_tasks — server saves immediately; NEVER use browse/confirm for registration
- confirm: delete/update mutations — preview + user button
- browse: list/filter/count/show only — no writes
- clarify: ONLY when there is literally no interpretable action

## Tool schemas (args MUST match exactly)
- add_task (auto): ${schemaHint(CreateTaskSchema)}
- bulk_add_tasks (auto): ${schemaHint(BulkAddTasksSchema)}
- delete_task (confirm): id OR sourceTitle — ${schemaHint(DeleteTaskIntentArgsSchema)}
- update_task (confirm): id OR sourceTitle + fields — ${schemaHint(UpdateTaskIntentArgsSchema)}
- complete_task (confirm): id OR sourceTitle — ${schemaHint(CompleteTaskSchema)}
- bulk_delete_tasks (confirm): ${schemaHint(BulkDeleteTasksSchema)}
- bulk_update_tasks (confirm): ${schemaHint(BulkUpdateTasksSchema)}
- delete_all_tasks (confirm): ${schemaHint(DeleteAllTasksSchema)}
- browse: listQuery — ${schemaHint(ListTasksSchema)}

## Critical field rules
- bulk_* filters: ALWAYS use search or searchTerms for title keywords (含む / containing / が入っている). NEVER use sourceTitle on bulk_* — it is stripped and causes whole-board ops.
- sourceTitle/searchTitle: ONLY on delete_task / update_task for a single title lookup
- 完了済み/未完了 → status "completed" or "active", NOT title search
- 全タスク/すべてのタスク → status "all" or "active" scope — NOT a title keyword
- Multiple likely matches → bulk_* with the same filter; do NOT use delete_task/update_task

## Worked examples (copy the shape)
| User message | resolution | tool | args |
| タスクを適当に5件追加 | auto | bulk_add_tasks | tasks: [5 items with title+priority you invent] |
| test1を追加 | auto | add_task | { title: "test1", priority: "medium" } |
| 3つ test2 を登録 | auto | bulk_add_tasks | tasks: 3× { title: "test2", priority: "medium" } |
| AとBを追加 | auto | bulk_add_tasks | tasks: [{ title: "A", ... }, { title: "B", ... }] |
| ミーティングを含むタスク | browse | — | listQuery: { search: "ミーティング", status: "all", sortBy: "createdAt", sortDirection: "asc" } |
| ミーティングが含まれるタスクをlowに更新 | confirm | bulk_update_tasks | { search: "ミーティング", priority: "low", status: "all" } |
| これらをLowに (after meeting list) | confirm | bulk_update_tasks | { search: "ミーティング", priority: "low", status: "all" } |
| すべてのタスクを完了に | confirm | bulk_update_tasks | { status: "active", completed: true } |
| 全タスクの優先度をLowに | confirm | bulk_update_tasks | { status: "all", priority: "low" } |
| 完了タスクを削除 | confirm | bulk_delete_tasks | { status: "completed" } |
| 請求書の確認を完了 | confirm | complete_task | { sourceTitle: "請求書の確認" } |
| 会議の準備を削除 | confirm | delete_task | { sourceTitle: "会議の準備" } |
| 週次レポートを削除 (one) | confirm | delete_task | { sourceTitle: "週次レポート" } |
| 全タスク削除 | confirm | delete_all_tasks | {} |

## Add quality
- 適当/ランダム/サンプル: invent diverse realistic Japanese task titles in bulk_add_tasks.tasks
- Each bulk item needs title + priority (low|medium|high)
- Never use browse for 追加/登録/作成 requests`;

type ResolvedToolCall = {
  args: Record<string, unknown>;
  listQuery: ListTasksInput;
  matched: MatchedTaskSnapshot[];
  tool: string;
};

function snapshotTasks(tasks: TaskView[]): MatchedTaskSnapshot[] {
  return tasks.map((task) => ({
    completed: task.completed,
    id: task.id,
    priority: task.priority,
    title: task.title,
  }));
}

async function fetchMatchingTasks(query: ListTasksInput): Promise<MatchedTaskSnapshot[]> {
  const result = await TaskService.list(ListTasksSchema.parse(query));

  if (Result.isError(result)) {
    return [];
  }

  return snapshotTasks(result.value);
}

function lookupTitleFromArgs(args: Record<string, unknown>) {
  if (typeof args.sourceTitle === "string" && args.sourceTitle.trim()) {
    return args.sourceTitle.trim();
  }

  if (typeof args.searchTitle === "string" && args.searchTitle.trim()) {
    return args.searchTitle.trim();
  }

  if (typeof args.search === "string" && args.search.trim()) {
    return args.search.trim();
  }

  return null;
}

function updateFieldsFromArgs(args: Record<string, unknown>) {
  const fields: Record<string, unknown> = {};

  if (typeof args.title === "string" && args.title.trim()) {
    fields.title = args.title.trim();
  }

  if (typeof args.priority === "string") {
    fields.priority = args.priority;
  }

  if (typeof args.completed === "boolean") {
    fields.completed = args.completed;
  }

  return fields;
}

function listQueryForTitleSearch(search: string): ListTasksInput {
  return ListTasksSchema.parse({
    search,
    sortBy: "createdAt",
    sortDirection: "asc",
    status: "all",
  });
}

function formatValidationError(error: z.ZodError) {
  const detail = error.issues.map((issue) => issue.message).join("；");

  return `リクエストを処理できませんでした（${detail}）。条件を見直すか、もう少し具体的に教えてください。`;
}

async function resolveCompleteTask(
  rawArgs: Record<string, unknown>,
): Promise<ResolvedToolCall | { clarify: string }> {
  const id = typeof rawArgs.id === "string" ? rawArgs.id.trim() : "";

  if (id) {
    const parsed = CompleteTaskSchema.safeParse({ id });

    if (!parsed.success) {
      return { clarify: formatValidationError(parsed.error) };
    }

    const listQuery = defaultListTasksSchema;
    const all = await fetchMatchingTasks(listQuery);
    const matched = all.filter((row) => row.id === id);

    return {
      args: parsed.data as Record<string, unknown>,
      listQuery,
      matched,
      tool: "complete_task",
    };
  }

  const lookupTitle = lookupTitleFromArgs(rawArgs);

  if (!lookupTitle) {
    return { clarify: "どのタスクを完了にするか、タイトルで教えてください。" };
  }

  const listQuery = listQueryForTitleSearch(lookupTitle);
  const matched = await fetchMatchingTasks(listQuery);

  if (matched.length === 0) {
    return { clarify: `「${lookupTitle}」に一致するタスクが見つかりませんでした。` };
  }

  if (matched.length === 1) {
    const parsed = CompleteTaskSchema.safeParse({ id: matched[0]!.id });

    if (!parsed.success) {
      return { clarify: formatValidationError(parsed.error) };
    }

    return {
      args: parsed.data as Record<string, unknown>,
      listQuery,
      matched,
      tool: "complete_task",
    };
  }

  const bulkArgs = { search: lookupTitle, status: "all", completed: true };
  const parsed = BulkUpdateTasksSchema.safeParse(bulkArgs);

  if (!parsed.success) {
    return { clarify: formatValidationError(parsed.error) };
  }

  return {
    args: parsed.data as Record<string, unknown>,
    listQuery,
    matched,
    tool: "bulk_update_tasks",
  };
}

async function resolveSingleOrBulkTool(
  tool: "delete_task" | "update_task",
  rawArgs: Record<string, unknown>,
): Promise<ResolvedToolCall | { clarify: string }> {
  const id = typeof rawArgs.id === "string" ? rawArgs.id.trim() : "";

  if (id) {
    const parsed = TOOL_SCHEMAS[tool].safeParse({ ...rawArgs, id });

    if (!parsed.success) {
      return { clarify: formatValidationError(parsed.error) };
    }

    const listQuery = defaultListTasksSchema;
    const all = await fetchMatchingTasks(listQuery);
    const matched = all.filter((row) => row.id === id);

    return { args: parsed.data as Record<string, unknown>, listQuery, matched, tool };
  }

  const lookupTitle = lookupTitleFromArgs(rawArgs);

  if (!lookupTitle) {
    return { clarify: "どのタスクか、タイトルまたはキーワードで教えてください。" };
  }

  const listQuery = listQueryForTitleSearch(lookupTitle);
  const matched = await fetchMatchingTasks(listQuery);

  if (matched.length === 0) {
    return { clarify: `「${lookupTitle}」に一致するタスクが見つかりませんでした。` };
  }

  if (matched.length === 1) {
    const { sourceTitle: _s, searchTitle: _st, search: _search, ...rest } = rawArgs;
    const args = { ...rest, id: matched[0]!.id };
    const parsed = TOOL_SCHEMAS[tool].safeParse(args);

    if (!parsed.success) {
      return { clarify: formatValidationError(parsed.error) };
    }

    return { args: parsed.data as Record<string, unknown>, listQuery, matched, tool };
  }

  if (tool === "delete_task") {
    const bulkArgs = { search: lookupTitle, status: "all" };
    const parsed = BulkDeleteTasksSchema.safeParse(bulkArgs);

    if (!parsed.success) {
      return { clarify: formatValidationError(parsed.error) };
    }

    return {
      args: parsed.data as Record<string, unknown>,
      listQuery,
      matched,
      tool: "bulk_delete_tasks",
    };
  }

  const updateFields = updateFieldsFromArgs(rawArgs);

  if (Object.keys(updateFields).length === 0) {
    return { clarify: "どの項目をどう変更するか教えてください。" };
  }

  const bulkArgs = { search: lookupTitle, status: "all", ...updateFields };
  const parsed = BulkUpdateTasksSchema.safeParse(bulkArgs);

  if (!parsed.success) {
    return { clarify: formatValidationError(parsed.error) };
  }

  return {
    args: parsed.data as Record<string, unknown>,
    listQuery,
    matched,
    tool: "bulk_update_tasks",
  };
}

async function validateAndResolveTool(
  tool: string,
  rawArgs: Record<string, unknown>,
): Promise<ResolvedToolCall | { clarify: string }> {
  if (tool === "add_task" || tool === "bulk_add_tasks") {
    const schema = TOOL_SCHEMAS[tool];
    const parsed = schema.safeParse(rawArgs);

    if (!parsed.success) {
      return { clarify: formatValidationError(parsed.error) };
    }

    const args = parsed.data as Record<string, unknown>;

    return {
      args,
      listQuery: defaultListTasksSchema,
      matched: await fetchMatchingTasks(defaultListTasksSchema),
      tool,
    };
  }

  if (tool === "complete_task") {
    return resolveCompleteTask(rawArgs);
  }

  if (tool === "delete_task" || tool === "update_task") {
    return resolveSingleOrBulkTool(tool, rawArgs);
  }

  const schema = TOOL_SCHEMAS[tool as keyof typeof TOOL_SCHEMAS];

  if (!schema) {
    return { clarify: "その操作はまだサポートされていません。" };
  }

  const parsed = schema.safeParse(rawArgs);

  if (!parsed.success) {
    return { clarify: formatValidationError(parsed.error) };
  }

  const args = parsed.data as Record<string, unknown>;
  const listQuery = listQueryFromTool(tool, args);
  const matched = await fetchMatchingTasks(listQuery);

  return { args, listQuery, matched, tool };
}

function listQueryFromTool(tool: string, args: Record<string, unknown>): ListTasksInput {
  if (tool === "bulk_delete_tasks" || tool === "bulk_update_tasks") {
    return ListTasksSchema.parse({
      search: args.search,
      searchTerms: args.searchTerms,
      sortBy: "createdAt",
      sortDirection: "asc",
      status: args.status ?? "all",
    });
  }

  if (tool === "list_tasks") {
    return ListTasksSchema.parse(args);
  }

  if (tool === "delete_all_tasks") {
    return defaultListTasksSchema;
  }

  if (tool === "delete_task" || tool === "update_task") {
    const lookup = lookupTitleFromArgs(args);

    if (lookup) {
      return listQueryForTitleSearch(lookup);
    }
  }

  return defaultListTasksSchema;
}

function buildGroundTruth(label: string, matched: MatchedTaskSnapshot[]) {
  if (matched.length === 0) {
    return `GROUND TRUTH: "${label}" matches 0 tasks. Do not show confirm UI with 0 targets.`;
  }

  const lines = matched
    .map(
      (task) =>
        `- "${task.title}" (id: ${task.id}, priority: ${task.priority}, completed: ${task.completed})`,
    )
    .join("\n");

  return `GROUND TRUTH (${matched.length} task(s) for "${label}"):
${lines}
- UI counts/titles must match Query(list_tasks) with pinned listQuery.`;
}

function buildUiContext(
  resolution: ToolIntent["resolution"],
  tool: string,
  listQuery: ListTasksInput,
  matched: MatchedTaskSnapshot[],
  pinned: PinnedMutations,
  execution: ToolExecution | null,
) {
  if (resolution === "auto" && !execution) {
    return `ADD NOT EXECUTED: Server did not save tasks. Show error Callout — do NOT show success UI.`;
  }

  if (resolution === "auto" && execution?.ok) {
    const count = execution.addedCount ?? execution.taskTitles?.length ?? 1;
    const titles = execution.taskTitles?.join(", ") ?? "";
    const dbCount = matched.length;

    return `AUTO-EXECUTED: ${tool} saved ${count} task(s): ${titles}. Database now has ${dbCount} task(s) on board.
${postAddUxRules}
Do NOT narrate success without Query — Table must show real rows from allTasks.`;
  }

  if (resolution === "auto" && execution?.error) {
    return `ADD FAILED: ${execution.error}. Show error Callout.`;
  }

  if (resolution === "browse") {
    return `BROWSE: Show list UI from Query("list_tasks", ${JSON.stringify(listQuery)}). No Mutation.`;
  }

  if (resolution === "confirm") {
    const countNote =
      matched.length > 0 ? ` Exactly ${matched.length} task(s) in database for preview.` : "";
    const pinnedJson = JSON.stringify(pinned[tool] ?? {});

    return `CONFIRM: ${tool}${countNote} ${postCudUxRules}
Mutation MUST be Mutation("${tool}", {}) — args are pinned server-side (${pinnedJson}).
For single-task delete/complete UI use Mutation("delete_task", {}) or Mutation("complete_task", {}) — id is pinned on those tools too when one target.
Query matched = Query("list_tasks", ${JSON.stringify(listQuery)}).
Never use @First(matched).id in Mutation — pinned on click.`;
  }

  return "";
}

async function executeAutoTool(
  tool: string,
  args: Record<string, unknown>,
): Promise<ToolExecution> {
  if (tool === "add_task") {
    const input = CreateTaskSchema.parse(args);
    const result = await TaskService.add(input);

    if (Result.isError(result)) {
      return { error: result.error.message, ok: false };
    }

    return { ok: true, taskTitles: [result.value.title] };
  }

  if (tool === "bulk_add_tasks") {
    const input = BulkAddTasksSchema.parse(args);
    const result = await TaskService.bulkAdd(input.tasks);

    if (Result.isError(result)) {
      return { error: result.error.message, ok: false };
    }

    return {
      addedCount: result.value.addedCount,
      ok: true,
      taskTitles: result.value.tasks.map((task) => task.title),
    };
  }

  return { error: "Unknown auto tool", ok: false };
}

export function conversationContextFromMessages(
  messages: Array<{ parts: Array<{ type: string; text?: string }>; role: string }>,
  maxMessages = 6,
) {
  const recent = messages.slice(-maxMessages);
  const lines: string[] = [];

  for (const message of recent) {
    let text = "";

    for (const part of message.parts) {
      if (part.type === "text" && part.text) {
        text += part.text;
      }
    }

    const trimmed = text.trim();

    if (!trimmed) {
      continue;
    }

    lines.push(`${message.role}: ${trimmed}`);
  }

  return lines.join("\n");
}

export function lastUserTextFromMessages(
  messages: Array<{ parts: Array<{ type: string; text?: string }>; role: string }>,
) {
  const lastUser = messages.filter((message) => message.role === "user").at(-1);

  if (!lastUser) {
    return "";
  }

  let text = "";

  for (const part of lastUser.parts) {
    if (part.type === "text" && part.text) {
      text += part.text;
    }
  }

  return text.trim();
}

function buildPinnedMutations(
  tool: string,
  args: Record<string, unknown>,
  matched: MatchedTaskSnapshot[],
): PinnedMutations {
  const id = typeof args.id === "string" ? args.id.trim() : "";
  const singleTargetId = matched.length === 1 ? matched[0]!.id : id || undefined;

  const pinned: PinnedMutations = {
    _resolved: {
      args,
      matchedCount: matched.length,
      singleTargetId,
      tool,
    },
    [tool]: args,
  };

  if (!singleTargetId) {
    return pinned;
  }

  for (const idTool of ["delete_task", "complete_task"] as const) {
    pinned[idTool] = { id: singleTargetId };
  }

  const updateMirror: Record<string, unknown> = { id: singleTargetId };

  if (typeof args.completed === "boolean") {
    updateMirror.completed = args.completed;
  }

  if (typeof args.priority === "string") {
    updateMirror.priority = args.priority;
  }

  if (typeof args.title === "string") {
    updateMirror.title = args.title;
  }

  pinned.update_task = updateMirror;

  return pinned;
}

function emptyClarifyResponse(clarifyMessage: string): ResolvedToolIntent {
  return {
    clarifyMessage,
    execution: null,
    groundTruth: "",
    listQuery: defaultListTasksSchema,
    matchedTasks: [],
    pinnedMutations: {},
    uiContext: "",
  };
}

function actionIntentFromToolIntent(intent: ToolIntent) {
  if (intent.resolution === "auto") {
    return {
      args: intent.args,
      resolution: intent.resolution,
      tool: intent.tool,
    };
  }

  if (intent.resolution === "confirm") {
    return {
      args: intent.args,
      resolution: intent.resolution,
      tool: intent.tool,
    };
  }

  return null;
}

export async function resolveToolIntent(
  userText: string,
  conversationContext = "",
): Promise<ResolvedToolIntent> {
  const prompt = conversationContext
    ? `Recent conversation:\n${conversationContext}\n\nCurrent user message:\n${userText}`
    : userText;

  const { object: intent } = await generateObject({
    model: gateway(chatModel),
    prompt,
    schema: ToolIntentSchema,
    system: toolIntentSystem,
  });

  if (intent.resolution === "clarify") {
    return emptyClarifyResponse(intent.message);
  }

  if (intent.resolution === "browse") {
    const listQuery = ListTasksSchema.parse(intent.listQuery);
    const matched = await fetchMatchingTasks(listQuery);

    return {
      clarifyMessage: null,
      execution: null,
      groundTruth: buildGroundTruth("browse", matched),
      listQuery,
      matchedTasks: matched,
      pinnedMutations: {},
      uiContext: buildUiContext("browse", "list_tasks", listQuery, matched, {}, null),
    };
  }

  const actionIntent = actionIntentFromToolIntent(intent);

  if (!actionIntent) {
    return emptyClarifyResponse("リクエストを処理できませんでした。もう一度お試しください。");
  }

  const resolved = await validateAndResolveTool(actionIntent.tool, actionIntent.args);

  if ("clarify" in resolved) {
    return emptyClarifyResponse(resolved.clarify);
  }

  const { tool, args, listQuery, matched } = resolved;

  if (actionIntent.resolution === "confirm" && matched.length === 0) {
    const label =
      listQuery.status === "completed"
        ? "完了済みタスク"
        : listQuery.status === "active"
          ? "未完了タスク"
          : (listQuery.search ?? listQuery.searchTerms?.join(" / ") ?? "指定条件");

    return emptyClarifyResponse(`${label}に一致するタスクは現在ありません。`);
  }

  const pinnedMutations = buildPinnedMutations(tool, args, matched);
  let execution: ToolExecution | null = null;
  let groundTruthMatched = matched;
  let groundTruthListQuery = listQuery;

  if (actionIntent.resolution === "auto") {
    execution = await executeAutoTool(tool, args);

    if (execution.ok) {
      groundTruthListQuery = defaultListTasksSchema;
      groundTruthMatched = await fetchMatchingTasks(defaultListTasksSchema);
    }
  }

  const label =
    groundTruthListQuery.status === "completed"
      ? "完了済みタスク"
      : groundTruthListQuery.status === "active"
        ? "未完了タスク"
        : (groundTruthListQuery.search ?? groundTruthListQuery.searchTerms?.join(" / ") ?? tool);

  return {
    clarifyMessage: null,
    execution,
    groundTruth: buildGroundTruth(label, groundTruthMatched),
    listQuery: groundTruthListQuery,
    matchedTasks: groundTruthMatched,
    pinnedMutations,
    uiContext: buildUiContext(
      actionIntent.resolution,
      tool,
      groundTruthListQuery,
      groundTruthMatched,
      pinnedMutations,
      execution,
    ),
  };
}
