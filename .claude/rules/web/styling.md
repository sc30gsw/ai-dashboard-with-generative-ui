---
description: Styling — HeroUI v3 primary component kit (incl. chat + OpenUI custom components), Tailwind v4 for layout, cn() (cnfast)
globs: ["src/**/*.{ts,tsx,css}"]
alwaysApply: true
---

# Styling

HeroUI (`@heroui/react` v3) is the **primary component kit** for this project. Use it as much as possible for UI elements (buttons, inputs, selects, tables, cards, chips, spinners, dialogs, etc.) across **all** layers:

- **App chrome / dashboard / task pages** — HeroUI.
- **Chat React components** (`src/features/chat/components/*`) — HeroUI.
- **OpenUI custom `defineComponent` components** (rendered by `<Renderer>`) — HeroUI too.

Tailwind CSS v4 + `cn` (from `cnfast`) remain for **layout and spacing only** (flex/grid, gaps, widths) on wrapper elements. Don't hand-roll buttons/inputs/tables with raw Tailwind when a HeroUI component exists.

## CSS imports (`src/styles.css`)

```css
@import "tailwindcss";
@import "@heroui/styles";
```

HeroUI v3 does not require a Provider wrapper. `@openuidev/react-ui` precompiled CSS is still imported once at app entry for the model-emitted OpenUI nodes.

## HeroUI inside the OpenUI `<Renderer>`

The app theme (HeroUI) is **light**; the OpenUI react-ui default Card is **dark**. So a HeroUI custom component rendered **inside** a react-ui `Card` clashes. Rule:

- Custom HeroUI `defineComponent` components must be **self-contained** — they provide their own HeroUI `Card` surface and must NOT be wrapped in an OpenUI `Card`.
- The chat **system prompt** emits such components at the **root** (e.g. `root = TaskList(tasks)`), never inside `Card([...])`.

(Model-emitted react-ui nodes like `Callout` / `TextContent` still render with react-ui's CSS; migrate them to HeroUI custom components over time if a consistent light theme is desired.)

## HeroUI v3 API notes (ground new usage in existing components)

v3 differs from v2/common examples. Copy patterns from the repo:

- `Button` — `onPress` (not `onClick`), `variant`, `size`. (`task-list-filters.tsx`)
- `Input` — `value`, `onChange={(e) => ...}`. (`task-list-filters.tsx`)
- `Select` — compound: `<Select value onChange={(key) => ...}><Select.Trigger><Select.Value/><Select.Indicator/></Select.Trigger><Select.Popover><ListBox><ListBox.Item id textValue>…</ListBox.Item></ListBox></Select.Popover></Select>`. (`task-list-filters.tsx`)
- `Chip` — `<Chip color={"danger"|"warning"|"success"|"default"|"accent"} size variant><Chip.Label>…</Chip.Label></Chip>`. (`priority-chip.tsx`, `task-table.tsx`)
- `Table` — compound: `<Table><Table.ScrollContainer><Table.Content aria-label><Table.Header><Table.Column isRowHeader>…</Table.Column></Table.Header><Table.Body items={rows}>{(row) => <Table.Row id={row.id}><Table.Cell>…</Table.Cell></Table.Row>}</Table.Body></Table.Content></Table.ScrollContainer></Table>`. (`task-table.tsx`)
- `Card` — `<Card><Card.Header><Card.Title>…</Card.Title></Card.Header><Card.Content>…</Card.Content></Card>`. (`task-list-page.tsx`)

## `cn()` from `cnfast`

Use `cn()` for layout/spacing classes on wrappers. `cn` is registered in oxfmt's `sortTailwindcss.functions` (see `vite.config.ts`), so class order is auto-sorted.

## Tailwind v4

Tailwind is wired through the `@tailwindcss/vite` plugin — no `tailwind.config.js`. Use CSS-first config (`@theme` in `src/styles.css`) for custom tokens.

## Related rules

- [web/generative-ui.md](./generative-ui.md) — custom `defineComponent` components (now HeroUI-based)
- [common/coding-style.md](../common/coding-style.md) — naming, immutability
