---
description: AI streaming — Vercel AI SDK v6 + Claude, TanStack Start server route, useChat → Renderer
globs: ["src/**/*.{ts,tsx}"]
alwaysApply: true
---

# AI Streaming (Vercel AI SDK + Claude)

> **Status:** The AI SDK is **installed** (`ai` v6, `@ai-sdk/react`) but **no chat endpoint exists yet**. Scaffold per this rule when building it.

Generative UI needs an LLM that streams **OpenUI Lang**. We use the **Vercel AI SDK** (`ai` v6) with **Claude accessed through the Vercel AI Gateway** — no direct Anthropic key: one endpoint, usage tracking, and one-line model swaps.

## Packages

```bash
vp add ai @ai-sdk/gateway @ai-sdk/react
```

- `ai` — core (`streamText`, `convertToModelMessages`).
- `@ai-sdk/gateway` — the Vercel AI Gateway provider (`gateway("anthropic/claude-…")`). Optional: the Gateway is the AI SDK's default global provider, so a plain `"anthropic/claude-…"` model string also routes through it. `@ai-sdk/anthropic` is **not** needed.
- `@ai-sdk/react` — `useChat` for the client.

## Environment

The Gateway key is **server-only** — no `VITE_` prefix, never inlined into the client bundle (see [common/security.md](../common/security.md)).

```ts
// read on the server only
const apiKey = process.env.AI_GATEWAY_API_KEY;
if (!apiKey) throw new Error("AI_GATEWAY_API_KEY is required");
```

## Server: stream OpenUI Lang

The streaming endpoint is a **TanStack Start server route** (raw `Request`/`Response`, not `createServerFn` — RPC functions don't return a streaming `Response`). See the `tanstack-start` skill for route syntax.

**Pattern B (chosen): operable UI.** For Generative UI the model's job is to emit OpenUI Lang containing `Query()` / `Mutation()` nodes — the client `toolProvider` resolves them (see [web/generative-ui.md](./generative-ui.md)). So `streamText` runs **without server-side `tools`** and **without `stopWhen` / `stepCountIs`**: there is no server tool-call loop. The handler body:

```ts
import { convertToModelMessages, streamText } from "ai";
import { chatModel } from "~/features/chat/lib/model"; // single config constant
import { systemPrompt } from "~/features/chat/lib/system-prompt";

export async function handleChat(request: Request) {
  const { messages } = await request.json();

  const result = streamText({
    model: chatModel, // gateway model — no `tools`, no `stopWhen`
    system: systemPrompt, // enumerates OpenUI components + toolProvider operations
    messages: convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
```

Keep the model in **one config constant** so it swaps in a single line (the Gateway makes this free):

```ts
// ~/features/chat/lib/model.ts
import { gateway } from "@ai-sdk/gateway";

// cost-first default; bump to "anthropic/claude-sonnet-4.5" if OpenUI Lang quality drops.
// verify the exact slug against the Gateway model list.
export const chatModel = gateway("anthropic/claude-haiku-4.5");
// or a plain string — the Gateway is the default global provider:
// export const chatModel = "anthropic/claude-haiku-4.5";
```

The `system` prompt is generated from the OpenUI Library so the model knows which components it may emit — see [web/generative-ui.md](./generative-ui.md).

> **Pattern A (fallback only):** classic AI SDK server-side tool-calling — `streamText({ tools, stopWhen: stepCountIs(n) })` — is kept _only_ as a documented fallback if `toolProvider` Query/Mutation resolution proves unreliable on OpenUI. The default is Pattern B above.

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
- [web/web-mcp.md](./web-mcp.md) — the shared tool map (`toolProvider` + `registerTool`)
- [common/security.md](../common/security.md) — server-only secrets (`AI_GATEWAY_API_KEY`)
