# Elysia Best Practice (adapted)

> Based on the official [Elysia Best Practice](https://elysiajs.com/essential/best-practice) (controller / service / model), **adapted** to this project's standards: **Zod single validator**, **better-result**, and the `features/` layout. Where the official guide and our standards differ, our standards win — the differences are called out below.

Elysia is pattern-agnostic. We apply its controller/service/model split, mapped onto our feature folders.

## Controller — the Elysia instance _is_ the controller

**1 Elysia instance = 1 controller.** Define routes directly on the instance so Elysia infers `Context` automatically.

- Lives at `src/features/<feature>/api/<feature>-routes.ts`; mounted in `src/routes/api.$.ts` via `app.fetch` (see [backend-elysia-drizzle.md](./backend-elysia-drizzle.md)).
- ❌ Do **not** create a separate controller class tied to Elysia's `Context` (complex/unstable types → loss of type integrity).
- ❌ Do **not** pass the whole `Context` to a function — destructure only what you need (`{ body }`, `{ params }`, …).

```ts
// ✅ controller = Elysia instance; convert Result → HTTP at the boundary
export const taskRoutes = new Elysia({ prefix: "/tasks" }).post(
  "/add",
  async ({ body }) => {
    const result = await addTask(body); // service returns a Result
    return Result.isError(result)
      ? { ok: false as const, message: result.error.message }
      : { ok: true as const, task: result.value };
  },
  { body: CreateTaskSchema },
); // Zod via Standard Schema
```

## Service — co-located with the controller (`api/`)

- An Elysia feature's service **co-locates with its controller** in `src/features/<feature>/api/<feature>-service.ts` (Elysia Best Practice module style: controller + service together). Do **not** split it into `lib/` — `lib/` is for non-Elysia feature helpers (system prompts, model config).
- **Non-request-dependent** logic (DB, pure logic) → plain functions, decoupled from Elysia's `Context` (never take `Context`).
- Wrap fallible work in **better-result** ([better-result.md](../typescript/better-result.md)). **Do NOT `throw status()` from the service** (the official guide does — we don't). The service returns a `Result`; the **controller** converts it to a plain HTTP body/status at the boundary. Never leak `Result`/`Error`/class instances over the wire.
- **Request-dependent** service (needs cookies/headers/`Context`) → an Elysia instance plugin (`macro` / `resolve` / `decorate`), `.use()`d by the controller. `decorate` only request-dependent props (e.g. `requestIP`, `session`) — overusing decorators ties code to Elysia.

## Model — Zod (single source of truth)

- Models/DTOs = **Zod** schemas in `src/features/<feature>/schemas/<feature>-schema.ts`, passed directly to `body`/`query`/`params` via **Standard Schema**.
- ❌ Do **not** use Elysia `t` / TypeBox, and **not** Elysia's TypeBox reference-model injection (`.model()` + `body: 'name'`) — both are TypeBox-bound. See [zod-validation.md](../typescript/zod-validation.md).
- One schema is the single source for runtime validation **and** types (`z.infer`). Never declare a separate `interface`/class for the same shape.

## Testing

Test a controller by driving the Elysia instance directly: `await app.handle(new Request("http://localhost/api/tasks/list"))`. Import test utils from `vite-plus/test` (see [common/testing.md](../common/testing.md)).

## Summary of deviations from the official guide

| Official Elysia guide                        | This project                                                 |
| -------------------------------------------- | ------------------------------------------------------------ |
| Model via `Elysia.t` (TypeBox)               | **Zod** via Standard Schema                                  |
| `throw status()` in services                 | **better-result**; convert `Result` → HTTP in the controller |
| `modules/<feature>/{index,service,model}.ts` | `features/<feature>/{api/{routes,service},schemas}/`         |

## Related rules

- [web/backend-elysia-drizzle.md](./backend-elysia-drizzle.md) — Elysia mount, Eden, Drizzle/Turso
- [typescript/zod-validation.md](../typescript/zod-validation.md) — Zod single validator
- [typescript/better-result.md](../typescript/better-result.md) — Result at boundaries
- [typescript/project-structure.md](../typescript/project-structure.md) — `features/` layout
