import { getWeatherTool, type WeatherToolProviderMap } from "~/features/weather/tools/get-weather";

export type { WeatherToolProviderMap };

//* OpenUI toolProvider アダプタ: read 専用ツール（get_weather）のみを公開。
//* Query() の自動解決に使う。
export function createWeatherReadToolMap() {
  return {
    [getWeatherTool.name]: (args) => getWeatherTool.run(args),
  } satisfies WeatherToolProviderMap;
}
