import { Result, TaggedError } from "better-result";
import { z } from "zod";

import { labelForWeatherCode } from "~/features/weather/lib/wmo-codes";
import { wmoCodeForWwoCode } from "~/features/weather/lib/wwo-codes";
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
    //? 湿度は best-effort（Open-Meteo が null を返す日があっても予報全体を落とさない）。
    relative_humidity_2m_mean: z.array(z.number().nullable()),
    temperature_2m_max: z.array(z.number()),
    temperature_2m_min: z.array(z.number()),
    time: z.array(z.string()),
    weather_code: z.array(z.number()),
  }),
});

type ForecastResponse = z.infer<typeof ForecastResponseSchema>;

const ReverseGeocodingResponseSchema = z.object({
  city: z.string().optional(),
  locality: z.string().optional(),
  principalSubdivision: z.string().optional(),
});

//? 座標のみ（現在地フォールバック）の場合に locationLabel を人間可読な地名へ解決する。
//? Open-Meteo に逆ジオコーディング API は無いため、キー不要の BigDataCloud を使う。
//? best-effort: 失敗しても天気取得は続行し、呼び出し側が座標文字列ラベルへ縮退する。
async function reverseGeocodeLabel(latitude: number, longitude: number) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    localityLanguage: "ja",
    longitude: String(longitude),
  });

  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return null;
    }

    const parsed = ReverseGeocodingResponseSchema.safeParse(await res.json());

    if (!parsed.success) {
      return null;
    }

    const { city, locality, principalSubdivision } = parsed.data;
    //? 日本の座標では city が都道府県（例 "東京都"）、locality が市区（例 "渋谷区"）で返る
    //? （localityLanguage=ja の実レスポンスで確認済み）。"東京都渋谷区" の形へ合成する。
    const region = city || principalSubdivision;

    if (locality && region && locality !== region) {
      return `${region}${locality}`;
    }

    return locality || region || null;
  } catch {
    return null;
  }
}

//? Open-Meteo geocoding は3文字未満の地名を完全一致でしか検索しない（「大阪」「東京」が0件になる）。
//? 0件のときは行政区分サフィックスを付けた候補で再検索する。
const GEOCODING_FALLBACK_SUFFIXES = ["市", "都", "府", "県"] as const;

async function searchCity(name: string) {
  const params = new URLSearchParams({
    count: "1",
    language: "ja",
    name,
  });
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, {
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new GeocodingFetchError("Geocoding request failed");
  }

  const json = await res.json().catch(() => {
    throw new GeocodingFetchError("Geocoding response is not valid JSON");
  });
  const parsed = GeocodingResponseSchema.safeParse(json);

  if (!parsed.success) {
    throw new GeocodingFetchError("Geocoding response has an unexpected shape");
  }

  return parsed.data.results?.[0];
}

async function resolveLocation(input: GetWeatherInput) {
  if (input.latitude !== undefined && input.longitude !== undefined) {
    const locationLabel =
      input.city ??
      (await reverseGeocodeLabel(input.latitude, input.longitude)) ??
      `${input.latitude}, ${input.longitude}`;

    return {
      latitude: input.latitude,
      locationLabel,
      longitude: input.longitude,
    };
  }

  const city = input.city ?? "";
  const candidates = [city, ...GEOCODING_FALLBACK_SUFFIXES.map((suffix) => `${city}${suffix}`)];

  for (const name of candidates) {
    // oxlint-disable-next-line react-doctor/async-await-in-loop -- sequential fallback search with early-exit on first match; candidates are tried in priority order, not independent, so Promise.all would fire extra unnecessary geocoding requests and change the result-priority semantics.
    const result = await searchCity(name);

    if (result) {
      return {
        latitude: result.latitude,
        locationLabel: result.name,
        longitude: result.longitude,
      };
    }
  }

  throw new GeocodingFetchError("No geocoding results found");
}

