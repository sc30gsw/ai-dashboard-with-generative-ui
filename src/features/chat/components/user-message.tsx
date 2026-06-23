import { Card } from "@heroui/react";
import type { UIMessage } from "ai";

import { messageText } from "~/features/chat/utils/message-parts";

export function UserMessage({ message }: Record<"message", UIMessage>) {
  return (
    <article className="flex justify-end">
      <Card className="max-w-[80%]">
        <Card.Content>
          <p className="mb-1 text-xs font-medium tracking-wide text-zinc-500 uppercase">You</p>
          <p className="text-sm leading-6 wrap-break-word">{messageText(message.parts)}</p>
        </Card.Content>
      </Card>
    </article>
  );
}
