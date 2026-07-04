import { cn } from "cnfast";

import "maplibre-gl/dist/maplibre-gl.css";
import { X, Minus, Plus, Locate, Maximize, Loader2 } from "lucide-react";
import MapLibreGL, { type PopupOptions, type MarkerOptions } from "maplibre-gl";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import { createPortal } from "react-dom";

const defaultStyles = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
};

// A tile-less, dependency-free style with a transparent background. Use it for
// data visualizations (choropleths, world arcs, dot maps) where you draw your
// own layers and don't need a street basemap. The easiest way to opt in is the
// `blank` prop:
//   <Map blank>...</Map>
// The transparent background lets the themed container show through.
const blankMapStyle: MapLibreGL.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "rgba(0, 0, 0, 0)" },
    },
  ],
};

type Theme = "light" | "dark";

// Check document class for theme (works with next-themes, etc.)
function getDocumentTheme(): Theme | null {
  if (typeof document === "undefined") return null;
  if (document.documentElement.classList.contains("dark")) return "dark";
  if (document.documentElement.classList.contains("light")) return "light";
  return null;
}

// Get system preference
function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function useResolvedTheme(themeProp?: "light" | "dark"): Theme {
  const [detectedTheme, setDetectedTheme] = useState<Theme>(
    () => getDocumentTheme() ?? getSystemTheme(),
  );

  useEffect(() => {
    if (themeProp) return; // Skip detection if theme is provided via prop

    // Watch for document class changes (e.g., next-themes toggling dark class)
    const observer = new MutationObserver(() => {
      const docTheme = getDocumentTheme();
      if (docTheme) {
        setDetectedTheme(docTheme);
      }
    });
    // oxlint-disable-next-line react-doctor/no-adjust-state-on-prop-change -- subscribes to external DOM class mutations (next-themes toggling), not a prop-derived sync.
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // Also watch for system preference changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = (e: MediaQueryListEvent) => {
      // Only use system preference if no document class is set
      if (!getDocumentTheme()) {
        setDetectedTheme(e.matches ? "dark" : "light");
      }
    };
    mediaQuery.addEventListener("change", handleSystemChange);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener("change", handleSystemChange);
    };
  }, [themeProp]);

  return themeProp ?? detectedTheme;
}

type MapContextValue = {
  map: MapLibreGL.Map | null;
  isLoaded: boolean;
  resolvedTheme: Theme;
};

const MapContext = createContext<MapContextValue | null>(null);

function useMap() {
  const context = use(MapContext);
  if (!context) {
    throw new Error("useMap must be used within a Map component");
  }
  return context;
}

/** Map viewport state */
type MapViewport = {
  /** Center coordinates [longitude, latitude] */
  center: [number, number];
  /** Zoom level */
  zoom: number;
  /** Bearing (rotation) in degrees */
  bearing: number;
  /** Pitch (tilt) in degrees */
  pitch: number;
};

type MapStyleOption = string | MapLibreGL.StyleSpecification;

type MapRef = MapLibreGL.Map;

type MapProps = {
  children?: ReactNode;
  /** Additional CSS classes for the map container */
  className?: string;
  /**
   * Theme for the map. If not provided, automatically detects system preference.
   * Pass your theme value here.
   */
  theme?: Theme;
  /** Custom map styles for light and dark themes. Overrides the default Carto styles. */
  styles?: {
    light?: MapStyleOption;
    dark?: MapStyleOption;
  };
  /**
   * Use a transparent, tile-less basemap instead of the default Carto street
   * basemap — a blank canvas. Used alone it renders nothing; add your own
   * layers on top (markers, etc.). Ideal for data
   * visualizations (choropleths, arcs, dot maps).
   * Ignored when an explicit `styles` prop is provided.
   */
  blank?: boolean;
  /** Map projection type. Use `{ type: "globe" }` for 3D globe view. */
  projection?: MapLibreGL.ProjectionSpecification;
  /**
   * Controlled viewport. When provided with onViewportChange,
   * the map becomes controlled and viewport is driven by this prop.
   */
  viewport?: Partial<MapViewport>;
  /**
   * Callback fired continuously as the viewport changes (pan, zoom, rotate, pitch).
   * Can be used standalone to observe changes, or with `viewport` prop
   * to enable controlled mode where the map viewport is driven by your state.
   */
  onViewportChange?: (viewport: MapViewport) => void;
  /** Show a loading indicator on the map */
  loading?: boolean;
  /** Imperative handle to the underlying MapLibre GL map instance */
  ref?: Ref<MapRef>;
} & Omit<MapLibreGL.MapOptions, "container" | "style">;

