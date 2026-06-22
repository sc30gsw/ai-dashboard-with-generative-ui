import { gateway } from "@ai-sdk/gateway";
import { generateObject } from "ai";
import { Result } from "better-result";
import { z } from "zod";

import { chatModel } from "~/features/chat/lib/model";
import {
  CreateTaskSchema,
  TaskPrioritySchema,
  type TaskPriority,
} from "~/features/tasks/api/task-model";
import { TaskService } from "~/features/tasks/api/task-service";

export type MatchedTaskSnapshot = {
  completed: boolean;
  id: string;
  priority: TaskPriority;
  title: string;
};

export type ResolvedChatAction = {
  action: ChatAction;
  groundTruth: string;
  matchedTasks: MatchedTaskSnapshot[];
  search: string | null;
};

const ChatActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  z.object({
    kind: z.literal("clarify"),
    message: z.string().min(1),
  }),
  z.object({
    kind: z.literal("add"),
    priority: TaskPrioritySchema.default("medium"),
    title: z.string().trim().min(1),
  }),
  z.object({
    kind: z.literal("bulk_add"),
    tasks: z.array(CreateTaskSchema).min(1).max(50),
  }),
  z.object({ kind: z.literal("delete_all") }),
  z.object({
    kind: z.literal("delete_one"),
    searchTitle: z.string().trim().min(1),
  }),
  z.object({
    kind: z.literal("update"),
    completed: z.boolean().optional(),
    priority: TaskPrioritySchema.optional(),
    searchTitle: z.string().trim().min(1),
    title: z.string().trim().min(1).optional(),
  }),
  z.object({
    kind: z.literal("bulk_update"),
    completed: z.boolean().optional(),
    priority: TaskPrioritySchema.optional(),
    search: z.string().trim().min(1),
  }),
]);

export type ChatAction = z.infer<typeof ChatActionSchema>;

export type ChatActionExecution = {
  addedCount?: number;
  error?: string;
  kind: ChatAction["kind"];
  ok: boolean;
  taskTitles?: string[];
};

const actionResolverSystem = `You classify task-board user messages into a structured action.

Rules:
- "add": ONE new task when title is clear. Default priority to medium if not specified.
- "bulk_add": multiple tasks (e.g. N件, サンプル, 適当に). Invent varied realistic Japanese task titles from the user's request — never reuse fixed demo words (牛乳, buy milk, test).
- "clarify": missing critical info (e.g. add without title). message must be Japanese, ask one clear question.
- "delete_all": user wants all tasks removed (UI will confirm — not executed here).
- "delete_one": delete a specific task by title reference.
- "update": change title, priority, or completed for ONE named task (exact or best single match).
- "bulk_update": update MULTIPLE tasks matching a title substring or category (メール関連, それら全部, all of them). Extract search keyword from user message and prior context.
- "none": list/filter/browse/chat without a write.

Adds execute automatically on the server. Deletes/updates only prepare UI — never assume delete/update already ran.
When conversation references a prior category (それら全部, all of them), reuse the search keyword from earlier user messages.`;

export function inferSearchKeyword(userText: string, conversationContext = ""): string | null {
  const text = `${conversationContext}\n${userText}`;

  const relatedMatch = text.match(/([^\s、。，]+)関連/);

  if (relatedMatch?.[1]) {
    return relatedMatch[1];
  }

  if (/メール/.test(text)) {
    return "メール";
  }

  return null;
}

function searchFromAction(action: ChatAction): string | null {
  if (action.kind === "bulk_update") {
    return action.search;
  }

  if (action.kind === "update" || action.kind === "delete_one") {
    return action.searchTitle;
  }

  return null;
}

function inferUpdateFields(text: string): {
  completed?: boolean;
  priority?: TaskPriority;
} {
  const completed = /完了/.test(text) ? true : undefined;
  let priority: TaskPriority | undefined;

  if (/\blow\b/i.test(text) || text.includes("low")) {
    priority = "low";
  } else if (/\bhigh\b/i.test(text) || text.includes("high")) {
    priority = "high";
  } else if (/\bmedium\b/i.test(text) || text.includes("medium")) {
    priority = "medium";
  }

  return { completed, priority };
}

