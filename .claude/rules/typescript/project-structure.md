---
description: Bulletproof React features/* layout, ~ alias, feature inter-dependencies
globs: ["src/**/*.{ts,tsx}"]
alwaysApply: true
---

# Project Structure

> This rule extends [CODING_GUIDELINES.md](../CODING_GUIDELINES.md) §プロジェクト構造.

## Feature layout

```
src/
├── features/          # Business logic — one module per domain
│   └── [feature]/
│       ├── api/         # Elysia route plugins (e.g. task-routes.ts), mounted in src/routes/api.$.ts
│       ├── components/  # feature-specific React components
│       ├── genui/       # OpenUI: openuiChatLibrary + custom defineComponent (library.ts)
│       ├── hooks/       # feature-specific hooks
│       ├── schemas/     # Zod schemas (shared by Elysia body validation + tool inputSchema)
│       ├── tools/       # tool defs shared by Web MCP + OpenUI toolProvider
│       ├── types/       # type definitions
│       └── lib/         # feature helpers + server-only service (e.g. task-service.ts, system prompts)
├── routes/            # TanStack Router file-based routing
│   ├── api.$.ts       # Elysia mount (app.fetch on Node) — task CRUD API
│   └── …              # + native server route for AI chat streaming
├── db/                # Drizzle schema + libsql (Turso) client — created on demand
├── lib/               # shared setup, created on demand (e.g. Eden client, AI model config)
└── styles.css
```

`src/components/`, `src/hooks/`, `src/stores/`, `src/utils/` are created on demand when something is genuinely shared across features.

## `~` alias (relative paths forbidden)

> Also enforced by PostToolUse hook in `.claude/settings.json`

```typescript
// CORRECT
import { useProducts } from "~/features/products/hooks/use-products";
import type { Product } from "~/features/products/types/product";

// WRONG: relative paths — forbidden even within the same directory
import { useProducts } from "../hooks/use-products";
import { helper } from "./helper";
```

## Feature inter-dependencies forbidden

```typescript
// WRONG: feature importing directly from another feature
// src/features/orders/components/order-form.tsx
import { UserSelect } from "~/features/users/components/user-select";

// CORRECT: extract to src/components/
import { UserSelect } from "~/components/user-select";
```

## Routes & default exports

Route files (`src/routes/**/*.tsx`) use `export const Route = createFileRoute(...)` — a named export, so no default export is needed. The `no-default-export` lint rule is turned off only for `src/router.tsx` and `*.config.ts` in `vite.config.ts`. (Routes get a _separate_ override that relaxes react-doctor's multi-component rules — not `no-default-export`.)

```typescript
// src/routes/index.tsx — named export, no default export
export const Route = createFileRoute("/")({
  component: Home,
});
```
