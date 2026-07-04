import { lazy, Suspense, type ReactNode } from "react";

type LocationMapViewProps = {
  label: string;
  latitude: number;
  longitude: number;
  popupContent?: ReactNode;
};

// maplibre-gl is browser-only (WebGL/window). A top-level import would break both
// SSR of the chat route and Node-side `vp run spec:gen` (which imports the genui
// component library graph). Isolate it in this lazy chunk only — same pattern as
// dashboard-page.tsx's recharts `lazy(async () => { const {...} = await import("recharts"); return { default: ... } })`.
const LocationMapContent = lazy(async () => {
  const { Map, MapControls, MapMarker, MarkerContent, MarkerLabel, MarkerPopup } =
    await import("~/components/ui/map");

  return {
    default: function LocationMapContent({
      label,
      latitude,
      longitude,
      popupContent,
    }: LocationMapViewProps) {
      return (
        <Map center={[longitude, latitude]} theme="light" zoom={10}>
          <MapControls position="bottom-right" />
          <MapMarker latitude={latitude} longitude={longitude}>
            <MarkerContent>
              <div className="size-5 rounded-full border-2 border-white bg-rose-500 shadow-lg transition-transform hover:scale-110" />
              <MarkerLabel>{label}</MarkerLabel>
            </MarkerContent>
            {popupContent ? <MarkerPopup closeButton>{popupContent}</MarkerPopup> : null}
          </MapMarker>
        </Map>
      );
    },
  };
});

export function LocationMapView({
  label,
  latitude,
  longitude,
  popupContent,
}: LocationMapViewProps) {
  return (
    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role, react-doctor/prefer-tag-over-role -- container wraps an interactive map, not a literal <img>
    <div aria-label={`${label}の地図`} className="h-70 overflow-hidden rounded-lg" role="img">
      <Suspense
        fallback={
          <div className="bg-surface-secondary flex h-full items-center justify-center rounded-lg">
            <p className="text-muted text-sm">地図を読み込み中...</p>
          </div>
        }
      >
        <LocationMapContent
          label={label}
          latitude={latitude}
          longitude={longitude}
          popupContent={popupContent}
        />
      </Suspense>
    </div>
  );
}
