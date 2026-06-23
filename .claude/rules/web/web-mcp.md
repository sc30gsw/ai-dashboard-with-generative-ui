---
description: Web MCP (MCP-B polyfill) — navigator.modelContext.registerTool, human-in-the-loop, shared tool defs
globs: ["src/**/*.{ts,tsx}"]
alwaysApply: true
---

# Web MCP (AI as consumer)

> **Status:** MCP-B is **installed** and wired in `src/routes/_app.tsx`. All 9 task tools are exposed via `useWebMCP`.

The other half of this project's purpose: the app exposes its actions as **tools** an in-browser AI agent can call — AI as a _consumer_ of the web, not just a producer. Instead of screenshot/DOM scraping, the agent calls semantic functions.

`navigator.modelContext` is an emerging proposal, not yet shipped in browsers, so we use the **MCP-B polyfill**.

## Packages

```bash
vp add @mcp-b/global @mcp-b/react-webmcp
```

- `@mcp-b/global` — importing it initializes the polyfill and the in-page MCP server. `import "@mcp-b/global"` once at app entry.
- `@mcp-b/react-webmcp` — React hooks for registering tools tied to component lifecycle.

## Core principle: human-in-the-loop

Tools are **collaboration surfaces**, not autonomy. A tool runs the _same logic_ a human button would. The AI proposes; the human stays in control. Never expose a tool that does something a user couldn't do, or that bypasses confirmation on a destructive action.

## Registering a tool

`registerTool` takes a **JSON Schema** `inputSchema`. We author schemas in **Zod** (project standard) and convert. `execute` returns `{ content: [{ type: "text", text }] }`.

```ts
import "@mcp-b/global";
import { Result } from "better-result";
import { z } from "zod";

const addTodoInput = z.object({ title: z.string().min(1) });

const ac = new AbortController();
navigator.modelContext.registerTool(
  {
    name: "add_todo",
    description: "Add a todo item to the current list.",
    inputSchema: z.toJSONSchema(addTodoInput),
    execute: async (args) => {
      const result = await Result.tryPromise({
        catch: (e) => e as Error,
        try: async () => addTask(addTodoInput.parse(args).title), // run() calls the Eden client — same path the UI button calls
      });
      return result.match({
        err: (error) => ({ content: [{ type: "text", text: `Failed: ${error.message}` }] }),
        ok: (todo) => ({ content: [{ type: "text", text: `Added: ${todo.title}` }] }),
      });
    },
  },
  { signal: ac.signal }, // unregister on cleanup
);
```

In React, prefer the `@mcp-b/react-webmcp` hooks so registration follows the component lifecycle (they handle the `AbortSignal` for you). Validate args with Zod inside `execute`; wrap fallible work in `better-result` ([typescript/better-result.md](../typescript/better-result.md)).

## Single tool registry — defs + adapters

Tool definitions live **once** in `defs/` and are adapted per surface. No logic is duplicated.

```
src/features/tasks/
└── tools/
    ├── defs/                 # One meta def per operation: { name, description, inputSchema (Zod), outputSchema (Zod) }
    │   ├── add-task.ts
    │   ├── list-tasks.ts     # annotations.readOnlyHint: true
    │   ├── complete-task.ts
    │   └── …
    └── adapters/
        ├── ai-sdk.ts         # chatTools for streamText; execute calls TaskService in-process on the server
        ├── web-mcp.ts        # run calls Eden client over HTTP; all mutations gate on elicitation
        └── tool-provider.ts  # read-only function map for OpenUI <Renderer toolProvider={…}>
```

### Web MCP adapter: all-mutation elicitation gate

The `web-mcp.ts` adapter gates **every mutating tool** on `elicitInput` — not just tools flagged as `destructive`. This is the agent-side analogue of a user gesture (§6 of `requirement.md`) and is robust to new mutating tools being added later (a flag-based gate would let an unguarded destructive tool slip through).

```ts
// web-mcp.ts adapter — pattern for every mutating tool
execute: async (args) => {
  // Gate: elicitation on every mutation (not just destructive)
  const confirmation = await navigator.modelContext.elicitInput({ ... });
  if (!confirmation.confirmed) {
    return { content: [{ type: "text", text: "Cancelled." }] };
  }
  const result = await Result.tryPromise({
    catch: (e) => e as Error,
    try: () => run(schema.parse(args)), // run calls the Eden client
  });
  return result.match({ ... });
},
```

The `destructive` flag on a tool def only drives confirmation-dialog **styling** (e.g. danger color). It does not determine whether the gate fires.

**Validate twice.** Tool args from an external agent are untrusted: Zod-parse them at the tool boundary **and** again in the Elysia route body ([web/backend-elysia-drizzle.md](./backend-elysia-drizzle.md), [typescript/zod-validation.md](../typescript/zod-validation.md)).

## Related rules

- [web/generative-ui.md](./generative-ui.md) — `toolProvider` is the read-only map; writes go through AI SDK tools
- [web/backend-elysia-drizzle.md](./backend-elysia-drizzle.md) — the Elysia routes / Eden client that `run` calls
- [typescript/zod-validation.md](../typescript/zod-validation.md) — `inputSchema` authored in Zod
- [typescript/better-result.md](../typescript/better-result.md) — wrapping `execute`
- [common/security.md](../common/security.md) — never expose privileged actions as unguarded tools
