import { Result, TaggedError } from "better-result";

import type { GetWeatherInput, WeatherReport } from "~/features/weather/schemas/weather-schema";

export class WeatherError extends TaggedError("WeatherError")<{
  cause?: unknown;
  message: string;
  reason: "geocoding_failed" | "forecast_failed" | "location_required";
}>() {}

class GeocodingFetchError extends Error {}
class ForecastFetchError extends Error {}

const WEATHER_CODE_LABELS = {
  0: "快晴",
  1: "晴れ",
  2: "晴れ",
  3: "曇り",
  45: "霧",
  48: "霧",
  51: "雨",
  53: "雨",
  55: "雨",
  56: "雨",
  57: "雨",
  61: "雨",
  63: "雨",
  65: "雨",
  66: "雨",
  67: "雨",
  71: "雪",
  73: "雪",
  75: "雪",
  77: "雪",
  80: "にわか雨",
  81: "にわか雨",
  82: "にわか雨",
  95: "雷雨",
  96: "雷雨",
  99: "雷雨",
} as const satisfies Record<number, string>;

function summaryForWeatherCode(weatherCode: number) {
  return WEATHER_CODE_LABELS[weatherCode as keyof typeof WEATHER_CODE_LABELS] ?? "不明";
}

type GeocodingResponse = {
  results?: { latitude: number; longitude: number; name: string }[];
};

type ForecastResponse = {
  daily: {
    precipitation_probability_max: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    time: string[];
    weather_code: number[];
  };
};

async function resolveLocation(input: GetWeatherInput) {
  if (input.latitude !== undefined && input.longitude !== undefined) {
    return {
      latitude: input.latitude,
      locationLabel: input.city ?? `${input.latitude}, ${input.longitude}`,
      longitude: input.longitude,
    };
  }

  const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(input.city ?? "")}&count=1&language=ja`;
  const res = await fetch(geocodeUrl);

  if (!res.ok) {
    throw new GeocodingFetchError("Geocoding request failed");
  }

  const data = (await res.json()) as GeocodingResponse;
  const result = data.results?.[0];

  if (!result) {
    throw new GeocodingFetchError("No geocoding results found");
  }

  return {
    latitude: result.latitude,
    locationLabel: result.name,
    longitude: result.longitude,
  };
}

async function fetchForecast(latitude: number, longitude: number) {
  const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=7`;
  const res = await fetch(forecastUrl);

  if (!res.ok) {
    throw new ForecastFetchError("Forecast request failed");
  }

  return (await res.json()) as ForecastResponse;
}

function at<T>(values: T[], index: number) {
  const value = values[index];

  if (value === undefined) {
    throw new ForecastFetchError("Forecast response is missing expected daily data");
  }

  return value;
}

function dailyEntryAt(daily: ForecastResponse["daily"], index: number) {
  return {
    date: at(daily.time, index),
    precipitationProbability: at(daily.precipitation_probability_max, index),
    summary: summaryForWeatherCode(at(daily.weather_code, index)),
    tempMax: at(daily.temperature_2m_max, index),
    tempMin: at(daily.temperature_2m_min, index),
    weatherCode: at(daily.weather_code, index),
  };
}

function buildReport(
  locationLabel: string,
  date: string,
  forecast: ForecastResponse,
): WeatherReport {
  const { daily } = forecast;
  const index = daily.time.indexOf(date);

  if (index === -1) {
    throw new ForecastFetchError("Requested date is outside the available forecast range");
  }

  const dailyEntries = daily.time.map((_, i) => dailyEntryAt(daily, i));
  const current = dailyEntryAt(daily, index);

  return {
    daily: dailyEntries,
    date,
    locationLabel,
    precipitationProbability: current.precipitationProbability,
    summary: current.summary,
    tempMax: current.tempMax,
    tempMin: current.tempMin,
    weatherCode: current.weatherCode,
  };
}

export abstract class WeatherService {
  static get(input: GetWeatherInput) {
    if (!input.city && (input.latitude === undefined || input.longitude === undefined)) {
      return Promise.resolve(
        Result.err(
          new WeatherError({
            message: "地点を特定できませんでした。",
            reason: "location_required",
          }),
        ),
      );
    }

    return Result.tryPromise({
      catch: (cause) => {
        if (cause instanceof GeocodingFetchError) {
          return new WeatherError({
            cause,
            message: "地点情報の取得に失敗しました。",
            reason: "geocoding_failed",
          });
        }

        return new WeatherError({
          cause,
          message: "天気予報の取得に失敗しました。",
          reason: "forecast_failed",
        });
      },
      try: async () => {
        const { latitude, locationLabel, longitude } = await resolveLocation(input);
        const forecast = await fetchForecast(latitude, longitude);

        return buildReport(locationLabel, input.date, forecast);
      },
    });
  }
}
