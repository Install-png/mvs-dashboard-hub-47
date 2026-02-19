import { useState, useEffect, useMemo, useCallback } from "react";
import { geoMercator, geoPath } from "d3-geo";
import * as topojson from "topojson-client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { FeatureCollection, Feature, Geometry } from "geojson";

export interface RegionData {
  id: string;
  name: string;
  activeIncidents: number;
}

interface RegionProperties {
  name: string;
  localized_name?: { ua: string };
  label_point?: [number, number];
}

interface UkraineMapProps {
  regions: RegionData[];
  selectedRegion: string | null;
  onSelectRegion: (id: string | null) => void;
}

const REGION_NAME_MAP: Record<string, string> = {
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

const UkraineMap = ({ regions, selectedRegion, onSelectRegion }: UkraineMapProps) => {
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [geoFeatures, setGeoFeatures] = useState<Feature<Geometry, RegionProperties>[]>([]);
  const [loading, setLoading] = useState(true);

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
  const height = 550;

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

  const getLabelPoint = (feature: Feature<Geometry, RegionProperties>): [number, number] | null => {
    const lp = feature.properties?.label_point;
    if (lp) {
      const projected = projection(lp);
      return projected as [number, number];
    }
    return null;
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id="region-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="drop-shadow">
          <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Country outline shadow */}
      {geoFeatures.map((feature) => {
        const d = pathGenerator(feature);
        if (!d) return null;
        return (
          <path
            key={`shadow-${(feature as any).id}`}
            d={d}
            fill="none"
            stroke="hsl(215, 20%, 25%)"
            strokeWidth="0.3"
            opacity="0.3"
          />
        );
      })}

      {/* Region paths */}
      {geoFeatures.map((feature) => {
        const id = (feature as any).id as string;
        const d = pathGenerator(feature);
        if (!d) return null;

        const data = getRegionData(id);
        const isSelected = selectedRegion === id;
        const isHovered = hoveredRegion === id;
        const hasIncidents = data && data.activeIncidents > 0;
        const name = getRegionName(feature);
        const incidents = data?.activeIncidents ?? 0;

        return (
          <Tooltip key={id}>
            <TooltipTrigger asChild>
              <g
                className="cursor-pointer"
                onMouseEnter={() => setHoveredRegion(id)}
                onMouseLeave={() => setHoveredRegion(null)}
                onClick={() => onSelectRegion(isSelected ? null : id)}
              >
                <path
                  d={d}
                  className="transition-all duration-200 ease-out"
                  fill={
                    isSelected
                      ? "hsl(210, 80%, 30%)"
                      : isHovered
                      ? "hsl(215, 35%, 30%)"
                      : hasIncidents
                      ? "hsl(215, 25%, 20%)"
                      : "hsl(215, 20%, 16%)"
                  }
                  stroke={
                    isSelected
                      ? "hsl(24, 95%, 53%)"
                      : isHovered
                      ? "hsl(215, 50%, 50%)"
                      : "hsl(215, 20%, 28%)"
                  }
                  strokeWidth={isSelected ? 2 : isHovered ? 1.2 : 0.6}
                  filter={isSelected ? "url(#region-glow)" : undefined}
                />

                {/* Pulsing incident markers */}
                {hasIncidents && (() => {
                  const pt = getLabelPoint(feature);
                  if (!pt) return null;
                  return (
                    <>
                      <circle cx={pt[0]} cy={pt[1]} r="6" className="fill-destructive opacity-30 animate-ping" />
                      <circle cx={pt[0]} cy={pt[1]} r="4" className="fill-destructive" />
                      <text
                        x={pt[0]}
                        y={pt[1] + 1}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="fill-white text-[7px] font-bold pointer-events-none"
                      >
                        {incidents}
                      </text>
                    </>
                  );
                })()}
              </g>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="bg-popover border-border text-popover-foreground px-3 py-2 z-50"
            >
              <p className="font-semibold text-sm">{name}</p>
              <p className="text-xs text-muted-foreground">
                Активних інцидентів: {incidents}
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </svg>
  );
};

export { REGION_NAME_MAP };
export default UkraineMap;
