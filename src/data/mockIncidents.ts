export type IncidentType = "Fire" | "Rescue" | "Crime" | "EOD" | "Medical" | "Flood";
export type IncidentStatus = "Ongoing" | "Containment" | "Resolved";
export type SeverityLevel = "Critical" | "Major" | "Minor";

export const VALID_STATUSES: IncidentStatus[] = ["Ongoing", "Containment", "Resolved"];
export const VALID_SEVERITIES: SeverityLevel[] = ["Critical", "Major", "Minor"];
export const VALID_TYPES: IncidentType[] = ["Fire", "Rescue", "Crime", "EOD", "Medical", "Flood"];

export interface Incident {
  id: string;
  timestamp: string;
  coordinates: [number, number]; // [lng, lat]
  region: string; // oblast id
  regionName: string;
  title: string;
  type: IncidentType;
  status: IncidentStatus;
  severity: SeverityLevel;
  resources: {
    ses_units: number;
    police_units: number;
    medical_units: number;
    personnel_total: number;
  };
  impact: {
    rescued: number;
    injured: number;
    fatalities: number;
    damage_est: string;
    damage_uah: number;
  };
  estimated_resolution_time: string; // ISO string
  risk_level: number; // 1-10
  description: string;
  lead_agency: string;
}

const now = new Date();
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600000).toISOString();

