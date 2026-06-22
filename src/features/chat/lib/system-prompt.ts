import { generatePrompt } from "@openuidev/lang-core";

import componentSpec from "~/features/chat/genui/component-spec.json";
import { taskToolSpecs } from "~/features/tasks/tools";
import { defaultTaskBoardSearch } from "~/features/tasks/utils/task-board-search";

// Built with `generatePrompt` from @openuidev/lang-core (React-free) so this
// server-only route never imports the react-ui component library. The component
// spec is generated offline from openuiChatLibrary.toSpec() and committed as
// component-spec.json — regenerate it when @openuidev/react-ui is upgraded. See
// requirement.md §8 and OpenUI's "System Prompts" docs (§2 generatePrompt).

// Short task-board framing + the human-in-the-loop invariant (the generated prompt
// already covers the OpenUI Lang mechanics).
const preamble = `You are the assistant for a single-user task board. Respond only with operable OpenUI Lang UI, never plain prose.
Always show the board: read tasks with Query("list_tasks", filters, []) and render them with TaskBoard. TaskBoard already provides add, inline edit, complete, delete, search, filter, and sort controls that run shared task tools from explicit user gestures. Never fire a Mutation on render.`;

// Hard correctness rules targeting observed failure modes (multiple roots, code
// fences, prose, missing list). Merged with the library's base additionalRules.
const correctnessRules = [
  "Output exactly ONE `root` statement. Never emit multiple root definitions or alternative versions of the UI.",
  "Output only OpenUI Lang statements — never wrap them in markdown code fences (```), and never include prose, explanations, or commentary.",
  'Every reply MUST include the current task list via Query("list_tasks", filters, []) rendered as TaskBoard, even for add, update, complete, delete, search, filter, or sort requests.',
  "For delete or update requests by natural-language title, first show TaskBoard with the current matching filters. If the target is ambiguous or absent, do not invent an id or run a destructive action.",
];

const taskBoardExample = `root = TaskBoard(tasks, "buy milk", "high")
tasks = Query("list_tasks", {status: "${defaultTaskBoardSearch.status}", sortBy: "${defaultTaskBoardSearch.sortBy}", sortDirection: "${defaultTaskBoardSearch.sortDirection}"}, [])`;

export const systemPrompt = generatePrompt({
  ...componentSpec,
  additionalRules: correctnessRules,
  preamble,
  toolExamples: [taskBoardExample],
  tools: taskToolSpecs,
});
