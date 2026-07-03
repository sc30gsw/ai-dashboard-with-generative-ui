import { expect, test } from "vite-plus/test";

import { GetWeatherInputSchema } from "~/features/weather/schemas/weather-schema";

function toDateOnlyString(date: Date) {
  return date.toISOString().slice(0, 10);
}

test("rejects a date too far in the future (+9 days)", () => {
  const date = toDateOnlyString(new Date(Date.now() + 9 * 24 * 60 * 60 * 1000));
  const result = GetWeatherInputSchema.safeParse({ city: "Tokyo", date });

  expect(result.success).toBe(false);
});

//? React-12: UTC/JST のズレを吸収するため、境界の前後1日は許容される（today+8 は許可）。
test("accepts a date exactly 8 days from today (UTC/JST slack)", () => {
  const date = toDateOnlyString(new Date(Date.now() + 8 * 24 * 60 * 60 * 1000));
  const result = GetWeatherInputSchema.safeParse({ city: "Tokyo", date });

  expect(result.success).toBe(true);
});

//? React-12: 過去方向にも1日分の余裕を許容する（today-1 は許可、today-2 は拒否）。
test("accepts yesterday's date (UTC/JST slack)", () => {
  const date = toDateOnlyString(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const result = GetWeatherInputSchema.safeParse({ city: "Tokyo", date });

  expect(result.success).toBe(true);
});

test("rejects a date too far in the past (-2 days)", () => {
  const date = toDateOnlyString(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000));
  const result = GetWeatherInputSchema.safeParse({ city: "Tokyo", date });

  expect(result.success).toBe(false);
});

test("rejects a malformed date string (not YYYY-MM-DD)", () => {
  const result = GetWeatherInputSchema.safeParse({ city: "Tokyo", date: "2026/07/03" });

  expect(result.success).toBe(false);
});

test("accepts today's date", () => {
  const date = toDateOnlyString(new Date());
  const result = GetWeatherInputSchema.safeParse({ city: "Tokyo", date });

  expect(result.success).toBe(true);
});

test("accepts a date 3 days from today", () => {
  const date = toDateOnlyString(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));
  const result = GetWeatherInputSchema.safeParse({ city: "Tokyo", date });

  expect(result.success).toBe(true);
});
