---
description: Web MCP (MCP-B polyfill) — navigator.modelContext.registerTool, human-in-the-loop, shared tool defs
globs: ["src/**/*.{ts,tsx}"]
alwaysApply: true
---

# Web MCP (AI as consumer)

> **Status:** MCP-B is **installed** (`@mcp-b/global`, `@mcp-b/react-webmcp`) but **not yet wired into any feature**. Scaffold per this rule when exposing the first tool.

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

## Define tools once — share with OpenUI

The same tool definitions back **both** the Web MCP surface (`registerTool`) **and** the OpenUI `toolProvider` ([web/generative-ui.md](./generative-ui.md)). Keep one registry per feature and adapt at each edge:

```
src/features/tasks/
├── tools/
│   ├── add-task.ts     # { name, description, inputSchema (Zod), run }
│   └── index.ts        # registry: toolMap (OpenUI toolProvider) + array (registerTool)
```

Each tool is `{ name, description, inputSchema (Zod), run }`. `run` calls the **Eden Treaty client** — Web MCP tools run in the browser, so `execute` hits the same Eden HTTP endpoint a UI button hits. `index.ts` exposes a `toolMap` for the OpenUI `toolProvider` and an array for `registerTool`; the `registerTool` adapter sets `inputSchema: z.toJSONSchema(schema)` and wraps `run` in the `{ content: [...] }` shape. Don't duplicate tool logic between the producer and consumer paths.

**Validate twice.** `Mutation` args emitted by the LLM and args from an external agent are both untrusted: Zod-parse them at the tool boundary **and** again in the Elysia route body ([web/backend-elysia-drizzle.md](./backend-elysia-drizzle.md), [typescript/zod-validation.md](../typescript/zod-validation.md)).

## Related rules

- [web/generative-ui.md](./generative-ui.md) — `toolProvider` consumes the same shared tool map (Mutation needs a user gesture)
- [web/backend-elysia-drizzle.md](./backend-elysia-drizzle.md) — the Elysia routes / Eden client that `run` calls
- [typescript/zod-validation.md](../typescript/zod-validation.md) — `inputSchema` authored in Zod
- [typescript/better-result.md](../typescript/better-result.md) — wrapping `execute`
- [common/security.md](../common/security.md) — never expose privileged actions as unguarded tools
