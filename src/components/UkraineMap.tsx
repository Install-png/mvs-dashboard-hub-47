import { useState, useEffect, useMemo, useCallback } from "react";
import { geoMercator, geoPath } from "d3-geo";
import * as topojson from "topojson-client";
import { cn } from "@/lib/utils";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { FeatureCollection, Feature, Geometry } from "geojson";
import type { Incident, SeverityLevel } from "@/data/mockIncidents";

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
}

export const REGION_NAME_MAP: Record<string, string> = {
  "crimea": "АР Крим",
  "mk": "Миколаївська",
  "cn": "Чернігівська",
  "rv": "Рівненська",
  "cv": "Чернівецька",
  "if": "Івано-Франківська",
  "km": "Хмельницька",
  "lviv": "Львівська",
  "te": "Тернопільська",
  "uz": "Закарпатська",
  "volyn": "Волинська",
  "ck": "Черкаська",
  "kr": "Кіровоградська",
  "kiev": "Київська",
  "od": "Одеська",
  "vn": "Вінницька",
  "zt": "Житомирська",
  "sm": "Сумська",
  "dp": "Дніпропетровська",
  "dn": "Донецька",
  "kh": "Харківська",
  "lg": "Луганська",
  "pl": "Полтавська",
  "zp": "Запорізька",
  "ks": "Херсонська",
};

const HEATMAP_COLORS = {
  0: "hsl(215, 20%, 16%)",
  1: "hsl(215, 30%, 20%)",
  2: "hsl(220, 40%, 22%)",
  3: "hsl(30, 50%, 22%)",
  4: "hsl(20, 60%, 24%)",
  5: "hsl(10, 70%, 26%)",
};

function getHeatmapColor(count: number, hasCritical: boolean): string {
  if (hasCritical) return "hsl(0, 55%, 22%)";
  const key = Math.min(count, 5) as keyof typeof HEATMAP_COLORS;
  return HEATMAP_COLORS[key];
}

interface TooltipState {
  x: number;
  y: number;
  incident: Incident | null;
  regionId: string | null;
  regionName: string;
}

