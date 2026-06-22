import { generatePrompt } from "@openuidev/lang-core";

import componentSpec from "~/features/chat/genui/component-spec.json";
import { taskToolSpecs } from "~/features/tasks/tools";

// Built with `generatePrompt` from @openuidev/lang-core (React-free) so this
// server-only route never imports the react-ui component library. The component
// spec is generated offline from openuiChatLibrary.toSpec() and committed as
// component-spec.json — regenerate it when @openuidev/react-ui is upgraded. See
// requirement.md §8 and OpenUI's "System Prompts" docs (§2 generatePrompt).

// Short task-board framing + the human-in-the-loop invariant (the generated prompt
// already covers the OpenUI Lang mechanics).
const preamble = `You are the assistant for a single-user task board. Respond only with operable OpenUI Lang UI, never plain prose.
Always show the board: read tasks with Query("list_tasks") and render them as a ListBlock. To add or complete a task, render a Form or list-item button whose Action runs the matching Mutation and then re-fetches list_tasks. Never fire a Mutation on render — only on an explicit click.`;

// Hard correctness rules targeting observed failure modes (multiple roots, code
// fences, prose, missing list). Merged with the library's base additionalRules.
const correctnessRules = [
  "Output exactly ONE `root` statement. Never emit multiple root definitions or alternative versions of the UI.",
  "Output only OpenUI Lang statements — never wrap them in markdown code fences (```), and never include prose, explanations, or commentary.",
  'Every reply MUST include the current task list via Query("list_tasks") rendered as a ListBlock, even for add or complete requests, so the board stays visible and re-fetches after any Mutation.',
];

// One full-board golden example (list + add + complete), authored in OpenUI Lang and
// validated against the library parser (root resolves, no errors/orphans). Mutations
// fire only on click via Action(); each runs the write, re-fetches the list Query, and
// (for add) resets the form.
const taskBoardExample = `root = Card([heading, list, addForm])
heading = TextContent("Your tasks", "large-heavy")
tasks = Query("list_tasks", {}, [])
completeMut = Mutation("complete_task", {id: $completeId})
list = ListBlock(@Each(tasks, "t", ListItem(t.title, t.priority, null, "Complete", Action([@Set($completeId, t.id), @Run(completeMut), @Run(tasks)]))))
addMut = Mutation("add_task", {title: $newTitle, priority: $newPriority})
titleInput = Input("title", "e.g. buy milk", "text", {required: true}, $newTitle)
titleField = FormControl("Title", titleInput)
pLow = SelectItem("low", "Low")
pMed = SelectItem("medium", "Medium")
pHigh = SelectItem("high", "High")
prioritySelect = Select("priority", [pLow, pMed, pHigh], "Select priority", {required: true}, $newPriority)
priorityField = FormControl("Priority", prioritySelect)
addBtn = Button("Add task", Action([@Run(addMut), @Run(tasks), @Reset($newTitle)]), "primary")
addButtons = Buttons([addBtn])
addForm = Form("addTask", addButtons, [titleField, priorityField])`;

export const systemPrompt = generatePrompt({
  ...componentSpec,
  additionalRules: [...(componentSpec.additionalRules ?? []), ...correctnessRules],
  preamble,
  toolExamples: [taskBoardExample],
  tools: taskToolSpecs,
});
