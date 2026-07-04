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
          relative_humidity_2m_mean: [55, 60],
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
    expect(result.value.humidity).toBe(55);
    expect(result.value.daily).toHaveLength(2);
    expect(result.value.daily[0]?.humidity).toBe(55);
    expect(result.value.daily[1]?.humidity).toBe(60);
  }
});

test("coordinates-only input resolves a human-readable label via reverse geocoding", async () => {
  const fetchMock = vi.mocked(fetch);
  fetchMock
    .mockResolvedValueOnce(
      //? 実 API（localityLanguage=ja）は日本の座標で city=都道府県 / locality=市区 を返す。
      jsonResponse({ city: "東京都", locality: "渋谷区", principalSubdivision: "東京都" }),
    )
    .mockResolvedValueOnce(
      jsonResponse({
        daily: {
          precipitation_probability_max: [10],
          relative_humidity_2m_mean: [55],
          temperature_2m_max: [30],
          temperature_2m_min: [22],
          time: ["2026-07-03"],
          weather_code: [0],
        },
      }),
    );

  const result = await WeatherService.get({
    date: "2026-07-03",
    latitude: 35.6595,
    longitude: 139.7005,
  });

  expect(Result.isOk(result)).toBe(true);

  if (Result.isOk(result)) {
    expect(result.value.locationLabel).toBe("東京都渋谷区");
  }
});

test("coordinates-only input falls back to a coordinate label when reverse geocoding fails", async () => {
  const fetchMock = vi.mocked(fetch);
  fetchMock.mockResolvedValueOnce(jsonResponse({}, false)).mockResolvedValueOnce(
    jsonResponse({
      daily: {
        precipitation_probability_max: [10],
        relative_humidity_2m_mean: [55],
        temperature_2m_max: [30],
        temperature_2m_min: [22],
        time: ["2026-07-03"],
        weather_code: [0],
      },
    }),
  );

  const result = await WeatherService.get({
    date: "2026-07-03",
    latitude: 35.6595,
    longitude: 139.7005,
  });

  expect(Result.isOk(result)).toBe(true);

  if (Result.isOk(result)) {
    expect(result.value.locationLabel).toBe("35.6595, 139.7005");
  }
});

test("falls back to suffixed candidates when a short Japanese city name returns no results", async () => {
  const fetchMock = vi.mocked(fetch);
  fetchMock
    //? 「大阪」は Open-Meteo geocoding（3文字未満は完全一致のみ）で0件になる
    .mockResolvedValueOnce(jsonResponse({}))
    //? フォールバック候補「大阪市」でヒット
    .mockResolvedValueOnce(
      jsonResponse({
        results: [{ latitude: 34.69379, longitude: 135.50107, name: "大阪市" }],
      }),
    )
    .mockResolvedValueOnce(
      jsonResponse({
        daily: {
          precipitation_probability_max: [10],
          relative_humidity_2m_mean: [55],
          temperature_2m_max: [30],
          temperature_2m_min: [22],
          time: ["2026-07-03"],
          weather_code: [0],
        },
      }),
    );

  const result = await WeatherService.get({ city: "大阪", date: "2026-07-03" });

  expect(Result.isOk(result)).toBe(true);

  if (Result.isOk(result)) {
    expect(result.value.locationLabel).toBe("大阪市");
    expect(result.value.latitude).toBe(34.69379);
  }
});

test("returns geocoding_failed error when all fallback candidates return no results", async () => {
  const fetchMock = vi.mocked(fetch);
  //? 元の地名 + 市/都/府/県 の全5候補が0件
  fetchMock.mockResolvedValue(jsonResponse({}));

  const result = await WeatherService.get({ city: "存在しない地名", date: "2026-07-03" });

  expect(Result.isError(result)).toBe(true);

  if (Result.isError(result)) {
    expect(result.error.reason).toBe("geocoding_failed");
    expect(fetchMock).toHaveBeenCalledTimes(5);
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

test("returns geocoding_failed error when the geocoding response has an unexpected shape", async () => {
  const fetchMock = vi.mocked(fetch);
  fetchMock.mockResolvedValueOnce(
    jsonResponse({
      results: [{ latitude: "not-a-number", longitude: 139.6917, name: "Tokyo" }],
    }),
  );

  const result = await WeatherService.get({ city: "Tokyo", date: "2026-07-03" });

  expect(Result.isError(result)).toBe(true);

  if (Result.isError(result)) {
    expect(result.error.reason).toBe("geocoding_failed");
  }
});

test("falls back to wttr.in when the Open-Meteo forecast request fails", async () => {
  const fetchMock = vi.mocked(fetch);
  fetchMock
    .mockResolvedValueOnce(
      jsonResponse({
        results: [{ latitude: 35.6895, longitude: 139.6917, name: "東京都" }],
      }),
    )
    //? Open-Meteo forecast がネットワーク障害で失敗
    .mockRejectedValueOnce(new Error("network down"))
    //? wttr.in フォールバック（数値は文字列で返る）
    .mockResolvedValueOnce(
      jsonResponse({
        weather: [
          {
            date: "2026-07-03",
            hourly: [
              { chanceofrain: "20", humidity: "60", weatherCode: "116" },
              { chanceofrain: "50", humidity: "70", weatherCode: "353" },
            ],
            maxtempC: "26",
            mintempC: "22",
          },
        ],
      }),
    );

  const result = await WeatherService.get({ city: "東京都", date: "2026-07-03" });

  expect(Result.isOk(result)).toBe(true);

  if (Result.isOk(result)) {
    expect(result.value.locationLabel).toBe("東京都");
    expect(result.value.tempMax).toBe(26);
    expect(result.value.tempMin).toBe(22);
    //? hourly の最大 chanceofrain
    expect(result.value.precipitationProbability).toBe(50);
    //? hourly の平均 humidity
    expect(result.value.humidity).toBe(65);
    //? 正午枠が無い場合は先頭枠の WWO 116 → WMO 2
    expect(result.value.weatherCode).toBe(2);
    expect(result.value.summary).toBe("晴れ");
  }
});

test("returns forecast_failed error when both forecast providers fail", async () => {
  const fetchMock = vi.mocked(fetch);
  fetchMock
    .mockResolvedValueOnce(
      jsonResponse({
        results: [{ latitude: 35.6895, longitude: 139.6917, name: "東京都" }],
      }),
    )
    .mockRejectedValueOnce(new Error("network down"))
    .mockRejectedValueOnce(new Error("network down"));

  const result = await WeatherService.get({ city: "東京都", date: "2026-07-03" });

  expect(Result.isError(result)).toBe(true);

  if (Result.isError(result)) {
    expect(result.error.reason).toBe("forecast_failed");
  }
});

test("returns forecast_failed error when the forecast response has an unexpected shape", async () => {
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
          relative_humidity_2m_mean: [55],
          temperature_2m_max: [30],
          temperature_2m_min: [22],
          time: ["2026-07-03"],
          weather_code: ["not-a-number"],
        },
      }),
    );

  const result = await WeatherService.get({ city: "Tokyo", date: "2026-07-03" });

  expect(Result.isError(result)).toBe(true);

  if (Result.isError(result)) {
    expect(result.error.reason).toBe("forecast_failed");
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
          relative_humidity_2m_mean: [55],
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
