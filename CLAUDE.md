# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

**Purpose:** Experimental project to catch up on Generative UI and Web MCP — designing web interfaces where humans and AI agents collaborate (AI acts as both a content _producer_ = Generative UI and _consumer_ = Web MCP). Planned UI direction: [OpenUI](https://www.openui.com/docs/openui-lang/quickstart). Background talk: ["How the frontend's counterpart changed — interface design for an AI-augmented web" (azukiazusa, slides)](https://speakerdeck.com/azukiazusa1/hurontoendonoxiang-shou-gabian-watuta-aigajia-watutawebnoxin-siiintahuesushe-ji).

**Current state vs. target:** This repo is an early-stage **TanStack Start starter** — only `src/routes/`, `src/router.tsx`, and a `cn` smoke test exist. The architecture and libraries described in `.claude/rules/**` and `CODING_GUIDELINES.md` (OpenUI — react-lang / react-headless / react-ui —, Zod, better-result, the Vercel AI SDK, Web MCP, the `features/` layout, etc.) are **target conventions to adopt as features are built — they are NOT in the codebase yet.** Before importing from `~/features/*`, OpenUI (`@openuidev/*`), etc., verify the module actually exists; if it does not, scaffold it following the matching rule.

**Current stack:** TanStack Start + Router, React 19 (React Compiler enabled via Babel), Tailwind CSS v4, `cn` from the `cnfast` package (not `~/lib/utils`). Toolchain is Vite+ (`vp`, see @AGENTS.md). Node ≥ 24.17. The `~` → `src` alias is configured in `tsconfig.json` and `vite.config.ts`.

**Agreed architecture (target, mostly unbuilt):** see [`requirement.md`](./requirement.md) — the agreed specification and single source of truth for the decisions below.

- **API layer:** Elysia, mounted inside TanStack Start at `src/routes/api.$.ts` via `app.fetch(request)` (runs on **Node**, not a standalone Bun server); client access via **Eden Treaty**.
- **Data:** Drizzle ORM + Turso (libsql); schema↔validation bridge via `drizzle-zod`. Zod stays the single validator (Elysia consumes Zod via Standard Schema — no TypeBox).
- **LLM:** Vercel AI Gateway (`AI_GATEWAY_API_KEY`, server-only); model `anthropic/claude-haiku-4.5` kept in one config constant (swappable to `anthropic/claude-sonnet-4.5`).
- **Generative UI:** Pattern B — operable UI via OpenUI `toolProvider`; `streamText` runs without server-side tools and emits OpenUI Lang.
- **Toolchain:** pnpm + Vite+ (`vp`) retained; **Bun is explicitly NOT adopted.**

## Behavioral Guidelines

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

@AGENTS.md
