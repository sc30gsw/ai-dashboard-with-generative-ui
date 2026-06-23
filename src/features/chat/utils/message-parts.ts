import type { InferUITools, ToolUIPart as SdkToolUIPart, UIMessage } from "ai";

import type { chatTools } from "~/features/tasks/tools/chat-ai-tools";

//? Single source of truth: the real per-state tool-part union derived from the
//? server tool registry (input/output/approval typed per tool), not hand-kept.
export type ToolUIPart = SdkToolUIPart<InferUITools<typeof chatTools>>;

export function messageText(parts: UIMessage["parts"]) {
  let text = "";

  for (const part of parts) {
    if (part.type === "text") {
      text += part.text;
    }
  }

  return text;
}

export function toolPartsOf(parts: UIMessage["parts"]) {
  return parts.filter((part) => part.type.startsWith("tool-")) as unknown as ToolUIPart[];
}

type ChatStatus = "error" | "ready" | "streaming" | "submitted";

export function chatUiState(messages: UIMessage[], status: ChatStatus) {
  const lastMessage = messages.at(-1);
  const isStreaming = status === "streaming";

  const showLoading =
    status === "submitted" ||
    (isStreaming &&
      lastMessage?.role === "assistant" &&
      messageText(lastMessage.parts).length === 0 &&
      toolPartsOf(lastMessage.parts).length === 0);

  const hasPendingApproval = messages.some(
    (message) =>
      message.role === "assistant" &&
      toolPartsOf(message.parts).some((part) => part.state === "approval-requested"),
  );

  return {
    hasPendingApproval,
    isStreaming,
    lastMessageId: lastMessage?.id,
    showLoading,
  };
}

export function canSendChatMessage(options: { hasPendingApproval: boolean; isStreaming: boolean }) {
  return !options.hasPendingApproval && !options.isStreaming;
}
