import { treaty } from "@elysiajs/eden";

import type { App } from "~/routes/api/$";

export function edenClient() {
  if (typeof window !== "undefined") {
    return treaty<App>(window.location.origin).api;
  }

  const apiUrl = process.env.API_URL;

  if (!apiUrl && process.env.NODE_ENV === "production") {
    throw new Error("API_URL is required on the server in production");
  }

  return treaty<App>(apiUrl ?? "http://localhost:3000").api;
}
