---
description: Zod as the single validator — schemas, z.infer, boundaries, TanStack Form (Standard Schema)
globs: ["src/**/*.{ts,tsx}"]
alwaysApply: true
---

# Zod Validation

This project uses **Zod** as its single validation library. (Earlier drafts referenced Valibot — that was dropped because OpenUI's `defineComponent` hardcodes Zod schemas, and running two validators splits the bundle and the mental model.)

This extends to the backend: Elysia's built-in TypeBox (`t`) is deliberately **not** used. Elysia consumes Zod directly through **Standard Schema** (Elysia ≥ 1.4), so the whole stack stays on one validator. See [web/backend-elysia-drizzle.md](../web/backend-elysia-drizzle.md).

## Placement: `features/*/schemas/`

Each feature owns its schemas:

```
src/features/chat/schemas/
└── message-schema.ts
```

## Derive types with `z.infer`

Define the schema once; derive the type from it.

```typescript
import { z } from "zod";

export const CreateMessageSchema = z.object({
  body: z.string().min(1, "本文は必須です"),
  role: z.enum(["user", "assistant"]),
});

export type CreateMessageInput = z.infer<typeof CreateMessageSchema>;
```

## Where Zod applies (boundaries only)

Validate at system boundaries. Do **not** validate pure internal transformations.

| Boundary                 | How Zod is used                                                                                                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenUI components        | `defineComponent({ props: z.object({...}) })` — **mandatory**, hardcoded by OpenUI ([web/generative-ui.md](../web/generative-ui.md))                                        |
| Web MCP tools            | author `inputSchema` in Zod, convert with `z.toJSONSchema()` ([web/web-mcp.md](../web/web-mcp.md))                                                                          |
| TanStack Form            | pass the Zod schema directly — see below                                                                                                                                    |
| Server routes / AI tools | parse incoming JSON before use                                                                                                                                              |
| Elysia routes            | pass the Zod schema directly via Standard Schema — no adapter, no TypeBox (`t`) ([web/backend-elysia-drizzle.md](../web/backend-elysia-drizzle.md))                         |
| Drizzle schemas          | derive Zod with `drizzle-zod` (`createInsertSchema` / `createSelectSchema`) — **not** `drizzle-typebox` ([web/backend-elysia-drizzle.md](../web/backend-elysia-drizzle.md)) |

## TanStack Form (Standard Schema — no adapter)

TanStack Form v1 consumes **Standard Schema** validators natively. Zod implements Standard Schema, so pass the schema straight to `validators` — no `@tanstack/*-adapter`.

```typescript
import { useForm } from "@tanstack/react-form";
import { CreateMessageSchema } from "~/features/chat/schemas/message-schema";

export function MessageForm({ onSuccess }: Record<"onSuccess", () => void>) {
  const form = useForm({
    defaultValues: { body: "", role: "user" as const },
    validators: { onChange: CreateMessageSchema },
    onSubmit: async ({ value }) => {
      /* ... */ onSuccess();
    },
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit(); }}>
      <form.Field name="body">
        {(field) => (
          <input
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            value={field.state.value}
          />
          {/* render field.state.meta.errors[0]?.message below the input */}
        )}
      </form.Field>
    </form>
  );
}
```

## Related rules

- [web/generative-ui.md](../web/generative-ui.md) — Zod is mandatory for OpenUI props
- [web/web-mcp.md](../web/web-mcp.md) — tool `inputSchema`
- [web/backend-elysia-drizzle.md](../web/backend-elysia-drizzle.md) — Elysia (Standard Schema) + `drizzle-zod`
- [common/security.md](../common/security.md) — why boundary validation matters
