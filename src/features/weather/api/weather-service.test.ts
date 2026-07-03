import { Result } from "better-result";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";

import { WeatherService } from "~/features/weather/api/weather-service";

function jsonResponse(body: unknown, ok = true) {
  return {
    json: async () => body,
    ok,
  } as Response;
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("returns location_required error when neither city nor coordinates are given", async () => {
  const result = await WeatherService.get({ date: "2026-07-03" });

  expect(Result.isError(result)).toBe(true);

  if (Result.isError(result)) {
    expect(result.error.reason).toBe("location_required");
  }
});

test("returns a weather report for a valid city and date", async () => {
  const fetchMock = vi.mocked(fetch);
  fetchMock
    .mockResolvedValueOnce(
      jsonResponse({
        results: [{ latitude: 35.6895, longitude: 139.6917, name: "Tokyo" }],
      }),
    )
    .mockResolvedValueOnce(
      jsonResponse({
        daily: {
          precipitation_probability_max: [10, 20],
          temperature_2m_max: [30, 31],
          temperature_2m_min: [22, 23],
          time: ["2026-07-03", "2026-07-04"],
          weather_code: [0, 61],
        },
      }),
    );

  const result = await WeatherService.get({ city: "Tokyo", date: "2026-07-03" });

  expect(Result.isOk(result)).toBe(true);

  if (Result.isOk(result)) {
    expect(result.value.locationLabel).toBe("Tokyo");
    expect(result.value.date).toBe("2026-07-03");
    expect(result.value.weatherCode).toBe(0);
    expect(result.value.summary).toBe("快晴");
    expect(result.value.tempMax).toBe(30);
    expect(result.value.tempMin).toBe(22);
    expect(result.value.precipitationProbability).toBe(10);
    expect(result.value.daily).toHaveLength(2);
  }
});

test("returns geocoding_failed error when the geocoding request fails", async () => {
  const fetchMock = vi.mocked(fetch);
  fetchMock.mockResolvedValueOnce(jsonResponse({}, false));

  const result = await WeatherService.get({ city: "Nowhere", date: "2026-07-03" });

  expect(Result.isError(result)).toBe(true);

  if (Result.isError(result)) {
    expect(result.error.reason).toBe("geocoding_failed");
  }
});

test("returns forecast_failed error when the requested date is outside the forecast range", async () => {
  const fetchMock = vi.mocked(fetch);
  fetchMock
    .mockResolvedValueOnce(
      jsonResponse({
        results: [{ latitude: 35.6895, longitude: 139.6917, name: "Tokyo" }],
      }),
    )
    .mockResolvedValueOnce(
      jsonResponse({
        daily: {
          precipitation_probability_max: [10],
          temperature_2m_max: [30],
          temperature_2m_min: [22],
          time: ["2026-07-03"],
          weather_code: [0],
        },
      }),
    );

  const result = await WeatherService.get({ city: "Tokyo", date: "2099-01-01" });

  expect(Result.isError(result)).toBe(true);

  if (Result.isError(result)) {
    expect(result.error.reason).toBe("forecast_failed");
  }
});
