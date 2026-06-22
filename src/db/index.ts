import { drizzle } from "drizzle-orm/libsql";

import { tasks } from "~/db/schema";

// Turso Cloud / libSQL driver (drizzle-orm/libsql) — see Drizzle "connect-turso".
// Local dev: DATABASE_URL=file:./local.db (authToken unset). Cloud: libsql:// + authToken.
export const db = drizzle({
  connection: {
    authToken: process.env.DATABASE_AUTH_TOKEN,
    url: process.env.DATABASE_URL ?? "file:./local.db",
  },
  schema: { tasks },
});
