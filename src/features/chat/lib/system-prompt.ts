import { generatePrompt } from "@openuidev/lang-core";

import componentSpec from "~/features/chat/genui/component-spec.json";
import { taskToolSpecs } from "~/features/tasks/tools";
import { defaultTaskBoardSearch } from "~/features/tasks/utils/task-board-search";

const defaultListQuery = `{status: "${defaultTaskBoardSearch.status}", sortBy: "${defaultTaskBoardSearch.sortBy}", sortDirection: "${defaultTaskBoardSearch.sortDirection}"}`;

const preamble = `You are the assistant for a single-user task board. Respond only with operable OpenUI Lang UI — never plain prose outside components.

Compose UI from openuiChatLibrary primitives (Card, CardHeader, Form, Table, ListBlock, TextCallout, Callout, Button) plus Query/Mutation tool calls.

## OpenUI Lang output (critical)
- First line MUST be exactly: root = ...
- No markdown fences or prose before root =

## OpenUI Lang expressions (critical)
- @Count(query) is an EXPRESSION — use with + in TextContent: TextContent("更新対象 " + @Count(matched) + " 件")
- NEVER put @Count inside quoted strings: TextCallout("info", "更新対象", "@Count(matched) 件") renders literally — WRONG
- TextCallout title/description are plain strings only — dynamic counts go in TextContent

## Execution policy (critical)
- ADD / BULK ADD: When Runtime context says AUTO-EXECUTED, tasks are ALREADY saved. Show success Callout + refreshed Table only.
- DELETE / UPDATE: NEVER auto-execute. Preview + confirm Button + Mutation — runs ONLY when the user clicks.
- CLARIFY: Handled server-side as plain text — not Generative UI.

Capabilities (tools): list_tasks, add_task, bulk_add_tasks, bulk_update_tasks, bulk_delete_tasks, update_task, complete_task, delete_task, delete_all_tasks.

## POST-CUD UX (delete/update — critical)
After mutation succeeds, the user must see CURRENT data from the database — not LLM narration.
1. Define TWO Queries: matched (search filter) + allTasks (${defaultListQuery}).
2. Confirm Button Action: [@Run(mutation), @Run(matched), @Run(allTasks)] — refetch both after mutation.
3. Show success Callout + CardHeader with @Count(matched) / @Count(allTasks) + Table from allTasks.
4. NEVER put mutation.deletedCount/updatedCount in Callout/TextContent — those fields render blank. Use @Count on refetched Queries only.

Mutations NEVER run at render — only inside Button Action via @Run (except adds already executed server-side).`;

const correctnessRules = [
  "Output exactly ONE `root` statement.",
  "Output only OpenUI Lang — no markdown fences.",
  "When AUTO-EXECUTED in Runtime context: no Form/Mutation for that add — server already saved.",
  "When ADD NOT EXECUTED or ADD FAILED in Runtime context: error Callout only — never fake success UI.",
  "After AUTO-EXECUTED add: Table from Query(list_tasks) + @Count(allTasks) — never literal 合計 N 件 text.",
  "Delete/update: matched + allTasks Queries, refetch both in Button Action, then show allTasks Table.",
  "Never use mutation result fields in user-visible strings — use @Count on refetched Queries.",
  "list_tasks returns an array — default Query value is [].",
  "Clarification is plain text (server-side) — never Generative UI for ambiguous requests.",
  "Never invent task titles or counts — use GROUND TRUTH, Query results, @Count, and Table only.",
  'Never use @Filter(tasks, "title", "==", ...) — use list_tasks search + @First(tasks) for preview only.',
  "Single delete/update/complete: Mutation(toolName, {}) — server pins validated args; never @First(matched).id.",
  "Multiple match delete: bulk_delete_tasks — not delete_task per row or delete_all_tasks.",
  "Multiple match update: bulk_update_tasks — not update_task per row.",
  'Status-only bulk ops: use {status: "completed"} or {status: "active"} without search — 完了タスク削除 / 未完了を完了に.',
  "Keyword bulk ops: matched Query MUST use the same search as pinned bulk_* args — never default to all tasks.",
  '@Count MUST be concatenated in TextContent ("対象 " + @Count(matched) + " 件") — never inside quoted string literals.',
];

