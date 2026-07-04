//? wttr.in（フォールバック天気プロバイダ）が返す WWO (World Weather Online) コードを、
//? 本プロジェクトの単一ソースである WMO コード（lib/wmo-codes.ts）へ変換する。
//? 右辺は wmo-codes.ts の WMO_CODES に存在するコードのみを使う。
const WWO_TO_WMO = {
  113: 0, // Clear / Sunny
  116: 2, // Partly cloudy
  119: 3, // Cloudy
  122: 3, // Overcast
  143: 45, // Mist
  176: 80, // Patchy rain nearby
  179: 71, // Patchy snow nearby
  182: 66, // Patchy sleet nearby
  185: 56, // Patchy freezing drizzle nearby
  200: 95, // Thundery outbreaks nearby
  227: 73, // Blowing snow
  230: 75, // Blizzard
  248: 45, // Fog
  260: 48, // Freezing fog
  263: 51, // Patchy light drizzle
  266: 51, // Light drizzle
  281: 56, // Freezing drizzle
  284: 57, // Heavy freezing drizzle
  293: 61, // Patchy light rain
  296: 61, // Light rain
  299: 63, // Moderate rain at times
  302: 63, // Moderate rain
  305: 65, // Heavy rain at times
  308: 65, // Heavy rain
  311: 66, // Light freezing rain
  314: 67, // Moderate or heavy freezing rain
  317: 66, // Light sleet
  320: 67, // Moderate or heavy sleet
  323: 71, // Patchy light snow
  326: 71, // Light snow
  329: 73, // Patchy moderate snow
  332: 73, // Moderate snow
  335: 75, // Patchy heavy snow
  338: 75, // Heavy snow
  350: 77, // Ice pellets
  353: 80, // Light rain shower
  356: 81, // Moderate or heavy rain shower
  359: 82, // Torrential rain shower
  362: 66, // Light sleet showers
  365: 67, // Moderate or heavy sleet showers
  368: 71, // Light snow showers
  371: 75, // Moderate or heavy snow showers
  374: 77, // Light showers of ice pellets
  377: 77, // Moderate or heavy showers of ice pellets
  386: 95, // Patchy light rain with thunder
  389: 95, // Moderate or heavy rain with thunder
  392: 96, // Patchy light snow with thunder
  395: 99, // Moderate or heavy snow with thunder
} as const satisfies Record<number, number>;

export function wmoCodeForWwoCode(wwoCode: number) {
  //? 未知コードは中立な 3（曇り）へフォールバックし、表示を落とさない。
  return WWO_TO_WMO[wwoCode as keyof typeof WWO_TO_WMO] ?? 3;
}
