---
description: Secret handling, input validation via Zod, XSS safety
globs: ["**/*.{ts,tsx}"]
alwaysApply: true
---

# Security

## Secrets

NEVER hardcode secrets, tokens, or credentials in source files.

```typescript
// CORRECT: client-safe value (VITE_ prefix, inlined into the bundle)
const apiKey = import.meta.env.VITE_API_KEY;
if (!apiKey) throw new Error("VITE_API_KEY is required");

// CORRECT: server-only secret — read on the server, NO VITE_ prefix, never in the client bundle.
// The LLM is reached through the Vercel AI Gateway; the gateway key lives only on the server.
const gatewayKey = process.env.AI_GATEWAY_API_KEY;
if (!gatewayKey) throw new Error("AI_GATEWAY_API_KEY is required");

// WRONG: hardcoded secret
const apiKey = "sk-abc123...";
```

### dotenvx environment management

- **Commit `.env`, `.env.development`, `.env.production`, and `.env.local` while they remain encrypted** (`encrypted:...` format; safe even if an AI reads them).
- **Never commit `.env.keys` or share it in plain text** (it is gitignored).
- When adding a new variable, use `vp run env:set NEW_VAR "value" -f .env.development` (do not hand-write `encrypted:` values).
- `import.meta.env.VITE_*` is decrypted and inlined at build time by dotenvx, so **plain values end up in the client bundle**—follow the `VITE_` prefix convention.
- **Server-only values** (e.g. `SESSION_SECRET`) have **no** `VITE_` prefix. Read them with `process.env.SESSION_SECRET` and **do not** expose them via `import.meta.env`.
- **Fail fast:** if a required env var is `undefined`, **throw at startup** with `throw new Error(...)` (keep the same pattern as existing code).

## Input validation

ALWAYS validate user input and external data (AI tool args, request bodies, LLM output destined for a tool) at system boundaries using Zod. See [typescript/zod-validation.md](../typescript/zod-validation.md) for schema patterns.

```typescript
// CORRECT: validate before use
const result = MessageSchema.safeParse(rawInput);
if (!result.success) throw new Error(result.error.message);
const message = result.data;

// WRONG: trusting unvalidated external data
const message = rawInput as Message;
```

## XSS

Avoid `dangerouslySetInnerHTML`. If HTML rendering is unavoidable, sanitize the input first with a trusted library. In custom OpenUI `defineComponent` components, never feed model- or user-derived content into `dangerouslySetInnerHTML` — rely on React's default escaping.

## LLM-output-driven execution (Generative UI Pattern B)

In Pattern B the model emits OpenUI Lang containing `Query()` / `Mutation()` nodes that the client `toolProvider` resolves. Treat the model's output as an **untrusted action source**:

- **`Mutation` args are untrusted.** Validate every tool argument with Zod **at both** the tool boundary **and** the Elysia route — the LLM emits these, so the double check is intentional (LLM → tool → HTTP → route).
- **`Mutation` runs only on an explicit user gesture (a click), never at render time.** `Query` (read-only) may auto-resolve. This keeps human-in-the-loop and prevents surprise writes from generated markup.
- **Never expose unguarded destructive actions as Web MCP tools.** A tool only does what a user could already do; destructive actions keep their confirmation. See [../web/web-mcp.md](../web/web-mcp.md).
- **Stored prompt injection:** free-text fields (e.g. task titles) fed back into model context can carry injected instructions. Blast radius is small for a single-user local app, but design tools so they can only do what the user could do anyway. See [../web/generative-ui.md](../web/generative-ui.md).
