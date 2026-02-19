import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface RegionData {
  id: string;
  name: string;
  activeIncidents: number;
}

interface UkraineMapProps {
  regions: RegionData[];
  selectedRegion: string | null;
  onSelectRegion: (id: string | null) => void;
}

// Simplified SVG path data for Ukrainian oblasts (approximate shapes for dashboard use)
const OBLAST_PATHS: { id: string; name: string; d: string; labelX: number; labelY: number }[] = [
  { id: "kyiv-city", name: "м. Київ", d: "M390,195 L395,190 L402,192 L404,198 L398,202 L392,200Z", labelX: 397, labelY: 196 },
  { id: "kyiv", name: "Київська", d: "M365,170 L385,160 L410,165 L425,180 L420,205 L405,215 L380,210 L360,195Z", labelX: 390, labelY: 190 },
  { id: "chernihiv", name: "Чернігівська", d: "M370,100 L410,90 L450,100 L460,130 L440,160 L410,165 L385,160 L365,140Z", labelX: 415, labelY: 130 },
  { id: "sumy", name: "Сумська", d: "M450,100 L490,85 L530,95 L540,130 L520,155 L480,160 L460,150 L460,130Z", labelX: 495, labelY: 125 },
  { id: "zhytomyr", name: "Житомирська", d: "M290,155 L330,145 L365,155 L365,170 L360,195 L340,210 L310,215 L285,200 L280,175Z", labelX: 322, labelY: 180 },
  { id: "cherkasy", name: "Черкаська", d: "M380,210 L405,215 L425,225 L430,250 L415,270 L390,275 L370,260 L365,235Z", labelX: 398, labelY: 245 },
  { id: "poltava", name: "Полтавська", d: "M440,160 L480,160 L520,155 L530,180 L520,210 L490,220 L460,215 L440,200 L425,180Z", labelX: 480, labelY: 190 },
  { id: "kharkiv", name: "Харківська", d: "M530,130 L570,115 L600,125 L610,160 L600,195 L570,210 L540,200 L520,180 L520,155Z", labelX: 565, labelY: 165 },
  { id: "luhansk", name: "Луганська", d: "M600,125 L640,115 L665,130 L670,170 L650,200 L620,210 L600,195 L610,160Z", labelX: 635, labelY: 162 },
  { id: "donetsk", name: "Донецька", d: "M570,210 L620,210 L650,200 L660,230 L645,265 L610,280 L575,270 L555,245 L560,220Z", labelX: 610, labelY: 245 },
  { id: "dnipro", name: "Дніпропетровська", d: "M490,220 L540,200 L570,210 L560,220 L555,245 L540,270 L510,280 L480,270 L470,245Z", labelX: 518, labelY: 245 },
  { id: "zaporizhzhia", name: "Запорізька", d: "M510,280 L540,270 L575,270 L585,300 L570,330 L535,340 L505,325 L495,300Z", labelX: 540, labelY: 305 },
  { id: "kirovohrad", name: "Кіровоградська", d: "M370,260 L415,270 L430,250 L460,260 L470,245 L480,270 L460,295 L430,305 L395,300 L370,285Z", labelX: 425, labelY: 280 },
  { id: "mykolaiv", name: "Миколаївська", d: "M395,300 L430,305 L460,295 L480,310 L475,340 L450,360 L420,365 L395,350 L385,325Z", labelX: 435, labelY: 335 },
  { id: "kherson", name: "Херсонська", d: "M480,310 L505,325 L535,340 L540,370 L520,395 L490,400 L460,390 L445,365 L450,360 L475,340Z", labelX: 495, labelY: 360 },
  { id: "odesa", name: "Одеська", d: "M280,300 L320,290 L370,285 L395,300 L385,325 L395,350 L380,380 L350,400 L310,410 L280,395 L270,360 L265,330Z", labelX: 330, labelY: 350 },
  { id: "vinnytsia", name: "Вінницька", d: "M285,200 L340,210 L365,235 L370,260 L370,285 L340,290 L310,280 L280,260 L270,230Z", labelX: 320, labelY: 250 },
  { id: "khmelnytskyi", name: "Хмельницька", d: "M230,180 L280,175 L290,195 L285,200 L270,230 L250,240 L225,235 L210,215 L215,195Z", labelX: 250, labelY: 210 },
  { id: "ternopil", name: "Тернопільська", d: "M180,195 L215,195 L225,215 L225,235 L210,250 L185,250 L170,235 L168,215Z", labelX: 197, labelY: 225 },
  { id: "rivne", name: "Рівненська", d: "M220,130 L265,120 L290,135 L290,155 L280,175 L250,180 L225,175 L210,155Z", labelX: 252, labelY: 152 },
  { id: "volyn", name: "Волинська", d: "M155,115 L195,105 L220,115 L225,130 L220,155 L195,165 L170,155 L150,135Z", labelX: 188, labelY: 135 },
  { id: "lviv", name: "Львівська", d: "M140,155 L170,155 L195,165 L210,180 L215,195 L195,210 L168,215 L145,205 L130,185 L130,170Z", labelX: 170, labelY: 185 },
  { id: "ivano-frankivsk", name: "Івано-Франківська", d: "M145,220 L168,215 L185,225 L185,250 L170,265 L150,265 L135,250 L135,235Z", labelX: 160, labelY: 242 },
  { id: "zakarpattia", name: "Закарпатська", d: "M100,235 L125,225 L140,235 L145,255 L135,275 L115,280 L95,270 L90,250Z", labelX: 118, labelY: 255 },
  { id: "chernivtsi", name: "Чернівецька", d: "M185,255 L210,250 L225,260 L230,280 L215,295 L195,295 L180,280Z", labelX: 205, labelY: 275 },
  { id: "crimea", name: "АР Крим", d: "M430,400 L470,395 L510,400 L540,410 L560,430 L540,450 L510,455 L475,448 L445,435 L425,420Z", labelX: 490, labelY: 430 },
];

