---
description: Core coding style — naming, comments, import order, file size, immutability
globs: ["**/*.{ts,tsx,js,jsx}"]
alwaysApply: true
---

# Coding Style

Full conventions are in [CODING_GUIDELINES.md](/CODING_GUIDELINES.md) §コードスタイル and §React/TypeScript規約. The rules below highlight the most critical points and those enforced by hooks.

## Immutability

ALWAYS return new values; NEVER mutate in place:

```typescript
// CORRECT: return new copy
const updated = { ...user, name: "new name" };

// WRONG: mutates original
user.name = "new name";
```

## File size

- 200–400 lines typical
- 800 lines maximum — extract utilities when approaching this limit
- One primary responsibility per file

## Naming

| Target         | Convention       | Example                      |
| -------------- | ---------------- | ---------------------------- |
| Variables / fn | lowerCamelCase   | `userName`, `getProducts`    |
| Components     | UpperCamelCase   | `ProductList`, `LoginForm`   |
| Types          | UpperCamelCase   | `Product`, `CreateUserInput` |
| Constants      | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`            |
| Files          | kebab-case       | `product-list.tsx`           |

## Enforced bans

The following are flagged automatically. PostToolUse hooks in `.claude/settings.json` warn on Edit/Write for the first three; `console.log` is caught by oxlint via `vp check` (there is no dedicated hook for it):

- **No `interface`** — use `type` everywhere (hook)
- **No relative imports** — always use the `~/` alias, even for files in the same directory or adjacent directories (hook)
- **No `export default`** outside `src/router.tsx` and `*.config.ts` (hook; see [typescript/react-conventions.md](../typescript/react-conventions.md))
- **No `console.log`** in committed code (oxlint / `vp check`)

```typescript
// WRONG: relative paths, even when the file is right next to you
import { tenantsFixture } from "./tenants-fixture";
import { helper } from "../utils/helper";

// CORRECT: always ~
import { genuiLibrary } from "~/features/chat/genui/library";
import { addTodo } from "~/features/todos/tools/add-todo";
```
