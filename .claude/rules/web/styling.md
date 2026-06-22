---
description: Styling — Tailwind v4 utilities, react-ui precompiled CSS, cn() (cnfast) boundary
globs: ["src/**/*.{ts,tsx,css}"]
alwaysApply: true
---

# Styling

No standalone design-system component library. Styling = **Tailwind CSS v4** for layout/utilities + **react-ui's precompiled CSS** for the generative-UI components (see [web/generative-ui.md](./generative-ui.md)).

## react-ui CSS

`@openuidev/react-ui` ships **precompiled CSS** — it does not require your Tailwind config or a specific Tailwind version. Import it once at app entry:

```ts
// src/routes/__root.tsx (or the app entry)
import "@openuidev/react-ui/index.css";
```

react-ui also exposes layered style exports (e.g. `@openuidev/react-ui/layered/styles/index.css`) for finer control over CSS layer ordering against Tailwind. Keep all such imports in one place.

## `cn()` from `cnfast`

Use `cn()` (from `cnfast`) to compose Tailwind classes — last-wins conflict resolution. Apply it on wrapper / layout elements; don't fight a component library's internals with arbitrary selectors.

```tsx
import { cn } from "cnfast";
import type { ReactNode } from "react";

// CORRECT: Tailwind for layout on a container
export function Section({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("flex flex-col gap-4", className)}>{children}</section>;
}
```

`cn` is registered in oxfmt's `sortTailwindcss.functions` (see `vite.config.ts`), so class order inside `cn(...)` is auto-sorted on save.

## Tailwind v4

Tailwind is wired through the `@tailwindcss/vite` plugin — there is **no `tailwind.config.js`**. Use CSS-first config (`@theme` in `src/styles.css`) for custom design tokens.

## Related rules

- [web/generative-ui.md](./generative-ui.md) — the react-ui components being styled
- [common/coding-style.md](../common/coding-style.md) — naming, immutability, hook-backed bans
