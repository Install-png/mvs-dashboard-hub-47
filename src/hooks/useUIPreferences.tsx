import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";

export type AccentColor = "orange" | "blue" | "green" | "purple" | "red" | "teal";
export type FontScale = "sm" | "md" | "lg" | "xl";
export type Density = "compact" | "comfortable" | "spacious";
export type FontFamily = "montserrat" | "inter" | "roboto" | "system";
export type Radius = "none" | "sm" | "md" | "lg" | "xl";

interface UIPrefs {
  accent: AccentColor;
  fontScale: FontScale;
  density: Density;
  fontFamily: FontFamily;
  radius: Radius;
  animations: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  sidebarCollapsed: boolean;
}

interface UIPrefsCtx extends UIPrefs {
  setPref: <K extends keyof UIPrefs>(key: K, value: UIPrefs[K]) => void;
  reset: () => void;
}

const DEFAULTS: UIPrefs = {
  accent: "orange",
  fontScale: "md",
  density: "comfortable",
  fontFamily: "montserrat",
  radius: "md",
  animations: true,
  reducedMotion: false,
  highContrast: false,
  sidebarCollapsed: false,
};

const ACCENT_HSL: Record<AccentColor, string> = {
  orange: "24 95% 53%",
  blue: "217 91% 60%",
  green: "142 71% 45%",
  purple: "262 83% 58%",
  red: "0 84% 60%",
  teal: "173 80% 40%",
};

const FONT_SCALE_PX: Record<FontScale, string> = {
  sm: "14px",
  md: "16px",
  lg: "18px",
  xl: "20px",
};

const RADIUS_REM: Record<Radius, string> = {
  none: "0rem",
  sm: "0.375rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.5rem",
};

const FONT_STACK: Record<FontFamily, string> = {
  montserrat: "'Montserrat', sans-serif",
  inter: "'Inter', system-ui, sans-serif",
  roboto: "'Roboto', sans-serif",
  system: "system-ui, -apple-system, sans-serif",
};

const STORAGE_KEY = "ui_prefs_v1";

const Ctx = createContext<UIPrefsCtx>({
  ...DEFAULTS,
  setPref: () => {},
  reset: () => {},
});

export const UIPreferencesProvider = ({ children }: { children: ReactNode }) => {
  const [prefs, setPrefs] = useState<UIPrefs>(() => {
    if (typeof window === "undefined") return DEFAULTS;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    const accent = ACCENT_HSL[prefs.accent];
    root.style.setProperty("--primary", accent);
    root.style.setProperty("--ring", accent);
    root.style.setProperty("--sidebar-primary", accent);
    root.style.setProperty("--sidebar-ring", accent);
    root.style.setProperty("--radius", RADIUS_REM[prefs.radius]);
    root.style.fontSize = FONT_SCALE_PX[prefs.fontScale];

    document.body.style.fontFamily = FONT_STACK[prefs.fontFamily];

    root.dataset.density = prefs.density;
    root.classList.toggle("no-animations", !prefs.animations || prefs.reducedMotion);
    root.classList.toggle("high-contrast", prefs.highContrast);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  const setPref = useCallback(<K extends keyof UIPrefs>(key: K, value: UIPrefs[K]) => {
    setPrefs((p) => ({ ...p, [key]: value }));
  }, []);

  const reset = useCallback(() => setPrefs(DEFAULTS), []);

  return <Ctx.Provider value={{ ...prefs, setPref, reset }}>{children}</Ctx.Provider>;
};

export const useUIPreferences = () => useContext(Ctx);
export const ACCENT_OPTIONS: { value: AccentColor; label: string; hsl: string }[] = [
  { value: "orange", label: "Помаранчевий (МВС)", hsl: ACCENT_HSL.orange },
  { value: "blue", label: "Синій", hsl: ACCENT_HSL.blue },
  { value: "green", label: "Зелений", hsl: ACCENT_HSL.green },
  { value: "purple", label: "Фіолетовий", hsl: ACCENT_HSL.purple },
  { value: "red", label: "Червоний", hsl: ACCENT_HSL.red },
  { value: "teal", label: "Бірюзовий", hsl: ACCENT_HSL.teal },
];
