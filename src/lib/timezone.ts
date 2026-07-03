import { Result } from "better-result";

export const APP_DEFAULT_TIMEZONE = "Asia/Tokyo";

//? タイムゾーンごとに Intl.DateTimeFormat をキャッシュする。呼び出しのたびに再構築しない
//? （react-doctor js-hoist-intl 対策も兼ねる）。不正な IANA タイムゾーン文字列は
//? コンストラクタが RangeError を投げるため、生成時点で Result.try に包んで吸収する。
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string) {
  const cached = formatterCache.get(timeZone);

  if (cached) {
    return Result.ok(cached);
  }

  return Result.try({
    catch: (cause) => cause,
    try: () => {
      // eslint-disable-next-line react-doctor/js-hoist-intl
      const formatter = new Intl.DateTimeFormat("en-CA", { timeZone });
      formatterCache.set(timeZone, formatter);

      return formatter;
    },
  });
}

//? 呼び出し側は常に日付文字列だけを必要とするため、Result はここで内部的に解決し、
//? プレーンな string を返す（不正なタイムゾーンは APP_DEFAULT_TIMEZONE にフォールバック）。
export function todayInTimeZone(timeZone: string) {
  const result = formatterFor(timeZone);

  if (Result.isError(result)) {
    return formatterFor(APP_DEFAULT_TIMEZONE).match({
      err: () => "",
      ok: (formatter) => formatter.format(new Date()),
    });
  }

  return result.value.format(new Date());
}
