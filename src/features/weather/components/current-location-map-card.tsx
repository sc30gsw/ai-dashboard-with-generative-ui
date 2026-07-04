import { Card } from "@heroui/react";
import { useEffect, useState } from "react";

import { LocationMapView } from "~/features/weather/components/location-map-view";
import type { WeatherReportProps } from "~/features/weather/components/weather-widget";
import { getCurrentCoordinates } from "~/utils/geolocation";

type MapLocation = Record<"label", string> &
  Pick<Required<WeatherReportProps>, "latitude" | "longitude">;

// getCurrentCoordinates() resolves Promise<{ latitude: number; longitude: number } | null> —
// null on permission denial / timeout / unsupported browser (confirmed in src/utils/geolocation.ts).
// Fallback point when geolocation is unavailable (e.g. headless E2E, permission denied): Tokyo Station.
// Label it explicitly as a fallback so it is never mistaken for the user's real current location.
const DEFAULT_MAP_LOCATION = {
  label: "既定地点（東京）",
  latitude: 35.6812,
  longitude: 139.7671,
} as const satisfies MapLocation;

export function CurrentLocationMapCard() {
  const [location, setLocation] = useState<MapLocation | null>(null);

  useEffect(() => {
    let cancelled = false;

    getCurrentCoordinates().then((coordinates) => {
      if (cancelled) {
        return;
      }

      setLocation(
        coordinates
          ? { label: "現在地", latitude: coordinates.latitude, longitude: coordinates.longitude }
          : DEFAULT_MAP_LOCATION,
      );
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card>
      <Card.Header>
        <Card.Title>現在地マップ</Card.Title>
      </Card.Header>
      <Card.Content className="flex flex-col gap-2">
        {location ? (
          <>
            <p className="text-muted text-sm">{location.label}</p>
            <LocationMapView
              label={location.label}
              latitude={location.latitude}
              longitude={location.longitude}
              popupContent={
                <div className="space-y-1">
                  <p className="font-semibold">{location.label}</p>
                  <p className="text-muted text-xs">
                    {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                  </p>
                </div>
              }
            />
          </>
        ) : (
          <p className="text-muted text-sm">位置情報を取得中...</p>
        )}
      </Card.Content>
    </Card>
  );
}