async function fetchOpenMeteoForecast(latitude: number, longitude: number) {
  const params = new URLSearchParams({
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,relative_humidity_2m_mean",
    forecast_days: "8",
    latitude: String(latitude),
    longitude: String(longitude),
    timezone: "auto",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new ForecastFetchError("Forecast request failed");
  }

  const json = await res.json().catch(() => {
    throw new ForecastFetchError("Forecast response is not valid JSON");
  });
  const parsed = ForecastResponseSchema.safeParse(json);

  if (!parsed.success) {
    throw new ForecastFetchError("Forecast response has an unexpected shape");
  }

  return parsed.data;
}

//? wttr.in の j1 レスポンス。数値がすべて文字列で返るため coerce で吸収する。
const WttrResponseSchema = z.object({
  weather: z.array(
    z.object({
      date: z.string(),
      hourly: z.array(
        z.object({
          chanceofrain: z.coerce.number(),
          humidity: z.coerce.number(),
          weatherCode: z.coerce.number(),
        }),
      ),
      maxtempC: z.coerce.number(),
      mintempC: z.coerce.number(),
    }),
  ),
});

//? Open-Meteo forecast ホスト障害時のフォールバック（2026-07-04 の全面停止で追加）。
//? キー不要の wttr.in（3日分・3時間刻み hourly）を既存の ForecastResponse 形へ正規化し、
//? buildReport 以降のパイプラインを共通のまま使う。WWO コードは WMO へ変換する。
async function fetchWttrForecast(latitude: number, longitude: number): Promise<ForecastResponse> {
  const res = await fetch(`https://wttr.in/${latitude},${longitude}?format=j1`, {
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new ForecastFetchError("Fallback forecast request failed");
  }

  const json = await res.json().catch(() => {
    throw new ForecastFetchError("Fallback forecast response is not valid JSON");
  });
  const parsed = WttrResponseSchema.safeParse(json);

  if (!parsed.success) {
    throw new ForecastFetchError("Fallback forecast response has an unexpected shape");
  }

  const days = parsed.data.weather;

  return {
    daily: {
      precipitation_probability_max: days.map((day) =>
        Math.max(0, ...day.hourly.map((hour) => hour.chanceofrain)),
      ),
      relative_humidity_2m_mean: days.map((day) =>
        day.hourly.length === 0
          ? null
          : Math.round(
              day.hourly.reduce((sum, hour) => sum + hour.humidity, 0) / day.hourly.length,
            ),
      ),
      temperature_2m_max: days.map((day) => day.maxtempC),
      temperature_2m_min: days.map((day) => day.mintempC),
      time: days.map((day) => day.date),
      //? 3時間刻み8枠の正午枠（index 4）を代表値にする。
      weather_code: days.map((day) =>
        wmoCodeForWwoCode((day.hourly[4] ?? day.hourly[0])?.weatherCode ?? 113),
      ),
    },
  };
}

async function fetchForecast(latitude: number, longitude: number) {
  try {
    return await fetchOpenMeteoForecast(latitude, longitude);
  } catch {
    return fetchWttrForecast(latitude, longitude);
  }
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
    humidity: at(daily.relative_humidity_2m_mean, index) ?? undefined,
    precipitationProbability: at(daily.precipitation_probability_max, index),
    summary: labelForWeatherCode(at(daily.weather_code, index)),
    tempMax: at(daily.temperature_2m_max, index),
    tempMin: at(daily.temperature_2m_min, index),
    weatherCode: at(daily.weather_code, index),
  };
}

function buildReport(
  location: Record<"latitude" | "longitude", number> & Record<"locationLabel", string>,
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
    humidity: current.humidity,
    latitude: location.latitude,
    locationLabel: location.locationLabel,
    longitude: location.longitude,
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
        const location = await resolveLocation(input);
        const forecast = await fetchForecast(location.latitude, location.longitude);

        return buildReport(location, input.date, forecast);
      },
    });
  }
}
