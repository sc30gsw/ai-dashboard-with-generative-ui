import { gateway } from "@ai-sdk/gateway";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { Result } from "better-result";

import { chatModel } from "~/features/chat/lib/model";
import { systemPrompt } from "~/features/chat/lib/system-prompt";
import { defaultListTasksSchema } from "~/features/tasks/api/task-model";
import { TaskService } from "~/features/tasks/api/task-service";
import { chatTools } from "~/features/tasks/tools/chat-ai-tools";

// The model has no read tool, so writes would otherwise be blind to the board and
// it may refuse a real task as "not found" (or invent tasks). Inject the live board
// as ground truth each turn so it calls the right write tool with a real title.
async function boardStateContext() {
  const result = await TaskService.list(defaultListTasksSchema);

  if (Result.isError(result)) {
    return "";
  }

  const tasks = result.value;

  if (tasks.length === 0) {
    return "## Current board state (GROUND TRUTH)\nThe board has 0 tasks. Only add operations have a target.";
  }

  const lines = tasks
    .map(
      (task) =>
        `- ${task.title} (priority: ${task.priority}, ${task.completed ? "done" : "active"})`,
    )
    .join("\n");

  return `## Current board state (GROUND TRUTH — this is the complete task list)
${lines}

- This list is the ONLY source of truth for what exists; you cannot see the board any other way.
- If the user refers to a task in this list (exact match or the clearly closest one), you MUST call the matching tool (single: sourceTitle, multiple: bulk_*). The tool resolves the real id server-side.
- NEVER claim a task does not exist, and NEVER ask the user to re-check the title, when a matching task is in this list — just call the tool.
- Never invent a task name that is not in this list.`;
}

// Pattern A: model-driven tool selection. Reads → the model emits OpenUI Lang
// (resolved client-side). Writes → AI SDK tools; destructive ones pause via
// `needsApproval` until the user approves. No server-side router, no pinning.
async function handleChat({ request }: Record<"request", Request>) {
  if (!process.env.AI_GATEWAY_API_KEY) {
    throw new Error("AI_GATEWAY_API_KEY is required");
  }

  const { messages }: Record<"messages", UIMessage[]> = await request.json();
  const [modelMessages, boardState] = await Promise.all([
    convertToModelMessages(messages),
    boardStateContext(),
  ]);

  const result = streamText({
    messages: modelMessages,
    model: gateway(chatModel),
    stopWhen: stepCountIs(5),
    system: boardState ? `${systemPrompt}\n\n${boardState}` : systemPrompt,
    toolChoice: "auto",
    tools: chatTools,
  });

  return result.toUIMessageStreamResponse();
}

export const Route = createFileRoute("/api/chat")({
  server: { handlers: { POST: handleChat } },
});
