import { Calendar, Card, Chip, DatePicker } from "@heroui/react";
import { type ComponentRenderProps, defineComponent } from "@openuidev/react-lang";
import { useState } from "react";
import { z } from "zod";

const WEATHER_CODE_EMOJI = {
  0: "☀️",
  1: "🌤️",
  2: "⛅",
  3: "☁️",
  45: "🌫️",
  48: "🌫️",
  51: "🌦️",
  53: "🌦️",
  55: "🌦️",
  56: "🌦️",
  57: "🌦️",
  61: "🌧️",
  63: "🌧️",
  65: "🌧️",
  66: "🌧️",
  67: "🌧️",
  71: "🌨️",
  73: "🌨️",
  75: "🌨️",
  77: "🌨️",
  80: "🌦️",
  81: "🌦️",
  82: "🌦️",
  95: "⛈️",
  96: "⛈️",
  99: "⛈️",
} as const satisfies Record<number, string>;

function emojiForWeatherCode(weatherCode: number) {
  return WEATHER_CODE_EMOJI[weatherCode as keyof typeof WEATHER_CODE_EMOJI] ?? "🌡️";
}

const dailyWeatherPropsSchema = z.object({
  date: z.string().describe("ISO date (YYYY-MM-DD) for this forecast day"),
  precipitationProbability: z
    .number()
    .describe("Precipitation probability for this day, as a percentage (0-100)"),
  summary: z.string().describe("Short weather summary for this day, e.g. '晴れ' or '雨'"),
  tempMax: z.number().describe("Maximum temperature for this day, in Celsius"),
  tempMin: z.number().describe("Minimum temperature for this day, in Celsius"),
  weatherCode: z.number().describe("WMO weather code for this day, used to choose a display icon"),
});

const weatherWidgetPropsSchema = z.object({
  daily: z
    .array(dailyWeatherPropsSchema)
    .describe("Up to 7 days of forecast data, in chronological order, for the 7-day strip"),
  date: z.string().describe("ISO date (YYYY-MM-DD) currently displayed in the header"),
  locationLabel: z.string().describe("Human-readable location name, e.g. '東京都'"),
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

type WeatherWidgetProps = z.infer<typeof weatherWidgetPropsSchema>;

export const weatherWidget = defineComponent({
  component: function WeatherWidgetView({ props }: ComponentRenderProps<WeatherWidgetProps>) {
    const {
      daily,
      date,
      locationLabel,
      precipitationProbability,
      summary,
      tempMax,
      tempMin,
      weatherCode,
    } = props;

    // Phase 2 will wire this to re-send a chat prompt for the picked date.
    // For now the picker only reflects the selection locally — no side effects.
    const [selectedDate, setSelectedDate] = useState(date);

    return (
      <Card>
        <Card.Header className="flex flex-row items-center justify-between gap-2">
          <Card.Title>{locationLabel}</Card.Title>
          <div className="flex items-center gap-2">
            <Chip color="default" size="sm" variant="secondary">
              <Chip.Label>{selectedDate}</Chip.Label>
            </Chip>
            <DatePicker
              onChange={(value) => {
                if (value) {
                  setSelectedDate(value.toString());
                }
              }}
            >
              <DatePicker.Trigger aria-label="日付を選択">
                <DatePicker.TriggerIndicator />
              </DatePicker.Trigger>
              <DatePicker.Popover>
                <Calendar>
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
                      {(gridDate) => <Calendar.Cell date={gridDate} />}
                    </Calendar.GridBody>
                  </Calendar.Grid>
                </Calendar>
              </DatePicker.Popover>
            </DatePicker>
          </div>
        </Card.Header>
        <Card.Content className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="text-4xl">
              {emojiForWeatherCode(weatherCode)}
            </span>
            <div>
              <p className="text-lg font-semibold">{summary}</p>
              <p className="text-muted text-sm">
                {tempMax}°C / {tempMin}°C・降水確率 {precipitationProbability}%
              </p>
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {daily.map((day) => (
              <div
                className="flex min-w-20 flex-col items-center gap-1 rounded-md border p-2 text-center"
                key={day.date}
              >
                <p className="text-muted text-xs">{day.date}</p>
                <span aria-hidden="true" className="text-2xl">
                  {emojiForWeatherCode(day.weatherCode)}
                </span>
                <p className="text-xs">{day.summary}</p>
                <p className="text-xs font-medium">
                  {day.tempMax}° / {day.tempMin}°
                </p>
              </div>
            ))}
          </div>
        </Card.Content>
      </Card>
    );
  },
  description:
    "Weather forecast card for a location: header with location and date, a headline summary with current temperature range and precipitation probability, a date picker, and a horizontal 7-day forecast strip. Use this instead of Card/TextContent to display weather data.",
  name: "WeatherWidget",
  props: weatherWidgetPropsSchema,
});
