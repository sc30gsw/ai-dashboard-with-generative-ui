import type { useWebMCP } from "@mcp-b/react-webmcp";
import type { RendererProps } from "@openuidev/react-lang";

import {
  GetWeatherInputSchema,
  WeatherReportSchema,
} from "~/features/weather/schemas/weather-schema";

type WeatherToolProviderMap = Extract<
  NonNullable<RendererProps["toolProvider"]>,
  Record<string, unknown>
>;

type WeatherTool = Pick<Parameters<typeof useWebMCP>[0], "description" | "name"> & {
  additive: boolean;
  destructive: boolean;
  exposeToWebMcp: boolean;
  inputSchema: typeof GetWeatherInputSchema;
  mutates: boolean;
  outputSchema: typeof WeatherReportSchema;
  run: WeatherToolProviderMap[string];
};

export const getWeatherTool = {
  additive: false,
  description:
    "Get the weather forecast for a city or coordinates on a given date (today up to 7 days ahead). Read-only.",
  destructive: false,
  exposeToWebMcp: true,
  inputSchema: GetWeatherInputSchema,
  mutates: false,
  name: "get_weather",
  outputSchema: WeatherReportSchema,
  run: async (args) => {
    const input = GetWeatherInputSchema.parse(args);
    const { edenClient } = await import("~/lib/eden");
    const { data, error } = await edenClient().weather.get.post(input);

    if (error) {
      throw new Error(`get_weather failed: ${String(error.status)}`);
    }

    if (!data.ok) {
      throw new Error(data.message);
    }

    return data.report;
  },
} as const satisfies WeatherTool;
