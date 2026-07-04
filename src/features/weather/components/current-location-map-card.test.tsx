// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, test, vi } from "vite-plus/test";

import { CurrentLocationMapCard } from "~/features/weather/components/current-location-map-card";
import { getCurrentCoordinates } from "~/utils/geolocation";

vi.mock("~/utils/geolocation", () => ({ getCurrentCoordinates: vi.fn() }));

vi.mock("~/features/weather/components/location-map-view", () => ({
  LocationMapView: ({
    label,
    popupContent,
  }: Record<"label", string> & Partial<Record<"popupContent", ReactNode>>) => (
    <>
      <span>{label}</span>
      {popupContent}
    </>
  ),
}));

test("resolves and displays the user's current location when geolocation succeeds", async () => {
  vi.mocked(getCurrentCoordinates).mockResolvedValue({ latitude: 1, longitude: 2 });

  render(<CurrentLocationMapCard />);

  expect((await screen.findAllByText("現在地")).length).toBeGreaterThan(0);
  expect(await screen.findByText("1.0000, 2.0000")).toBeDefined();
});

test("falls back to the default location when geolocation is unavailable", async () => {
  vi.mocked(getCurrentCoordinates).mockResolvedValue(null);

  render(<CurrentLocationMapCard />);

  expect((await screen.findAllByText("既定地点（東京）")).length).toBeGreaterThan(0);
  expect(await screen.findByText("35.6812, 139.7671")).toBeDefined();
});
