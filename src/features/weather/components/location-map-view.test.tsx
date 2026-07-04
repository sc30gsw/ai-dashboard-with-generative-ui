// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vite-plus/test";

import { LocationMapView } from "~/features/weather/components/location-map-view";

afterEach(cleanup);

vi.mock("~/components/ui/map", () => ({
  Map: ({ children }: Record<string, unknown> & { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  MapControls: () => null,
  MapMarker: ({ children }: Record<string, unknown> & { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  MarkerContent: ({ children }: Record<string, unknown> & { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  MarkerLabel: ({ children }: Record<string, unknown> & { children?: React.ReactNode }) => (
    <span>{children}</span>
  ),
  MarkerPopup: ({ children }: Record<string, unknown> & { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

test("renders the marker label after the lazy map chunk resolves", async () => {
  render(<LocationMapView label="東京" latitude={35.68} longitude={139.76} />);

  await expect(screen.findByText("東京")).resolves.toBeDefined();
});

test("renders popupContent when provided", async () => {
  render(
    <LocationMapView
      label="東京"
      latitude={35.68}
      longitude={139.76}
      popupContent={<p>popup-body</p>}
    />,
  );

  await expect(screen.findByText("popup-body")).resolves.toBeDefined();
});

test("does not render popup content when popupContent is omitted", async () => {
  render(<LocationMapView label="東京" latitude={35.68} longitude={139.76} />);

  await expect(screen.findByText("東京")).resolves.toBeDefined();
  expect(screen.queryByText("popup-body")).toBeNull();
});
