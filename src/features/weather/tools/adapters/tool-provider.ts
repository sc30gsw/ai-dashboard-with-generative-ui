import type { RendererProps } from "@openuidev/react-lang";

import { getWeatherTool } from "~/features/weather/tools/get-weather";

type WeatherToolProviderMap = Extract<
  NonNullable<RendererProps["toolProvider"]>,
  Record<string, unknown>
>;

//* OpenUI toolProvider アダプタ: read 専用ツール（get_weather）のみを公開。
//* Query() の自動解決に使う。
export function createWeatherReadToolMap() {
  return {
    [getWeatherTool.name]: (args) => getWeatherTool.run(args),
  } satisfies WeatherToolProviderMap;
}
