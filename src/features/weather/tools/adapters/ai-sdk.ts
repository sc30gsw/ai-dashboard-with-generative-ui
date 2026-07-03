import { tool, type ToolSet } from "ai";
import { Result } from "better-result";

import { WeatherService } from "~/features/weather/api/weather-service";
import {
  GetWeatherInputSchema,
  type GetWeatherInput,
} from "~/features/weather/schemas/weather-schema";
import { getWeatherTool } from "~/features/weather/tools/get-weather";

//? §6.1 のフォールバックチェーン: モデルが city も座標も渡さなかった場合、リクエストの
//? デフォルト座標（クライアントの Geolocation 由来）へフォールバックし、location_required で
//? 行き止まりになるのを防ぐ。
function resolveCoordinates(
  input: GetWeatherInput,
  defaultCoords?: Record<"latitude" | "longitude", number>,
): GetWeatherInput {
  if (input.city || (input.latitude != null && input.longitude != null) || !defaultCoords) {
    return input;
  }

  return { ...input, latitude: defaultCoords.latitude, longitude: defaultCoords.longitude };
}

//* AI SDK アダプタ（パターン A: モデル駆動の読み取り）。read-only のため needsApproval は常に false。
//* Eden 経由の getWeatherTool.run とは異なり、WeatherService をサーバー側でインプロセス実行する。
export function createWeatherChatTools(defaultCoords?: Record<"latitude" | "longitude", number>) {
  return {
    get_weather: tool({
      description: getWeatherTool.description,
      inputSchema: GetWeatherInputSchema,
      needsApproval: false,
      execute: async (input) => {
        const coords = resolveCoordinates(input, defaultCoords);
        const result = await WeatherService.get(coords);

        if (Result.isError(result)) {
          return { message: result.error.message, status: "error" as const };
        }

        return { report: result.value, status: "success" as const };
      },
    }),
  } as const satisfies ToolSet;
}
