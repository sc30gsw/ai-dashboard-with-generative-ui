import { tool, type ToolSet } from "ai";
import { Result } from "better-result";

import { WeatherService } from "~/features/weather/api/weather-service";
import { GetWeatherInputSchema } from "~/features/weather/schemas/weather-schema";
import { getWeatherTool } from "~/features/weather/tools/get-weather";

//* AI SDK アダプタ（パターン A: モデル駆動の読み取り）。read-only のため needsApproval は常に false。
//* Eden 経由の getWeatherTool.run とは異なり、WeatherService をサーバー側でインプロセス実行する。
export const weatherChatTools = {
  get_weather: tool({
    description: getWeatherTool.description,
    inputSchema: GetWeatherInputSchema,
    needsApproval: false,
    execute: async (input) => {
      const result = await WeatherService.get(input);

      if (Result.isError(result)) {
        return { message: result.error.message, status: "error" as const };
      }

      return { report: result.value, status: "success" as const };
    },
  }),
} as const satisfies ToolSet;
