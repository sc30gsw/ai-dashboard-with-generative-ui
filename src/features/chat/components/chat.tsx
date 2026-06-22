import { useChat } from "@ai-sdk/react";
import { BuiltinActionType } from "@openuidev/lang-core";
import { Renderer } from "@openuidev/react-lang";
import { useForm } from "@tanstack/react-form";
import { DefaultChatTransport, type UIMessage } from "ai";
import { cn } from "cnfast";
import { useState } from "react";

import { genuiLibrary } from "~/features/chat/genui/library";
import { isOpenUILangResponse, extractOpenUILang } from "~/features/chat/lib/clarify-response";
import {
  getLatestPinnedMutations,
  setLatestPinnedMutations,
  type PinnedMutations,
} from "~/features/chat/lib/pinned-mutations";
import { CreateMessageSchema } from "~/features/chat/schemas/message-schema";
import { createTaskToolMap } from "~/features/tasks/tools";

function messageText(parts: UIMessage["parts"]) {
  let text = "";

  for (const part of parts) {
    if (part.type === "text") {
      text += part.text;
    }
  }

  return text;
}

function ChatLoadingIndicator() {
  return (
    <article className="max-w-full">
      <p className="mb-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Assistant</p>
      <div
        aria-busy="true"
        aria-label="Assistant is thinking"
        className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500 shadow-sm"
      >
        <span className="flex gap-1">
          <span className="size-2 rounded-full bg-zinc-400" />
          <span className="size-2 rounded-full bg-zinc-300" />
          <span className="size-2 rounded-full bg-zinc-200" />
        </span>
        <span className="animate-pulse">UI生成中...</span>
      </div>
    </article>
  );
}

function isPendingAssistantResponse(
  status: "error" | "ready" | "streaming" | "submitted",
  messages: UIMessage[],
) {
  if (status === "submitted") {
    return true;
  }

  if (status !== "streaming") {
    return false;
  }

  const lastMessage = messages.at(-1);

  if (!lastMessage) {
    return true;
  }

  if (lastMessage.role === "user") {
    return true;
  }

  return lastMessage.role === "assistant" && messageText(lastMessage.parts).length === 0;
}

export function Chat() {
  const [pinnedMutations, setPinnedMutations] = useState<PinnedMutations | null>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      fetch: async (input, init) => {
        const response = await fetch(input, init);
        const header = response.headers.get("X-Pinned-Mutations");

        if (header) {
          try {
            const pinned = JSON.parse(decodeURIComponent(header)) as PinnedMutations;

            setPinnedMutations(pinned);
            setLatestPinnedMutations(pinned);
          } catch {
            setPinnedMutations(null);
            setLatestPinnedMutations(null);
          }
        }

        return response;
      },
    }),
  });

  const toolProvider = createTaskToolMap(pinnedMutations ?? getLatestPinnedMutations());

  const isStreaming = status === "streaming";
  const lastMessageId = messages.at(-1)?.id;
  const showLoading = isPendingAssistantResponse(status, messages);

  const form = useForm({
    defaultValues: { body: "" },
    validators: { onChange: CreateMessageSchema },
    onSubmit: ({ value }) => {
      sendMessage({ text: value.body });
      form.reset();
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div aria-label="Chat history" className="flex flex-col gap-4">
        {messages.map((message) => {
          if (
            message.role === "assistant" &&
            showLoading &&
            message.id === lastMessageId &&
            messageText(message.parts).length === 0
          ) {
            return null;
          }

          return message.role === "assistant" ? (
            <article className="max-w-full" key={message.id}>
              <p className="mb-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">
                Assistant
              </p>
              {isOpenUILangResponse(messageText(message.parts)) ? (
                <Renderer
                  isStreaming={isStreaming && message.id === lastMessageId}
                  library={genuiLibrary}
                  onAction={(event) => {
                    if (event.type === BuiltinActionType.ContinueConversation) {
                      sendMessage({ text: event.humanFriendlyMessage });
                    }
                  }}
                  response={extractOpenUILang(messageText(message.parts)) ?? ""}
                  toolProvider={toolProvider}
                />
              ) : (
                <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm leading-6 text-zinc-800 shadow-sm">
                  {messageText(message.parts)}
                </div>
              )}
            </article>
          ) : (
            <article className="flex justify-end" key={message.id}>
              <div className="max-w-[80%] rounded-lg border border-zinc-200 bg-white px-4 py-3 text-zinc-800 shadow-sm">
                <p className="mb-1 text-xs font-medium tracking-wide text-zinc-500 uppercase">
                  You
                </p>
                <p className="text-sm leading-6 wrap-break-word">{messageText(message.parts)}</p>
              </div>
            </article>
          );
        })}
        {showLoading ? <ChatLoadingIndicator /> : null}
      </div>

      <form
        aria-label="Send chat message"
        className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field name="body">
          {(field) => (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-zinc-700" htmlFor={field.name}>
                Message
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  aria-label="Chat message"
                  className={cn(
                    "min-h-12 flex-1 rounded-md border border-zinc-300 px-3 text-base outline-offset-2 placeholder:text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-900",
                  )}
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="例: 高優先度で週次レポート提出タスクを追加"
                  value={field.state.value}
                />
                <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
                  {([canSubmit, isSubmitting]) => (
                    <button
                      className={cn(
                        "min-h-12 rounded-md bg-black px-5 font-medium text-white outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-900",
                        (!canSubmit || isStreaming) && "opacity-50",
                      )}
                      disabled={!canSubmit || isStreaming}
                      type="submit"
                    >
                      {isSubmitting ? "..." : "Send"}
                    </button>
                  )}
                </form.Subscribe>
              </div>
              {!field.state.meta.isValid && (
                <em className="text-sm text-red-600" role="alert">
                  {field.state.meta.errors.map((error) => error?.message).join(", ")}
                </em>
              )}
            </div>
          )}
        </form.Field>
      </form>
    </div>
  );
}
