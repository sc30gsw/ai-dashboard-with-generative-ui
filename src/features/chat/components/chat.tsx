import { useChat } from "@ai-sdk/react";
import { Button } from "@heroui/react";
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
import { getCurrentCoordinates } from "~/utils/geolocation";

//? チャット送信のたびに現在地取得を試み、body の location/timeZone として渡す。
//? get_weather ツールが city/座標なしで呼ばれた場合のデフォルト座標フォールバック（§6.1）に使う。
async function chatRequestBody() {
  const coordinates = await getCurrentCoordinates();

  return {
    location: coordinates ?? undefined,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

//? レンダーごとに transport を再生成しない（ref が毎回変わると SDK の再初期化を招く）。
const chatTransport = new DefaultChatTransport({ api: "/api/chat" });

export function Chat() {
  const { messages, sendMessage, status, error, addToolApprovalResponse, regenerate } = useChat({
    onFinish: () => {
      void refetchTasksCollection();
    },
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    transport: chatTransport,
  });

  const { hasPendingApproval, isStreaming, lastMessageId, showLoading } = chatUiState(
    messages,
    status,
  );

  const sendGuard = { hasPendingApproval, isStreaming };

  const trySendMessage = async (
    text: Parameters<
      NonNullable<ComponentProps<typeof Renderer>["onAction"]>
    >[0]["humanFriendlyMessage"],
  ) => {
    if (!canSendChatMessage(sendGuard)) {
      return;
    }

    sendMessage({ text }, { body: await chatRequestBody() });
  };

  const form = useAppForm({
    defaultValues: { body: "" },
    validators: { onChange: CreateMessageSchema },
    onSubmit: async ({ value }) => {
      if (!canSendChatMessage(sendGuard)) {
        return;
      }

      sendMessage({ text: value.body }, { body: await chatRequestBody() });
      form.reset();
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div aria-label="Chat history" className="flex flex-col gap-4" role="log">
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

      {error ? (
        <div className="flex items-center gap-3">
          <p className="text-sm text-red-600" role="alert">
            {error.message || "チャットでエラーが発生しました。"}
          </p>
          <Button onPress={() => regenerate()} size="sm" variant="secondary">
            再試行
          </Button>
        </div>
      ) : null}

      <ChatInputForm
        form={form}
        hasPendingApproval={hasPendingApproval}
        isStreaming={isStreaming}
      />
    </div>
  );
}
