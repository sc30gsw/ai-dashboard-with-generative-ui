import { Result } from "better-result";

export const APP_DEFAULT_TIMEZONE = "Asia/Tokyo";

//? タイムゾーンごとに Intl.DateTimeFormat をキャッシュする。呼び出しのたびに再構築しない
//? （react-doctor js-hoist-intl 対策も兼ねる）。不正な IANA タイムゾーン文字列は
//? コンストラクタが RangeError を投げるため、生成時点で Result.try に包んで吸収する。
const formatterCache = new Map<string, Intl.DateTimeFormat>();

//? APP_DEFAULT_TIMEZONE は既知の有効な IANA タイムゾーン定数なので、モジュール読み込み時に
//? 一度だけ構築してキャッシュに種入れする。ここで RangeError が起きるなら定数自体の設定
//? ミス（プログラマの不具合）であり、Result に包まず fail fast させる。
// eslint-disable-next-line react-doctor/js-hoist-intl
const defaultFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: APP_DEFAULT_TIMEZONE });
formatterCache.set(APP_DEFAULT_TIMEZONE, defaultFormatter);

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
//? プレーンな string を返す（不正なタイムゾーンは事前構築済みの defaultFormatter にフォールバック）。
export function todayInTimeZone(timeZone: string) {
  return formatterFor(timeZone).match({
    err: () => defaultFormatter.format(new Date()),
    ok: (formatter) => formatter.format(new Date()),
  });
}

//? 任意の Date を指定タイムゾーンの "YYYY-MM-DD" に変換する（不正なタイムゾーンは
//? defaultFormatter にフォールバック）。ダッシュボードの日次集計などで使う。
export function dateKeyInTimeZone(date: Date, timeZone: string) {
  return formatterFor(timeZone).match({
    err: () => defaultFormatter.format(date),
    ok: (formatter) => formatter.format(date),
  });
}

function addDaysToDateOnly(dateOnly: string, days: number) {
  const year = Number(dateOnly.slice(0, 4));
  const month = Number(dateOnly.slice(5, 7));
  const day = Number(dateOnly.slice(8, 10));

  // ? "YYYY-MM-DD" はカレンダー日付であり時刻を持たないため、UTC を計算用の器として
  // ? 使うだけで実際のタイムゾーン変換は発生しない（暦日の加算として安全）。
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

//? Calendar/DatePicker の選択可能範囲（今日 〜 今日+7日）を "YYYY-MM-DD" で返す。
export function todayRangeInTimeZone(timeZone: string) {
  const start = todayInTimeZone(timeZone);

  return { end: addDaysToDateOnly(start, 7), start };
}
