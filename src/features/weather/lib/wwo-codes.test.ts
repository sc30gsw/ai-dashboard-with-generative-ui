import { expect, test } from "vite-plus/test";

import { labelForWeatherCode } from "~/features/weather/lib/wmo-codes";
import { wmoCodeForWwoCode } from "~/features/weather/lib/wwo-codes";

test("maps representative WWO codes to WMO codes", () => {
  expect(wmoCodeForWwoCode(113)).toBe(0); // Clear
  expect(wmoCodeForWwoCode(116)).toBe(2); // Partly cloudy
  expect(wmoCodeForWwoCode(296)).toBe(61); // Light rain
  expect(wmoCodeForWwoCode(353)).toBe(80); // Light rain shower
  expect(wmoCodeForWwoCode(389)).toBe(95); // Rain with thunder
  expect(wmoCodeForWwoCode(338)).toBe(75); // Heavy snow
});

test("falls back to cloudy (3) for unknown WWO codes", () => {
  expect(wmoCodeForWwoCode(999)).toBe(3);
});

test("every mapped WMO code resolves to a known label", () => {
  const wwoCodes = [
    113, 116, 119, 122, 143, 176, 179, 182, 185, 200, 227, 230, 248, 260, 263, 266, 281, 284, 293,
    296, 299, 302, 305, 308, 311, 314, 317, 320, 323, 326, 329, 332, 335, 338, 350, 353, 356, 359,
    362, 365, 368, 371, 374, 377, 386, 389, 392, 395,
  ];

  for (const wwoCode of wwoCodes) {
    expect(labelForWeatherCode(wmoCodeForWwoCode(wwoCode))).not.toBe("不明");
  }
});
