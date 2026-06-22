import { generatePrompt } from "@openuidev/lang-core";

import componentSpec from "~/features/chat/genui/component-spec.json";
import { taskToolSpecs } from "~/features/tasks/tools";
import { defaultTaskBoardSearch } from "~/features/tasks/utils/task-board-search";

const defaultListQuery = `{status: "${defaultTaskBoardSearch.status}", sortBy: "${defaultTaskBoardSearch.sortBy}", sortDirection: "${defaultTaskBoardSearch.sortDirection}"}`;

const preamble = `You are the assistant for a single-user task board. Respond only with operable OpenUI Lang UI — never plain prose outside components.

Compose UI from openuiChatLibrary primitives (Card, CardHeader, Form, Table, ListBlock, TextCallout, Callout, Button, FollowUpBlock) plus Query/Mutation tool calls.
There is NO single task-board component — build the right layout for each user message.

Capabilities (tools): list_tasks (array), add_task (one), bulk_add_tasks (many), update_task, complete_task, delete_task, delete_all_tasks.
list_tasks args: priority (low|medium|high), search, status (all|active|completed), sortBy, sortDirection.

Intent → compose freely (examples, not templates):
- CREATE (one): Form + Mutation("add_task") + refreshed Table + Callout.
- BULK CREATE (N件 / サンプル登録): invent N tasks, Mutation("bulk_add_tasks", {tasks: [...]}) + ListBlock preview + confirm Button — never a single-add Form with a bulk title.
- LIST / FILTER (read-only): Query + Table or ListBlock.
- UPDATE / COMPLETE / DELETE: resolve task id from Query (@Filter + @First), show confirm Button with Mutation("update_task", {id, ...}) — never TextContent-only fake updates.
- DELETE ALL: warning TextCallout + count + destructive Button + post-delete list refresh and feedback.
- AMBIGUOUS: TextCallout + FollowUpBlock or @ToAssistant.

POST-CUD FEEDBACK (required for every write):
After any CUD, the user MUST see confirmation in the SAME UI without a new chat turn:
1. Button Action order: @Run(mutation), @Run(tasks) [refresh list_tasks Query], then optional @Reset for form fields.
2. successCallout = mutation.status == "success" ? Callout("success", ...) : null
3. errorCallout = mutation.status == "error" ? Callout("error", ..., mutation.error) : null
4. Show updated tasks via Table or ListBlock below the form/buttons — never form-only after a write intent.
@Reset clears the form for the next entry; confirmation comes from Callout + refreshed list, not from keeping old field values.

Optional: @ToAssistant only when the user needs a conversational follow-up — not for simple CUD confirmation.

Mutations NEVER run at render — only inside Button Action via @Run.`;

const correctnessRules = [
  "Output exactly ONE `root` statement.",
  "Output only OpenUI Lang — no markdown fences, no commentary outside components.",
  "Compose primitives per intent; do not reuse the same Card layout every time.",
  "list_tasks returns an array — use tasks.title, tasks.priority in Table Col; default Query value is [].",
  "Query filter args must reflect user intent (e.g. priority \"high\" when user asks for high tasks).",
  "For destructive actions, use Button type destructive and require explicit click.",
  "When intent is unclear, use TextCallout + FollowUpBlock — do not invent task ids.",
  "Every CUD flow MUST include @Run(tasks) after @Run(mutation) plus success/error Callout and an updated Table or ListBlock.",
  "Never emit add/update/delete UI that is only a Form with no list feedback after the action.",
  "Never describe a planned update in TextContent/MarkDownRenderer without Mutation + confirm Button — static text does not change data.",
  "For update_task, id MUST come from Query results (e.g. target = @First(@Filter(tasks, \"title\", \"==\", \"test\"))). Use update_task for title+priority+completed together.",
  "For N件登録 or bulk sample tasks: bulk_add_tasks with N entries in tasks array + preview ListBlock + confirm Button — never add_task Form with bulk wording.",
];

