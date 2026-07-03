import * as holidayJp from "@holiday-jp/holiday_jp";
import type { CalendarDate } from "@internationalized/date";

type DayKind = "holiday" | "saturday" | "sunday" | "weekday";

//? 標準的な日本のカレンダー配色: 日曜日・祝日は赤、土曜日は青、平日は無色。
const DAY_KIND_COLOR = {
  holiday: "text-red-500",
  saturday: "text-blue-500",
  sunday: "text-red-500",
  weekday: "",
} as const satisfies Record<DayKind, string>;

//? CalendarDate はタイムゾーンを持たない暦日。@holiday-jp/holiday_jp の判定も
//? Date#getDay() もランタイムのローカルタイムゾーンで年月日を解釈するため、
//? UTC 変換や toDate(timeZone) を経由せずローカル Date を直接構築し、暦日のずれを防ぐ。
function toLocalDate(date: CalendarDate) {
  return new Date(date.year, date.month - 1, date.day);
}

export function calendarDayInfo(date: CalendarDate) {
  const localDate = toLocalDate(date);
  const holiday = holidayJp.between(localDate, localDate)[0];

  if (holiday) {
    return { color: DAY_KIND_COLOR.holiday, holidayName: holiday.name, kind: "holiday" as const };
  }

  const dayOfWeek = localDate.getDay();

  if (dayOfWeek === 0) {
    return { color: DAY_KIND_COLOR.sunday, holidayName: undefined, kind: "sunday" as const };
  }

  if (dayOfWeek === 6) {
    return { color: DAY_KIND_COLOR.saturday, holidayName: undefined, kind: "saturday" as const };
  }

  return { color: DAY_KIND_COLOR.weekday, holidayName: undefined, kind: "weekday" as const };
}
