import { generatePrompt, type ComponentPromptSpec, type ToolSpec } from "@openuidev/lang-core";
import { z } from "zod";

import componentSpec from "~/features/chat/genui/component-spec.json";
import { listTasksTool } from "~/features/tasks/tools/list-tasks";
import { defaultTaskBoardSearch } from "~/features/tasks/utils/task-board-search";

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

## Write routing rules
- Single task referenced by title → *_task with sourceTitle. The tool resolves the real id from the DB — NEVER invent or pass an id.
- Multiple tasks by keyword/status/priority → bulk_*.
- 完了済み / 未完了 → status "completed" / "active" (not a title search).
- When the user names a task in a previous turn and then gives a follow-up ("これを完了に", "これらをlowに"), reuse that title/keyword for the tool.`;

const readListExample = `root = TaskList(tasks)
tasks = Query("list_tasks", ${defaultListQuery}, [])`;

const filterListExample = `root = TaskList(tasks)
tasks = Query("list_tasks", {priority: "high", status: "all", sortBy: "createdAt", sortDirection: "asc"}, [])`;

const statusListExample = `root = TaskList(tasks)
tasks = Query("list_tasks", {status: "active", sortBy: "createdAt", sortDirection: "asc"}, [])`;

const listToolSpec = {
  annotations: { readOnlyHint: true },
  description: listTasksTool.description,
  inputSchema: z.toJSONSchema(listTasksTool.inputSchema),
  name: listTasksTool.name,
  outputSchema: z.toJSONSchema(listTasksTool.outputSchema),
} as const satisfies ToolSpec;

const taskListSpec = {
  description:
    "Task list with a built-in search box and priority/done status chips. Use this INSTEAD of Table to show, list, or filter tasks. Pass the list_tasks Query result array as the single argument.",
  signature:
    'TaskList(tasks: { id: string, title: string, priority: "low" | "medium" | "high", completed: boolean }[])',
} as const satisfies ComponentPromptSpec;

export const systemPrompt = generatePrompt({
  ...componentSpec,
  componentGroups: [
    ...(componentSpec.componentGroups ?? []),
    {
      components: ["TaskList"],
      name: "Task domain",
      notes: ["Use TaskList (not Table) for showing/listing/filtering tasks."],
    },
  ],
  components: { ...componentSpec.components, TaskList: taskListSpec },
  preamble,
  toolExamples: [readListExample, filterListExample, statusListExample],
  tools: [listToolSpec],
});
