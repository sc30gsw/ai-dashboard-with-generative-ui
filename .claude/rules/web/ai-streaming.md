---
description: AI streaming — Vercel AI SDK v6 + Claude, TanStack Start server route, useChat → Renderer
globs: ["src/**/*.{ts,tsx}"]
alwaysApply: true
---

# AI Streaming (Vercel AI SDK + Claude)

> **Status:** The AI SDK is **installed** (`ai` v6, `@ai-sdk/anthropic`, `@ai-sdk/react`) but **no chat endpoint exists yet**. Scaffold per this rule when building it.

Generative UI needs an LLM that streams **OpenUI Lang**. We use the **Vercel AI SDK** (`ai` v6) with **Anthropic Claude**.

## Packages

```bash
vp add ai @ai-sdk/anthropic @ai-sdk/react
```

- `ai` — core (`streamText`, `convertToModelMessages`, `stepCountIs`).
- `@ai-sdk/anthropic` — Claude provider.
- `@ai-sdk/react` — `useChat` for the client.

## Environment

The Anthropic key is **server-only** — no `VITE_` prefix, never inlined into the client bundle (see [common/security.md](../common/security.md)).

```ts
// read on the server only
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required");
```

## Server: stream OpenUI Lang

The streaming endpoint is a **TanStack Start server route** (raw `Request`/`Response`, not `createServerFn` — RPC functions don't return a streaming `Response`). See the `tanstack-start` skill for route syntax. The handler body:

```ts
import { anthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { systemPrompt } from "~/features/chat/lib/system-prompt";
import { tools } from "~/features/chat/tools";

export async function handleChat(request: Request) {
  const { messages } = await request.json();

  const result = streamText({
    model: anthropic("claude-opus-4-8"),
    system: systemPrompt, // describes the OpenUI Library components to the model
    messages: convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
```

Default to the latest Claude model. The `system` prompt is generated from the OpenUI Library so the model knows which components it may emit — see [web/generative-ui.md](./generative-ui.md).

## Client: `useChat` → `<Renderer>`

```tsx
import { useChat } from "@ai-sdk/react";
import { Renderer } from "@openuidev/react-lang";
import { genuiLibrary } from "~/features/chat/genui/library";

export function Chat() {
  const { messages, sendMessage, status } = useChat();

  return (
    <>
      {messages.map((m) => (
        <Renderer
          key={m.id}
          response={m.content}
          library={genuiLibrary}
          isStreaming={status === "streaming"}
        />
      ))}
    </>
  );
}
```

## Boundaries

Wrap any fallible non-AI-SDK call (tool execution, persistence) in `better-result`. The AI SDK manages its own streaming errors — surface them via `useChat`'s `error`, don't wrap the stream itself. See [typescript/better-result.md](../typescript/better-result.md).

## Related rules

- [web/generative-ui.md](./generative-ui.md) — the `<Renderer>` and Library being fed
- [web/web-mcp.md](./web-mcp.md) — `tools` shared with the consumer surface
- [common/security.md](../common/security.md) — server-only secrets
