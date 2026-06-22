---
description: Backend/data layer — Elysia API (Zod via Standard Schema) mounted in TanStack Start, Eden Treaty, Drizzle + Turso
globs: ["src/**/*.{ts,tsx}"]
alwaysApply: true
---

# Backend API & Data Layer (Elysia + Eden + Drizzle/Turso)

> **Status:** packages **not yet installed / not wired**. Scaffold per this rule when building the first feature's data API. Source of truth for these decisions: [`requirement.md`](/requirement.md).

Task CRUD goes through an **Elysia** API layer. Persistence is **Drizzle ORM** on **Turso (libsql)**. Validation stays on **Zod** end-to-end. The client reaches the API through a single **Eden Treaty** entry point shared by UI buttons, Web MCP tools, and the OpenUI `toolProvider`.

## Elysia is mounted inside TanStack Start (Node, not Bun)

Elysia does **not** run as a standalone server. It is mounted in a TanStack Start server route and invoked via `app.fetch(request)` — WinterCG-compliant, so it runs on **Node** under the existing Vite+ toolchain.

```ts
// src/routes/api.$.ts
import { Elysia } from "elysia";
import { createFileRoute } from "@tanstack/react-router";
import { taskRoutes } from "~/features/tasks/api/task-routes";

const app = new Elysia({ prefix: "/api" }).use(taskRoutes);

const handle = ({ request }: { request: Request }) => app.fetch(request);

export const Route = createFileRoute("/api/$")({
  server: { handlers: { GET: handle, POST: handle, PATCH: handle, DELETE: handle } },
});

export type App = typeof app; // for Eden Treaty typing
```

**Bun is NOT adopted.** Mounting via `app.fetch` needs no Bun, and Elysia's Bun-only throughput numbers do not apply when it is not the listening server. The toolchain stays **pnpm + Vite+ (`vp`)** — see [common/development-workflow.md](../common/development-workflow.md) and [AGENTS.md](/AGENTS.md).

## Validation = Zod via Standard Schema (no TypeBox)

Elysia ≥ 1.4 supports **Standard Schema**, so pass **Zod** schemas directly to `body` / `query` / `params`. Do **not** use Elysia's built-in TypeBox (`t`) — Zod stays the single validator (see [typescript/zod-validation.md](../typescript/zod-validation.md)).

```ts
import { Elysia } from "elysia";
import { CreateTaskSchema } from "~/features/tasks/schemas/task-schema";
import { createTask } from "~/features/tasks/lib/task-service";

export const taskRoutes = new Elysia({ prefix: "/tasks" }).post(
  "/",
  ({ body }) => createTask(body), // body already validated + typed from the Zod schema
  { body: CreateTaskSchema },
);
```

Caveats:

- **OpenAPI generation** with Zod needs `openapi({ mapJsonSchema: { zod: z.toJSONSchema } })` — otherwise Zod params are not serialized into the docs.
- **File validation** under Standard Schema does not auto-detect content type; use Elysia's `fileType` utility.

## Eden Treaty — the single client entry

Expose a typed client with `createIsomorphicFn()`: on the **server** it calls Elysia directly (no HTTP); on the **client** it goes over HTTP. This one client is what UI buttons, Web MCP tool `execute`, and the OpenUI `toolProvider` all call — satisfying "a tool runs the same logic a human button would" ([web/web-mcp.md](./web-mcp.md)).

```ts
// src/lib/eden.ts
import { treaty } from "@elysiajs/eden";
import { createIsomorphicFn } from "@tanstack/react-start";
import type { App } from "~/routes/api.$";

export const getApi = createIsomorphicFn()
  .server(() => treaty<App>(/* in-process app */).api)
  .client(() => treaty<App>(window.location.origin).api);
```

## Drizzle ORM + Turso (libsql)

`@libsql/client` + `drizzle-orm/libsql`. Point at a local file in dev; switching to Turso cloud is a connection-URL change. Migrations via `drizzle-kit`.

- Derive Zod from the Drizzle schema with **`drizzle-zod`** (`createInsertSchema` / `createSelectSchema`) — **not** `drizzle-typebox` (which emits TypeBox and would break the single-validator rule). Because we avoid `drizzle-typebox`, the `@sinclair/typebox` version pin is unnecessary.
- Wrap fallible service / persistence calls in `better-result` at the boundary — see [typescript/better-result.md](../typescript/better-result.md).

## Layering — single source of truth

```
Drizzle  ←  task-service (server-only, real DB logic)
              ↑ wrap
           Elysia routes (/api/tasks…, Zod-validated body)   ← src/routes/api.$.ts via app.fetch (Node)
              ↑ HTTP (type-safe)
           Eden Treaty client            ← single client entry point
              ↑ shared by all three caller surfaces
   UI button   /   Web MCP registerTool   /   OpenUI toolProvider map
```

`task-service` holds the actual Drizzle logic (server-only). Elysia routes wrap it with Zod-validated input. Everything client-side reaches it through the Eden client. Never duplicate task logic across these edges.

## Chat streaming is NOT in Elysia

The AI chat endpoint stays a **native TanStack Start server route** returning a streaming `Response` (`toUIMessageStreamResponse()`), not an Elysia route. Elysia is for task CRUD only. See [web/ai-streaming.md](./ai-streaming.md).

## Related rules

- [typescript/zod-validation.md](../typescript/zod-validation.md) — Zod via Standard Schema, `drizzle-zod`
- [typescript/project-structure.md](../typescript/project-structure.md) — `api/`, `lib/` service, `src/db/`, `src/routes/api.$.ts`
- [typescript/better-result.md](../typescript/better-result.md) — wrap service/persistence calls
- [web/web-mcp.md](./web-mcp.md) — tools call the same Eden client as UI buttons
- [web/ai-streaming.md](./ai-streaming.md) — chat streaming stays a native server route
