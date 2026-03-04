export type IncidentType = "Fire" | "Rescue" | "Crime" | "EOD" | "Medical" | "Flood";
export type IncidentStatus = "Dispatched" | "On-Scene" | "Ongoing" | "Containment" | "Resolved";
export type SeverityLevel = "Critical" | "High" | "Major" | "Medium" | "Minor" | "Low";
export type IncidentCategory = "SES" | "Police" | "Medical" | "Combined";

export const VALID_STATUSES: IncidentStatus[] = ["Dispatched", "On-Scene", "Ongoing", "Containment", "Resolved"];
export const VALID_SEVERITIES: SeverityLevel[] = ["Critical", "High", "Major", "Medium", "Minor", "Low"];
export const VALID_TYPES: IncidentType[] = ["Fire", "Rescue", "Crime", "EOD", "Medical", "Flood"];
export const VALID_CATEGORIES: IncidentCategory[] = ["SES", "Police", "Medical", "Combined"];

export interface Incident {
  id: string;
  timestamp: string;
  coordinates: [number, number]; // [lng, lat]
  region: string; // oblast id
  regionName: string;
  address: string;
  title: string;
  type: IncidentType;
  category: IncidentCategory;
  status: IncidentStatus;
  severity: SeverityLevel;
  resources: {
    ses_units: number;
    police_units: number;
    medical_units: number;
    personnel_total: number;
    specialized_equipment: string[];
  };
  impact: {
    rescued: number;
    injured: number;
    fatalities: number;
    damage_est: string;
    damage_uah: number;
  };
  estimated_resolution_time: string;
  risk_level: number;
  description: string;
  lead_agency: string;
  last_updated: string;
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
    address: "вул. Промислова, 15, Київ",
    title: "Пожежа на промисловому об'єкті",
    type: "Fire",
    category: "SES",
    status: "Ongoing",
    severity: "Critical",
    resources: { ses_units: 8, police_units: 4, medical_units: 3, personnel_total: 42, specialized_equipment: ["Автодрабина", "Пінна станція"] },
    impact: { rescued: 5, injured: 3, fatalities: 0, damage_est: "Значні руйнування", damage_uah: 4500000 },
    estimated_resolution_time: new Date(now.getTime() + 3 * 3600000).toISOString(),
    risk_level: 9,
    description: "Масштабна пожежа на складі хімічних речовин. Задіяно 8 пожежних розрахунків ДСНС.",
    lead_agency: "ДСНС",
    last_updated: hoursAgo(0.5),
  },
  {
    id: "inc-002",
    timestamp: hoursAgo(5),
    coordinates: [23.9936, 49.8397],
    region: "lviv",
    regionName: "Львівська",
    address: "вул. Стрийська, 48, Львів",
    title: "Обвал будівлі — рятувальна операція",
    type: "Rescue",
    category: "Combined",
    status: "On-Scene",
    severity: "Critical",
    resources: { ses_units: 12, police_units: 6, medical_units: 5, personnel_total: 67, specialized_equipment: ["Кран", "Тепловізор"] },
    impact: { rescued: 11, injured: 7, fatalities: 2, damage_est: "Повне руйнування", damage_uah: 12000000 },
    estimated_resolution_time: new Date(now.getTime() + 6 * 3600000).toISOString(),
    risk_level: 10,
    description: "Обвал 5-поверхової будівлі внаслідок вибуху газу.",
    lead_agency: "ДСНС",
    last_updated: hoursAgo(1),
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

export const CATEGORY_LABELS: Record<IncidentCategory, string> = {
  SES: "ДСНС",
  Police: "Поліція",
  Medical: "Медицина",
  Combined: "Комбінований",
};

export const SEVERITY_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  Critical: { label: "Критичний", color: "text-red-400", bgColor: "bg-red-500/20 border-red-500/40" },
  High: { label: "Високий", color: "text-orange-400", bgColor: "bg-orange-500/20 border-orange-500/40" },
  Major: { label: "Значний", color: "text-yellow-400", bgColor: "bg-yellow-500/20 border-yellow-500/40" },
  Medium: { label: "Середній", color: "text-amber-400", bgColor: "bg-amber-500/20 border-amber-500/40" },
  Minor: { label: "Незначний", color: "text-green-400", bgColor: "bg-green-500/20 border-green-500/40" },
  Low: { label: "Низький", color: "text-blue-400", bgColor: "bg-blue-500/20 border-blue-500/40" },
};

export const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  Dispatched: { label: "Відправлено", color: "text-blue-400" },
  "On-Scene": { label: "На місці", color: "text-orange-400" },
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
