---
description: Styling — Tailwind v4 utilities, HeroUI app chrome, react-ui precompiled CSS, cn() (cnfast) boundary
globs: ["src/**/*.{ts,tsx,css}"]
alwaysApply: true
---

# Styling

Styling uses three layers with clear boundaries:

- **Tailwind CSS v4** — layout, spacing, and utility classes on app chrome wrappers
- **HeroUI (`@heroui/react` + `@heroui/styles`)** — dashboard shell, tables, cards, forms, and non-Generative task pages
- **OpenUI react-ui precompiled CSS** — Generative UI components rendered by `<Renderer>` (see [web/generative-ui.md](./generative-ui.md))

Do not mix HeroUI styling into OpenUI-generated markup or vice versa.

## HeroUI CSS

Import HeroUI styles immediately after Tailwind in `src/styles.css`:

```css
@import "tailwindcss";
@import "@heroui/styles";
```

HeroUI v3 does not require a Provider wrapper.

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
