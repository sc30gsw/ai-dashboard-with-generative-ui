import { drizzle } from "drizzle-orm/libsql";

import { tasks } from "~/db/schema";

const databaseUrl =
  process.env.DATABASE_URL ??
  (process.env.NODE_ENV === "production" ? undefined : "file:./local.db");

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required in production");
}

export const db = drizzle({
  connection: {
    authToken: process.env.DATABASE_AUTH_TOKEN,
    url: databaseUrl,
  },
  schema: { tasks },
});
