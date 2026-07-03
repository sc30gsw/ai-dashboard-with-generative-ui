import { Result, TaggedError } from "better-result";
import { z } from "zod";

import { labelForWeatherCode } from "~/features/weather/lib/wmo-codes";
import type { GetWeatherInput, WeatherReport } from "~/features/weather/schemas/weather-schema";

export class WeatherError extends TaggedError("WeatherError")<{
  cause?: unknown;
  message: string;
  reason: "geocoding_failed" | "forecast_failed" | "location_required";
}>() {}

class GeocodingFetchError extends Error {}
class ForecastFetchError extends Error {}

const GeocodingResponseSchema = z.object({
  results: z
    .array(
      z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        name: z.string(),
      }),
    )
    .optional(),
});

const ForecastResponseSchema = z.object({
  daily: z.object({
    precipitation_probability_max: z.array(z.number()),
    temperature_2m_max: z.array(z.number()),
    temperature_2m_min: z.array(z.number()),
    time: z.array(z.string()),
    weather_code: z.array(z.number()),
  }),
});

type ForecastResponse = z.infer<typeof ForecastResponseSchema>;

async function resolveLocation(input: GetWeatherInput) {
  if (input.latitude !== undefined && input.longitude !== undefined) {
    return {
      latitude: input.latitude,
      locationLabel: input.city ?? `${input.latitude}, ${input.longitude}`,
      longitude: input.longitude,
    };
  }

  const params = new URLSearchParams({
    count: "1",
    language: "ja",
    name: input.city ?? "",
  });
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`);

  if (!res.ok) {
    throw new GeocodingFetchError("Geocoding request failed");
  }

  const parsed = GeocodingResponseSchema.safeParse(await res.json());

  if (!parsed.success) {
    throw new GeocodingFetchError("Geocoding response has an unexpected shape");
  }

  const result = parsed.data.results?.[0];

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
  const params = new URLSearchParams({
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    forecast_days: "7",
    latitude: String(latitude),
    longitude: String(longitude),
    timezone: "auto",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);

  if (!res.ok) {
    throw new ForecastFetchError("Forecast request failed");
  }

  const parsed = ForecastResponseSchema.safeParse(await res.json());

  if (!parsed.success) {
    throw new ForecastFetchError("Forecast response has an unexpected shape");
  }

  return parsed.data;
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
    summary: labelForWeatherCode(at(daily.weather_code, index)),
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
