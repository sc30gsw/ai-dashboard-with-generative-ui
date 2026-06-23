import { treaty } from "@elysiajs/eden";
import { openapi } from "@elysiajs/openapi";
import { createFileRoute } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { Elysia } from "elysia";
import { z } from "zod";

import { taskRoutes } from "~/features/tasks/api/task-routes";

const app = new Elysia({ prefix: "/api" })
  .use(openapi({ mapJsonSchema: { zod: z.toJSONSchema } }))
  .use(taskRoutes);

export type App = typeof app;

const handle = ({ request }: Record<"request", Request>) => app.fetch(request);

export const Route = createFileRoute("/api/$")({
  server: { handlers: { GET: handle, POST: handle } },
});

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
