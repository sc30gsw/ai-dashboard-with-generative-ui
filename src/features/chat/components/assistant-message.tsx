import { BuiltinActionType } from "@openuidev/lang-core";
import { Renderer } from "@openuidev/react-lang";
import type { UIMessage } from "ai";
import type { ComponentProps } from "react";

import { ToolPartView, type ToolPartViewProps } from "~/features/chat/components/tool-part-view";
import { genuiLibrary } from "~/features/chat/genui/library";
import { extractOpenUILang, isOpenUILangResponse } from "~/features/chat/lib/clarify-response";
import { chatUiState, messageText, toolPartsOf } from "~/features/chat/utils/message-parts";
import { createReadToolMap } from "~/features/tasks/tools";

const readToolMap = createReadToolMap();

type AssistantMessageProps = {
  isLastMessage: boolean;
  isStreaming: ReturnType<typeof chatUiState>["isStreaming"];
  message: UIMessage;
  onApprove: ToolPartViewProps["onApprove"];
  onContinueConversation: (
    text: Parameters<
      NonNullable<ComponentProps<typeof Renderer>["onAction"]>
    >[0]["humanFriendlyMessage"],
  ) => void;
};

export function AssistantMessage({
  isLastMessage,
  isStreaming,
  message,
  onApprove,
  onContinueConversation,
}: AssistantMessageProps) {
  const toolParts = toolPartsOf(message.parts);
  const text = messageText(message.parts);
  const isLang = isOpenUILangResponse(text);

  if (text.length === 0 && toolParts.length === 0) {
    return null;
  }

  return (
    <article className="flex max-w-full flex-col gap-3">
      <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">Assistant</p>

      {toolParts.map((part) => (
        <ToolPartView key={part.toolCallId} onApprove={onApprove} part={part} />
      ))}

      {isLang ? (
        <Renderer
          isStreaming={isStreaming && isLastMessage}
          library={genuiLibrary}
          onAction={(event) => {
            if (event.type === BuiltinActionType.ContinueConversation) {
              onContinueConversation(event.humanFriendlyMessage);
            }
          }}
          response={extractOpenUILang(text) ?? ""}
          toolProvider={readToolMap}
        />
      ) : text.length > 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm leading-6 text-zinc-800 shadow-sm">
          {text}
        </div>
      ) : null}
    </article>
  );
}
