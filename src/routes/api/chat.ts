import { gateway } from "@ai-sdk/gateway";
import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  validateUIMessages,
  type InferUITools,
  type UIDataTypes,
  type UIMessage,
} from "ai";
import { z } from "zod";

import { boardStateContext } from "~/features/chat/lib/board-state-context";
import { chatModel } from "~/features/chat/lib/model";
import { systemPrompt } from "~/features/chat/lib/system-prompt";
import { chatTools } from "~/features/tasks/tools/adapters/ai-sdk";
import { createWeatherChatTools } from "~/features/weather/tools/adapters/ai-sdk";
import { createRateLimiter } from "~/lib/rate-limit";
import { APP_DEFAULT_TIMEZONE, todayInTimeZone } from "~/lib/timezone";

if (!process.env.AI_GATEWAY_API_KEY) {
  throw new Error("AI_GATEWAY_API_KEY is required");
}

//? tasks + weather の AI SDK ツールの型合成。weatherChatTools はリクエストの座標を受け取る
//? ファクトリになったため、代表的な呼び出し（引数なし）から型だけを借用する。
//? 実行時に実際にマージするのは handleChat 内（リクエストごとの defaultCoords を渡すため）。
type AllChatTools = typeof chatTools & ReturnType<typeof createWeatherChatTools>;

//? allChatTools 由来の tool 型を持つ UIMessage。validateUIMessages へ渡して tool parts まで型安全に検証する。
type ChatMessage = UIMessage<never, UIDataTypes, InferUITools<AllChatTools>>;

const ChatRequestSchema = z.object({
  location: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
    .optional(),
  messages: z.array(z.unknown()),
  timeZone: z.string().max(64).optional(),
});

//? Gateway は有料なので、IP ごとに 1 分 20 リクエストへ制限し wallet-DoS を抑える。
//* 単一インスタンスの常駐 Node サーバー前提のインメモリ制限（rate-limit.ts の caveat 参照）。
const CHAT_RATE_LIMIT = { max: 20, windowMs: 60_000 } as const satisfies Record<string, number>;

//? x-forwarded-for はクライアントが自由に詐称できるヘッダ。これを回転させれば per-IP 制限
//? （CHAT_RATE_LIMIT）は個別キーごとにリセットされ回避されるため、全キー共有の集約ウィンドウで
//? 総スループットにも上限をかける（Sec MED-1）。
const CHAT_GLOBAL_RATE_LIMIT = { max: 60, windowMs: 60_000 } as const satisfies Record<
  string,
  number
>;

const chatRateLimiter = createRateLimiter({ ...CHAT_RATE_LIMIT, global: CHAT_GLOBAL_RATE_LIMIT });

//* プロキシ経由の実クライアント IP を取得。取れない場合は固定バケットへ集約し、
//* IP 不明でも総スループットに上限がかかるようにする。
function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    headers: { "content-type": "application/json" },
    status: 400,
  });
}

//* パターン A: モデル駆動のツール選択。Read → モデルが OpenUI Lang を出力（クライアント側で解決）。
//* Write → AI SDK ツール。破壊的操作は `needsApproval` でユーザー承認まで一時停止。
//* サーバー側ルーターやピン留めなし。
//? テストからリクエストバリデーション（400 分岐）を直接駆動できるよう export する。
export async function handleChat({ request }: Record<"request", Request>) {
  //* Gateway を呼ぶ前にレート制限を判定し、超過時は streamText に到達させない（コスト濫用対策）。
  const limit = chatRateLimiter.check(clientKey(request));

  if (!limit.allowed) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      headers: {
        "content-type": "application/json",
        "Retry-After": String(limit.retryAfterSeconds),
      },
      status: 429,
    });
  }

  const body = await request.json().catch(() => null);
  const parsed = ChatRequestSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest("Invalid request body");
  }

  //? tasks + weather の AI SDK ツールを統合。weather 側はリクエストの座標（クライアントの
  //? Geolocation 由来）を defaultCoords として渡し、モデルが city/座標を省略した場合に
  //? フォールバックできるようにする（§6.1）。
  const allChatTools: AllChatTools = {
    ...chatTools,
    ...createWeatherChatTools(parsed.data.location),
  };

  //? LLM が出した tool parts も含め UIMessage 形状を検証。不正なら 400（security.md の境界検証）。
  const messages = await validateUIMessages<ChatMessage>({
    messages: parsed.data.messages,
    tools: allChatTools,
  }).catch(() => null);

  if (!messages) {
    return badRequest("Invalid messages");
  }

  const timeZone = parsed.data.timeZone ?? APP_DEFAULT_TIMEZONE;
  const today = todayInTimeZone(timeZone);
  const currentDateContext = `## Current date\nToday is ${today} (${timeZone}).`;

  const [modelMessages, boardState] = await Promise.all([
    convertToModelMessages(messages),
    boardStateContext(),
  ]);

  const result = streamText({
    messages: modelMessages,
    model: gateway(chatModel),
    stopWhen: stepCountIs(5),
    system: `${systemPrompt}\n\n${currentDateContext}\n\n${boardState}`,
    toolChoice: "auto",
    tools: allChatTools,
  });

  return result.toUIMessageStreamResponse();
}

export const Route = createFileRoute("/api/chat")({
  server: { handlers: { POST: handleChat } },
});