function DefaultLoader() {
  return (
    <div className="bg-background/50 absolute inset-0 z-10 flex items-center justify-center backdrop-blur-xs">
      <div className="flex gap-1">
        <span className="bg-muted-foreground/60 size-1.5 animate-pulse rounded-full" />
        <span className="bg-muted-foreground/60 size-1.5 animate-pulse rounded-full [animation-delay:150ms]" />
        <span className="bg-muted-foreground/60 size-1.5 animate-pulse rounded-full [animation-delay:300ms]" />
      </div>
    </div>
  );
}

function getViewport(map: MapLibreGL.Map): MapViewport {
  const center = map.getCenter();
  return {
    center: [center.lng, center.lat],
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  };
}

function Map({
  children,
  className,
  theme: themeProp,
  styles,
  blank = false,
  projection,
  viewport,
  onViewportChange,
  loading = false,
  ref,
  ...props
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<MapLibreGL.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);
  const currentStyleRef = useRef<MapStyleOption | null>(null);
  const styleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const internalUpdateRef = useRef(false);
  const resolvedTheme = useResolvedTheme(themeProp);

  const isControlled = viewport !== undefined && onViewportChange !== undefined;

  const onViewportChangeRef = useRef(onViewportChange);
  // Assigning ref.current happens in an effect (not directly during render) so
  // the React Compiler can still optimize this component — mutating a ref
  // synchronously during render is a purity violation from the compiler's
  // point of view, even though it's otherwise safe here.
  useEffect(() => {
    onViewportChangeRef.current = onViewportChange;
  }, [onViewportChange]);

  // Kept as useMemo (not de-memoized like the rest of this file) because it's
  // a REQUIRED dependency of the "Handle style change" effect below — oxlint's
  // react-hooks/exhaustive-deps (correctness, hard error) requires a
  // referentially stable value there; deps are accurate ([styles, blank]).
  // oxlint-disable-next-line react-doctor/react-compiler-no-manual-memoization -- see comment above; this is not decorative, exhaustive-deps requires it.
  const mapStyles = useMemo(() => {
    // Explicit styles win. Otherwise `blank` opts into the transparent
    // tile-less basemap; with neither, fall back to the Carto defaults.
    if (styles) {
      return {
        dark: styles.dark ?? defaultStyles.dark,
        light: styles.light ?? defaultStyles.light,
      };
    }
    if (blank) {
      return { dark: blankMapStyle, light: blankMapStyle };
    }
    return defaultStyles;
  }, [styles, blank]);

  // Expose the map instance to the parent component
  useImperativeHandle(ref, () => mapInstance as MapLibreGL.Map, [mapInstance]);

  // Kept as useCallback (not de-memoized like the rest of this file) because
  // it's a REQUIRED dependency of the "Handle style change" effect below —
  // oxlint's react-hooks/exhaustive-deps (correctness, hard error) requires a
  // referentially stable function there; only touches a ref, so `[]` is accurate.
  // oxlint-disable-next-line react-doctor/react-compiler-no-manual-memoization -- see comment above; this is not decorative, exhaustive-deps requires it.
  const clearStyleTimeout = useCallback(() => {
    if (styleTimeoutRef.current) {
      clearTimeout(styleTimeoutRef.current);
      styleTimeoutRef.current = null;
    }
  }, []);

  // Initialize the map
  useEffect(() => {
    if (!containerRef.current) return;

    const initialStyle = resolvedTheme === "dark" ? mapStyles.dark : mapStyles.light;
    currentStyleRef.current = initialStyle;

    const map = new MapLibreGL.Map({
      container: containerRef.current,
      style: initialStyle,
      renderWorldCopies: false,
      attributionControl: {
        compact: true,
      },
      ...props,
      ...viewport,
    });

    const styleDataHandler = () => {
      clearStyleTimeout();
      // Delay to ensure style is fully processed before allowing layer operations
      // This is a workaround to avoid race conditions with the style loading
      // else we have to force update every layer on setStyle change
      styleTimeoutRef.current = setTimeout(() => {
        setIsStyleLoaded(true);
        if (projection) {
          map.setProjection(projection);
        }
      }, 100);
    };
    const loadHandler = () => setIsLoaded(true);

    // Viewport change handler - skip if triggered by internal update
    const handleMove = () => {
      if (internalUpdateRef.current) return;
      onViewportChangeRef.current?.(getViewport(map));
    };

    map.on("load", loadHandler);
    map.on("styledata", styleDataHandler);
    map.on("move", handleMove);
    // oxlint-disable-next-line react-doctor/no-initialize-state -- mapInstance can only be null until this effect constructs MapLibreGL.Map against containerRef (needs a live DOM node, unavailable before the first commit); this initial null->instance transition is inherent to any DOM-ref-dependent imperative library, not an avoidable extra render.
    setMapInstance(map);

    return () => {
      clearStyleTimeout();
      map.off("load", loadHandler);
      map.off("styledata", styleDataHandler);
      map.off("move", handleMove);
      map.remove();
      setIsLoaded(false);
      setIsStyleLoaded(false);
      setMapInstance(null);
    };
    // oxlint-disable-next-line react-doctor/exhaustive-deps -- intentional mount-once init: constructs the native MapLibreGL.Map against containerRef exactly once. Live theme/style/viewport/projection changes are picked up by the separate sync effects below, not by re-running this one (re-running would tear down and recreate the whole map).
  }, []);

  // Sync controlled viewport to map
  useEffect(() => {
    if (!mapInstance || !isControlled || !viewport) return;
    if (mapInstance.isMoving()) return;

    const current = getViewport(mapInstance);
    const next = {
      center: viewport.center ?? current.center,
      zoom: viewport.zoom ?? current.zoom,
      bearing: viewport.bearing ?? current.bearing,
      pitch: viewport.pitch ?? current.pitch,
    };

    if (
      next.center[0] === current.center[0] &&
      next.center[1] === current.center[1] &&
      next.zoom === current.zoom &&
      next.bearing === current.bearing &&
      next.pitch === current.pitch
    ) {
      return;
    }

    internalUpdateRef.current = true;
    mapInstance.jumpTo(next);
    internalUpdateRef.current = false;
  }, [mapInstance, isControlled, viewport]);

  // Handle style change
  useEffect(() => {
    if (!mapInstance || !resolvedTheme) return;

    const newStyle = resolvedTheme === "dark" ? mapStyles.dark : mapStyles.light;

    if (currentStyleRef.current === newStyle) return;

    clearStyleTimeout();
    currentStyleRef.current = newStyle;
    // oxlint-disable-next-line react-doctor/no-adjust-state-on-prop-change, react-doctor/no-chain-state-updates -- tracks async MapLibre style-load completion: this sets isStyleLoaded=false to start the transition, and the "styledata" handler in the init effect above sets it back to true once the new style/tiles finish loading. That two-step async handshake is inherent to MapLibre's event-driven style API, not a combinable same-tick update.
    setIsStyleLoaded(false);

    mapInstance.setStyle(newStyle, { diff: true });
  }, [mapInstance, resolvedTheme, mapStyles, clearStyleTimeout]);

  // Sync projection when the prop changes after mount.
  useEffect(() => {
    if (!mapInstance || !isStyleLoaded || !projection) return;
    mapInstance.setProjection(projection);
  }, [mapInstance, isStyleLoaded, projection]);

  // No manual memoization for this Provider value — the React Compiler already
  // caches object literals whose inputs (mapInstance, isLoaded, isStyleLoaded,
  // resolvedTheme) are all plain reads, same as any other computed JSX prop.
  return (
    <MapContext.Provider
      // oxlint-disable-next-line react-doctor/jsx-no-constructed-context-values -- inputs (mapInstance, isLoaded, isStyleLoaded, resolvedTheme) are plain reads with no unstable identity; the React Compiler caches this object literal the same way it caches any other computed JSX prop (react-conventions.md: no manual memoization without a measured reason).
      value={{ map: mapInstance, isLoaded: isLoaded && isStyleLoaded, resolvedTheme }}
    >
      <div ref={containerRef} className={cn("relative h-full w-full", className)}>
        {/* oxlint-disable-next-line react-doctor/no-initialize-state -- mapInstance can only be null until the effect above constructs MapLibreGL.Map against containerRef (needs a live DOM node, unavailable before the first commit); this initial null->instance transition is inherent to any DOM-ref-dependent imperative library, not an avoidable extra render. */}
        {(!isLoaded || loading) && <DefaultLoader />}
        {/* SSR-safe: children render only when map is loaded on client */}
        {mapInstance && children}
      </div>
    </MapContext.Provider>
  );
}

