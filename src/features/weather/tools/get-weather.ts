import {
  GetWeatherInputSchema,
  WeatherReportSchema,
  type GetWeatherInput,
} from "~/features/weather/schemas/weather-schema";
import { edenClient } from "~/lib/eden";
import type { ToolDefinition, ToolProviderMap } from "~/types/tool";

export type WeatherToolProviderMap = ToolProviderMap;

type WeatherTool = ToolDefinition<
  WeatherToolProviderMap[string],
  typeof GetWeatherInputSchema,
  typeof WeatherReportSchema
>;

//? Query() 経由の read パス（toolProvider）はチャットのリクエストボディ（chat.ts の location）を
//? 経由しないため、AI SDK 側の resolveCoordinates と同じ§6.1フォールバックがここには効かない。
//? モデルが city/座標を省略した場合は、この経路自身がブラウザの Geolocation に直接フォールバックする。
async function withGeolocationFallback(input: GetWeatherInput) {
  if (input.city || (input.latitude != null && input.longitude != null)) {
    return input;
  }

  const { getCurrentCoordinates } = await import("~/utils/geolocation");
  const coordinates = await getCurrentCoordinates();

  if (!coordinates) {
    return input;
  }

  return { ...input, latitude: coordinates.latitude, longitude: coordinates.longitude };
}

export const getWeatherTool = {
  additive: false,
  description:
    "Get the weather forecast for a city or coordinates on a given date (today up to 7 days ahead). city/latitude/longitude may all be omitted — the caller falls back to the browser's current location automatically. Read-only.",
  destructive: false,
  exposeToWebMcp: true,
  inputSchema: GetWeatherInputSchema,
  mutates: false,
  name: "get_weather",
  outputSchema: WeatherReportSchema,
  run: async (args) => {
    const parsed = GetWeatherInputSchema.parse(args);
    const input = await withGeolocationFallback(parsed);
    const { data, error } = await edenClient().weather.get({ query: input });

    if (error) {
      throw new Error(`get_weather failed: ${String(error.status)}`);
    }

    if (!data.ok) {
      throw new Error(data.message);
    }

    return data.report;
  },
} as const satisfies WeatherTool;
