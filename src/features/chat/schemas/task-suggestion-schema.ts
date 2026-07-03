import { z } from "zod";

const taskSuggestionItemSchema = z.object({
  id: z.string().describe("Task id"),
  title: z.string().describe("Task title"),
  priority: z.enum(["low", "medium", "high"]).describe("Priority level"),
  location: z
    .enum(["indoor", "outdoor"])
    .nullable()
    .describe("Where the task takes place, or null if not location-specific"),
  reason: z.string().describe("Short explanation for this item's position, e.g. weather-driven"),
});

//? get_weather の Query 結果をそのまま第2引数として受け取れるサブセット。
//? 位置引数は Zod スキーマの宣言順にバインドされるため、items が先頭・weather が2番目。
const taskSuggestionWeatherSchema = z.object({
  date: z.string().describe("ISO date (YYYY-MM-DD) the suggestion targets"),
  locationLabel: z.string().describe("Human-readable location name, e.g. '東京都'"),
  summary: z.string().describe("Short weather summary, e.g. '晴れ' or '雨'"),
  tempMax: z.number().describe("Maximum temperature in Celsius"),
  tempMin: z.number().describe("Minimum temperature in Celsius"),
  precipitationProbability: z
    .number()
    .describe("Precipitation probability as a percentage (0-100)"),
  humidity: z.number().optional().describe("Mean relative humidity as a percentage (0-100)"),
  weatherCode: z.number().describe("WMO weather code, used to choose a display icon"),
});

export const taskSuggestionPropsSchema = z.object({
  items: z
    .array(taskSuggestionItemSchema)
    .describe("Weather-aware suggested task order, ranked in display order"),
  weather: taskSuggestionWeatherSchema
    .optional()
    .describe(
      "Weather report for the suggested day — pass the get_weather Query result. Omit when weather data was unavailable.",
    ),
});

export type TaskSuggestionItem = z.infer<typeof taskSuggestionItemSchema>;
export type TaskSuggestionWeather = z.infer<typeof taskSuggestionWeatherSchema>;
