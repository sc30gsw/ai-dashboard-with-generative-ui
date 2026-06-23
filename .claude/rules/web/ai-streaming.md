---
description: AI streaming — Vercel AI SDK v6 + Claude, TanStack Start server route, useChat → Renderer
globs: ["src/**/*.{ts,tsx}"]
alwaysApply: true
---

# AI Streaming (Vercel AI SDK + Claude)

> **Status:** The AI SDK is **installed** and the chat endpoint is implemented at `src/routes/api/chat.ts`.

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

## Server: hybrid streaming (Pattern A writes + Pattern B reads)

The streaming endpoint is a **TanStack Start server route** (raw `Request`/`Response`, not `createServerFn` — RPC functions don't return a streaming `Response`). See the `tanstack-start` skill for route syntax.

**Hybrid (chosen design):** WRITES go through AI SDK server-side tools (Pattern A). READS still stream OpenUI Lang rendered client-side by `<Renderer>` (Pattern B). Rationale: routing writes through server tools lets `execute` resolve the real task id server-side (from `sourceTitle`), avoiding the null-id bug that occurred when the model was asked to emit ids in `Mutation()` args. `needsApproval: true` on mutating tools is the human-in-the-loop substitute for `Mutation` gesture gating. See `requirement.md §8` for full rationale.

**Validate the incoming request body** before passing to `streamText`. Use `validateUIMessages({ messages, tools })` from the AI SDK to validate `UIMessage[]` (Zod alone cannot faithfully reproduce this shape across SDK versions), plus a thin Zod guard on the outer body object. Return 400 on failure.

```ts
import { convertToModelMessages, stepCountIs, streamText, validateUIMessages } from "ai";
import { z } from "zod";
import { chatTools } from "~/features/tasks/tools/adapters/ai-sdk";
import { chatModel } from "~/features/chat/lib/model"; // single config constant
import { systemPrompt } from "~/features/chat/lib/system-prompt";

const ChatBodySchema = z.object({ messages: z.array(z.unknown()) });

export async function handleChat(request: Request) {
  const body = ChatBodySchema.parse(await request.json());
  const { messages } = validateUIMessages({ messages: body.messages, tools: chatTools });

  const result = streamText({
    model: chatModel,
    system: systemPrompt,
    messages: convertToModelMessages(messages),
    tools: chatTools, // AI SDK server-side tools for writes
    stopWhen: stepCountIs(3), // prevent runaway tool loops
    toolChoice: "auto",
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
```

The `system` prompt is generated from the OpenUI Library so the model knows which components it may emit — see [web/generative-ui.md](./generative-ui.md).

**`needsApproval` policy:**

- `needsApproval: false` — additive tools only (`add_task`, `bulk_add_tasks`): the user's chat message is the explicit intent; additive actions are reversible.
- `needsApproval: true` — all other mutating tools (`complete_task`, `delete_task`, `bulk_delete_tasks`, `update_task`, etc.). The AI SDK surfaces an approval card before `execute` runs.

> **Pattern B for reads:** `streamText` still emits OpenUI Lang for list/display nodes. The `<Renderer toolProvider={readOnlyToolMap}>` client-side renders them. `toolProvider` is a read-only function map — only `list_tasks` and similar reads are wired here. See [web/generative-ui.md](./generative-ui.md).

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
