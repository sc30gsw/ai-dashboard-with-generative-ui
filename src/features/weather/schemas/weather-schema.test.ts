import { expect, test } from "vite-plus/test";

import { GetWeatherInputSchema } from "~/features/weather/schemas/weather-schema";

function toDateOnlyString(date: Date) {
  return date.toISOString().slice(0, 10);
}

test("rejects a date too far in the future (+10 days)", () => {
  const date = toDateOnlyString(new Date(Date.now() + 10 * 24 * 60 * 60 * 1000));
  const result = GetWeatherInputSchema.safeParse({ city: "Tokyo", date });

  expect(result.success).toBe(false);
});

test("rejects a date in the past", () => {
  const date = toDateOnlyString(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const result = GetWeatherInputSchema.safeParse({ city: "Tokyo", date });

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
