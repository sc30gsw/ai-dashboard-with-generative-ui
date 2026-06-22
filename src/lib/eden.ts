import { treaty } from "@elysiajs/eden";

import type { App } from "~/routes/api/$";

// Client-safe Eden entry: `App` is a type-only import, so no server code
// (Elysia / Drizzle / libsql) is pulled into the client bundle. Used by the
// UI buttons, Web MCP tool `execute`, and the OpenUI `toolProvider` — one path.
export function edenClient() {
  const origin = typeof window === "undefined" ? process.env.API_URL : window.location.origin;

  return treaty<App>(origin ?? "http://localhost:3000").api;
}
