import { z } from "zod";

function toDateOnlyString(date: Date) {
  return date.toISOString().slice(0, 10);
}

export const GetWeatherInputSchema = z
  .object({
    city: z.string().trim().min(1).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  })
  .refine(
    ({ date }) => {
      const today = toDateOnlyString(new Date());
      const maxDate = toDateOnlyString(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

      return date >= today && date <= maxDate;
    },
    {
      error: "日付は今日から7日先までの範囲で指定してください。",
      path: ["date"],
    },
  );

export type GetWeatherInput = z.infer<typeof GetWeatherInputSchema>;

const DailyWeatherSchema = z.object({
  date: z.string(),
  precipitationProbability: z.number().min(0).max(100),
  summary: z.string(),
  tempMax: z.number(),
  tempMin: z.number(),
  weatherCode: z.number(),
});

export const WeatherReportSchema = z.object({
  daily: z.array(DailyWeatherSchema).max(7),
  date: z.string(),
  locationLabel: z.string(),
  precipitationProbability: z.number().min(0).max(100),
  summary: z.string(),
  tempMax: z.number(),
  tempMin: z.number(),
  weatherCode: z.number(),
});

export type WeatherReport = z.infer<typeof WeatherReportSchema>;