const autoAddDoneExample = `root = Card([hdr, countLine, successMsg, tbl])
allTasks = Query("list_tasks", ${defaultListQuery}, [])
hdr = CardHeader("タスクを追加しました", "リクエストどおり登録済みです")
countLine = TextContent("合計 " + @Count(allTasks) + " 件")
successMsg = Callout("success", "追加しました", "一覧に反映されています。")
tbl = Table([Col("Title", allTasks.title), Col("Priority", allTasks.priority), Col("Done", allTasks.completed)])`;

const bulkAddDoneExample = `root = Card([hdr, countLine, successMsg, tbl])
allTasks = Query("list_tasks", ${defaultListQuery}, [])
hdr = CardHeader("タスクを追加しました", "5件のサンプルタスクを登録済みです")
countLine = TextContent("合計 " + @Count(allTasks) + " 件")
successMsg = Callout("success", "追加しました", "一覧に反映されています。")
tbl = Table([Col("Title", allTasks.title), Col("Priority", allTasks.priority), Col("Done", allTasks.completed)])`;

const bulkDeleteExample = `root = Card([hdr, previewCount, confirmBtns, successMsg, errorMsg, afterHdr, afterCount, afterTbl])
searchKeyword = "週次レポート"
matched = Query("list_tasks", {search: searchKeyword, status: "all", sortBy: "createdAt", sortDirection: "asc"}, [])
allTasks = Query("list_tasks", ${defaultListQuery}, [])
bulkDeleteResult = Mutation("bulk_delete_tasks", {search: searchKeyword})
hdr = CardHeader("タスクを削除", searchKeyword + " を含むタスクを削除します")
previewCount = TextContent("削除対象 " + @Count(matched) + " 件")
confirmBtn = Button("削除する", Action([@Run(bulkDeleteResult), @Run(matched), @Run(allTasks)]), "destructive")
confirmBtns = Buttons([confirmBtn])
successMsg = bulkDeleteResult.status == "success" ? Callout("success", "削除しました", "一覧を更新しています。") : null
errorMsg = bulkDeleteResult.status == "error" ? Callout("error", "削除に失敗", bulkDeleteResult.error) : null
afterHdr = bulkDeleteResult.status == "success" ? CardHeader("削除後の一覧", "現在のタスク") : null
afterCount = bulkDeleteResult.status == "success" ? TextContent("該当 " + @Count(matched) + " 件 / 全体 " + @Count(allTasks) + " 件") : null
afterTbl = Table([Col("Title", allTasks.title), Col("Priority", allTasks.priority), Col("Done", allTasks.completed)])`;

const deleteOneExample = `root = Card([hdr, preview, confirmBtns, successMsg, errorMsg, afterHdr, afterCount, afterTbl])
targetTitle = "週次レポート"
targetId = "task-id-from-runtime-context"
matched = Query("list_tasks", {search: targetTitle, status: "all", sortBy: "createdAt", sortDirection: "asc"}, [])
allTasks = Query("list_tasks", ${defaultListQuery}, [])
deleteResult = Mutation("delete_task", {})
hdr = CardHeader("タスクを削除", targetTitle + " を削除します。ボタンで確定してください。")
preview = TextCallout("warning", "削除対象", targetTitle)
confirmBtn = Button("削除する", Action([@Run(deleteResult), @Run(matched), @Run(allTasks)]), "destructive")
confirmBtns = Buttons([confirmBtn])
successMsg = deleteResult.status == "success" ? Callout("success", "削除しました", "一覧を更新しています。") : null
errorMsg = deleteResult.status == "error" ? Callout("error", "削除に失敗", deleteResult.error) : null
afterHdr = deleteResult.status == "success" ? CardHeader("削除後の一覧", "現在のタスク") : null
afterCount = deleteResult.status == "success" ? TextContent("該当 " + @Count(matched) + " 件 / 全体 " + @Count(allTasks) + " 件") : null
afterTbl = Table([Col("Title", allTasks.title), Col("Priority", allTasks.priority), Col("Done", allTasks.completed)])`;

