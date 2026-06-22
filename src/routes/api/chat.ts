import { gateway } from "@ai-sdk/gateway";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";

import { chatModel } from "~/features/chat/lib/model";
import { systemPrompt } from "~/features/chat/lib/system-prompt";
import { chatTools } from "~/features/tasks/tools/chat-ai-tools";

// Pattern A: model-driven tool selection. Reads → the model emits OpenUI Lang
// (resolved client-side). Writes → AI SDK tools; destructive ones pause via
// `needsApproval` until the user approves. No server-side router, no pinning.
async function handleChat({ request }: Record<"request", Request>) {
  if (!process.env.AI_GATEWAY_API_KEY) {
    throw new Error("AI_GATEWAY_API_KEY is required");
  }

  const { messages }: Record<"messages", UIMessage[]> = await request.json();
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    messages: modelMessages,
    model: gateway(chatModel),
    stopWhen: stepCountIs(5),
    system: systemPrompt,
    toolChoice: "auto",
    tools: chatTools,
  });

  return result.toUIMessageStreamResponse();
}

export const Route = createFileRoute("/api/chat")({
  server: { handlers: { POST: handleChat } },
});
