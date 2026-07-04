import { Droplet, Umbrella } from "@gravity-ui/icons";
import { Calendar, Card, Chip, DateField, DatePicker } from "@heroui/react";
import {
  type ComponentRenderProps,
  defineComponent,
  useTriggerAction,
} from "@openuidev/react-lang";
import { useState } from "react";
import { z } from "zod";

import { HolidayCalendarCell } from "~/components/holiday-calendar-cell";
import { LocationMapView } from "~/features/weather/components/location-map-view";
import { WeatherCodeIcon } from "~/features/weather/components/weather-code-icon";
import { APP_DEFAULT_TIMEZONE, todayRangeInTimeZone } from "~/lib/timezone";

const dailyWeatherPropsSchema = z.object({
  date: z.string().describe("ISO date (YYYY-MM-DD) for this forecast day"),
  humidity: z
    .number()
    .optional()
    .describe("Mean relative humidity for this day, as a percentage (0-100)"),
  precipitationProbability: z
    .number()
    .describe("Precipitation probability for this day, as a percentage (0-100)"),
  summary: z.string().describe("Short weather summary for this day, e.g. '晴れ' or '雨'"),
  tempMax: z.number().describe("Maximum temperature for this day, in Celsius"),
  tempMin: z.number().describe("Minimum temperature for this day, in Celsius"),
  weatherCode: z.number().describe("WMO weather code for this day, used to choose a display icon"),
});

//? OpenUI Lang は名前付き引数を持たず、呼び出しの位置引数を Zod スキーマの宣言順に
//? そのまま props にバインドする。以前はここがフラットな多フィールド object だったため、
//? モデルが `WeatherWidget(weather)` と1引数だけ渡すと weather オブジェクト全体が
//? 先頭フィールド（daily）にバインドされ、残りは undefined になっていた
//? （`(daily ?? []).map is not a function` の原因）。TaskList(tasks) / TaskSuggestion(items)
//? と同じ「1引数 = 1つのラップ済みプロパティ」パターンに合わせ、weather を単一の
//? ネストしたオブジェクトとして受け取る。
const weatherReportPropsSchema = z.object({
  daily: z
    .array(dailyWeatherPropsSchema)
    .describe("Up to 7 days of forecast data, in chronological order, for the 7-day strip"),
  date: z.string().describe("ISO date (YYYY-MM-DD) currently displayed in the header"),
  humidity: z
    .number()
    .optional()
    .describe("Mean relative humidity for the displayed date, as a percentage (0-100)"),
  latitude: z
    .number()
    .optional()
    .describe(
      "Resolved latitude for the location, if available — used to render an inline map when showMap is true",
    ),
  locationLabel: z.string().describe("Human-readable location name, e.g. '東京都'"),
  longitude: z
    .number()
    .optional()
    .describe(
      "Resolved longitude for the location, if available — used to render an inline map when showMap is true",
    ),
  precipitationProbability: z
    .number()
    .describe("Precipitation probability for the displayed date, as a percentage (0-100)"),
  summary: z
    .string()
    .describe("Short weather summary for the displayed date, e.g. '晴れ' or '曇り'"),
  tempMax: z.number().describe("Maximum temperature for the displayed date, in Celsius"),
  tempMin: z.number().describe("Minimum temperature for the displayed date, in Celsius"),
  weatherCode: z
    .number()
    .describe("WMO weather code for the displayed date, used to choose a display icon"),
});

export type WeatherReportProps = z.infer<typeof weatherReportPropsSchema>;

//? OpenUI の Query() 解決パイプラインは JSON Schema の "format: date" ヒントを見て
//? 文字列を実 Date インスタンスへ自動変換することがある。Date を直接 JSX の子要素として
//? 描画すると React が例外を投げるため、表示直前に文字列へ正規化するヘルパー。
function toDateLabel(value: string | Date | undefined) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

const weatherWidgetPropsSchema = z.object({
  weather: weatherReportPropsSchema
    .optional()
    .describe("Weather report object — pass the get_weather Query result as a single argument"),
  error: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Error message when weather data could not be fetched. When present, render a compact error-only card instead of the normal temperature/summary/daily-strip display.",
    ),
  showMap: z
    .boolean()
    .optional()
    .describe(
      "Set true to render an inline map below the 7-day forecast strip, showing the location's coordinates with a marker. Only set this when the user explicitly asked to see a map or the location visually — never by default.",
    ),
});

type WeatherWidgetProps = z.infer<typeof weatherWidgetPropsSchema>;

