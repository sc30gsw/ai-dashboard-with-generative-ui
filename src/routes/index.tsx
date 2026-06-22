import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";

import { Chat } from "~/features/chat/components/chat";
import { WebMcpTools } from "~/features/tasks/components/web-mcp-tools";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="mb-4 text-2xl font-semibold">Task Board</h1>
      <ClientOnly fallback={<p className="text-gray-500">読み込み中...</p>}>
        <Suspense fallback={<p className="text-gray-500">読み込み中...</p>}>
          <WebMcpTools />
          <Chat />
        </Suspense>
      </ClientOnly>
    </main>
  );
}