type MarkerContextValue = {
  marker: MapLibreGL.Marker;
  map: MapLibreGL.Map | null;
};

const MarkerContext = createContext<MarkerContextValue | null>(null);

function useMarkerContext() {
  const context = use(MarkerContext);
  if (!context) {
    throw new Error("Marker components must be used within MapMarker");
  }
  return context;
}

type MapMarkerProps = {
  /** Longitude coordinate for marker position */
  longitude: number;
  /** Latitude coordinate for marker position */
  latitude: number;
  /** Marker subcomponents (MarkerContent, MarkerPopup, MarkerTooltip, MarkerLabel) */
  children: ReactNode;
  /** Callback when marker is clicked */
  onClick?: (e: MouseEvent) => void;
  /** Callback when mouse enters marker */
  onMouseEnter?: (e: MouseEvent) => void;
  /** Callback when mouse leaves marker */
  onMouseLeave?: (e: MouseEvent) => void;
  /** Callback when marker drag starts (requires draggable: true) */
  onDragStart?: (lngLat: { lng: number; lat: number }) => void;
  /** Callback during marker drag (requires draggable: true) */
  onDrag?: (lngLat: { lng: number; lat: number }) => void;
  /** Callback when marker drag ends (requires draggable: true) */
  onDragEnd?: (lngLat: { lng: number; lat: number }) => void;
} & Omit<MarkerOptions, "element">;

