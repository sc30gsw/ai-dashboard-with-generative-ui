//? WMO (World Meteorological Organization) weather code -> 日本語ラベル / 絵文字の単一ソース。
//? weather-service.ts (サーバー側ラベル) と weather-widget.tsx (表示アイコン) の双方で
//? コードテーブルが分岐していたのを解消するため、ここに一本化する。
const WMO_CODES = {
  0: { emoji: "☀️", label: "快晴" },
  1: { emoji: "🌤️", label: "晴れ" },
  2: { emoji: "⛅", label: "晴れ" },
  3: { emoji: "☁️", label: "曇り" },
  45: { emoji: "🌫️", label: "霧" },
  48: { emoji: "🌫️", label: "霧" },
  51: { emoji: "🌦️", label: "雨" },
  53: { emoji: "🌦️", label: "雨" },
  55: { emoji: "🌦️", label: "雨" },
  56: { emoji: "🌦️", label: "雨" },
  57: { emoji: "🌦️", label: "雨" },
  61: { emoji: "🌧️", label: "雨" },
  63: { emoji: "🌧️", label: "雨" },
  65: { emoji: "🌧️", label: "雨" },
  66: { emoji: "🌧️", label: "雨" },
  67: { emoji: "🌧️", label: "雨" },
  71: { emoji: "🌨️", label: "雪" },
  73: { emoji: "🌨️", label: "雪" },
  75: { emoji: "🌨️", label: "雪" },
  77: { emoji: "🌨️", label: "雪" },
  80: { emoji: "🌦️", label: "にわか雨" },
  81: { emoji: "🌦️", label: "にわか雨" },
  82: { emoji: "🌦️", label: "にわか雨" },
  95: { emoji: "⛈️", label: "雷雨" },
  96: { emoji: "⛈️", label: "雷雨" },
  99: { emoji: "⛈️", label: "雷雨" },
} as const satisfies Record<number, { emoji: string; label: string }>;

export function labelForWeatherCode(weatherCode: number) {
  return WMO_CODES[weatherCode as keyof typeof WMO_CODES]?.label ?? "不明";
}

export function emojiForWeatherCode(weatherCode: number) {
  return WMO_CODES[weatherCode as keyof typeof WMO_CODES]?.emoji ?? "🌡️";
}
