import { Result } from "better-result";
import { beforeEach, expect, test, vi } from "vite-plus/test";

//? service を差し替え、エラー分岐（内部メッセージ）でも汎用メッセージへ変換されることを検証する。
const { getResult } = vi.hoisted(() => {
  return { getResult: { current: null as unknown } };
});

vi.mock("~/features/weather/api/weather-service", () => ({
  WeatherService: {
    get: async () => getResult.current,
  },
}));

//? errorResponse は内部メッセージを console.error に出す。テスト出力を汚さないよう抑制する。
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const INTERNAL_MESSAGE = "Failed to fetch weather (INTERNAL DETAIL)";
const validForecastDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

test("error branch returns a generic message, not the internal WeatherError message", async () => {
  const { weatherRoutes } = await import("~/features/weather/api/weather-routes");

  getResult.current = Result.err({ message: INTERNAL_MESSAGE });

  const response = await weatherRoutes.handle(
    new Request(`http://localhost/weather?city=Tokyo&date=${validForecastDate}`),
  );
  const data = await response.json();

  expect(data.ok).toBe(false);
  expect(data.message).toBe("操作に失敗しました。");
  //? 内部の WeatherError メッセージがクライアントへ漏れていないこと。
  expect(data.message).not.toContain("INTERNAL DETAIL");
});

test("success branch returns a 200 with the report for a valid city and date query", async () => {
  const { weatherRoutes } = await import("~/features/weather/api/weather-routes");

  const report = {
    daily: [],
    date: validForecastDate,
    humidity: 55,
    locationLabel: "Tokyo",
    precipitationProbability: 10,
    summary: "晴れ",
    tempMax: 30,
    tempMin: 22,
    weatherCode: 1,
  };
  getResult.current = Result.ok(report);

  const response = await weatherRoutes.handle(
    new Request(`http://localhost/weather?city=Tokyo&date=${validForecastDate}`),
  );
  const data = await response.json();

  expect(response.status).toBe(200);
  expect(data.ok).toBe(true);
  expect(data.report).toEqual(report);
});

test("success branch coerces latitude/longitude query strings to numbers", async () => {
  const { weatherRoutes } = await import("~/features/weather/api/weather-routes");

  const report = {
    daily: [],
    date: validForecastDate,
    humidity: 55,
    locationLabel: "35.68,139.77",
    precipitationProbability: 10,
    summary: "晴れ",
    tempMax: 30,
    tempMin: 22,
    weatherCode: 1,
  };
  getResult.current = Result.ok(report);

  const response = await weatherRoutes.handle(
    new Request(
      `http://localhost/weather?latitude=35.68&longitude=139.77&date=${validForecastDate}`,
    ),
  );
  const data = await response.json();

  expect(response.status).toBe(200);
  expect(data.ok).toBe(true);
});

test("invalid query (missing date) fails Standard Schema validation", async () => {
  const { weatherRoutes } = await import("~/features/weather/api/weather-routes");

  const response = await weatherRoutes.handle(new Request("http://localhost/weather?city=Tokyo"));

  expect(response.status).toBeGreaterThanOrEqual(400);
});
