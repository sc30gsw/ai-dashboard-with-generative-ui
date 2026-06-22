import { generatePrompt, type ToolSpec } from "@openuidev/lang-core";
import { z } from "zod";

import componentSpec from "~/features/chat/genui/component-spec.json";
import { listTasksTool } from "~/features/tasks/tools/list-tasks";
import { defaultTaskBoardSearch } from "~/features/tasks/utils/task-board-search";

const defaultListQuery = `{status: "${defaultTaskBoardSearch.status}", sortBy: "${defaultTaskBoardSearch.sortBy}", sortDirection: "${defaultTaskBoardSearch.sortDirection}"}`;

const preamble = `You are the assistant for a single-user task board. Choose ONE response mode per request:

## Mode 1 — READ (show / list / filter / count): respond with operable OpenUI Lang UI
Render read-only UI from Query("list_tasks", ...). Use Card / CardHeader / Table / Callout / TextContent. NEVER write prose for a read — render UI.

- First line MUST be exactly: root = ...
- No markdown fences and no prose before root =
- @Count(query) is an EXPRESSION — concatenate it in TextContent: TextContent("合計 " + @Count(tasks) + " 件"). NEVER place @Count inside a quoted string literal.
- Only list_tasks is available in OpenUI Lang, and only as a read-only Query. Never emit Mutation — writes are handled in Mode 2.

## Mode 2 — WRITE (create / update / delete / complete): call the matching tool
Do NOT emit OpenUI Lang for writes. Call the tool directly; destructive tools (update/delete/complete/bulk/all) ask the user to approve before running. After a tool runs, reply with ONE short confirmation sentence.

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

const readListExample = `root = Card([hdr, count, tbl])
tasks = Query("list_tasks", ${defaultListQuery}, [])
hdr = CardHeader("タスク一覧", "現在のタスク")
count = TextContent("合計 " + @Count(tasks) + " 件")
tbl = Table([Col("Title", tasks.title), Col("Priority", tasks.priority), Col("Done", tasks.completed)])`;

const filterListExample = `root = Card([hdr, count, tbl])
tasks = Query("list_tasks", {priority: "high", status: "all", sortBy: "createdAt", sortDirection: "asc"}, [])
hdr = CardHeader("優先度 High", "High に設定されたタスク")
count = TextContent("該当 " + @Count(tasks) + " 件")
tbl = Table([Col("Title", tasks.title), Col("Priority", tasks.priority), Col("Done", tasks.completed)])`;

const statusListExample = `root = Card([hdr, count, tbl])
tasks = Query("list_tasks", {status: "active", sortBy: "createdAt", sortDirection: "asc"}, [])
hdr = CardHeader("未完了タスク", "未完了のタスク一覧")
count = TextContent("未完了 " + @Count(tasks) + " 件")
tbl = Table([Col("Title", tasks.title), Col("Priority", tasks.priority)])`;

const listToolSpec = {
  annotations: { readOnlyHint: true },
  description: listTasksTool.description,
  inputSchema: z.toJSONSchema(listTasksTool.inputSchema),
  name: listTasksTool.name,
  outputSchema: z.toJSONSchema(listTasksTool.outputSchema),
} as const satisfies ToolSpec;

export const systemPrompt = generatePrompt({
  ...componentSpec,
  preamble,
  toolExamples: [readListExample, filterListExample, statusListExample],
  tools: [listToolSpec],
});
