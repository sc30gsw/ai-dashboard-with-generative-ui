import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";

import { Chat } from "~/features/chat/components/chat";

function RoutePending() {
  return <p className="text-muted text-sm">読み込み中...</p>;
}

export const Route = createFileRoute("/_app/chat")({
  component: ChatPage,
  pendingComponent: RoutePending,
});

function ChatPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-semibold">Chat</h2>
        <p className="text-muted text-sm">
          Generative UI composed from OpenUI primitives, Query/Mutation, and toolProvider.
        </p>
      </div>
      <Suspense fallback={<p className="text-muted text-sm">読み込み中...</p>}>
        <Chat />
      </Suspense>
    </div>
  );
}
