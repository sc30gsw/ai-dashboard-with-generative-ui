import { Card } from "@heroui/react";

export function ChatLoadingIndicator() {
  return (
    <article className="max-w-full">
      <p className="mb-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Assistant</p>
      <Card aria-busy="true" aria-label="Assistant is thinking">
        <Card.Content className="flex items-center gap-3 text-sm text-zinc-500">
          <span className="flex gap-1">
            <span className="size-2 animate-pulse rounded-full bg-zinc-400" />
            <span className="size-2 animate-pulse rounded-full bg-zinc-300" />
            <span className="size-2 animate-pulse rounded-full bg-zinc-200" />
          </span>
          <span>考え中...</span>
        </Card.Content>
      </Card>
    </article>
  );
}
