import { treaty } from "@elysiajs/eden";

import type { App } from "~/routes/api/$";

//* クライアント安全な Eden エントリ: `App` は type-only import のため、サーバーコード
//* （Elysia / Drizzle / libsql）はクライアントバンドルに含まれない。
//* UI ボタン、Web MCP tool `execute`、OpenUI `toolProvider` が共通で使用する単一パス。
export function edenClient() {
  const origin = typeof window === "undefined" ? process.env.API_URL : window.location.origin;

  return treaty<App>(origin ?? "http://localhost:3000").api;
}
