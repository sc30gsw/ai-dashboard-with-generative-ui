import { useChat } from "@ai-sdk/react";
import { Renderer } from "@openuidev/react-lang";
import { useForm } from "@tanstack/react-form";
import { DefaultChatTransport, type UIMessage } from "ai";
import { cn } from "cnfast";

import { genuiLibrary } from "~/features/chat/genui/library";
import { CreateMessageSchema } from "~/features/chat/schemas/message-schema";
import { taskToolMap } from "~/features/tasks/tools";

function messageText(parts: UIMessage["parts"]) {
  let text = "";

  for (const part of parts) {
    if (part.type === "text") {
      text += part.text;
    }
  }

  return text;
}

export function Chat() {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const isStreaming = status === "streaming";
  const lastMessageId = messages.at(-1)?.id;

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
        {messages.map((message) =>
          message.role === "assistant" ? (
            <article className="max-w-full" key={message.id}>
              <p className="mb-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">
                Assistant
              </p>
              <Renderer
                isStreaming={isStreaming && message.id === lastMessageId}
                library={genuiLibrary}
                response={messageText(message.parts)}
                toolProvider={taskToolMap}
              />
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
          ),
        )}
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
                  placeholder="e.g. add a task to buy milk, high priority"
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