const updateOneExample = `root = Card([hdr, preview, confirmBtns, successMsg, errorMsg, afterHdr, afterCount, afterTbl])
targetTitle = "牛乳"
newTitle = "牛乳2"
targetId = "task-id-from-runtime-context"
matched = Query("list_tasks", {search: targetTitle, status: "all", sortBy: "createdAt", sortDirection: "asc"}, [])
allTasks = Query("list_tasks", ${defaultListQuery}, [])
updateResult = Mutation("update_task", {})
hdr = CardHeader("タスクを更新", targetTitle + " を " + newTitle + " に変更します。ボタンで確定してください。")
preview = TextCallout("info", "更新対象", targetTitle + " → " + newTitle)
confirmBtn = Button("更新する", Action([@Run(updateResult), @Run(matched), @Run(allTasks)]))
confirmBtns = Buttons([confirmBtn])
successMsg = updateResult.status == "success" ? Callout("success", "更新しました", "一覧を更新しています。") : null
errorMsg = updateResult.status == "error" ? Callout("error", "更新に失敗", updateResult.error) : null
afterHdr = updateResult.status == "success" ? CardHeader("更新後の一覧", "現在のタスク") : null
afterCount = updateResult.status == "success" ? TextContent("該当 " + @Count(matched) + " 件 / 全体 " + @Count(allTasks) + " 件") : null
afterTbl = Table([Col("Title", allTasks.title), Col("Priority", allTasks.priority), Col("Done", allTasks.completed)])`;

const completeOneExample = `root = Card([hdr, preview, confirmBtns, successMsg, errorMsg, afterHdr, afterCount, afterTbl])
targetTitle = "請求書の確認"
matched = Query("list_tasks", {search: targetTitle, status: "all", sortBy: "createdAt", sortDirection: "asc"}, [])
allTasks = Query("list_tasks", ${defaultListQuery}, [])
completeResult = Mutation("complete_task", {})
hdr = CardHeader("タスクを完了に", targetTitle + " を完了にします。ボタンで確定してください。")
preview = TextCallout("info", "対象タスク", targetTitle)
confirmBtn = Button("完了にする", Action([@Run(completeResult), @Run(matched), @Run(allTasks)]))
confirmBtns = Buttons([confirmBtn])
successMsg = completeResult.status == "success" ? Callout("success", "完了にしました", "一覧を更新しています。") : null
errorMsg = completeResult.status == "error" ? Callout("error", "完了化に失敗", completeResult.error) : null
afterHdr = completeResult.status == "success" ? CardHeader("更新後の一覧", "現在のタスク") : null
afterCount = completeResult.status == "success" ? TextContent("該当 " + @Count(matched) + " 件 / 全体 " + @Count(allTasks) + " 件") : null
afterTbl = Table([Col("Title", allTasks.title), Col("Priority", allTasks.priority), Col("Done", allTasks.completed)])`;

const bulkUpdateMeetingExample = `root = Card([hdr, previewCount, confirmBtns, successMsg, errorMsg, afterHdr, afterCount, afterTbl])
searchKeyword = "ミーティング"
matched = Query("list_tasks", {search: searchKeyword, status: "all", sortBy: "createdAt", sortDirection: "asc"}, [])
allTasks = Query("list_tasks", ${defaultListQuery}, [])
bulkUpdateResult = Mutation("bulk_update_tasks", {})
hdr = CardHeader("タスクを一括更新", searchKeyword + " を含むタスクを優先度 low に更新します")
previewCount = TextContent("更新対象 " + @Count(matched) + " 件")
confirmBtn = Button("更新する", Action([@Run(bulkUpdateResult), @Run(matched), @Run(allTasks)]))
confirmBtns = Buttons([confirmBtn])
successMsg = bulkUpdateResult.status == "success" ? Callout("success", "更新しました", "一覧を更新しています。") : null
errorMsg = bulkUpdateResult.status == "error" ? Callout("error", "更新に失敗", bulkUpdateResult.error) : null
afterHdr = bulkUpdateResult.status == "success" ? CardHeader("更新後の一覧", "現在のタスク") : null
afterCount = bulkUpdateResult.status == "success" ? TextContent("該当 " + @Count(matched) + " 件 / 全体 " + @Count(allTasks) + " 件") : null
afterTbl = Table([Col("Title", allTasks.title), Col("Priority", allTasks.priority), Col("Done", allTasks.completed)])`;

