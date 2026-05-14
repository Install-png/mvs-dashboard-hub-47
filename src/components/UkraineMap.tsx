import { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import { geoMercator, geoPath } from "d3-geo";
import * as topojson from "topojson-client";
import { cn } from "@/lib/utils";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { FeatureCollection, Feature, Geometry } from "geojson";
import type { Incident, SeverityLevel } from "@/data/mockIncidents";
import { useMapPreferences } from "@/hooks/useMapPreferences";

export interface RegionData {
  id: string;
  name: string;
  activeIncidents: number;
  criticalCount: number;
}

interface RegionProperties {
  name: string;
  localized_name?: { ua: string };
  label_point?: [number, number];
}

interface UkraineMapProps {
  regions: RegionData[];
  incidents: Incident[];
  selectedRegion: string | null;
  onSelectRegion: (id: string | null) => void;
  onSelectIncident?: (incident: Incident) => void;
  hoveredIncidentId?: string | null;
  highlightedIncidentId?: string | null;
}

export const REGION_NAME_MAP: Record<string, string> = {
  "crimea": "АР Крим", "mk": "Миколаївська", "cn": "Чернігівська", "rv": "Рівненська",
  "cv": "Чернівецька", "if": "Івано-Франківська", "km": "Хмельницька", "lviv": "Львівська",
  "te": "Тернопільська", "uz": "Закарпатська", "volyn": "Волинська", "ck": "Черкаська",
  "kr": "Кіровоградська", "kiev": "Київська", "od": "Одеська", "vn": "Вінницька",
  "zt": "Житомирська", "sm": "Сумська", "dp": "Дніпропетровська", "dn": "Донецька",
  "kh": "Харківська", "lg": "Луганська", "pl": "Полтавська", "zp": "Запорізька", "ks": "Херсонська",
};

const HEATMAP_COLORS = {
  0: "hsl(215, 20%, 16%)", 1: "hsl(215, 30%, 20%)", 2: "hsl(220, 40%, 22%)",
  3: "hsl(30, 50%, 22%)", 4: "hsl(20, 60%, 24%)", 5: "hsl(10, 70%, 26%)",
};

function getHeatmapColor(count: number, hasCritical: boolean): string {
  if (hasCritical) return "hsl(0, 55%, 22%)";
  return HEATMAP_COLORS[Math.min(count, 5) as keyof typeof HEATMAP_COLORS];
}

interface TooltipState {
  x: number; y: number; incident: Incident | null; regionId: string | null; regionName: string;
}

// ═══ UKRAINIAN CITIES DATABASE ═══
interface CityData {
  name: string;
  coords: [number, number]; // [lng, lat]
  population: number; // thousands
  tier: 1 | 2 | 3; // 1=capital/million+, 2=regional center, 3=smaller city
  regionId: string;
}

const UKRAINE_CITIES: CityData[] = [
  // Tier 1 — always visible
  { name: "Київ", coords: [30.5234, 50.4501], population: 2967, tier: 1, regionId: "kiev" },
  { name: "Харків", coords: [36.2304, 49.9935], population: 1443, tier: 1, regionId: "kh" },
  { name: "Одеса", coords: [30.7233, 46.4825], population: 1015, tier: 1, regionId: "od" },
  { name: "Дніпро", coords: [35.0462, 48.4647], population: 980, tier: 1, regionId: "dp" },
  // Tier 2 — visible from zoom 1.5+
  { name: "Львів", coords: [24.0297, 49.8397], population: 721, tier: 2, regionId: "lviv" },
  { name: "Запоріжжя", coords: [35.1396, 47.8388], population: 722, tier: 2, regionId: "zp" },
  { name: "Миколаїв", coords: [31.9946, 46.9750], population: 480, tier: 2, regionId: "mk" },
  { name: "Вінниця", coords: [28.4682, 49.2331], population: 371, tier: 2, regionId: "vn" },
  { name: "Полтава", coords: [34.5514, 49.5883], population: 284, tier: 2, regionId: "pl" },
  { name: "Чернігів", coords: [31.2893, 51.4982], population: 285, tier: 2, regionId: "cn" },
  { name: "Херсон", coords: [32.6169, 46.6354], population: 283, tier: 2, regionId: "ks" },
  { name: "Суми", coords: [34.7981, 50.9077], population: 259, tier: 2, regionId: "sm" },
  { name: "Хмельницький", coords: [26.9871, 49.4229], population: 275, tier: 2, regionId: "km" },
  { name: "Черкаси", coords: [32.0598, 49.4444], population: 272, tier: 2, regionId: "ck" },
  { name: "Рівне", coords: [26.2516, 50.6199], population: 245, tier: 2, regionId: "rv" },
  { name: "Житомир", coords: [28.6587, 50.2547], population: 263, tier: 2, regionId: "zt" },
  { name: "Івано-Франківськ", coords: [24.7111, 48.9226], population: 238, tier: 2, regionId: "if" },
  { name: "Тернопіль", coords: [25.5948, 49.5535], population: 221, tier: 2, regionId: "te" },
  { name: "Луцьк", coords: [25.3424, 50.7472], population: 217, tier: 2, regionId: "volyn" },
  { name: "Ужгород", coords: [22.2879, 48.6208], population: 115, tier: 2, regionId: "uz" },
  { name: "Чернівці", coords: [25.9358, 48.2921], population: 265, tier: 2, regionId: "cv" },
  { name: "Кропивницький", coords: [32.2597, 48.5079], population: 222, tier: 2, regionId: "kr" },
  { name: "Донецьк", coords: [37.8024, 48.0159], population: 905, tier: 2, regionId: "dn" },
  { name: "Луганськ", coords: [39.3078, 48.5740], population: 399, tier: 2, regionId: "lg" },
  { name: "Сімферополь", coords: [34.1024, 44.9521], population: 340, tier: 2, regionId: "crimea" },
  // Tier 3 — visible from zoom 2.5+
  { name: "Маріуполь", coords: [37.5494, 47.0958], population: 431, tier: 3, regionId: "dn" },
  { name: "Краматорськ", coords: [37.5557, 48.7236], population: 150, tier: 3, regionId: "dn" },
  { name: "Кривий Ріг", coords: [33.3869, 47.9106], population: 612, tier: 3, regionId: "dp" },
  { name: "Біла Церква", coords: [29.9507, 49.7953], population: 200, tier: 3, regionId: "kiev" },
  { name: "Бровари", coords: [30.7904, 50.5114], population: 109, tier: 3, regionId: "kiev" },
  { name: "Мелітополь", coords: [35.3675, 46.8497], population: 150, tier: 3, regionId: "zp" },
  { name: "Бердянськ", coords: [36.7949, 46.7586], population: 107, tier: 3, regionId: "zp" },
  { name: "Ізмаїл", coords: [28.8411, 45.3487], population: 70, tier: 3, regionId: "od" },
  { name: "Нікополь", coords: [34.3963, 47.5714], population: 107, tier: 3, regionId: "dp" },
  { name: "Павлоград", coords: [35.8722, 48.5364], population: 104, tier: 3, regionId: "dp" },
  { name: "Кам'янське", coords: [34.6132, 48.5108], population: 229, tier: 3, regionId: "dp" },
  { name: "Конотоп", coords: [33.2039, 51.2400], population: 84, tier: 3, regionId: "sm" },
  { name: "Шостка", coords: [33.4763, 51.8667], population: 73, tier: 3, regionId: "sm" },
  { name: "Коростень", coords: [28.6367, 50.9542], population: 62, tier: 3, regionId: "zt" },
  { name: "Умань", coords: [30.2181, 48.7500], population: 82, tier: 3, regionId: "ck" },
  { name: "Коломия", coords: [25.0404, 48.5300], population: 61, tier: 3, regionId: "if" },
  { name: "Мукачево", coords: [22.7179, 48.4414], population: 85, tier: 3, regionId: "uz" },
  { name: "Стрий", coords: [23.8458, 49.2600], population: 59, tier: 3, regionId: "lviv" },
  { name: "Дрогобич", coords: [23.5017, 49.3500], population: 74, tier: 3, regionId: "lviv" },
  { name: "Лубни", coords: [33.0000, 50.0167], population: 44, tier: 3, regionId: "pl" },
  { name: "Кременчук", coords: [33.4167, 49.0667], population: 217, tier: 3, regionId: "pl" },
  { name: "Севастополь", coords: [33.5254, 44.6167], population: 393, tier: 3, regionId: "crimea" },
  { name: "Керч", coords: [36.4681, 45.3561], population: 145, tier: 3, regionId: "crimea" },
  { name: "Євпаторія", coords: [33.3669, 45.1900], population: 106, tier: 3, regionId: "crimea" },
  { name: "Новоград-Вол.", coords: [27.6167, 50.5833], population: 55, tier: 3, regionId: "zt" },
  { name: "Славута", coords: [26.8667, 50.3000], population: 33, tier: 3, regionId: "km" },
  { name: "Бориспіль", coords: [30.9533, 50.3500], population: 63, tier: 3, regionId: "kiev" },
];

// Clustering: group nearby incidents when zoomed out
function clusterIncidents(incidents: { incident: Incident; x: number; y: number }[], radius: number = 25) {
  const clusters: { incidents: typeof incidents; x: number; y: number }[] = [];
  const used = new Set<number>();

  for (let i = 0; i < incidents.length; i++) {
    if (used.has(i)) continue;
    const cluster = [incidents[i]];
    used.add(i);
    let cx = incidents[i].x, cy = incidents[i].y;

    for (let j = i + 1; j < incidents.length; j++) {
      if (used.has(j)) continue;
      const dx = incidents[j].x - cx;
      const dy = incidents[j].y - cy;
      if (Math.sqrt(dx * dx + dy * dy) < radius) {
        cluster.push(incidents[j]);
        used.add(j);
      }
    }

    const avgX = cluster.reduce((s, c) => s + c.x, 0) / cluster.length;
    const avgY = cluster.reduce((s, c) => s + c.y, 0) / cluster.length;
    clusters.push({ incidents: cluster, x: avgX, y: avgY });
  }
  return clusters;
}

const BASE_WIDTH = 900;
const BASE_HEIGHT = 600;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

const UkraineMap = memo(({ regions, incidents, selectedRegion, onSelectRegion, onSelectIncident, hoveredIncidentId, highlightedIncidentId }: UkraineMapProps) => {
  const mapPrefs = useMapPreferences();
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [geoFeatures, setGeoFeatures] = useState<Feature<Geometry, RegionProperties>[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ═══ ZOOM / PAN STATE ═══
  const [zoom, setZoom] = useState(mapPrefs.defaultZoom);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Apply default zoom when user changes it in settings
  useEffect(() => { setZoom(mapPrefs.defaultZoom); setPan({ x: 0, y: 0 }); }, [mapPrefs.defaultZoom]);

  useEffect(() => {
    fetch("/ukraine-oblasts.json")
      .then((res) => res.json())
      .then((topoData: Topology) => {
        const regionsObj = topoData.objects.regions as GeometryCollection<RegionProperties>;
        const fc = topojson.feature(topoData, regionsObj) as FeatureCollection<Geometry, RegionProperties>;
        setGeoFeatures(fc.features as Feature<Geometry, RegionProperties>[]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const projection = useMemo(() => geoMercator().center([31.5, 48.8]).scale(3600).translate([BASE_WIDTH / 2, BASE_HEIGHT / 2]), []);
  const pathGenerator = useMemo(() => geoPath().projection(projection), [projection]);

  const getRegionData = useCallback((id: string) => regions.find((r) => r.id === id), [regions]);
  const getRegionName = (feature: Feature<Geometry, RegionProperties>): string => {
    const id = (feature as any).id as string;
    return REGION_NAME_MAP[id] || feature.properties?.localized_name?.ua || feature.properties?.name || id;
  };

  // ═══ ZOOM HANDLERS ═══
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.3 : 0.3;
    setZoom(prev => {
      const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta));
      // Adjust pan to zoom toward mouse position
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        const mx = (e.clientX - rect.left) / rect.width * BASE_WIDTH;
        const my = (e.clientY - rect.top) / rect.height * BASE_HEIGHT;
        const scale = next / prev;
        setPan(p => ({
          x: mx - scale * (mx - p.x),
          y: my - scale * (my - p.y),
        }));
      }
      return next;
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = BASE_WIDTH / rect.width;
    const scaleY = BASE_HEIGHT / rect.height;
    setPan({
      x: panStart.current.panX + (e.clientX - panStart.current.x) * scaleX,
      y: panStart.current.panY + (e.clientY - panStart.current.y) * scaleY,
    });
  }, [isPanning]);

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const zoomIn = useCallback(() => setZoom(z => Math.min(MAX_ZOOM, z + 0.5)), []);
  const zoomOut = useCallback(() => setZoom(z => Math.max(MIN_ZOOM, z - 0.5)), []);

  // ═══ VISIBLE CITIES based on zoom ═══
  const visibleCities = useMemo(() => {
    return UKRAINE_CITIES.filter(c => {
      if (c.tier === 1) return true;
      if (c.tier === 2) return zoom >= 1.5;
      return zoom >= 2.5;
    }).map(c => {
      const pt = projection(c.coords);
      return pt ? { ...c, x: pt[0], y: pt[1] } : null;
    }).filter(Boolean) as (CityData & { x: number; y: number })[];
  }, [zoom, projection]);

  // ═══ TRANSFORM STRING ═══
  const transformStr = `translate(${pan.x}, ${pan.y}) scale(${zoom})`;
  const invZoom = 1 / zoom; // to keep labels/markers same screen size

  // Project and cluster (adjusted for zoom)
  const projectedIncidents = useMemo(() => {
    return incidents
      .map((inc) => {
        const pt = projection(inc.coordinates);
        return pt ? { incident: inc, x: pt[0], y: pt[1] } : null;
      })
      .filter(Boolean) as { incident: Incident; x: number; y: number }[];
  }, [incidents, projection]);

  const clusters = useMemo(
    () => mapPrefs.cluster
      ? clusterIncidents(projectedIncidents, 20 * invZoom)
      : projectedIncidents.map((p) => ({ incidents: [p], x: p.x, y: p.y })),
    [projectedIncidents, invZoom, mapPrefs.cluster]
  );

  const handleRegionMouseEnter = (_e: React.MouseEvent, id: string, name: string) => {
    if (isPanning) return;
    setHoveredRegion(id);
    setTooltip({ x: 0, y: 0, incident: null, regionId: id, regionName: name });
  };
  const handleRegionMouseLeave = () => { setHoveredRegion(null); setTooltip(null); };

  const handleIncidentMouseEnter = (e: React.MouseEvent<SVGElement>, incident: Incident) => {
    if (isPanning) return;
    e.stopPropagation();
    const pt = projection(incident.coordinates);
    if (!pt) return;
    setTooltip({ x: pt[0], y: pt[1], incident, regionId: null, regionName: "" });
  };
  const handleIncidentMouseLeave = () => setTooltip(null);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full select-none" style={{ touchAction: "none" }}>
      {/* Zoom Controls */}
      <div className="absolute top-2 right-2 z-20 flex flex-col gap-1">
        <button onClick={zoomIn} className="h-7 w-7 rounded bg-background/80 border border-border flex items-center justify-center text-foreground hover:bg-muted text-sm font-bold backdrop-blur-sm">+</button>
        <button onClick={zoomOut} className="h-7 w-7 rounded bg-background/80 border border-border flex items-center justify-center text-foreground hover:bg-muted text-sm font-bold backdrop-blur-sm">−</button>
        <button onClick={resetView} className="h-7 w-7 rounded bg-background/80 border border-border flex items-center justify-center text-foreground hover:bg-muted backdrop-blur-sm" title="Скинути">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 8a6 6 0 1 1 1.5 3.9" /><path d="M2 12V8h4" />
          </svg>
        </button>
      </div>

      {/* Zoom level indicator */}
      {zoom > 1 && (
        <div className="absolute bottom-2 left-2 z-20 text-[10px] text-muted-foreground bg-background/70 backdrop-blur-sm px-2 py-0.5 rounded border border-border">
          {zoom.toFixed(1)}×
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${BASE_WIDTH} ${BASE_HEIGHT}`}
        className={cn("w-full h-full", isPanning ? "cursor-grabbing" : "cursor-grab")}
        xmlns="http://www.w3.org/2000/svg"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setIsPanning(false); setHoveredRegion(null); setTooltip(null); }}
      >
        <defs>
          <filter id="region-glow"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <filter id="marker-glow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <filter id="city-shadow"><feDropShadow dx="0" dy="0.5" stdDeviation="0.5" floodColor="black" floodOpacity="0.6" /></filter>
          <radialGradient id="selected-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(210, 80%, 35%)" /><stop offset="100%" stopColor="hsl(210, 60%, 22%)" />
          </radialGradient>
        </defs>

        <g transform={transformStr}>
          {/* Region paths */}
          {geoFeatures.map((feature) => {
            const id = (feature as any).id as string;
            const d = pathGenerator(feature);
            if (!d) return null;
            const data = getRegionData(id);
            const isSelected = selectedRegion === id;
            const isHovered = hoveredRegion === id;
            const name = getRegionName(feature);
            const incCount = data?.activeIncidents ?? 0;
            const hasCritical = (data?.criticalCount ?? 0) > 0;
            const fillColor = isSelected ? "url(#selected-grad)" : isHovered ? "hsl(215, 35%, 30%)" : getHeatmapColor(incCount, hasCritical);

            return (
              <g key={id} className="cursor-pointer"
                onMouseEnter={(e) => handleRegionMouseEnter(e, id, name)}
                onMouseLeave={handleRegionMouseLeave}
                onClick={() => { if (!isPanning) onSelectRegion(isSelected ? null : id); }}>
                <path d={d} className="transition-all duration-200 ease-out" fill={fillColor}
                  stroke={isSelected ? "hsl(24, 95%, 53%)" : hasCritical ? "hsl(0, 70%, 50%)" : isHovered ? "hsl(215, 60%, 55%)" : "hsl(215, 20%, 30%)"}
                  strokeWidth={(isSelected ? 2 : hasCritical ? 1.2 : isHovered ? 1 : 0.5) * invZoom}
                  filter={isSelected ? "url(#region-glow)" : undefined} />
              </g>
            );
          })}

          {/* ═══ CITY MARKERS ═══ */}
          {visibleCities.map((city) => {
            const dotR = city.tier === 1 ? 3 * invZoom : city.tier === 2 ? 2 * invZoom : 1.5 * invZoom;
            const fontSize = city.tier === 1 ? 10 * invZoom : city.tier === 2 ? 8 * invZoom : 7 * invZoom;
            const opacity = city.tier === 1 ? 0.95 : city.tier === 2 ? 0.8 : 0.65;

            return (
              <g key={city.name} opacity={opacity}>
                <circle cx={city.x} cy={city.y} r={dotR}
                  fill={city.tier === 1 ? "hsl(45, 100%, 70%)" : "hsl(215, 60%, 70%)"}
                  stroke="hsl(222, 47%, 10%)" strokeWidth={0.5 * invZoom} />
                <text x={city.x + dotR + 2 * invZoom} y={city.y + fontSize * 0.35}
                  fontSize={fontSize} fill="hsl(215, 20%, 75%)" filter="url(#city-shadow)"
                  fontFamily="system-ui, sans-serif" fontWeight={city.tier === 1 ? "600" : "400"}
                  className="pointer-events-none">
                  {city.name}
                </text>
                {/* Population label for tier 1 at higher zoom */}
                {city.tier === 1 && zoom >= 2 && (
                  <text x={city.x + dotR + 2 * invZoom} y={city.y + fontSize * 0.35 + fontSize}
                    fontSize={6 * invZoom} fill="hsl(215, 20%, 50%)"
                    fontFamily="system-ui, sans-serif"
                    className="pointer-events-none">
                    {(city.population / 1000).toFixed(1)}M
                  </text>
                )}
              </g>
            );
          })}

          {/* Incident Markers (clustered) */}
          {clusters.map((cluster, ci) => {
            if (cluster.incidents.length === 1) {
              const { incident, x, y } = cluster.incidents[0];
              const isHovered = hoveredIncidentId === incident.id;
              const isHighlighted = highlightedIncidentId === incident.id;
              const isOngoing = incident.status === "Ongoing" || incident.status === "On-Scene" || incident.status === "Dispatched";
              const isContainment = incident.status === "Containment";
              const isResolved = incident.status === "Resolved";
              const isCritical = incident.severity === "Critical";

              const markerColor = isResolved ? "hsl(142, 70%, 45%)" : isContainment ? "hsl(40, 90%, 50%)" : isCritical ? "hsl(0, 85%, 55%)" : "hsl(0, 70%, 50%)";
              const basePulse = isHovered || isHighlighted ? 18 : isCritical ? 14 : 10;
              const baseCore = isHovered || isHighlighted ? 8 : isCritical ? 6 : incident.severity === "Major" || incident.severity === "High" ? 5 : 4;
              const pulseSize = basePulse * invZoom;
              const coreSize = baseCore * invZoom;

              return (
                <g key={incident.id} filter="url(#marker-glow)">
                  {(isOngoing || isContainment) && (
                    <>
                      <circle cx={x} cy={y} r={pulseSize} fill={markerColor} opacity="0.15"
                        className={isOngoing ? "animate-ping" : undefined}
                        style={isContainment ? { animation: "ping 2s cubic-bezier(0,0,0.2,1) infinite" } : undefined} />
                      <circle cx={x} cy={y} r={pulseSize * 0.7} fill={markerColor} opacity="0.25" />
                    </>
                  )}
                  {isHighlighted && (
                    <circle cx={x} cy={y} r={20 * invZoom} fill="none" stroke="hsl(24, 95%, 53%)" strokeWidth={2 * invZoom}
                      className="animate-ping" opacity="0.6" />
                  )}
                  <circle cx={x} cy={y} r={coreSize} fill={markerColor}
                    stroke={isHighlighted ? "hsl(24, 95%, 53%)" : "hsl(222, 47%, 10%)"} strokeWidth={(isHighlighted ? 2.5 : 1.5) * invZoom}
                    className="cursor-pointer hover:opacity-80 transition-all"
                    onMouseEnter={(e) => handleIncidentMouseEnter(e, incident)}
                    onMouseLeave={handleIncidentMouseLeave}
                    onClick={(e) => { e.stopPropagation(); if (!isPanning) onSelectIncident?.(incident); }} />
                </g>
              );
            } else {
              // Cluster marker
              const hasCrit = cluster.incidents.some((i) => i.incident.severity === "Critical");
              return (
                <g key={`cluster-${ci}`}>
                  <circle cx={cluster.x} cy={cluster.y} r={16 * invZoom} fill={hasCrit ? "hsl(0, 70%, 30%)" : "hsl(215, 50%, 30%)"}
                    stroke={hasCrit ? "hsl(0, 70%, 50%)" : "hsl(215, 50%, 50%)"} strokeWidth={1.5 * invZoom} className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isPanning) onSelectIncident?.(cluster.incidents[0].incident);
                    }} />
                  <text x={cluster.x} y={cluster.y + 4 * invZoom} textAnchor="middle" fill="white" fontSize={11 * invZoom} fontWeight="bold"
                    className="pointer-events-none">
                    {cluster.incidents.length}
                  </text>
                </g>
              );
            }
          })}
        </g>
      </svg>

      {/* Floating Tooltip */}
      {tooltip?.incident && svgRef.current && (() => {
        const rect = svgRef.current!.getBoundingClientRect();
        const scaleX = rect.width / BASE_WIDTH;
        const scaleY = rect.height / BASE_HEIGHT;
        const pt = projection(tooltip.incident!.coordinates);
        if (!pt) return null;
        // Apply zoom+pan transform to get screen position
        const px = (pt[0] * zoom + pan.x) * scaleX;
        const py = (pt[1] * zoom + pan.y) * scaleY;
        const leftSide = px > rect.width / 2;

        return (
          <div className="absolute z-50 pointer-events-none"
            style={{ left: leftSide ? px - 8 : px + 8, top: py, transform: leftSide ? "translate(-100%, -50%)" : "translate(0%, -50%)" }}>
            <div className="bg-[hsl(222,47%,10%)] border border-[hsl(215,20%,25%)] rounded-lg p-3 shadow-xl min-w-[200px] max-w-[240px]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">
                  {tooltip.incident!.type === "Fire" ? "🔥" : tooltip.incident!.type === "Rescue" ? "🆘" :
                   tooltip.incident!.type === "Crime" ? "🚔" : tooltip.incident!.type === "EOD" ? "💣" :
                   tooltip.incident!.type === "Medical" ? "🚑" : "🌊"}
                </span>
                <p className="font-semibold text-xs text-white leading-tight">{tooltip.incident!.title}</p>
              </div>
              <div className="space-y-1 text-[11px] text-[hsl(215,20%,70%)]">
                <div className="flex justify-between"><span>Служба:</span><span className="text-white font-medium">{tooltip.incident!.lead_agency}</span></div>
                <div className="flex justify-between"><span>Особовий склад:</span><span className="text-white font-medium">{tooltip.incident!.resources.personnel_total}</span></div>
                <div className="flex gap-3 pt-1 border-t border-[hsl(215,20%,22%)]">
                  {tooltip.incident!.resources.ses_units > 0 && <span>🚒 {tooltip.incident!.resources.ses_units}</span>}
                  {tooltip.incident!.resources.police_units > 0 && <span>🚓 {tooltip.incident!.resources.police_units}</span>}
                  {tooltip.incident!.resources.medical_units > 0 && <span>🚑 {tooltip.incident!.resources.medical_units}</span>}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
});
UkraineMap.displayName = "UkraineMap";

export default UkraineMap;