const UkraineMap = ({ regions, incidents, selectedRegion, onSelectRegion, onSelectIncident }: UkraineMapProps) => {
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [geoFeatures, setGeoFeatures] = useState<Feature<Geometry, RegionProperties>[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [svgRef, setSvgRef] = useState<SVGSVGElement | null>(null);

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

  const width = 800;
  const height = 520;

  const projection = useMemo(
    () =>
      geoMercator()
        .center([31.5, 48.5])
        .scale(3200)
        .translate([width / 2, height / 2]),
    []
  );

  const pathGenerator = useMemo(() => geoPath().projection(projection), [projection]);

  const getRegionData = useCallback(
    (id: string): RegionData | undefined => regions.find((r) => r.id === id),
    [regions]
  );

  const getRegionName = (feature: Feature<Geometry, RegionProperties>): string => {
    const id = (feature as any).id as string;
    return REGION_NAME_MAP[id] || feature.properties?.localized_name?.ua || feature.properties?.name || id;
  };

  // Project incident coordinates to SVG space
  const projectedIncidents = useMemo(() => {
    return incidents.map((inc) => {
      const pt = projection(inc.coordinates);
      return { incident: inc, x: pt ? pt[0] : null, y: pt ? pt[1] : null };
    });
  }, [incidents, projection]);

  const handleRegionMouseEnter = (e: React.MouseEvent, id: string, name: string) => {
    setHoveredRegion(id);
    setTooltip({ x: 0, y: 0, incident: null, regionId: id, regionName: name });
  };

  const handleRegionMouseLeave = () => {
    setHoveredRegion(null);
    setTooltip(null);
  };

  const handleIncidentMouseEnter = (e: React.MouseEvent<SVGCircleElement>, incident: Incident) => {
    e.stopPropagation();
    const svgEl = svgRef;
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    const pt = projection(incident.coordinates);
    if (!pt) return;
    setTooltip({ x: pt[0] / scaleX, y: pt[1] / scaleY, incident, regionId: null, regionName: "" });
  };

  const handleIncidentMouseLeave = () => {
    setTooltip(null);
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <svg
        ref={setSvgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        onMouseLeave={() => { setHoveredRegion(null); setTooltip(null); }}
      >
        <defs>
          <filter id="region-glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="marker-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="selected-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(210, 80%, 35%)" />
            <stop offset="100%" stopColor="hsl(210, 60%, 22%)" />
          </radialGradient>
        </defs>

        {/* Region paths */}
        {geoFeatures.map((feature) => {
          const id = (feature as any).id as string;
          const d = pathGenerator(feature);
          if (!d) return null;

          const data = getRegionData(id);
          const isSelected = selectedRegion === id;
          const isHovered = hoveredRegion === id;
          const name = getRegionName(feature);
          const incidents_count = data?.activeIncidents ?? 0;
          const hasCritical = (data?.criticalCount ?? 0) > 0;

          const fillColor = isSelected
            ? "url(#selected-grad)"
            : isHovered
            ? "hsl(215, 35%, 30%)"
            : getHeatmapColor(incidents_count, hasCritical);

          return (
            <g
              key={id}
              className="cursor-pointer"
              onMouseEnter={(e) => handleRegionMouseEnter(e, id, name)}
              onMouseLeave={handleRegionMouseLeave}
              onClick={() => onSelectRegion(isSelected ? null : id)}
            >
              <path
                d={d}
                className="transition-all duration-200 ease-out"
                fill={fillColor}
                stroke={
                  isSelected
                    ? "hsl(24, 95%, 53%)"
                    : hasCritical
                    ? "hsl(0, 70%, 50%)"
                    : isHovered
                    ? "hsl(215, 60%, 55%)"
                    : "hsl(215, 20%, 30%)"
                }
                strokeWidth={isSelected ? 2 : hasCritical ? 1.2 : isHovered ? 1 : 0.5}
                filter={isSelected ? "url(#region-glow)" : undefined}
              />
            </g>
          );
        })}

        {/* Incident Markers */}
        {projectedIncidents.map(({ incident, x, y }) => {
          if (x === null || y === null) return null;
          if (x < 0 || x > width || y < 0 || y > height) return null;

          const isOngoing = incident.status === "Ongoing";
          const isContainment = incident.status === "Containment";
          const isResolved = incident.status === "Resolved";
          const isCritical = incident.severity === "Critical";

          const markerColor = isResolved
            ? "hsl(142, 70%, 45%)"
            : isContainment
            ? "hsl(40, 90%, 50%)"
            : isCritical
            ? "hsl(0, 85%, 55%)"
            : "hsl(0, 70%, 50%)";

          return (
            <g key={incident.id} filter="url(#marker-glow)">
              {/* Ping animation for active */}
              {(isOngoing || isContainment) && (
                <>
                  <circle
                    cx={x}
                    cy={y}
                    r={isCritical ? 14 : 10}
                    fill={markerColor}
                    opacity="0.15"
                    className={isOngoing ? "animate-ping" : undefined}
                    style={isContainment ? { animation: "ping 2s cubic-bezier(0,0,0.2,1) infinite" } : undefined}
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={isCritical ? 9 : 7}
                    fill={markerColor}
                    opacity="0.25"
                  />
                </>
              )}
              {/* Core dot */}
              <circle
                cx={x}
                cy={y}
                r={isCritical ? 6 : incident.severity === "Major" ? 5 : 4}
                fill={markerColor}
                stroke="hsl(222, 47%, 10%)"
                strokeWidth="1.5"
                className="cursor-pointer hover:opacity-80 transition-opacity"
                onMouseEnter={(e) => handleIncidentMouseEnter(e, incident)}
                onMouseLeave={handleIncidentMouseLeave}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectIncident?.(incident);
                }}
              />
            </g>
          );
        })}
      </svg>

      {/* Floating Tooltip */}
      {tooltip && tooltip.incident && svgRef && (() => {
        const rect = svgRef.getBoundingClientRect();
        const scaleX = rect.width / width;
        const scaleY = rect.height / height;
        const pt = projection(tooltip.incident.coordinates);
        if (!pt) return null;
        const px = pt[0] * scaleX;
        const py = pt[1] * scaleY;
        const leftSide = px > rect.width / 2;

        return (
          <div
            className="absolute z-50 pointer-events-none"
            style={{
              left: leftSide ? px - 8 : px + 8,
              top: py,
              transform: leftSide ? "translate(-100%, -50%)" : "translate(0%, -50%)",
            }}
          >
            <div className="bg-[hsl(222,47%,10%)] border border-[hsl(215,20%,25%)] rounded-lg p-3 shadow-xl min-w-[200px] max-w-[240px]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">
                  {tooltip.incident.type === "Fire" ? "🔥" :
                   tooltip.incident.type === "Rescue" ? "🆘" :
                   tooltip.incident.type === "Crime" ? "🚔" :
                   tooltip.incident.type === "EOD" ? "💣" :
                   tooltip.incident.type === "Medical" ? "🚑" : "🌊"}
                </span>
                <p className="font-semibold text-xs text-white leading-tight">{tooltip.incident.title}</p>
              </div>
              <div className="space-y-1 text-[11px] text-[hsl(215,20%,70%)]">
                <div className="flex justify-between">
                  <span>Служба:</span>
                  <span className="text-white font-medium">{tooltip.incident.lead_agency}</span>
                </div>
                <div className="flex justify-between">
                  <span>Особовий склад:</span>
                  <span className="text-white font-medium">{tooltip.incident.resources.personnel_total}</span>
                </div>
                <div className="flex gap-3 pt-1 border-t border-[hsl(215,20%,22%)]">
                  {tooltip.incident.resources.ses_units > 0 && <span>🚒 {tooltip.incident.resources.ses_units}</span>}
                  {tooltip.incident.resources.police_units > 0 && <span>🚓 {tooltip.incident.resources.police_units}</span>}
                  {tooltip.incident.resources.medical_units > 0 && <span>🚑 {tooltip.incident.resources.medical_units}</span>}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default UkraineMap;
