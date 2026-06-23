import { gateway } from "@ai-sdk/gateway";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { Result } from "better-result";

import { chatModel } from "~/features/chat/lib/model";
import { systemPrompt } from "~/features/chat/lib/system-prompt";
import { defaultListTasksSchema } from "~/features/tasks/api/task-model";
import { TaskService } from "~/features/tasks/api/task-service";
import { chatTools } from "~/features/tasks/tools/chat-ai-tools";

//? モデルに read ツールがないため、書き込みはボードを見えず、実在タスクを「見つからない」と
//? 拒否したり、架空タスクを捏造する可能性がある。各ターンでライブボードを
//? ground truth として注入し、正しいタイトルで適切な write ツールを呼ばせる。
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

//* パターン A: モデル駆動のツール選択。Read → モデルが OpenUI Lang を出力（クライアント側で解決）。
//* Write → AI SDK ツール。破壊的操作は `needsApproval` でユーザー承認まで一時停止。
//* サーバー側ルーターやピン留めなし。
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