function MapMarker({
  longitude,
  latitude,
  children,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onDragStart,
  onDrag,
  onDragEnd,
  draggable = false,
  ...markerOptions
}: MapMarkerProps) {
  const { map } = useMap();

  /* oxlint-disable react-doctor/no-event-handler -- markerInstance.getElement() below is a native DOM node owned by MapLibre, not a React element; there is no JSX to attach a real onClick/onMouseEnter/... prop to. Reading the latest callbacks from a ref inside the native addEventListener wiring (in the lazily-constructed marker below) is the only integration point. */
  const callbacksRef = useRef({
    onClick,
    onMouseEnter,
    onMouseLeave,
    onDragStart,
    onDrag,
    onDragEnd,
  });
  /* oxlint-enable react-doctor/no-event-handler */
  // Assigned in an effect (not during render) so the React Compiler can still
  // optimize this component — see the identical pattern on onViewportChangeRef
  // in Map above.
  useEffect(() => {
    callbacksRef.current = {
      onClick,
      onMouseEnter,
      onMouseLeave,
      onDragStart,
      onDrag,
      onDragEnd,
    };
  }, [onClick, onMouseEnter, onMouseLeave, onDragStart, onDrag, onDragEnd]);

  // Lazily construct the native Marker exactly once (React 19 lazy useState
  // initializer — see rerender-lazy-state-init). markerOptions/draggable/
  // longitude/latitude are only read here to seed the INITIAL marker; later
  // changes are applied imperatively by the position-sync effect below rather
  // than by recreating the marker (recreating would drop its DOM element,
  // native drag state, and listeners). No refs are touched here — listener
  // wiring (which needs callbacksRef) is done in the effect below instead, so
  // the React Compiler can still memoize this component.
  /* oxlint-disable react-doctor/no-event-handler -- lazy useState initial-state pattern (React docs: "pass a function" to compute initial state from props); reads markerOptions/draggable/longitude/latitude once to seed the marker, not event-handler logic. */
  const [marker] = useState(() =>
    new MapLibreGL.Marker({
      ...markerOptions,
      element: document.createElement("div"),
      draggable,
    }).setLngLat([longitude, latitude]),
  );
  /* oxlint-enable react-doctor/no-event-handler */

  // Wires the native marker's DOM/drag listeners to the latest callbacks via
  // callbacksRef. Kept in an effect (not the lazy state initializer above) so
  // reading callbacksRef.current never happens during render.
  /* oxlint-disable react-doctor/no-event-handler -- marker.getElement() is a native DOM node owned by MapLibre, not a React element; there is no JSX to attach a real onClick/onMouseEnter/... prop to. */
  useEffect(() => {
    const handleClick = (e: MouseEvent) => callbacksRef.current.onClick?.(e);
    const handleMouseEnter = (e: MouseEvent) => callbacksRef.current.onMouseEnter?.(e);
    const handleMouseLeave = (e: MouseEvent) => callbacksRef.current.onMouseLeave?.(e);

    const element = marker.getElement();
    element?.addEventListener("click", handleClick);
    element?.addEventListener("mouseenter", handleMouseEnter);
    element?.addEventListener("mouseleave", handleMouseLeave);

    const handleDragStart = () => {
      const lngLat = marker.getLngLat();
      callbacksRef.current.onDragStart?.({ lng: lngLat.lng, lat: lngLat.lat });
    };
    const handleDrag = () => {
      const lngLat = marker.getLngLat();
      callbacksRef.current.onDrag?.({ lng: lngLat.lng, lat: lngLat.lat });
    };
    const handleDragEnd = () => {
      const lngLat = marker.getLngLat();
      callbacksRef.current.onDragEnd?.({ lng: lngLat.lng, lat: lngLat.lat });
    };

    marker.on("dragstart", handleDragStart);
    marker.on("drag", handleDrag);
    marker.on("dragend", handleDragEnd);

    return () => {
      element?.removeEventListener("click", handleClick);
      element?.removeEventListener("mouseenter", handleMouseEnter);
      element?.removeEventListener("mouseleave", handleMouseLeave);
      marker.off("dragstart", handleDragStart);
      marker.off("drag", handleDrag);
      marker.off("dragend", handleDragEnd);
    };
  }, [marker]);
  /* oxlint-enable react-doctor/no-event-handler */

  useEffect(() => {
    if (!map) return;

    marker.addTo(map);

    return () => {
      marker.remove();
    };
  }, [map, marker]);

  const { offset, rotation, rotationAlignment, pitchAlignment } = markerOptions;

  // Prop-driven sync effect (the canonical "synchronize an external system"
  // useEffect use case, not a faked event handler): imperatively pushes
  // longitude/latitude/draggable/offset/rotation/... onto the native marker
  // whenever they change, without recreating it.
  /* oxlint-disable react-doctor/no-event-handler */
  useEffect(() => {
    const current = marker.getLngLat();
    if (current.lng !== longitude || current.lat !== latitude) {
      marker.setLngLat([longitude, latitude]);
    }

    if (marker.isDraggable() !== draggable) {
      marker.setDraggable(draggable);
    }

    const currentOffset = marker.getOffset();
    const newOffset = offset ?? [0, 0];
    const [newOffsetX, newOffsetY] = Array.isArray(newOffset)
      ? newOffset
      : [newOffset.x, newOffset.y];
    if (currentOffset.x !== newOffsetX || currentOffset.y !== newOffsetY) {
      marker.setOffset(newOffset);
    }

    if (marker.getRotation() !== (rotation ?? 0)) {
      marker.setRotation(rotation ?? 0);
    }
    if (marker.getRotationAlignment() !== (rotationAlignment ?? "auto")) {
      marker.setRotationAlignment(rotationAlignment ?? "auto");
    }
    if (marker.getPitchAlignment() !== (pitchAlignment ?? "auto")) {
      marker.setPitchAlignment(pitchAlignment ?? "auto");
    }
  }, [marker, longitude, latitude, draggable, offset, rotation, rotationAlignment, pitchAlignment]);

  // oxlint-disable-next-line react-doctor/jsx-no-constructed-context-values -- `marker` is a stable (useState-derived) reference and `map` a plain read; the compiler caches this literal, no manual memo needed.
  return <MarkerContext.Provider value={{ marker, map }}>{children}</MarkerContext.Provider>;
}

