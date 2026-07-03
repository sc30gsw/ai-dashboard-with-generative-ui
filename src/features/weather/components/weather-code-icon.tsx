import { cn } from "cnfast";
import { createElement } from "react";

import { colorForWeatherCode, iconForWeatherCode } from "~/features/weather/lib/wmo-codes";

//? render 中に大文字変数へ代入した JSX コンポーネント（const Icon = ...; <Icon />）は
//? React Compiler が「render 中のコンポーネント生成」と誤検知して最適化を外すため、
//? createElement で動的アイコンを描画する共有コンポーネントに切り出す。
export function WeatherCodeIcon({
  className,
  weatherCode,
}: {
  className?: string;
  weatherCode: number;
}) {
  return createElement(iconForWeatherCode(weatherCode), {
    "aria-hidden": true,
    className: cn(className, colorForWeatherCode(weatherCode)),
  });
}
