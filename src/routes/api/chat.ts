import { gateway } from "@ai-sdk/gateway";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

import { createClarifyResponse } from "~/features/chat/lib/clarify-response";
import { chatModel } from "~/features/chat/lib/model";
import { systemPrompt } from "~/features/chat/lib/system-prompt";
import {
  conversationContextFromMessages,
  lastUserTextFromMessages,
  resolveToolIntent,
} from "~/features/chat/lib/tool-intent";

// Hybrid: adds auto-execute on server; CUD tools get confirm UI with server-pinned mutation args.
async function handleChat({ request }: Record<"request", Request>) {
  if (!process.env.AI_GATEWAY_API_KEY) {
    throw new Error("AI_GATEWAY_API_KEY is required");
  }

  const { messages }: Record<"messages", UIMessage[]> = await request.json();
  const userText = lastUserTextFromMessages(messages);

  let actionContext = "";
  let pinnedHeader = "";

  if (userText) {
    try {
      const conversationContext = conversationContextFromMessages(messages);
      const resolved = await resolveToolIntent(userText, conversationContext);

      if (resolved.clarifyMessage) {
        return createClarifyResponse(resolved.clarifyMessage);
      }

      const sections = [resolved.uiContext, resolved.groundTruth].filter(Boolean);

      actionContext = sections.join("\n\n");
      pinnedHeader = encodeURIComponent(JSON.stringify(resolved.pinnedMutations));
    } catch (error) {
      console.error(
        "[chat] resolveToolIntent failed — streaming UI without runtime context",
        error,
      );
    }
  }

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    messages: modelMessages,
    model: gateway(chatModel),
    system: actionContext
      ? `${systemPrompt}\n\n## Runtime context\n${actionContext}`
      : systemPrompt,
  });

  const response = result.toUIMessageStreamResponse();

  if (pinnedHeader) {
    response.headers.set("X-Pinned-Mutations", pinnedHeader);
  }

  return response;
}

export const Route = createFileRoute("/api/chat")({
  server: { handlers: { POST: handleChat } },
});
