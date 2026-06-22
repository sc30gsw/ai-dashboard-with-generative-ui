import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";

import { Chat } from "~/features/chat/components/chat";
import { ListTasksSchema } from "~/features/tasks/api/task-model";
import { WebMcpTools } from "~/features/tasks/components/web-mcp-tools";

export const Route = createFileRoute("/_app/chat")({
  validateSearch: ListTasksSchema,
  component: ChatPage,
});

function ChatPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-semibold">Chat</h2>
        <p className="text-muted text-sm">
          Generative UI task board powered by OpenUI Lang and toolProvider.
        </p>
      </div>
      <ClientOnly fallback={<p className="text-muted text-sm">読み込み中...</p>}>
        <Suspense fallback={<p className="text-muted text-sm">読み込み中...</p>}>
          <WebMcpTools />
          <Chat />
        </Suspense>
      </ClientOnly>
    </div>
  );
}
