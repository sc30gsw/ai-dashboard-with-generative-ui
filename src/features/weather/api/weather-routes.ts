import { Result } from "better-result";
import { Elysia } from "elysia";

import { WeatherService } from "~/features/weather/api/weather-service";
import { GetWeatherQuerySchema } from "~/features/weather/schemas/weather-schema";

//? 内部の WeatherError メッセージをクライアントへ漏らさないための汎用メッセージ。
const GENERIC_ERROR_MESSAGE = "操作に失敗しました。";

//? 詳細はサーバー側に残し、クライアントには汎用メッセージのみ返す。
//? 応答 SHAPE（{ ok: false, message }）は維持し、Eden クライアント / tool 側の data.ok・data.message 依存を壊さない。
function errorResponse(error: Record<"message", string>) {
  console.error("[weather-routes]", error.message);

  return { message: GENERIC_ERROR_MESSAGE, ok: false as const };
}

export const weatherRoutes = new Elysia({ prefix: "/weather" }).get(
  "/",
  async ({ query }) => {
    const result = await WeatherService.get(query);

    return Result.isError(result)
      ? errorResponse(result.error)
      : { ok: true as const, report: result.value };
  },
  { query: GetWeatherQuerySchema },
);
