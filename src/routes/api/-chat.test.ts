import { Result } from "better-result";
import { beforeEach, expect, test, vi } from "vite-plus/test";

//? chat.ts は TaskService 経由で db クライアント（drizzle/libsql）を読み込む。
//? テスト環境では DATABASE_URL が dotenvx の暗号値のままで実クライアント生成が失敗するため、
//? TaskService をモックして db モジュールの読み込み自体を回避する（weather-routes.test.ts と同じ手法）。
vi.mock("~/features/tasks/api/task-service", () => ({
  TaskService: { list: async () => Result.ok([]) },
}));

//? streamText/Gateway に到達させず、リクエストボディの Zod 検証（400 分岐）だけを駆動する。
beforeEach(() => {
  process.env.AI_GATEWAY_API_KEY = "test-key";
});

function postChat(body: unknown) {
  return new Request("http://localhost/api/chat", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

test("rejects a request with latitude out of range (200) with 400", async () => {
  const { handleChat } = await import("~/routes/api/chat");

  const response = await handleChat({
    request: postChat({
      location: { latitude: 200, longitude: 139.77 },
      messages: [],
    }),
  });

  expect(response.status).toBe(400);
});

test("rejects a request with longitude out of range (-200) with 400", async () => {
  const { handleChat } = await import("~/routes/api/chat");

  const response = await handleChat({
    request: postChat({
      location: { latitude: 35.68, longitude: -200 },
      messages: [],
    }),
  });

  expect(response.status).toBe(400);
});

test("rejects a request with a non-array messages field with 400", async () => {
  const { handleChat } = await import("~/routes/api/chat");

  const response = await handleChat({
    request: postChat({ messages: "not-an-array" }),
  });

  expect(response.status).toBe(400);
});
