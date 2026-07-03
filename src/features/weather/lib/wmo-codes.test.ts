import { expect, test } from "vite-plus/test";

import { colorForWeatherCode } from "~/features/weather/lib/wmo-codes";

test("colors sun codes amber", () => {
  expect(colorForWeatherCode(0)).toBe("text-amber-500");
  expect(colorForWeatherCode(1)).toBe("text-amber-500");
});

test("colors rain codes blue", () => {
  expect(colorForWeatherCode(61)).toBe("text-blue-500");
  expect(colorForWeatherCode(80)).toBe("text-blue-500");
});

test("colors snow codes cyan", () => {
  expect(colorForWeatherCode(71)).toBe("text-cyan-400");
});

test("colors thunderstorm codes violet", () => {
  expect(colorForWeatherCode(95)).toBe("text-violet-500");
});

test("falls back to slate for unknown codes", () => {
  expect(colorForWeatherCode(-1)).toBe("text-slate-400");
});