function userWantsTaskMutation(text: string) {
  return /low|high|medium|完了|優先度|更新|削除|delete|update/i.test(text);
}

function refineActionForGroundTruth(
  action: ChatAction,
  matched: MatchedTaskSnapshot[],
  search: string,
  userText: string,
  conversationContext: string,
): ChatAction {
  const combined = `${conversationContext}\n${userText}`;

  if (matched.length === 1 && (action.kind === "clarify" || action.kind === "none")) {
    if (userWantsTaskMutation(combined)) {
      const fields = inferUpdateFields(combined);

      if (fields.priority !== undefined || fields.completed !== undefined) {
        return {
          kind: "bulk_update",
          completed: fields.completed,
          priority: fields.priority,
          search,
        };
      }
    }
  }

  return action;
}

async function fetchMatchingTasks(search: string): Promise<MatchedTaskSnapshot[]> {
  const result = await TaskService.list({
    search,
    sortBy: "createdAt",
    sortDirection: "asc",
    status: "all",
  });

  if (Result.isError(result)) {
    return [];
  }

  return result.value.map((task) => ({
    completed: task.completed,
    id: task.id,
    priority: task.priority,
    title: task.title,
  }));
}

function buildGroundTruthContext(search: string, matched: MatchedTaskSnapshot[]): string {
  if (matched.length === 0) {
    return `GROUND TRUTH: search "${search}" matches 0 tasks in the database. Show a warning Callout — do not invent tasks or counts.`;
  }

  const lines = matched
    .map(
      (task) =>
        `- "${task.title}" (id: ${task.id}, priority: ${task.priority}, completed: ${task.completed})`,
    )
    .join("\n");

  return `GROUND TRUTH (database — authoritative; ${matched.length} task(s) for search "${search}"):
${lines}
- Counts and titles in UI MUST match Query(list_tasks, {search: "${search}"}) and this list exactly.
- Use @Count(tasks) for counts and Table for titles — never enumerate invented task names in TextCallout/TextContent.
- FollowUpItem labels must use only these actual titles or generic actions (e.g. 一覧を表示).`;
}

export async function resolveActionWithGroundTruth(
  userText: string,
  conversationContext = "",
): Promise<ResolvedChatAction> {
  let action = await resolveChatAction(userText, conversationContext);

  const search =
    searchFromAction(action) ?? inferSearchKeyword(userText, conversationContext) ?? null;

  const matched = search ? await fetchMatchingTasks(search) : [];

  if (search && matched.length > 0) {
    action = refineActionForGroundTruth(action, matched, search, userText, conversationContext);
  }

  const groundTruth = search ? buildGroundTruthContext(search, matched) : "";

  return { action, groundTruth, matchedTasks: matched, search };
}

export async function resolveChatAction(userText: string, conversationContext = "") {
  const prompt = conversationContext
    ? `Recent conversation:\n${conversationContext}\n\nCurrent user message:\n${userText}`
    : userText;

  const { object } = await generateObject({
    model: gateway(chatModel),
    prompt,
    schema: ChatActionSchema,
    system: actionResolverSystem,
  });

  return object;
}

export async function executeChatAction(action: ChatAction): Promise<ChatActionExecution> {
  if (action.kind === "add") {
    const result = await TaskService.add({
      priority: action.priority,
      title: action.title,
    });

    if (Result.isError(result)) {
      return { error: result.error.message, kind: action.kind, ok: false };
    }

    return {
      kind: action.kind,
      ok: true,
      taskTitles: [result.value.title],
    };
  }

  if (action.kind === "bulk_add") {
    const result = await TaskService.bulkAdd(action.tasks);

    if (Result.isError(result)) {
      return { error: result.error.message, kind: action.kind, ok: false };
    }

    return {
      addedCount: result.value.addedCount,
      kind: action.kind,
      ok: true,
      taskTitles: result.value.tasks.map((task) => task.title),
    };
  }

  return { kind: action.kind, ok: true };
}

