import { gateway } from "@ai-sdk/gateway";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

import { chatModel } from "~/features/chat/lib/model";
import { systemPrompt } from "~/features/chat/lib/system-prompt";

// Native server route (raw Request/Response) — server functions can't return a
// streaming Response. Pattern B: NO `tools`/`stopWhen`; the model emits OpenUI
// Lang that the client `toolProvider` resolves.
async function handleChat({ request }: Record<"request", Request>) {
  if (!process.env.AI_GATEWAY_API_KEY) {
    throw new Error("AI_GATEWAY_API_KEY is required");
  }

  const { messages }: Record<"messages", UIMessage[]> = await request.json();

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    messages: modelMessages,
    model: gateway(chatModel),
    system: systemPrompt,
  });

  return result.toUIMessageStreamResponse();
}

export const Route = createFileRoute("/api/chat")({
  server: { handlers: { POST: handleChat } },
});