type MarkerContentProps = {
  /** Custom marker content. Defaults to a blue dot if not provided */
  children?: ReactNode;
  /** Additional CSS classes for the marker container */
  className?: string;
};

function MarkerContent({ children, className }: MarkerContentProps) {
  const { marker } = useMarkerContext();

  return createPortal(
    <div className={cn("relative cursor-pointer", className)}>
      {children || <DefaultMarkerIcon />}
    </div>,
    marker.getElement(),
  );
}

function DefaultMarkerIcon() {
  return (
    <div className="relative h-4 w-4 rounded-full border-2 border-white bg-blue-500 shadow-lg" />
  );
}

function PopupCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close popup"
      className="focus-visible:ring-ring hover:bg-muted text-foreground absolute top-1 right-1 z-10 inline-flex size-5 cursor-pointer items-center justify-center rounded-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset"
    >
      <X className="size-3.5" />
    </button>
  );
}

type MarkerPopupProps = {
  /** Popup content */
  children: ReactNode;
  /** Additional CSS classes for the popup container */
  className?: string;
  /** Show a close button in the popup (default: false) */
  closeButton?: boolean;
} & Omit<PopupOptions, "className" | "closeButton">;

function MarkerPopup({
  children,
  className,
  closeButton = false,
  ...popupOptions
}: MarkerPopupProps) {
  const { marker, map } = useMarkerContext();
  // No real dependencies read — the compiler caches this the same way
  // useMemo(() => document.createElement("div"), []) used to.
  const container = document.createElement("div");
  /* oxlint-disable react-doctor/no-event-handler -- constructing the native Popup once, same justification as MapMarker's marker construction above. */
  const { offset, maxWidth } = popupOptions;

  // Lazily construct the native Popup exactly once (see MapMarker above for
  // why: popupOptions changing later must not tear down/rebuild the popup).
  const [popup] = useState(() => {
    const popupInstance = new MapLibreGL.Popup({
      offset: 16,
      ...popupOptions,
      closeButton: false,
    })
      .setMaxWidth("none")
      .setDOMContent(container);

    return popupInstance;
  });
  /* oxlint-enable react-doctor/no-event-handler */

  useEffect(() => {
    if (!map) return;

    popup.setDOMContent(container);
    marker.setPopup(popup);

    return () => {
      marker.setPopup(null);
    };
  }, [map, popup, container, marker]);

  // Sync popup options when they change.
  useEffect(() => {
    popup.setOffset(offset ?? 16);
    if (maxWidth) {
      popup.setMaxWidth(maxWidth);
    }
  }, [popup, offset, maxWidth]);

  const handleClose = () => popup.remove();

  return createPortal(
    <div
      className={cn(
        "bg-popover text-popover-foreground relative max-w-62 rounded-md border p-3 shadow-md",
        "animate-in fade-in-0 zoom-in-95 duration-200 ease-out",
        className,
      )}
    >
      {closeButton && <PopupCloseButton onClick={handleClose} />}
      {children}
    </div>,
    container,
  );
}

