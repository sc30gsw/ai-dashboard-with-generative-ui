import { useChat } from "@ai-sdk/react";
import { Renderer } from "@openuidev/react-lang";
import { useForm } from "@tanstack/react-form";
import { DefaultChatTransport } from "ai";
import { cn } from "cnfast";

import { genuiLibrary } from "~/features/chat/genui/library";
import { CreateMessageSchema } from "~/features/chat/schemas/message-schema";
import { taskToolMap } from "~/features/tasks/tools";

type MessagePart = { text?: string; type: string };

function messageText(parts: MessagePart[]) {
  let text = "";

  for (const part of parts) {
    if (part.type === "text") {
      text += part.text ?? "";
    }
  }

  return text;
}

export function Chat() {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const isStreaming = status === "streaming";

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
      <div className="flex flex-col gap-3">
        {messages.map((message) =>
          message.role === "assistant" ? (
            <Renderer
              key={message.id}
              isStreaming={isStreaming}
              library={genuiLibrary}
              response={messageText(message.parts)}
              toolProvider={taskToolMap}
            />
          ) : (
            <p key={message.id} className="text-right text-gray-700">
              {messageText(message.parts)}
            </p>
          ),
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field name="body">
          {(field) => (
            <div className="flex flex-col gap-1">
              <div className="flex gap-2">
                <input
                  aria-label="Chat message"
                  className={cn("flex-1 rounded-md border px-3 py-2")}
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
                        "rounded-md bg-black px-4 py-2 text-white",
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
