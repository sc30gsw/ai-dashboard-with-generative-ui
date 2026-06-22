---
description: Vite+ (vp) command conventions, forbidden alternatives, PR pre-check flow
globs: []
alwaysApply: false
---

# Development Workflow

## Commands

All development operations go through **`vp`** (Vite+). Never call `pnpm`, `npm`, or `yarn` directly.

| Command                        | Purpose                                                          |
| ------------------------------ | ---------------------------------------------------------------- |
| `vp dev`                       | Start dev server                                                 |
| `vp build`                     | Production build                                                 |
| `vp check`                     | Format + lint + typecheck (add `--fix` to auto-fix)              |
| `vp fix`                       | Auto-fix format and lint issues                                  |
| `vp test`                      | Run tests (Vitest)                                               |
| `vp lint`                      | Lint only (oxlint)                                               |
| `vp install`                   | Install dependencies                                             |
| `vp add <pkg>`                 | Add a dependency                                                 |
| `vp remove <pkg>`              | Remove a dependency                                              |
| `vp run fallow`                | Detect unused code, duplication, circular deps, and complexity   |
| `vp run fallow:dead-code`      | Detect unused files, exports, and dependencies (knip equivalent) |
| `vp run doctor`                | React-focused health checks                                      |
| `vp exec drizzle-kit generate` | Generate SQL migrations from the Drizzle schema                  |
| `vp exec drizzle-kit migrate`  | Apply migrations to the Turso (libsql) database                  |
| `vp exec drizzle-kit push`     | Push the schema directly (dev convenience)                       |

> **Stack note:** Elysia (API layer, mounted on Node in a TanStack Start server route) and Eden (its type-safe client) are part of the stack. Drizzle + Turso is the database layer. The package manager stays **pnpm**, the toolchain stays **Vite+** — **Bun is not adopted**, and direct package-manager calls remain forbidden (below).

## Forbidden

```
// WRONG: direct package manager calls
pnpm install
npm run build

// WRONG: vp subcommands that do not exist
vp vitest
vp oxlint

// WRONG: importing from vite or vitest directly
import { defineConfig } from 'vite'
import { expect } from 'vitest'

// CORRECT: import from vite-plus
import { defineConfig } from 'vite-plus'
import { expect } from 'vite-plus/test'
```

Use `vp dlx` instead of `npx` or `pnpm dlx`.

## PR pre-check

Before opening a PR, run:

```bash
vp check          # format + lint + typecheck
vp test           # all unit tests
vp run fallow:dead-code   # when removing or renaming exports
vp build          # confirms production build succeeds
```
