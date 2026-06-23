import {
  isToolUIPart,
  type InferUITools,
  type ToolUIPart as SdkToolUIPart,
  type UIMessage,
} from "ai";

import type { chatTools } from "~/features/tasks/tools/adapters/ai-sdk";

//? 単一の真実: サーバー側ツールレジストリから導出したステート別 tool-part ユニオン
//? （ツールごとに input/output/approval が型付け）。手書きで同期する必要はない。
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
  //? v6 の型ガードで tool-* parts のみへ絞り込む（unknown キャストを排除）。
  //? 静的ツール union（chatTools 由来）へさらに narrow する。
  return parts.filter(isToolUIPart) as ToolUIPart[];
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