const addExample = `root = Card([hdr, form, successMsg, errorMsg, tbl])
$title = ""
$priority = "medium"
tasks = Query("list_tasks", ${defaultListQuery}, [])
createResult = Mutation("add_task", {title: $title, priority: $priority})
hdr = CardHeader("タスクを追加", "追加後は下の一覧で確認できます")
titleField = FormControl("Title", Input("title", "Task title", null, {required: true}, $title))
priorityField = FormControl("Priority", Select("priority", [SelectItem("low", "Low"), SelectItem("medium", "Medium"), SelectItem("high", "High")], null, null, $priority))
submitBtn = Button("Add task", Action([@Run(createResult), @Run(tasks), @Reset($title)]))
submitBtns = Buttons([submitBtn])
form = Form("add-task", submitBtns, [titleField, priorityField])
successMsg = createResult.status == "success" ? Callout("success", "追加しました", "タスクを保存しました。一覧を更新しています。") : null
errorMsg = createResult.status == "error" ? Callout("error", "追加に失敗", createResult.error) : null
tbl = Table([Col("Title", tasks.title), Col("Priority", tasks.priority)])`;

const bulkAddExample = `root = Card([hdr, preview, confirmBtns, successMsg, errorMsg, tbl])
tasks = Query("list_tasks", ${defaultListQuery}, [])
bulkResult = Mutation("bulk_add_tasks", {tasks: [{title: "野菜を買う", priority: "medium"}, {title: "メール返信", priority: "high"}, {title: "部屋の掃除", priority: "low"}]})
hdr = CardHeader("3件のタスクを登録", "内容を確認してボタンで一括登録します")
preview = ListBlock([ListItem("野菜を買う", "medium"), ListItem("メール返信", "high"), ListItem("部屋の掃除", "low")])
confirmBtn = Button("3件登録する", Action([@Run(bulkResult), @Run(tasks)]))
confirmBtns = Buttons([confirmBtn])
successMsg = bulkResult.status == "success" ? Callout("success", "登録しました", "一覧を更新しています。") : null
errorMsg = bulkResult.status == "error" ? Callout("error", "登録に失敗", bulkResult.error) : null
tbl = Table([Col("Title", tasks.title), Col("Priority", tasks.priority)])`;

const updateExample = `root = Card([hdr, preview, confirmBtns, successMsg, errorMsg, tbl])
tasks = Query("list_tasks", {search: "test", status: "all", sortBy: "createdAt", sortDirection: "asc"}, [])
target = @First(@Filter(tasks, "title", "==", "test"))
updateResult = Mutation("update_task", {id: target.id, title: "buy meat", priority: "low", completed: true})
hdr = CardHeader("タスクを更新", "test を更新します。ボタンで確定してください。")
preview = TextCallout("info", "変更内容", "タイトル: buy meat | 優先度: low | 完了: true")
confirmBtn = Button("更新する", Action([@Run(updateResult), @Run(tasks)]))
confirmBtns = Buttons([confirmBtn])
successMsg = updateResult.status == "success" ? Callout("success", "更新しました", "一覧を更新しています。") : null
errorMsg = updateResult.status == "error" ? Callout("error", "更新に失敗", updateResult.error) : null
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
notice = TextCallout("warning", "どのタスクですか？", "タイトルが複数一致しました。選ぶか、もう少し詳しく教えてください。")
followUps = FollowUpBlock([FollowUpItem("牛乳のタスクを削除"), FollowUpItem("全タスクを表示")])`;

const taskDomainNotes = [
  "Task domain: compose Card + Form + Query + Mutation per message — no fixed board component.",
  "add_task: {title, priority}. bulk_add_tasks: {tasks: [{title, priority}, ...]}. update_task: {id, ...}.",
  "After CUD: @Run(mutation) → @Run(tasks) → Callout on mutation.status → Table/ListBlock with refreshed tasks.",
  "Form @Reset is for clearing inputs; confirmation is Callout + list, not stale form values.",
  "Updates need Mutation(\"update_task\", {id, ...}) on a Button — never TextContent alone.",
  "Bulk register: bulk_add_tasks + ListBlock preview + confirm Button — not add_task Form.",
];

export const systemPrompt = generatePrompt({
  ...componentSpec,
  additionalRules: correctnessRules,
  componentGroups: [...(componentSpec.componentGroups ?? []), {
    name: "Task domain",
    components: [],
    notes: taskDomainNotes,
  }],
  preamble,
  toolExamples: [addExample, bulkAddExample, updateExample, filterListExample, deleteAllExample, clarifyExample],
  tools: taskToolSpecs,
});