type MarkerTooltipProps = {
  /** Tooltip content */
  children: ReactNode;
  /** Additional CSS classes for the tooltip container */
  className?: string;
} & Omit<PopupOptions, "className" | "closeButton" | "closeOnClick">;

function MarkerTooltip({ children, className, ...popupOptions }: MarkerTooltipProps) {
  const { marker, map } = useMarkerContext();
  const container = document.createElement("div");
  /* oxlint-disable react-doctor/no-event-handler -- constructing the native tooltip Popup once, same justification as MapMarker's marker construction above. */
  const { offset, maxWidth } = popupOptions;

  const [tooltip] = useState(() => {
    const tooltipInstance = new MapLibreGL.Popup({
      offset: 16,
      ...popupOptions,
      closeOnClick: true,
      closeButton: false,
    }).setMaxWidth("none");

    return tooltipInstance;
  });
  /* oxlint-enable react-doctor/no-event-handler */

  useEffect(() => {
    if (!map) return;

    tooltip.setDOMContent(container);

    const handleMouseEnter = () => {
      tooltip.setLngLat(marker.getLngLat()).addTo(map);
    };
    const handleMouseLeave = () => tooltip.remove();

    marker.getElement()?.addEventListener("mouseenter", handleMouseEnter);
    marker.getElement()?.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      marker.getElement()?.removeEventListener("mouseenter", handleMouseEnter);
      marker.getElement()?.removeEventListener("mouseleave", handleMouseLeave);
      tooltip.remove();
    };
  }, [map, tooltip, container, marker]);

  // Sync tooltip options when they change.
  useEffect(() => {
    tooltip.setOffset(offset ?? 16);
    if (maxWidth) {
      tooltip.setMaxWidth(maxWidth);
    }
  }, [tooltip, offset, maxWidth]);

  return createPortal(
    <div
      className={cn(
        "bg-foreground text-background pointer-events-none rounded-md px-2 py-1 text-xs text-balance shadow-md",
        "animate-in fade-in-0 zoom-in-95 duration-200 ease-out",
        className,
      )}
    >
      {children}
    </div>,
    container,
  );
}

const markerLabelPositionClasses = {
  top: "bottom-full mb-1",
  bottom: "top-full mt-1",
};

