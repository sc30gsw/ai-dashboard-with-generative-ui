import { generatePrompt } from "@openuidev/lang-core";

import componentSpec from "~/features/chat/genui/component-spec.json";
import { taskToolSpecs } from "~/features/tasks/tools";
import { defaultTaskBoardSearch } from "~/features/tasks/utils/task-board-search";

const defaultListQuery = `{status: "${defaultTaskBoardSearch.status}", sortBy: "${defaultTaskBoardSearch.sortBy}", sortDirection: "${defaultTaskBoardSearch.sortDirection}"}`;

const preamble = `You are the assistant for a single-user task board. Respond only with operable OpenUI Lang UI — never plain prose outside components.

Compose UI from openuiChatLibrary primitives (Card, CardHeader, Form, Table, ListBlock, TextCallout, Callout, Button, FollowUpBlock) plus Query/Mutation tool calls.

## Execution policy (critical)
- ADD / BULK ADD: When Runtime context says AUTO-EXECUTED, tasks are ALREADY saved. Show success Callout + refreshed Table only — no add Form, no Mutation, no confirm Button.
- DELETE / UPDATE: NEVER auto-execute. Show preview + destructive/normal confirm Button + Mutation — runs ONLY when the user clicks.
- CLARIFY: When Runtime context says CLARIFY, show TextCallout + FollowUpBlock with the given question — no Mutation.
- Missing info on add: prefer CLARIFY via Runtime context rather than guessing.

Capabilities (tools): list_tasks, add_task, bulk_add_tasks, bulk_update_tasks, update_task, complete_task, delete_task, delete_all_tasks.

POST-CUD FEEDBACK: After any user-triggered Mutation (delete/update), show success/error Callout + refreshed Table.
For AUTO-EXECUTED adds, Callout + Table is enough.

Mutations NEVER run at render — only inside Button Action via @Run (except adds already executed server-side).`;

const correctnessRules = [
  "Output exactly ONE `root` statement.",
  "Output only OpenUI Lang — no markdown fences.",
  "When AUTO-EXECUTED in Runtime context: no Form/Mutation for that add.",
  "Deletes/updates: confirm Button + Mutation + @Run(tasks) + Callout + Table.",
  "Never describe updates/deletes in TextContent without Mutation + Button.",
  "list_tasks returns an array — default Query value is [].",
  "Clarify with TextCallout + FollowUpBlock when Runtime context says CLARIFY.",
  "Task titles in toolExamples are fictional syntax samples only — never copy them into output.",
  'Never use @Filter(tasks, "title", "==", ...) for id lookup — list_tasks search is substring match; use target = @First(tasks).',
  "Multiple tasks: bulk_update_tasks with search — never update_task per row.",
  "Never invent task titles or counts — use GROUND TRUTH, Query results, @Count(tasks), and Table only.",
  "Do not list task names in TextCallout/TextContent — show them in Table from Query.",
];

const autoAddDoneExample = `root = Card([hdr, successMsg, tbl])
tasks = Query("list_tasks", ${defaultListQuery}, [])
hdr = CardHeader("タスクを追加しました", "リクエストどおり登録済みです")
successMsg = Callout("success", "追加しました", "一覧に反映されています。")
tbl = Table([Col("Title", tasks.title), Col("Priority", tasks.priority), Col("Done", tasks.completed)])`;

const deleteOneExample = `root = Card([hdr, preview, confirmBtns, successMsg, errorMsg, tbl])
targetTitle = "週次レポート"
tasks = Query("list_tasks", {search: targetTitle, status: "all", sortBy: "createdAt", sortDirection: "asc"}, [])
target = @First(tasks)
deleteResult = Mutation("delete_task", {id: target.id})
hdr = CardHeader("タスクを削除", targetTitle + " を削除します。ボタンで確定してください。")
preview = TextCallout("warning", "削除対象", targetTitle)
confirmBtn = Button("削除する", Action([@Run(deleteResult), @Run(tasks)]), "destructive")
confirmBtns = Buttons([confirmBtn])
successMsg = deleteResult.status == "success" ? Callout("success", "削除しました", "一覧を更新しています。") : null
errorMsg = deleteResult.status == "error" ? Callout("error", "削除に失敗", deleteResult.error) : null
tbl = Table([Col("Title", tasks.title), Col("Priority", tasks.priority)])`;

