import { CalendarDate } from "@internationalized/date";
import { expect, test } from "vite-plus/test";

import { calendarDayInfo } from "~/lib/japanese-holiday";

test("marks a national holiday as holiday with its name", () => {
  // 2026-01-01 (Thu) = 元日 (New Year's Day)
  const info = calendarDayInfo(new CalendarDate(2026, 1, 1));

  expect(info.kind).toBe("holiday");
  expect(info.holidayName).toBe("元日");
  expect(info.color).toBe("text-red-500");
});

test("marks a non-holiday Sunday as sunday", () => {
  // 2026-01-04 is a Sunday, not a national holiday
  const info = calendarDayInfo(new CalendarDate(2026, 1, 4));

  expect(info.kind).toBe("sunday");
  expect(info.holidayName).toBeUndefined();
  expect(info.color).toBe("text-red-500");
});

test("marks a non-holiday Saturday as saturday", () => {
  // 2026-01-03 is a Saturday, not a national holiday
  const info = calendarDayInfo(new CalendarDate(2026, 1, 3));

  expect(info.kind).toBe("saturday");
  expect(info.holidayName).toBeUndefined();
  expect(info.color).toBe("text-blue-500");
});

test("marks an ordinary weekday with no color", () => {
  // 2026-01-06 is a Tuesday, not a national holiday
  const info = calendarDayInfo(new CalendarDate(2026, 1, 6));

  expect(info.kind).toBe("weekday");
  expect(info.holidayName).toBeUndefined();
  expect(info.color).toBe("");
});

test("prioritizes holiday over its weekday when a holiday falls on a Monday", () => {
  // 2026-01-12 (Mon) = 成人の日 (Coming of Age Day)
  const info = calendarDayInfo(new CalendarDate(2026, 1, 12));

  expect(info.kind).toBe("holiday");
  expect(info.holidayName).toBe("成人の日");
});