export const MOCK_INCIDENTS: Incident[] = [
  {
    id: "inc-001",
    timestamp: hoursAgo(2),
    coordinates: [30.5234, 50.4501],
    region: "kiev",
    regionName: "Київська",
    title: "Пожежа на промисловому об'єкті",
    type: "Fire",
    status: "Ongoing",
    severity: "Critical",
    resources: { ses_units: 8, police_units: 4, medical_units: 3, personnel_total: 42 },
    impact: { rescued: 5, injured: 3, fatalities: 0, damage_est: "Значні руйнування", damage_uah: 4500000 },
    estimated_resolution_time: new Date(now.getTime() + 3 * 3600000).toISOString(),
    risk_level: 9,
    description: "Масштабна пожежа на складі хімічних речовин. Задіяно 8 пожежних розрахунків ДСНС. Евакуйовано 200 осіб з прилеглої зони.",
    lead_agency: "ДСНС",
  },
  {
    id: "inc-002",
    timestamp: hoursAgo(5),
    coordinates: [23.9936, 49.8397],
    region: "lviv",
    regionName: "Львівська",
    title: "Обвал будівлі — рятувальна операція",
    type: "Rescue",
    status: "Ongoing",
    severity: "Critical",
    resources: { ses_units: 12, police_units: 6, medical_units: 5, personnel_total: 67 },
    impact: { rescued: 11, injured: 7, fatalities: 2, damage_est: "Повне руйнування", damage_uah: 12000000 },
    estimated_resolution_time: new Date(now.getTime() + 6 * 3600000).toISOString(),
    risk_level: 10,
    description: "Обвал 5-поверхової будівлі внаслідок вибуху газу. Під завалами перебуває орієнтовно 4 особи. Задіяно важку техніку ДСНС.",
    lead_agency: "ДСНС",
  },
  {
    id: "inc-003",
    timestamp: hoursAgo(1),
    coordinates: [36.2304, 49.9935],
    region: "kh",
    regionName: "Харківська",
    title: "Знешкодження вибухонебезпечного предмету",
    type: "EOD",
    status: "Containment",
    severity: "Major",
    resources: { ses_units: 3, police_units: 8, medical_units: 1, personnel_total: 22 },
    impact: { rescued: 0, injured: 0, fatalities: 0, damage_est: "Незначні", damage_uah: 50000 },
    estimated_resolution_time: new Date(now.getTime() + 1.5 * 3600000).toISOString(),
    risk_level: 7,
    description: "Виявлено підозрілий предмет біля адміністративної будівлі. Проводиться евакуація в радіусі 200м. Піротехніки на місці.",
    lead_agency: "Поліція",
  },
  {
    id: "inc-004",
    timestamp: hoursAgo(8),
    coordinates: [34.9981, 48.4647],
    region: "dp",
    regionName: "Дніпропетровська",
    title: "Масове ДТП на трасі М-04",
    type: "Medical",
    status: "Containment",
    severity: "Major",
    resources: { ses_units: 2, police_units: 10, medical_units: 8, personnel_total: 35 },
    impact: { rescued: 18, injured: 12, fatalities: 1, damage_est: "Середні", damage_uah: 800000 },
    estimated_resolution_time: new Date(now.getTime() + 1 * 3600000).toISOString(),
    risk_level: 6,
    description: "Зіткнення 7 транспортних засобів, в тому числі рейсового автобуса. Постраждалих транспортовано до лікарень.",
    lead_agency: "Поліція",
  },
  {
    id: "inc-005",
    timestamp: hoursAgo(12),
    coordinates: [30.7233, 46.4775],
    region: "od",
    regionName: "Одеська",
    title: "Повінь у прибережних районах",
    type: "Flood",
    status: "Ongoing",
    severity: "Major",
    resources: { ses_units: 15, police_units: 5, medical_units: 2, personnel_total: 58 },
    impact: { rescued: 34, injured: 2, fatalities: 0, damage_est: "Великі збитки інфраструктурі", damage_uah: 7200000 },
    estimated_resolution_time: new Date(now.getTime() + 24 * 3600000).toISOString(),
    risk_level: 8,
    description: "Підтоплено близько 120 домогосподарств внаслідок сильних опадів. Евакуація продовжується. Рятувальники задіяли 6 моторних човнів.",
    lead_agency: "ДСНС",
  },
  {
    id: "inc-006",
    timestamp: hoursAgo(3),
    coordinates: [24.7111, 48.9226],
    region: "if",
    regionName: "Івано-Франківська",
    title: "Пошуково-рятувальна операція в горах",
    type: "Rescue",
    status: "Ongoing",
    severity: "Major",
    resources: { ses_units: 6, police_units: 2, medical_units: 2, personnel_total: 28 },
    impact: { rescued: 3, injured: 1, fatalities: 0, damage_est: "Незначні", damage_uah: 0 },
    estimated_resolution_time: new Date(now.getTime() + 4 * 3600000).toISOString(),
    risk_level: 7,
    description: "Група туристів з 5 осіб заблукала в Карпатах. 3 особи вже знайдено. Пошук двох продовжується із залученням гелікоптера.",
    lead_agency: "ДСНС",
  },
  {
    id: "inc-007",
    timestamp: hoursAgo(16),
    coordinates: [28.4752, 49.2328],
    region: "vn",
    regionName: "Вінницька",
    title: "Пожежа в житловому будинку",
    type: "Fire",
    status: "Resolved",
    severity: "Minor",
    resources: { ses_units: 3, police_units: 2, medical_units: 1, personnel_total: 14 },
    impact: { rescued: 6, injured: 1, fatalities: 0, damage_est: "Часткові", damage_uah: 350000 },
    estimated_resolution_time: hoursAgo(12),
    risk_level: 3,
    description: "Пожежа на 3-му поверсі житлового будинку ліквідована протягом 40 хвилин. Всіх мешканців евакуйовано.",
    lead_agency: "ДСНС",
  },
  {
    id: "inc-008",
    timestamp: hoursAgo(6),
    coordinates: [38.0027, 47.0954],
    region: "dn",
    regionName: "Донецька",
    title: "Хімічне забруднення ґрунтових вод",
    type: "Rescue",
    status: "Containment",
    severity: "Major",
    resources: { ses_units: 5, police_units: 3, medical_units: 4, personnel_total: 31 },
    impact: { rescued: 0, injured: 8, fatalities: 0, damage_est: "Екологічна катастрофа", damage_uah: 3100000 },
    estimated_resolution_time: new Date(now.getTime() + 48 * 3600000).toISOString(),
    risk_level: 8,
    description: "Виявлено витік хімічних речовин з промислового підприємства. Зона відчуження встановлена. Забруднення ґрунтових вод підтверджено.",
    lead_agency: "ДСНС",
  },
  {
    id: "inc-009",
    timestamp: hoursAgo(4),
    coordinates: [33.4203, 47.8388],
    region: "zp",
    regionName: "Запорізька",
    title: "Масові заворушення в місті",
    type: "Crime",
    status: "Containment",
    severity: "Major",
    resources: { ses_units: 0, police_units: 25, medical_units: 3, personnel_total: 42 },
    impact: { rescued: 0, injured: 15, fatalities: 0, damage_est: "Пошкоджено майно", damage_uah: 1200000 },
    estimated_resolution_time: new Date(now.getTime() + 2 * 3600000).toISOString(),
    risk_level: 7,
    description: "Сутичка між групами осіб переросла в масові заворушення. 25 поліцейських нарядів на місці. 18 затримано.",
    lead_agency: "Поліція",
  },
  {
    id: "inc-010",
    timestamp: hoursAgo(20),
    coordinates: [33.9902, 46.9658],
    region: "ks",
    regionName: "Херсонська",
    title: "Розмінування сільськогосподарських угідь",
    type: "EOD",
    status: "Resolved",
    severity: "Minor",
    resources: { ses_units: 4, police_units: 2, medical_units: 0, personnel_total: 12 },
    impact: { rescued: 0, injured: 0, fatalities: 0, damage_est: "Незначні", damage_uah: 0 },
    estimated_resolution_time: hoursAgo(16),
    risk_level: 4,
    description: "Знешкоджено 3 протипіхотних міни та 1 артилерійський снаряд під час сільськогосподарських робіт. Поле очищено.",
    lead_agency: "ДСНС",
  },
];

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  Fire: "Пожежа",
  Rescue: "Рятування",
  Crime: "Правопорядок",
  EOD: "Піротехніка",
  Medical: "Медична",
  Flood: "Повінь",
};

export const SEVERITY_CONFIG: Record<SeverityLevel, { label: string; color: string; bgColor: string }> = {
  Critical: { label: "Критичний", color: "text-red-400", bgColor: "bg-red-500/20 border-red-500/40" },
  Major: { label: "Значний", color: "text-yellow-400", bgColor: "bg-yellow-500/20 border-yellow-500/40" },
  Minor: { label: "Незначний", color: "text-green-400", bgColor: "bg-green-500/20 border-green-500/40" },
};

export const STATUS_CONFIG: Record<IncidentStatus, { label: string; color: string }> = {
  Ongoing: { label: "Активний", color: "text-red-400" },
  Containment: { label: "Контроль", color: "text-yellow-400" },
  Resolved: { label: "Вирішено", color: "text-green-400" },
};

export const TYPE_ICONS: Record<IncidentType, string> = {
  Fire: "🔥",
  Rescue: "🆘",
  Crime: "🚔",
  EOD: "💣",
  Medical: "🚑",
  Flood: "🌊",
};
