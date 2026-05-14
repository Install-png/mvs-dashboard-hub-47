import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

export type Language = "ua" | "en";

type Dict = Record<string, string>;

const TRANSLATIONS: Record<Language, Dict> = {
  ua: {
    "app.title": "МВС Панель",
    "nav.dashboard": "Дашборд",
    "nav.situation": "Ситуаційний центр",
    "nav.calendar": "Календар",
    "nav.reports": "Звіти",
    "nav.settings": "Налаштування",
    "nav.theme.light": "Світла тема",
    "nav.theme.dark": "Темна тема",
    "nav.signout": "Вийти",

    "settings.title": "Налаштування інтерфейсу",
    "settings.subtitle": "Підлаштуйте систему під себе — кольори, шрифти, щільність та анімації застосовуються миттєво.",
    "settings.reset": "Скинути",
    "settings.reset.toast": "Налаштування скинуто",
    "settings.tab.appearance": "Вигляд",
    "settings.tab.typography": "Типографіка",
    "settings.tab.layout": "Макет",
    "settings.tab.map": "Карта",
    "settings.tab.language": "Мова",
    "settings.tab.about": "Про систему",

    "settings.theme.title": "Тема оформлення",
    "settings.theme.desc": "Світла або темна — обирайте за умовами роботи.",
    "settings.theme.light": "Світла",
    "settings.theme.dark": "Темна",
    "settings.accent.title": "Акцентний колір",
    "settings.accent.desc": "Основний колір кнопок, посилань та маркерів.",
    "settings.accent.current": "Поточний",
    "settings.anim.title": "Анімації та ефекти",
    "settings.anim.transitions": "Анімації переходів",
    "settings.anim.transitions.desc": "Плавні переходи між станами елементів",
    "settings.anim.reduced": "Зменшений рух",
    "settings.anim.reduced.desc": "Для людей з вестибулярною чутливістю",
    "settings.anim.contrast": "Високий контраст",
    "settings.anim.contrast.desc": "Покращена читабельність",

    "settings.lang.title": "Мова інтерфейсу",
    "settings.lang.desc": "Перемикайте мову системи без перезавантаження.",
    "settings.lang.ua": "Українська",
    "settings.lang.en": "English",
    "settings.lang.toast": "Мову змінено",

    "settings.map.title": "Налаштування карти України",
    "settings.map.desc": "Налаштуйте відображення мапи та маркерів інцидентів.",
    "settings.map.detail": "Рівень деталізації",
    "settings.map.detail.low": "Низький — лише області",
    "settings.map.detail.medium": "Середній — області + великі міста",
    "settings.map.detail.high": "Високий — усі міста та маркери",
    "settings.map.zoom": "Стартовий масштаб",
    "settings.map.highlight": "Підсвітка областей",
    "settings.map.highlight.heat": "Теплова карта (за кількістю інцидентів)",
    "settings.map.highlight.severity": "За критичністю",
    "settings.map.highlight.flat": "Однотонна",
    "settings.map.markers": "Стиль маркерів",
    "settings.map.markers.dot": "Крапки",
    "settings.map.markers.pin": "Шпильки",
    "settings.map.markers.pulse": "Пульсуючі",
    "settings.map.cluster": "Групувати близькі маркери",
    "settings.map.cluster.desc": "Об'єднує інциденти в радіусі для зручності.",
    "settings.map.labels": "Показувати назви областей",
  },
  en: {
    "app.title": "MIA Panel",
    "nav.dashboard": "Dashboard",
    "nav.situation": "Situation Center",
    "nav.calendar": "Calendar",
    "nav.reports": "Reports",
    "nav.settings": "Settings",
    "nav.theme.light": "Light theme",
    "nav.theme.dark": "Dark theme",
    "nav.signout": "Sign out",

    "settings.title": "Interface settings",
    "settings.subtitle": "Customize the system — colors, fonts, density and animations apply instantly.",
    "settings.reset": "Reset",
    "settings.reset.toast": "Settings reset",
    "settings.tab.appearance": "Appearance",
    "settings.tab.typography": "Typography",
    "settings.tab.layout": "Layout",
    "settings.tab.map": "Map",
    "settings.tab.language": "Language",
    "settings.tab.about": "About",

    "settings.theme.title": "Color theme",
    "settings.theme.desc": "Light or dark — choose what suits your environment.",
    "settings.theme.light": "Light",
    "settings.theme.dark": "Dark",
    "settings.accent.title": "Accent color",
    "settings.accent.desc": "Primary color for buttons, links and markers.",
    "settings.accent.current": "Current",
    "settings.anim.title": "Animations & effects",
    "settings.anim.transitions": "Transition animations",
    "settings.anim.transitions.desc": "Smooth transitions between element states",
    "settings.anim.reduced": "Reduced motion",
    "settings.anim.reduced.desc": "For users with vestibular sensitivity",
    "settings.anim.contrast": "High contrast",
    "settings.anim.contrast.desc": "Improved readability",

    "settings.lang.title": "Interface language",
    "settings.lang.desc": "Switch language without reloading.",
    "settings.lang.ua": "Ukrainian",
    "settings.lang.en": "English",
    "settings.lang.toast": "Language changed",

    "settings.map.title": "Ukraine map settings",
    "settings.map.desc": "Configure map rendering and incident markers.",
    "settings.map.detail": "Detail level",
    "settings.map.detail.low": "Low — regions only",
    "settings.map.detail.medium": "Medium — regions + major cities",
    "settings.map.detail.high": "High — all cities and markers",
    "settings.map.zoom": "Default zoom",
    "settings.map.highlight": "Region highlight",
    "settings.map.highlight.heat": "Heatmap (by incident count)",
    "settings.map.highlight.severity": "By severity",
    "settings.map.highlight.flat": "Flat",
    "settings.map.markers": "Marker style",
    "settings.map.markers.dot": "Dots",
    "settings.map.markers.pin": "Pins",
    "settings.map.markers.pulse": "Pulsing",
    "settings.map.cluster": "Cluster nearby markers",
    "settings.map.cluster.desc": "Groups incidents within a radius for clarity.",
    "settings.map.labels": "Show region labels",
  },
};

interface Ctx {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: string) => string;
}

const I18nCtx = createContext<Ctx>({ lang: "ua", setLang: () => {}, t: (k) => k });
const STORAGE_KEY = "ui_lang_v1";

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Language>(() => {
    if (typeof window === "undefined") return "ua";
    return (localStorage.getItem(STORAGE_KEY) as Language) || "ua";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang === "ua" ? "uk" : "en";
  }, [lang]);

  const setLang = useCallback((l: Language) => setLangState(l), []);
  const t = useCallback((key: string) => TRANSLATIONS[lang][key] ?? TRANSLATIONS.ua[key] ?? key, [lang]);

  return <I18nCtx.Provider value={{ lang, setLang, t }}>{children}</I18nCtx.Provider>;
};

export const useI18n = () => useContext(I18nCtx);
