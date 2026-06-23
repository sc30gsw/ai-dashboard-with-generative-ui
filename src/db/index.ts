import { drizzle } from "drizzle-orm/libsql";

import { tasks } from "~/db/schema";

export const db = drizzle({
  connection: {
    authToken: process.env.DATABASE_AUTH_TOKEN,
    url: process.env.DATABASE_URL ?? "file:./local.db",
  },
  schema: { tasks },
});