export function buildActionContext(
  action: ChatAction,
  execution: ChatActionExecution | null,
  matchedTasks: MatchedTaskSnapshot[] = [],
  search: string | null = null,
): string {
  if (action.kind === "clarify") {
    if (matchedTasks.length > 1 && search) {
      const titles = matchedTasks.map((task) => task.title).join(", ");

      return `CLARIFY WITH REAL DATA: ${matchedTasks.length} tasks match "${search}": ${titles}. Show Table from Query(list_tasks, {search: "${search}"}) + FollowUpItem ONLY for these exact titles. Question: ${action.message}. Do NOT invent other task names.`;
    }

    if (matchedTasks.length === 1 && search) {
      const task = matchedTasks[0]!;

      return `SINGLE MATCH: Only "${task.title}" matches "${search}". Do not ask which task — proceed with the user's requested action using this task.`;
    }

    return `CLARIFY: Ask the user in Japanese via TextCallout + FollowUpBlock. Question: ${action.message}. Do not invent example task names in FollowUpItem.`;
  }

  if (action.kind === "add" || action.kind === "bulk_add") {
    if (execution?.ok) {
      const titles = execution.taskTitles?.join(", ") ?? "";
      const count = execution.addedCount ?? execution.taskTitles?.length ?? 1;

      return `AUTO-EXECUTED ADD: Already saved ${count} task(s): ${titles}. Show success Callout + refreshed Table. Do NOT show add Form or Mutation or confirm Button.`;
    }

    if (execution?.error) {
      return `ADD FAILED: ${execution.error}. Show error Callout and ask how to proceed.`;
    }
  }

  if (action.kind === "delete_all") {
    return "DELETE ALL: User requested bulk delete. Show danger TextCallout, @Count(tasks) from Query — never invent counts, destructive confirm Button, Mutation(delete_all_tasks) — execute ONLY on button click.";
  }

  if (action.kind === "delete_one") {
    const target = matchedTasks[0];

    return `DELETE ONE: Target "${action.searchTitle}"${target ? ` (matched: "${target.title}", id: ${target.id})` : ""}. Query list_tasks with search, use target = @First(tasks) for id. Destructive confirm Button + Mutation(delete_task, {id}) — execute ONLY on button click.`;
  }

  if (action.kind === "update") {
    const fields = [
      action.title ? `title→${action.title}` : null,
      action.priority ? `priority→${action.priority}` : null,
      action.completed !== undefined ? `completed→${action.completed}` : null,
    ]
      .filter(Boolean)
      .join(", ");

    const target = matchedTasks[0];

    return `UPDATE ONE: Target "${action.searchTitle}" (${fields})${target ? ` — matched: "${target.title}", id: ${target.id}` : ""}. Query list_tasks with search, use target = @First(tasks) for id. Mutation(update_task, {id: target.id, ...}) + confirm Button — execute ONLY on button click.`;
  }

  if (action.kind === "bulk_update") {
    const fields = [
      action.priority ? `priority→${action.priority}` : null,
      action.completed !== undefined ? `completed→${action.completed}` : null,
    ]
      .filter(Boolean)
      .join(", ");

    const countNote =
      matchedTasks.length > 0 ? ` Exactly ${matchedTasks.length} task(s) match in database.` : "";

    return `BULK UPDATE: Match title contains "${action.search}" (${fields}).${countNote} Preview with Query(list_tasks, {search: "${action.search}", status: "all"}) — use @Count(tasks) for count, Table for titles; never list invented names in TextCallout. Mutation(bulk_update_tasks, {search: "${action.search}", priority, completed}) + confirm Button — execute ONLY on button click.`;
  }

  return "";
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

    if (trimmed) {
      lines.push(`${message.role}: ${trimmed}`);
    }
  }

  return lines.join("\n");
}
