import { Cloud, Clouds, Snowflake, Sun, Thunderbolt, Umbrella } from "@gravity-ui/icons";
import type { ComponentType, SVGProps } from "react";

type WeatherIcon = ComponentType<SVGProps<SVGSVGElement>>;

//? WMO (World Meteorological Organization) weather code -> 日本語ラベル / 表示アイコンの単一ソース。
//? weather-service.ts (サーバー側ラベル) と weather-widget.tsx / task-suggestion.tsx (表示アイコン)
//? の双方でコードテーブルが分岐していたのを解消するため、ここに一本化する。
//? アイコンは HeroUI に天気系がないため、プロジェクト既採用の @gravity-ui/icons を使う。
//? アイコンの色は天気カテゴリ単位（Sun/Cloud/Clouds/Umbrella/Snowflake/Thunderbolt）で揃える。
//? Tailwind v4 は CSS-first（tailwind.config なし）なのでビルトインパレットのクラスをそのまま使う。
const WMO_CODES = {
  0: { color: "text-amber-500", icon: Sun, label: "快晴" },
  1: { color: "text-amber-500", icon: Sun, label: "晴れ" },
  2: { color: "text-sky-500", icon: Cloud, label: "晴れ" },
  3: { color: "text-slate-400", icon: Clouds, label: "曇り" },
  45: { color: "text-slate-400", icon: Clouds, label: "霧" },
  48: { color: "text-slate-400", icon: Clouds, label: "霧" },
  51: { color: "text-blue-500", icon: Umbrella, label: "雨" },
  53: { color: "text-blue-500", icon: Umbrella, label: "雨" },
  55: { color: "text-blue-500", icon: Umbrella, label: "雨" },
  56: { color: "text-blue-500", icon: Umbrella, label: "雨" },
  57: { color: "text-blue-500", icon: Umbrella, label: "雨" },
  61: { color: "text-blue-500", icon: Umbrella, label: "雨" },
  63: { color: "text-blue-500", icon: Umbrella, label: "雨" },
  65: { color: "text-blue-500", icon: Umbrella, label: "雨" },
  66: { color: "text-blue-500", icon: Umbrella, label: "雨" },
  67: { color: "text-blue-500", icon: Umbrella, label: "雨" },
  71: { color: "text-cyan-400", icon: Snowflake, label: "雪" },
  73: { color: "text-cyan-400", icon: Snowflake, label: "雪" },
  75: { color: "text-cyan-400", icon: Snowflake, label: "雪" },
  77: { color: "text-cyan-400", icon: Snowflake, label: "雪" },
  80: { color: "text-blue-500", icon: Umbrella, label: "にわか雨" },
  81: { color: "text-blue-500", icon: Umbrella, label: "にわか雨" },
  82: { color: "text-blue-500", icon: Umbrella, label: "にわか雨" },
  95: { color: "text-violet-500", icon: Thunderbolt, label: "雷雨" },
  96: { color: "text-violet-500", icon: Thunderbolt, label: "雷雨" },
  99: { color: "text-violet-500", icon: Thunderbolt, label: "雷雨" },
} as const satisfies Record<number, { color: string; icon: WeatherIcon; label: string }>;

const FALLBACK_COLOR = "text-slate-400";

export function labelForWeatherCode(weatherCode: number) {
  return WMO_CODES[weatherCode as keyof typeof WMO_CODES]?.label ?? "不明";
}

export function iconForWeatherCode(weatherCode: number): WeatherIcon {
  return WMO_CODES[weatherCode as keyof typeof WMO_CODES]?.icon ?? Cloud;
}

export function colorForWeatherCode(weatherCode: number) {
  return WMO_CODES[weatherCode as keyof typeof WMO_CODES]?.color ?? FALLBACK_COLOR;
}
