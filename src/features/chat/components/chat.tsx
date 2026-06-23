import { useChat } from "@ai-sdk/react";
import type { Renderer } from "@openuidev/react-lang";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses } from "ai";
import type { ComponentProps } from "react";

import { AssistantMessage } from "~/features/chat/components/assistant-message";
import { ChatInputForm } from "~/features/chat/components/chat-input-form";
import { ChatLoadingIndicator } from "~/features/chat/components/chat-loading-indicator";
import { UserMessage } from "~/features/chat/components/user-message";
import { useAppForm } from "~/features/chat/hooks/form";
import { CreateMessageSchema } from "~/features/chat/schemas/message-schema";
import { canSendChatMessage, chatUiState } from "~/features/chat/utils/message-parts";
import { refetchTasksCollection } from "~/features/tasks/collections/tasks-collection";

export function Chat() {
  const { messages, sendMessage, status, addToolApprovalResponse } = useChat({
    onFinish: () => {
      void refetchTasksCollection();
    },
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const { hasPendingApproval, isStreaming, lastMessageId, showLoading } = chatUiState(
    messages,
    status,
  );

  const sendGuard = { hasPendingApproval, isStreaming };

  const trySendMessage = (
    text: Parameters<
      NonNullable<ComponentProps<typeof Renderer>["onAction"]>
    >[0]["humanFriendlyMessage"],
  ) => {
    if (!canSendChatMessage(sendGuard)) {
      return;
    }

    sendMessage({ text });
  };

  const form = useAppForm({
    defaultValues: { body: "" },
    validators: { onChange: CreateMessageSchema },
    onSubmit: ({ value }) => {
      if (!canSendChatMessage(sendGuard)) {
        return;
      }

      sendMessage({ text: value.body });
      form.reset();
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div aria-label="Chat history" className="flex flex-col gap-4">
        {messages.map((message) =>
          message.role === "assistant" ? (
            <AssistantMessage
              isLastMessage={message.id === lastMessageId}
              isStreaming={isStreaming}
              key={message.id}
              message={message}
              onApprove={(id, approved) => addToolApprovalResponse({ approved, id })}
              onContinueConversation={trySendMessage}
            />
          ) : (
            <UserMessage key={message.id} message={message} />
          ),
        )}
        {showLoading ? <ChatLoadingIndicator /> : null}
      </div>

      <ChatInputForm
        form={form}
        hasPendingApproval={hasPendingApproval}
        isStreaming={isStreaming}
      />
    </div>
  );
}