type MarkerLabelProps = {
  /** Label text content */
  children: ReactNode;
  /** Additional CSS classes for the label */
  className?: string;
  /** Position of the label relative to the marker (default: "top") */
  position?: "top" | "bottom";
};

function MarkerLabel({ children, className, position = "top" }: MarkerLabelProps) {
  return (
    <div
      className={cn(
        "absolute left-1/2 -translate-x-1/2 whitespace-nowrap",
        "text-foreground text-[10px] font-medium",
        markerLabelPositionClasses[position],
        className,
      )}
    >
      {children}
    </div>
  );
}

type MapControlsProps = {
  /** Position of the controls on the map (default: "bottom-right") */
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  /** Show zoom in/out buttons (default: true) */
  showZoom?: boolean;
  /** Show compass button to reset bearing (default: false) */
  showCompass?: boolean;
  /** Show locate button to find user's location (default: false) */
  showLocate?: boolean;
  /** Show fullscreen toggle button (default: false) */
  showFullscreen?: boolean;
  /** Additional CSS classes for the controls container */
  className?: string;
  /** Callback with user coordinates when located */
  onLocate?: (coords: { longitude: number; latitude: number }) => void;
};

const positionClasses = {
  "top-left": "top-2 left-2",
  "top-right": "top-2 right-2",
  "bottom-left": "bottom-2 left-2",
  "bottom-right": "bottom-10 right-2",
};

function ControlGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-border bg-background [&>button:not(:last-child)]:border-border flex flex-col overflow-hidden rounded-md border shadow-sm [&>button:not(:last-child)]:border-b">
      {children}
    </div>
  );
}

function ControlButton({
  onClick,
  label,
  children,
  disabled = false,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      type="button"
      className={cn(
        "flex size-8 items-center justify-center transition-all",
        "first:rounded-t-md last:rounded-b-md",
        "hover:bg-accent dark:hover:bg-accent/40",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
        "disabled:pointer-events-none disabled:opacity-50",
      )}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

// oxlint-disable-next-line react-doctor/no-many-boolean-props -- public API mirrors the upstream mapcn/shadcn `map` component (docs/weather-map-genui-spec.md §4.1: import-swap + trim only, no API redesign). Splitting into named variants would diverge from the vendored source and complicate future re-vendoring; our own callers only ever pass 0-1 of these flags.
function MapControls({
  position = "bottom-right",
  showZoom = true,
  showCompass = false,
  showLocate = false,
  showFullscreen = false,
  className,
  onLocate,
}: MapControlsProps) {
  const { map } = useMap();
  const [waitingForLocation, setWaitingForLocation] = useState(false);

  function handleZoomIn() {
    map?.zoomTo(map.getZoom() + 1, { duration: 300 });
  }

  function handleZoomOut() {
    map?.zoomTo(map.getZoom() - 1, { duration: 300 });
  }

  function handleResetBearing() {
    map?.resetNorthPitch({ duration: 300 });
  }

  function handleLocate() {
    setWaitingForLocation(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = {
            longitude: pos.coords.longitude,
            latitude: pos.coords.latitude,
          };
          map?.flyTo({
            center: [coords.longitude, coords.latitude],
            zoom: 14,
            duration: 1500,
          });
          onLocate?.(coords);
          setWaitingForLocation(false);
        },
        (error) => {
          console.error("Error getting location:", error);
          setWaitingForLocation(false);
        },
      );
    }
  }

  function handleFullscreen() {
    const container = map?.getContainer();
    if (!container) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen();
    }
  }

  return (
    <div
      className={cn("absolute z-10 flex flex-col gap-1.5", positionClasses[position], className)}
    >
      {showZoom && (
        <ControlGroup>
          <ControlButton onClick={handleZoomIn} label="Zoom in">
            <Plus className="size-4" />
          </ControlButton>
          <ControlButton onClick={handleZoomOut} label="Zoom out">
            <Minus className="size-4" />
          </ControlButton>
        </ControlGroup>
      )}
      {showCompass && (
        <ControlGroup>
          <CompassButton onClick={handleResetBearing} />
        </ControlGroup>
      )}
      {showLocate && (
        <ControlGroup>
          <ControlButton
            onClick={handleLocate}
            label="Find my location"
            disabled={waitingForLocation}
          >
            {waitingForLocation ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Locate className="size-4" />
            )}
          </ControlButton>
        </ControlGroup>
      )}
      {showFullscreen && (
        <ControlGroup>
          <ControlButton onClick={handleFullscreen} label="Toggle fullscreen">
            <Maximize className="size-4" />
          </ControlButton>
        </ControlGroup>
      )}
    </div>
  );
}

