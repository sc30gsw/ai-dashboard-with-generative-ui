import { Calendar } from "@heroui/react";
import type { CalendarDate } from "@internationalized/date";

import { calendarDayInfo } from "~/lib/japanese-holiday";

//? weather-widget.tsx と weather-suggestion-panel.tsx の Calendar.GridBody が同一の
//? bare `<Calendar.Cell date={gridDate} />` を重複させていたため、祝日/曜日の色付けを
//? ここに一本化する。選択中・選択不可のセルでは配色を出さず react-aria のデフォルト状態色を優先する。
//? CalendarCellProps は title を持たないため、children render fn の中でツールチップを付与する。
//? セル自体のアクセシブルネームは react-aria が date から内部生成するため、children の変更では影響しない。
export function HolidayCalendarCell({ date }: Record<"date", CalendarDate>) {
  const { color, holidayName } = calendarDayInfo(date);

  return (
    <Calendar.Cell
      className={(renderProps) => (renderProps.isSelected || renderProps.isDisabled ? "" : color)}
      date={date}
    >
      {(renderProps) => <span title={holidayName}>{renderProps.formattedDate}</span>}
    </Calendar.Cell>
  );
}