const UkraineMap = ({ regions, selectedRegion, onSelectRegion }: UkraineMapProps) => {
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);

  const getRegionData = (id: string): RegionData | undefined =>
    regions.find((r) => r.id === id);

  return (
    <svg
      viewBox="70 70 620 410"
      className="w-full h-full"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {OBLAST_PATHS.map((oblast) => {
        const data = getRegionData(oblast.id);
        const isSelected = selectedRegion === oblast.id;
        const isHovered = hoveredRegion === oblast.id;
        const hasIncidents = data && data.activeIncidents > 0;

        return (
          <Tooltip key={oblast.id}>
            <TooltipTrigger asChild>
              <g
                className="cursor-pointer"
                onMouseEnter={() => setHoveredRegion(oblast.id)}
                onMouseLeave={() => setHoveredRegion(null)}
                onClick={() => onSelectRegion(isSelected ? null : oblast.id)}
              >
                <path
                  d={oblast.d}
                  className={cn(
                    "transition-all duration-300 ease-out",
                    isSelected
                      ? "fill-[hsl(210,80%,35%)] stroke-[hsl(24,95%,53%)] stroke-[2.5]"
                      : isHovered
                      ? "fill-[hsl(215,30%,35%)] stroke-[hsl(215,40%,55%)] stroke-[1.5]"
                      : hasIncidents
                      ? "fill-[hsl(215,25%,22%)] stroke-[hsl(215,20%,32%)] stroke-[0.8]"
                      : "fill-[hsl(215,20%,18%)] stroke-[hsl(215,15%,28%)] stroke-[0.5]"
                  )}
                  filter={isSelected ? "url(#glow)" : undefined}
                />
                {/* Pulsing incident dot */}
                {hasIncidents && (
                  <>
                    <circle
                      cx={oblast.labelX}
                      cy={oblast.labelY}
                      r="4"
                      className="fill-destructive animate-ping opacity-75"
                    />
                    <circle
                      cx={oblast.labelX}
                      cy={oblast.labelY}
                      r="3"
                      className="fill-destructive"
                    />
                  </>
                )}
              </g>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="bg-popover border-border text-popover-foreground px-3 py-2"
            >
              <p className="font-semibold text-sm">{oblast.name}</p>
              <p className="text-xs text-muted-foreground">
                Активних інцидентів: {data?.activeIncidents ?? 0}
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </svg>
  );
};

export { OBLAST_PATHS };
export default UkraineMap;