function CompassButton({ onClick }: { onClick: () => void }) {
  const { map } = useMap();
  const compassRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!map || !compassRef.current) return;

    const compass = compassRef.current;

    const updateRotation = () => {
      const bearing = map.getBearing();
      const pitch = map.getPitch();
      compass.style.transform = `rotateX(${pitch}deg) rotateZ(${-bearing}deg)`;
    };

    map.on("rotate", updateRotation);
    map.on("pitch", updateRotation);
    updateRotation();

    return () => {
      map.off("rotate", updateRotation);
      map.off("pitch", updateRotation);
    };
  }, [map]);

  return (
    <ControlButton onClick={onClick} label="Reset bearing to north">
      <svg
        ref={compassRef}
        viewBox="0 0 24 24"
        className="size-5 transition-transform duration-200"
        style={{ transformStyle: "preserve-3d" }}
      >
        <path d="M12 2L16 12H12V2Z" className="fill-red-500" />
        <path d="M12 2L8 12H12V2Z" className="fill-red-300" />
        <path d="M12 22L16 12H12V22Z" className="fill-muted-foreground/60" />
        <path d="M12 22L8 12H12V22Z" className="fill-muted-foreground/30" />
      </svg>
    </ControlButton>
  );
}

type MapPopupProps = {
  /** Longitude coordinate for popup position */
  longitude: number;
  /** Latitude coordinate for popup position */
  latitude: number;
  /** Callback when popup is closed */
  onClose?: () => void;
  /** Popup content */
  children: ReactNode;
  /** Additional CSS classes for the popup container */
  className?: string;
  /** Show a close button in the popup (default: false) */
  closeButton?: boolean;
} & Omit<PopupOptions, "className" | "closeButton">;

function MapPopup({
  longitude,
  latitude,
  onClose,
  children,
  className,
  closeButton = false,
  ...popupOptions
}: MapPopupProps) {
  const { map } = useMap();
  const onCloseRef = useRef(onClose);
  // Assigned in an effect (not during render) — see onViewportChangeRef in Map.
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  const container = document.createElement("div");
  /* oxlint-disable react-doctor/no-event-handler -- constructing the native Popup once, same justification as MapMarker's marker construction above. */
  const { offset, maxWidth } = popupOptions;

  const [popup] = useState(() => {
    const popupInstance = new MapLibreGL.Popup({
      offset: 16,
      ...popupOptions,
      closeButton: false,
    })
      .setMaxWidth("none")
      .setLngLat([longitude, latitude]);

    return popupInstance;
  });
  /* oxlint-enable react-doctor/no-event-handler */

  useEffect(() => {
    if (!map) return;

    const onCloseProp = () => onCloseRef.current?.();

    popup.on("close", onCloseProp);

    popup.setDOMContent(container);
    popup.addTo(map);

    return () => {
      popup.off("close", onCloseProp);
      if (popup.isOpen()) {
        popup.remove();
      }
    };
  }, [map, popup, container]);

  // Sync popup position and options when they change (prop-driven external-
  // system sync, not a faked event handler — same as MapMarker's position-sync
  // effect above).
  /* oxlint-disable react-doctor/no-event-handler */
  useEffect(() => {
    const current = popup.getLngLat();
    if (!current || current.lng !== longitude || current.lat !== latitude) {
      popup.setLngLat([longitude, latitude]);
    }
    popup.setOffset(offset ?? 16);
    if (maxWidth) {
      popup.setMaxWidth(maxWidth);
    }
  }, [popup, longitude, latitude, offset, maxWidth]);

  const handleClose = () => {
    popup.remove();
  };

  return createPortal(
    <div
      className={cn(
        "bg-popover text-popover-foreground relative max-w-62 rounded-md border p-3 shadow-md",
        "animate-in fade-in-0 zoom-in-95 duration-200 ease-out",
        className,
      )}
    >
      {closeButton && <PopupCloseButton onClick={handleClose} />}
      {children}
    </div>,
    container,
  );
}

export {
  Map,
  useMap,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  MarkerTooltip,
  MarkerLabel,
  MapPopup,
  MapControls,
};

export type { MapRef, MapViewport };