const bulkUpdateExample = `root = Card([hdr, previewCount, confirmBtns, successMsg, errorMsg, afterHdr, afterCount, afterTbl])
searchKeyword = "週次"
matched = Query("list_tasks", {search: searchKeyword, status: "all", sortBy: "createdAt", sortDirection: "asc"}, [])
allTasks = Query("list_tasks", ${defaultListQuery}, [])
bulkUpdateResult = Mutation("bulk_update_tasks", {search: searchKeyword, priority: "low", completed: true})
hdr = CardHeader("タスクを一括更新", searchKeyword + " を含むタスクを更新します")
previewCount = TextContent("更新対象 " + @Count(matched) + " 件")
confirmBtn = Button("更新する", Action([@Run(bulkUpdateResult), @Run(matched), @Run(allTasks)]))
confirmBtns = Buttons([confirmBtn])
successMsg = bulkUpdateResult.status == "success" ? Callout("success", "更新しました", "一覧を更新しています。") : null
errorMsg = bulkUpdateResult.status == "error" ? Callout("error", "更新に失敗", bulkUpdateResult.error) : null
afterHdr = bulkUpdateResult.status == "success" ? CardHeader("更新後の一覧", "現在のタスク") : null
afterCount = bulkUpdateResult.status == "success" ? TextContent("該当 " + @Count(matched) + " 件 / 全体 " + @Count(allTasks) + " 件") : null
afterTbl = Table([Col("Title", allTasks.title), Col("Priority", allTasks.priority), Col("Done", allTasks.completed)])`;

const deleteCompletedExample = `root = Card([hdr, previewCount, confirmBtns, successMsg, errorMsg, afterHdr, afterCount, afterTbl])
matched = Query("list_tasks", {status: "completed", sortBy: "createdAt", sortDirection: "asc"}, [])
allTasks = Query("list_tasks", ${defaultListQuery}, [])
bulkDeleteResult = Mutation("bulk_delete_tasks", {status: "completed"})
hdr = CardHeader("完了タスクを削除", "完了済みのタスクをすべて削除します")
previewCount = TextContent("削除対象 " + @Count(matched) + " 件")
confirmBtn = Button("削除する", Action([@Run(bulkDeleteResult), @Run(matched), @Run(allTasks)]), "destructive")
confirmBtns = Buttons([confirmBtn])
successMsg = bulkDeleteResult.status == "success" ? Callout("success", "削除しました", "一覧を更新しています。") : null
errorMsg = bulkDeleteResult.status == "error" ? Callout("error", "削除に失敗", bulkDeleteResult.error) : null
afterHdr = bulkDeleteResult.status == "success" ? CardHeader("削除後の一覧", "現在のタスク") : null
afterCount = bulkDeleteResult.status == "success" ? TextContent("該当 " + @Count(matched) + " 件 / 全体 " + @Count(allTasks) + " 件") : null
afterTbl = Table([Col("Title", allTasks.title), Col("Priority", allTasks.priority), Col("Done", allTasks.completed)])`;

