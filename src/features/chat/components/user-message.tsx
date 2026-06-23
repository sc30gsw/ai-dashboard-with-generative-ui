import type { UIMessage } from "ai";

import { messageText } from "~/features/chat/utils/message-parts";

export function UserMessage({ message }: Record<"message", UIMessage>) {
  return (
    <article className="flex justify-end">
      <div className="max-w-[80%] rounded-lg border border-zinc-200 bg-white px-4 py-3 text-zinc-800 shadow-sm">
        <p className="mb-1 text-xs font-medium tracking-wide text-zinc-500 uppercase">You</p>
        <p className="text-sm leading-6 wrap-break-word">{messageText(message.parts)}</p>
      </div>
    </article>
  );
}
