import { expect, test } from "vite-plus/test";

import {
  APP_DEFAULT_TIMEZONE,
  dateKeyInTimeZone,
  todayInTimeZone,
  todayRangeInTimeZone,
} from "~/lib/timezone";

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

test("todayRangeInTimeZone returns a 7-day-later end date in the same calendar space as start", () => {
  const { end, start } = todayRangeInTimeZone(APP_DEFAULT_TIMEZONE);

  expect(start).toMatch(DATE_ONLY_PATTERN);
  expect(end).toMatch(DATE_ONLY_PATTERN);

  const startUtcMs = Date.UTC(
    Number(start.slice(0, 4)),
    Number(start.slice(5, 7)) - 1,
    Number(start.slice(8, 10)),
  );
  const endUtcMs = Date.UTC(
    Number(end.slice(0, 4)),
    Number(end.slice(5, 7)) - 1,
    Number(end.slice(8, 10)),
  );

  expect((endUtcMs - startUtcMs) / (24 * 60 * 60 * 1000)).toBe(7);
});

test("dateKeyInTimeZone falls back to APP_DEFAULT_TIMEZONE without throwing for an invalid timezone string", () => {
  const date = new Date("2026-07-03T00:00:00.000Z");
  const fallback = dateKeyInTimeZone(date, APP_DEFAULT_TIMEZONE);

  expect(() => dateKeyInTimeZone(date, "Not/AZone")).not.toThrow();
  expect(dateKeyInTimeZone(date, "Not/AZone")).toBe(fallback);
});