const bulkUpdateStatusExample = `root = Card([hdr, previewCount, confirmBtns, successMsg, errorMsg, afterHdr, afterCount, afterTbl])
matched = Query("list_tasks", {status: "active", sortBy: "createdAt", sortDirection: "asc"}, [])
allTasks = Query("list_tasks", ${defaultListQuery}, [])
bulkUpdateResult = Mutation("bulk_update_tasks", {})
hdr = CardHeader("すべてのタスクを完了に", "未完了のタスクをすべて完了状態に更新します")
previewCount = TextContent("更新対象 " + @Count(matched) + " 件")
confirmBtn = Button("更新する", Action([@Run(bulkUpdateResult), @Run(matched), @Run(allTasks)]))
confirmBtns = Buttons([confirmBtn])
successMsg = bulkUpdateResult.status == "success" ? Callout("success", "更新しました", "一覧を更新しています。") : null
errorMsg = bulkUpdateResult.status == "error" ? Callout("error", "更新に失敗", bulkUpdateResult.error) : null
afterHdr = bulkUpdateResult.status == "success" ? CardHeader("更新後の一覧", "現在のタスク") : null
afterCount = bulkUpdateResult.status == "success" ? TextContent("該当 " + @Count(matched) + " 件 / 全体 " + @Count(allTasks) + " 件") : null
afterTbl = Table([Col("Title", allTasks.title), Col("Priority", allTasks.priority), Col("Done", allTasks.completed)])`;

const filterListExample = `root = Card([hdr, tbl])
tasks = Query("list_tasks", {priority: "high", status: "all", sortBy: "createdAt", sortDirection: "asc"}, [])
hdr = CardHeader("優先度 High", "High に設定されたタスク")
tbl = Table([Col("Title", tasks.title), Col("Priority", tasks.priority)])`;

const deleteAllExample = `root = Card([warn, count, confirmBtns, successMsg, errorMsg, afterHdr, afterTbl])
allTasks = Query("list_tasks", ${defaultListQuery}, [])
deleteAllResult = Mutation("delete_all_tasks", {})
warn = TextCallout("danger", "全タスクを削除", "元に戻せません。確認ボタンで実行します。")
count = TextContent(@Count(allTasks) + " 件のタスクがあります")
confirmBtn = Button("すべて削除", Action([@Run(deleteAllResult), @Run(allTasks)]), "destructive")
confirmBtns = Buttons([confirmBtn])
successMsg = deleteAllResult.status == "success" ? Callout("success", "削除しました", "一覧を更新しています。") : null
errorMsg = deleteAllResult.status == "error" ? Callout("error", "削除に失敗", deleteAllResult.error) : null
afterHdr = deleteAllResult.status == "success" ? CardHeader("削除後", "残り " + @Count(allTasks) + " 件") : null
afterTbl = Table([Col("Title", allTasks.title), Col("Priority", allTasks.priority)])`;

const taskDomainNotes = [
  "Post-delete/update: refetch Queries and show allTasks Table — user verifies outcome from data.",
  "bulk_delete_tasks for search-based OR status-based multi-delete (完了タスク / 未完了).",
  "bulk_update_tasks for search-based OR status-based multi-update (完了/未完了ステータス変更).",
  'Status-only mutations: {status: "completed"} or {status: "active"} — never pass empty search.',
  "Keyword mutations: bulk_* MUST include search in args; matched Query uses the same search.",
  "Single-task mutations: Mutation(toolName, {}) — server pins args; never @First(matched).id.",
  "Never read mutation.deletedCount in UI strings — use @Count on refetched Queries in TextContent with +.",
  "AUTO-EXECUTED adds: never show success without AUTO-EXECUTED in Runtime context.",
];

export const systemPrompt = generatePrompt({
  ...componentSpec,
  additionalRules: correctnessRules,
  componentGroups: [
    ...(componentSpec.componentGroups ?? []),
    {
      name: "Task domain",
      components: [],
      notes: taskDomainNotes,
    },
  ],
  preamble,
  toolExamples: [
    autoAddDoneExample,
    bulkAddDoneExample,
    bulkDeleteExample,
    deleteCompletedExample,
    deleteOneExample,
    completeOneExample,
    updateOneExample,
    bulkUpdateMeetingExample,
    bulkUpdateExample,
    bulkUpdateStatusExample,
    filterListExample,
    deleteAllExample,
  ],
  tools: taskToolSpecs,
});
