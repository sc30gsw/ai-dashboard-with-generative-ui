---
description: OpenUI generative-UI rendering — Renderer, openuiChatLibrary, custom defineComponent (Zod props), toolProvider
globs: ["src/**/*.{ts,tsx}"]
alwaysApply: true
---

# Generative UI (OpenUI)

> **Status:** OpenUI is **installed** and wired for the chat read/display path. The hybrid design (Pattern A writes via AI SDK tools + Pattern B reads via `<Renderer>`) is the chosen architecture.

This project's core purpose is Generative UI: the LLM returns **operable UI**, not text. We use [OpenUI](https://www.openui.com/docs/openui-lang/quickstart) (`@openuidev/*`) as the rendering layer **with its prebuilt component library** — we do **not** ship our own design system.

## How it works

```
LLM → emits OpenUI Lang (declarative markup, streaming, ~67% fewer tokens than JSON)
    → <Renderer> parses the stream token-by-token
    → maps tags to React components (react-ui's openuiChatLibrary + any custom ones)
    → operable UI appears inline in the chat
```

OpenUI Lang (the model emits it; you never hand-write it):

```text
Card([
  CardHeader(title="Weather in Tokyo"),
  BarChart(data=[...], title="Temperature this week")
])
```

## Packages

```bash
vp add @openuidev/react-lang @openuidev/react-headless @openuidev/react-ui zustand
```

- `@openuidev/react-lang` — runtime: `<Renderer>`, `defineComponent`.
- `@openuidev/react-headless` — chat state / streaming / thread management (react-ui's substrate). `zustand` is its peer store engine — required, **not used directly** (our chat state is the AI SDK's `useChat`).
- `@openuidev/react-ui` — the prebuilt component library (`openuiChatLibrary`) + precompiled CSS. Import the CSS once at app entry — see [web/styling.md](./styling.md).

## The Library

Use react-ui's ready-made `openuiChatLibrary` as the base — it already covers cards, charts, forms, etc. No per-component wrapping.

```tsx
import { Renderer } from "@openuidev/react-lang";
import { openuiChatLibrary } from "@openuidev/react-ui/genui-lib";

export function AssistantMessage({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  return (
    <Renderer
      response={text}
      library={openuiChatLibrary}
      isStreaming={isStreaming}
      onAction={handleAction}
    />
  );
}
```

The streamed text comes from the AI SDK — see [web/ai-streaming.md](./ai-streaming.md).

## Custom components (only when the base library lacks one)

Define with `defineComponent` — props are a **Zod** object schema (OpenUI hardcodes Zod; see [typescript/zod-validation.md](../typescript/zod-validation.md)). Style with plain JSX + Tailwind v4 + `cn` (see [web/styling.md](./styling.md)), not a separate UI kit.

```tsx
// ~/features/chat/genui/components/stat-card.tsx
import { defineComponent } from "@openuidev/react-lang";
import { cn } from "cnfast";
import { z } from "zod";

export const statCard = defineComponent({
  name: "StatCard",
  description: "Displays a single labelled metric. Use for KPIs and summary numbers.",
  props: z.object({
    label: z.string().describe("Metric label, e.g. 'Active users'"),
    value: z.string().describe("Formatted value, e.g. '1,204'"),
  }),
  component: ({ label, value }) => (
    <div className={cn("rounded-md border p-4")}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  ),
});
```

`.describe()` on every field matters — OpenUI feeds those descriptions into the model's system prompt. Vague descriptions → wrong UI.

**Security:** custom components render model- and user-derived content. Never use `dangerouslySetInnerHTML` with that content — rely on React's default escaping (see [common/security.md](../common/security.md)).

Extend the base library with custom components and pass the result to `<Renderer library={...}>` (combine per OpenUI's library API — check the OpenUI docs for the exact merge call):

```tsx
// ~/features/chat/genui/library.ts
import { openuiChatLibrary } from "@openuidev/react-ui/genui-lib";
import { statCard } from "~/features/chat/genui/components/stat-card";

// extend the base library with project-specific components (statCard, ...)
export const genuiLibrary = openuiChatLibrary;
```

## `toolProvider` — READ path only (Pattern B for reads)

`<Renderer toolProvider={...}>` is the **read path**: it wires `Query()` nodes so the `<Renderer>` can auto-fetch list data on render. The `toolProvider` is a **read-only function map** — only `list_tasks` and similar reads are wired here.

**WRITES are NOT routed through `Mutation()` / `toolProvider`.** In the hybrid design, writes go through AI SDK server-side tools with `needsApproval` (see [web/ai-streaming.md](./ai-streaming.md)). The human-in-the-loop invariant for writes is enforced by the AI SDK approval card, not by requiring a client-side gesture on a `Mutation()` node.

```tsx
import { toolProviderMap } from "~/features/tasks/tools/adapters/tool-provider";

<Renderer response={text} library={genuiLibrary} toolProvider={toolProviderMap} />;
```

### `toolProvider` adapter

The `tool-provider.ts` adapter exposes only read operations:

```ts
// ~/features/tasks/tools/adapters/tool-provider.ts
// Read-only function map for OpenUI <Renderer toolProvider={...}>.
// Writes go through AI SDK server-side tools — do NOT add mutating tools here.
export const toolProviderMap = {
  list_tasks: async (args) => {
    /* calls Eden client */
  },
};
```

### Invariant: Query auto-resolves; toolProvider is read-only

- **`Query()`** (read-only) may resolve automatically on render to populate list UI.
- **`Mutation()`** nodes are NOT used for writes in this project. The model should not emit `Mutation()` nodes for task writes; writes are handled by AI SDK tool calls with user approval.

> The `toolProvider` function-map shape is `Record<string, (args) => Promise<unknown>>`. Type it via `Extract<NonNullable<RendererProps["toolProvider"]>, Record<string, unknown>>` — the exported `ToolProvider` type is the MCP-client variant (needs `callTool`), not the function map.

## Placement

```
src/features/chat/
├── genui/
│   ├── components/   # custom defineComponent components (only when openuiChatLibrary lacks one)
│   └── library.ts    # openuiChatLibrary extended with custom components
```

## Related rules

- [web/ai-streaming.md](./ai-streaming.md) — streaming OpenUI Lang from Claude
- [web/web-mcp.md](./web-mcp.md) — tools shared with `toolProvider`
- [web/styling.md](./styling.md) — Tailwind v4 + react-ui CSS + `cn()`
- [typescript/zod-validation.md](../typescript/zod-validation.md) — why `defineComponent` props are Zod