export const weatherWidget = defineComponent({
  component: function WeatherWidgetView({ props }: ComponentRenderProps<WeatherWidgetProps>) {
    const { error, showMap, weather } = props;
    const {
      daily,
      date,
      humidity,
      latitude,
      locationLabel,
      longitude,
      precipitationProbability,
      summary,
      tempMax,
      tempMin,
      weatherCode,
    } = weather ?? {};
    const triggerAction = useTriggerAction();
    //? マウント時の日付を一度だけ取得する（render のたびに算出すると React Compiler の
    //? purity ルールに反するため、lazy initializer で一度だけ評価する）。
    const [{ end: maxDate, start: minDate }] = useState(() =>
      todayRangeInTimeZone(APP_DEFAULT_TIMEZONE),
    );

    if (error) {
      return (
        <Card>
          <Card.Header>
            <Card.Title>{locationLabel ?? "天気情報"}</Card.Title>
          </Card.Header>
          <Card.Content>
            <p className="text-muted text-sm">{error}</p>
          </Card.Content>
        </Card>
      );
    }

    const isMapVisible =
      showMap === true &&
      typeof latitude === "number" &&
      Number.isFinite(latitude) &&
      typeof longitude === "number" &&
      Number.isFinite(longitude);

    return (
      <Card>
        <Card.Header className="flex flex-row items-center justify-between gap-2">
          <Card.Title>{locationLabel}</Card.Title>
          <div className="flex items-center gap-2">
            <Chip color="default" size="sm" variant="secondary">
              <Chip.Label>{toDateLabel(date)}</Chip.Label>
            </Chip>
            <DatePicker
              className="w-40"
              onChange={(value) => {
                if (value) {
                  const selectedDate = value.toString();
                  triggerAction(`${selectedDate} の天気でタスク順序を提案して`);
                }
              }}
            >
              <DateField.Group>
                <DateField.Input>
                  {(segment) => <DateField.Segment segment={segment} />}
                </DateField.Input>
                <DateField.Suffix>
                  <DatePicker.Trigger aria-label="日付を選択">
                    <DatePicker.TriggerIndicator />
                  </DatePicker.Trigger>
                </DateField.Suffix>
              </DateField.Group>
              <DatePicker.Popover offset={8} placement="bottom end">
                <Calendar
                  isDateUnavailable={(date) => {
                    const iso = date.toString();

                    return iso < minDate || iso > maxDate;
                  }}
                >
                  <Calendar.Header>
                    <Calendar.NavButton slot="previous" />
                    <Calendar.Heading />
                    <Calendar.NavButton slot="next" />
                  </Calendar.Header>
                  <Calendar.Grid>
                    <Calendar.GridHeader>
                      {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                    </Calendar.GridHeader>
                    <Calendar.GridBody>
                      {(gridDate) => <HolidayCalendarCell date={gridDate} />}
                    </Calendar.GridBody>
                  </Calendar.Grid>
                </Calendar>
              </DatePicker.Popover>
            </DatePicker>
          </div>
        </Card.Header>
        <Card.Content className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <WeatherCodeIcon className="size-10" weatherCode={weatherCode ?? -1} />
            <div>
              <p className="text-lg font-semibold">{summary}</p>
              <div className="text-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span>
                  {tempMax}°C / {tempMin}°C
                </span>
                <span className="inline-flex items-center gap-1">
                  <Umbrella aria-hidden="true" className="size-3.5" />
                  降水確率 {precipitationProbability}%
                </span>
                {humidity === undefined ? null : (
                  <span className="inline-flex items-center gap-1">
                    <Droplet aria-hidden="true" className="size-3.5" />
                    湿度 {humidity}%
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {(daily ?? []).map((day) => (
              <div
                className="flex min-w-20 flex-col items-center gap-1 rounded-md border p-2 text-center"
                key={day.date}
              >
                <p className="text-muted text-xs">{toDateLabel(day.date)}</p>
                <WeatherCodeIcon className="size-6" weatherCode={day.weatherCode} />
                <p className="text-xs">{day.summary}</p>
                <p className="text-xs font-medium">
                  {day.tempMax}° / {day.tempMin}°
                </p>
              </div>
            ))}
          </div>
          {isMapVisible ? (
            <LocationMapView
              label={locationLabel ?? ""}
              latitude={latitude}
              longitude={longitude}
              popupContent={
                <div className="space-y-1">
                  <p className="font-semibold">
                    {locationLabel} / {toDateLabel(date)}
                  </p>
                  <p className="text-sm">
                    {tempMax}°C / {tempMin}°C
                    {humidity === undefined ? null : ` ・湿度 ${humidity}%`}
                  </p>
                  {precipitationProbability === undefined ? null : (
                    <p className="text-sm">降水確率 {precipitationProbability}%</p>
                  )}
                </div>
              }
            />
          ) : null}
        </Card.Content>
      </Card>
    );
  },
  description:
    "Weather forecast card for a location: header with location and date, a headline summary with current temperature range and precipitation probability, a date picker, and a horizontal 7-day forecast strip. Use this instead of Card/TextContent to display weather data.",
  name: "WeatherWidget",
  props: weatherWidgetPropsSchema,
});
