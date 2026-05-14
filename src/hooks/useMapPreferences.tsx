import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

export type MapDetail = "low" | "medium" | "high";
export type MapHighlight = "heat" | "severity" | "flat";
export type MapMarker = "dot" | "pin" | "pulse";

export interface MapPrefs {
  detail: MapDetail;
  defaultZoom: number; // 1..8
  highlight: MapHighlight;
  marker: MapMarker;
  cluster: boolean;
  showLabels: boolean;
}

const DEFAULTS: MapPrefs = {
  detail: "high",
  defaultZoom: 1,
  highlight: "heat",
  marker: "pulse",
  cluster: true,
  showLabels: true,
};

const STORAGE_KEY = "map_prefs_v1";

interface Ctx extends MapPrefs {
  setPref: <K extends keyof MapPrefs>(k: K, v: MapPrefs[K]) => void;
  reset: () => void;
}

const MapCtx = createContext<Ctx>({ ...DEFAULTS, setPref: () => {}, reset: () => {} });

export const MapPreferencesProvider = ({ children }: { children: ReactNode }) => {
  const [prefs, setPrefs] = useState<MapPrefs>(() => {
    if (typeof window === "undefined") return DEFAULTS;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  const setPref = useCallback(<K extends keyof MapPrefs>(k: K, v: MapPrefs[K]) => {
    setPrefs((p) => ({ ...p, [k]: v }));
  }, []);
  const reset = useCallback(() => setPrefs(DEFAULTS), []);

  return <MapCtx.Provider value={{ ...prefs, setPref, reset }}>{children}</MapCtx.Provider>;
};

export const useMapPreferences = () => useContext(MapCtx);
