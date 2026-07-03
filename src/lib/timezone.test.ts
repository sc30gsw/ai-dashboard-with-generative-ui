import { expect, test } from "vite-plus/test";

import { APP_DEFAULT_TIMEZONE, todayInTimeZone } from "~/lib/timezone";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

test("returns a plausible YYYY-MM-DD for a valid IANA timezone (Asia/Tokyo)", () => {
  const today = todayInTimeZone("Asia/Tokyo");

  expect(today).toMatch(DATE_ONLY_PATTERN);
});

test("returns a plausible YYYY-MM-DD for a valid IANA timezone (America/New_York)", () => {
  const today = todayInTimeZone("America/New_York");

  expect(today).toMatch(DATE_ONLY_PATTERN);
});

test("falls back to APP_DEFAULT_TIMEZONE without throwing for an invalid timezone string", () => {
  const fallback = todayInTimeZone(APP_DEFAULT_TIMEZONE);

  expect(() => todayInTimeZone("Not/AZone")).not.toThrow();
  expect(todayInTimeZone("Not/AZone")).toBe(fallback);
});
