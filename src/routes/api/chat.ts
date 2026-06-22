import { gateway } from "@ai-sdk/gateway";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

import {
  buildActionContext,
  conversationContextFromMessages,
  executeChatAction,
  lastUserTextFromMessages,
  resolveActionWithGroundTruth,
} from "~/features/chat/lib/chat-action";
import { chatModel } from "~/features/chat/lib/model";
import { systemPrompt } from "~/features/chat/lib/system-prompt";

// Hybrid: safe adds run on the server before UI generation; deletes/updates get confirm UI only.
async function handleChat({ request }: Record<"request", Request>) {
  if (!process.env.AI_GATEWAY_API_KEY) {
    throw new Error("AI_GATEWAY_API_KEY is required");
  }

  const { messages }: Record<"messages", UIMessage[]> = await request.json();
  const userText = lastUserTextFromMessages(messages);

  let actionContext = "";

  if (userText) {
    const conversationContext = conversationContextFromMessages(messages);
    const { action, groundTruth, matchedTasks, search } = await resolveActionWithGroundTruth(
      userText,
      conversationContext,
    );
    const execution =
      action.kind === "add" || action.kind === "bulk_add" ? await executeChatAction(action) : null;

    const builtContext = buildActionContext(action, execution, matchedTasks, search);
    const sections = [builtContext, groundTruth].filter(Boolean);

    actionContext = sections.join("\n\n");
  }

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    messages: modelMessages,
    model: gateway(chatModel),
    system: actionContext
      ? `${systemPrompt}\n\n## Runtime context\n${actionContext}`
      : systemPrompt,
  });

  return result.toUIMessageStreamResponse();
}

export const Route = createFileRoute("/api/chat")({
  server: { handlers: { POST: handleChat } },
});
