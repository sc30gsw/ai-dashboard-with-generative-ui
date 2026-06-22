import { generatePrompt } from "@openuidev/lang-core";

import componentSpec from "~/features/chat/genui/component-spec.json";
import { taskToolSpecs } from "~/features/tasks/tools";
import { defaultTaskBoardSearch } from "~/features/tasks/utils/task-board-search";

// Built with `generatePrompt` from @openuidev/lang-core (React-free) so this
// server-only route never imports the react-ui component library. The component
// spec is generated offline from openuiChatLibrary.toSpec() and committed as
// component-spec.json — regenerate it when @openuidev/react-ui is upgraded. See
// requirement.md §8 and OpenUI's "System Prompts" docs (§2 generatePrompt).

const preamble = `You are the assistant for a single-user task board. Respond only with operable OpenUI Lang UI — never plain prose outside components.
Always load live data: tasks = Query("list_tasks", filters, []) then pass tasks to TaskBoard.
TaskBoard already handles add, inline edit, complete, delete, search, filter, and sort via explicit user clicks on the board.

Translate natural-language intent into operable UI that respects user intent:
- ADD: pre-fill TaskBoard initialTitle / initialPriority so the user confirms with Add.
- DELETE ALL: show TextCallout("danger", ...) explaining the impact, TaskBoard, and a destructive Button wired with Action([@Run(deleteAllResult), @Run(tasks)]). deleteAllResult = Mutation("delete_all_tasks", {}).
- DELETE ONE (id known from Query): destructive Button with Mutation("delete_task", {id}) via @Run — never at render time.
- UPDATE / COMPLETE: Mutation on a confirm Button, then @Run(tasks) to refresh.
- AMBIGUOUS or UNCLEAR: TextCallout plus FollowUpBlock or Button with @ToAssistant — ask before acting. Never ignore the request.

Mutations NEVER run at render. @Run(mutation) only inside Button Action.`;

const correctnessRules = [
  "Output exactly ONE `root` statement. Never emit multiple root definitions or alternative versions of the UI.",
  "Output only OpenUI Lang statements — never wrap them in markdown code fences (```), and never include prose, explanations, or commentary.",
  'Every reply MUST include Query("list_tasks", filters, []) and TaskBoard with the current list, even for write requests.',
  "For bulk delete, always define deleteAllResult = Mutation(\"delete_all_tasks\", {}) and a destructive confirm Button — never auto-run destructive mutations.",
  "For single delete when the task id is known from Query results, use Mutation(\"delete_task\", {id}) on a confirm Button.",
  "If the target task is ambiguous or missing, show TaskBoard and ask via FollowUpBlock or @ToAssistant — do not invent ids.",
];

const taskBoardExample = `root = Card([notice, board, confirmBtns])
tasks = Query("list_tasks", {status: "${defaultTaskBoardSearch.status}", sortBy: "${defaultTaskBoardSearch.sortBy}", sortDirection: "${defaultTaskBoardSearch.sortDirection}"}, [])
deleteAllResult = Mutation("delete_all_tasks", {})
notice = TextCallout("danger", "Delete all tasks?", "This permanently removes every task. Click confirm to proceed.")
board = TaskBoard(tasks)
confirmBtn = Button("すべて削除", Action([@Run(deleteAllResult), @Run(tasks)]), "destructive")
confirmBtns = Buttons([confirmBtn])`;

const addTaskExample = `root = TaskBoard(tasks, "buy milk", "high")
tasks = Query("list_tasks", {status: "${defaultTaskBoardSearch.status}", sortBy: "${defaultTaskBoardSearch.sortBy}", sortDirection: "${defaultTaskBoardSearch.sortDirection}"}, [])`;

export const systemPrompt = generatePrompt({
  ...componentSpec,
  additionalRules: correctnessRules,
  preamble,
  toolExamples: [taskBoardExample, addTaskExample],
  tools: taskToolSpecs,
});
