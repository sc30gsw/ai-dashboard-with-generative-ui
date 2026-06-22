import { treaty } from "@elysiajs/eden";
import { openapi } from "@elysiajs/openapi";
import { createFileRoute } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { Elysia } from "elysia";
import { z } from "zod";

import { taskRoutes } from "~/features/tasks/api/task-routes";

// Zod has no native JSON Schema method on the schema, so map it for OpenAPI.
// UI at /api/openapi, spec at /api/openapi/json.
const app = new Elysia({ prefix: "/api" })
  .use(openapi({ mapJsonSchema: { zod: z.toJSONSchema } }))
  .use(taskRoutes);

export type App = typeof app;

const handle = ({ request }: Record<"request", Request>) => app.fetch(request);

// TODO(verify): confirm the server-route shape (`server.handlers`) against the
// installed TanStack Start version — taken from the official Elysia integration doc.
export const Route = createFileRoute("/api/$")({
  server: { handlers: { GET: handle, POST: handle } },
});

// Isomorphic Eden client for server-side use (loaders): direct call, no HTTP.
// Client-side callers (tools / toolProvider) use `~/lib/eden` to avoid bundling Elysia.
export const getTreaty = createIsomorphicFn()
  .server(() => treaty(app).api)
  .client(
    () =>
      treaty<App>(
        typeof window === "undefined"
          ? (process.env.API_URL ?? "http://localhost:3000")
          : window.location.origin,
      ).api,
  );
