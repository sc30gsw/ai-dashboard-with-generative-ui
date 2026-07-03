import { z } from "zod";

function toDateOnlyString(date: Date) {
  return date.toISOString().slice(0, 10);
}

//? UTC/JST のズレ（React-12）を吸収するため、境界の前後1日分の余裕を持たせる。
//? 厳密な予報ウィンドウの判定は WeatherService 側の forecast_failed（実際の Open-Meteo
//? レスポンスの time 配列に対する範囲チェック）に委譲し、ここではおおまかな範囲だけを弾く。
function isDateWithinForecastRange({ date }: Record<"date", string>) {
  const minDate = toDateOnlyString(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const maxDate = toDateOnlyString(new Date(Date.now() + 8 * 24 * 60 * 60 * 1000));

  return date >= minDate && date <= maxDate;
}

function dateRangeRefinement() {
  return {
    error: "日付は今日から7日先までの範囲で指定してください。",
    path: ["date"],
  };
}

export const GetWeatherInputSchema = z
  .object({
    city: z.string().trim().min(1).optional(),
    date: z.iso.date(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  })
  .refine(isDateWithinForecastRange, dateRangeRefinement());

export type GetWeatherInput = z.infer<typeof GetWeatherInputSchema>;

//? クエリ文字列は常に string で届くため、number 系フィールドのみ coerce する。date/city はそのまま string。
export const GetWeatherQuerySchema = z
  .object({
    city: z.string().trim().min(1).optional(),
    date: z.iso.date(),
    latitude: z
      .string()
      .trim()
      .min(1)
      .transform(Number)
      .pipe(z.number().min(-90).max(90))
      .optional(),
    longitude: z
      .string()
      .trim()
      .min(1)
      .transform(Number)
      .pipe(z.number().min(-180).max(180))
      .optional(),
  })
  .refine(isDateWithinForecastRange, dateRangeRefinement());

const DailyWeatherSchema = z.object({
  date: z.string(),
  humidity: z.number().min(0).max(100).optional(),
  precipitationProbability: z.number().min(0).max(100),
  summary: z.string(),
  tempMax: z.number(),
  tempMin: z.number(),
  weatherCode: z.number(),
});

export const WeatherReportSchema = z.object({
  daily: z.array(DailyWeatherSchema).max(8),
  date: z.string(),
  humidity: z.number().min(0).max(100).optional(),
  //? 地図表示用の解決済み座標。city 指定時はジオコーディング結果、座標指定時は入力値。
  //? モデルに座標を emit させず、サーバーが解決した実座標を widget まで届ける。
  latitude: z.number().min(-90).max(90),
  locationLabel: z.string(),
  longitude: z.number().min(-180).max(180),
  precipitationProbability: z.number().min(0).max(100),
  summary: z.string(),
  tempMax: z.number(),
  tempMin: z.number(),
  weatherCode: z.number(),
});

export type WeatherReport = z.infer<typeof WeatherReportSchema>;