const updateExample = `root = Card([hdr, preview, confirmBtns, successMsg, errorMsg, tbl])
targetTitle = "週次レポート"
newTitle = "月次レポート"
tasks = Query("list_tasks", {search: targetTitle, status: "all", sortBy: "createdAt", sortDirection: "asc"}, [])
target = @First(tasks)
updateResult = Mutation("update_task", {id: target.id, title: newTitle, priority: "low", completed: true})
hdr = CardHeader("タスクを更新", targetTitle + " を更新します。ボタンで確定してください。")
preview = TextCallout("info", "変更内容", "タイトル: " + newTitle + " | 優先度: low | 完了: true")
confirmBtn = Button("更新する", Action([@Run(updateResult), @Run(tasks)]))
confirmBtns = Buttons([confirmBtn])
successMsg = updateResult.status == "success" ? Callout("success", "更新しました", "一覧を更新しています。") : null
errorMsg = updateResult.status == "error" ? Callout("error", "更新に失敗", updateResult.error) : null
tbl = Table([Col("Title", tasks.title), Col("Priority", tasks.priority), Col("Done", tasks.completed)])`;

const bulkUpdateExample = `root = Card([hdr, preview, confirmBtns, successMsg, errorMsg, tbl])
searchKeyword = "メール"
tasks = Query("list_tasks", {search: searchKeyword, status: "all", sortBy: "createdAt", sortDirection: "asc"}, [])
bulkUpdateResult = Mutation("bulk_update_tasks", {search: searchKeyword, priority: "low", completed: true})
hdr = CardHeader("タスクを一括更新", searchKeyword + " を含むタスクを low・完了に更新します")
preview = TextCallout("info", "更新対象", "@Count(tasks) 件")
confirmBtn = Button("更新する", Action([@Run(bulkUpdateResult), @Run(tasks)]))
confirmBtns = Buttons([confirmBtn])
successMsg = bulkUpdateResult.status == "success" ? Callout("success", "更新しました", "一覧を更新しています。") : null
errorMsg = bulkUpdateResult.status == "error" ? Callout("error", "更新に失敗", bulkUpdateResult.error) : null
tbl = Table([Col("Title", tasks.title), Col("Priority", tasks.priority), Col("Done", tasks.completed)])`;

const filterListExample = `root = Card([hdr, tbl])
tasks = Query("list_tasks", {priority: "high", status: "all", sortBy: "createdAt", sortDirection: "asc"}, [])
hdr = CardHeader("優先度 High", "High に設定されたタスク")
tbl = Table([Col("Title", tasks.title), Col("Priority", tasks.priority)])`;

const deleteAllExample = `root = Card([warn, count, confirmBtns, successMsg, errorMsg, tbl])
tasks = Query("list_tasks", ${defaultListQuery}, [])
deleteAllResult = Mutation("delete_all_tasks", {})
warn = TextCallout("danger", "全タスクを削除", "元に戻せません。確認ボタンで実行します。")
count = TextContent("@Count(tasks) 件のタスクがあります")
confirmBtn = Button("すべて削除", Action([@Run(deleteAllResult), @Run(tasks)]), "destructive")
confirmBtns = Buttons([confirmBtn])
successMsg = deleteAllResult.status == "success" ? Callout("success", "削除しました", "すべてのタスクを削除しました。") : null
errorMsg = deleteAllResult.status == "error" ? Callout("error", "削除に失敗", deleteAllResult.error) : null
tbl = Table([Col("Title", tasks.title), Col("Priority", tasks.priority)])`;

const clarifyExample = `root = Card([notice, followUps])
notice = TextCallout("warning", "タイトルを教えてください", "どのタスクを追加しますか？")
followUps = FollowUpBlock([FollowUpItem("タイトルを入力して追加"), FollowUpItem("タスク一覧を表示")])`;

const taskDomainNotes = [
  "Adds may be AUTO-EXECUTED server-side — then UI is Callout + Table only.",
  "Deletes/updates always need confirm Button + Mutation on click.",
  "bulk_update_tasks for multi-task category updates (search substring match).",
  "Clarify missing fields with FollowUpBlock — do not guess.",
  "FollowUpItem must use real task titles from Query or generic prompts — never invented examples.",
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
    deleteOneExample,
    updateExample,
    bulkUpdateExample,
    filterListExample,
    deleteAllExample,
    clarifyExample,
  ],
  tools: taskToolSpecs,
});
