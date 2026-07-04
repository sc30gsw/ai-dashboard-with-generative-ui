// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, test, vi } from "vite-plus/test";

import { weatherWidget } from "~/features/weather/components/weather-widget";

vi.mock("@openuidev/react-lang", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@openuidev/react-lang")>();
  return { ...actual, useTriggerAction: () => vi.fn() };
});

afterEach(cleanup);

vi.mock("~/features/weather/components/location-map-view", () => ({
  LocationMapView: ({ label, popupContent }: { label: string; popupContent?: ReactNode }) => (
    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role, react-doctor/prefer-tag-over-role -- mirrors the real component's container role
    <div aria-label={label} role="img">
      {popupContent}
    </div>
  ),
}));

const baseWeather = {
  daily: [],
  date: "2026-07-04",
  locationLabel: "東京都",
  precipitationProbability: 10,
  summary: "晴れ",
  tempMax: 30,
  tempMin: 20,
  weatherCode: 0,
};

test("showMap が未指定の場合は地図もポップアップ内容も表示しない", () => {
  render(
    <weatherWidget.component
      props={{ weather: { ...baseWeather, latitude: 35.68, longitude: 139.76 } }}
      renderNode={() => null}
    />,
  );

  expect(screen.queryByRole("img")).toBeNull();
  expect(screen.queryByText(/東京都 \/ 2026-07-04/)).toBeNull();
});

test("showMap が true かつ緯度経度がある場合は地図とポップアップ内容を表示する", async () => {
  render(
    <weatherWidget.component
      props={{
        showMap: true,
        weather: { ...baseWeather, latitude: 35.68, longitude: 139.76 },
      }}
      renderNode={() => null}
    />,
  );

  const mapView = screen.getByRole("img");
  expect(mapView).not.toBeNull();
  expect(await within(mapView).findByText(/30°C \/ 20°C/)).not.toBeNull();
});

test("showMap が true でも緯度経度がない場合は地図を表示せずエラーにならない", () => {
  expect(() =>
    render(
      <weatherWidget.component
        props={{ showMap: true, weather: { ...baseWeather } }}
        renderNode={() => null}
      />,
    ),
  ).not.toThrow();

  expect(screen.queryByRole("img")).toBeNull();
});

test("日付ピッカーで別日を選択するとポップアップ内容が選択日のデータに更新される", async () => {
  const { rerender } = render(
    <weatherWidget.component
      props={{
        showMap: true,
        weather: { ...baseWeather, latitude: 35.68, longitude: 139.76 },
      }}
      renderNode={() => null}
    />,
  );

  expect(await within(screen.getByRole("img")).findByText(/30°C \/ 20°C/)).not.toBeNull();

  rerender(
    <weatherWidget.component
      props={{
        showMap: true,
        weather: {
          ...baseWeather,
          date: "2026-07-05",
          latitude: 35.68,
          longitude: 139.76,
          tempMax: 25,
          tempMin: 15,
        },
      }}
      renderNode={() => null}
    />,
  );

  const mapView = screen.getByRole("img");
  expect(within(mapView).queryByText(/30°C \/ 20°C/)).toBeNull();
  expect(await within(mapView).findByText(/25°C \/ 15°C/)).not.toBeNull();
  expect(within(mapView).getByText(/東京都 \/ 2026-07-05/)).not.toBeNull();
});
