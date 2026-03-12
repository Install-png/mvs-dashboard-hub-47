import { useState, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { startOfDay, subDays, getMonth, getDay, isToday, format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useIncidents } from "@/hooks/useIncidents";
import { useIncidentStore } from "@/stores/useIncidentStore";
import { REGION_NAME_MAP } from "@/components/UkraineMap";
import {
  SEVERITY_CONFIG, STATUS_CONFIG, INCIDENT_TYPE_LABELS, CATEGORY_LABELS,
  type Incident, type SeverityLevel,
} from "@/data/mockIncidents";
import {
  Shield, Users, FileText, AlertTriangle, TrendingUp,
  BarChart3, Activity, Pencil, Plus, Trash2, Loader2,
  Flame, Phone, ShieldCheck, ArrowRightLeft, MapPin, Zap,
  Truck, Heart, Siren, ChevronRight, X, Download, Clock,
  Target, Eye, Building2, Crosshair, Radio, Stethoscope,
  Droplets, Pill, Ambulance, ShieldAlert, Sword,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, AreaChart, Area,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";

const CHART_COLORS = ["hsl(24, 95%, 53%)", "hsl(24, 80%, 65%)", "hsl(30, 100%, 75%)", "hsl(30, 40%, 85%)", "hsl(200, 70%, 50%)", "hsl(150, 60%, 45%)", "hsl(280, 60%, 55%)", "hsl(340, 70%, 55%)"];
const MONTH_NAMES = ["Січ", "Лют", "Бер", "Кві", "Тра", "Чер", "Лип", "Сер", "Вер", "Жов", "Лис", "Гру"];
const DAY_NAMES = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const REGION_IDS = Object.keys(REGION_NAME_MAP);

// ═══ RESOURCE NORMS ═══
const SEVERITY_RESOURCE_NORM: Record<string, { personnel: number; units: number }> = {
  Critical: { personnel: 30, units: 8 },
  High: { personnel: 15, units: 5 },
  Major: { personnel: 8, units: 3 },
  Medium: { personnel: 4, units: 2 },
  Minor: { personnel: 2, units: 1 },
  Low: { personnel: 1, units: 1 },
};

interface RegionDeficit {
  regionId: string; regionName: string; activeCount: number; criticalCount: number;
  currentPersonnel: number; requiredPersonnel: number; currentUnits: number; requiredUnits: number;
  deficitPersonnel: number; deficitUnits: number; deficitPercent: number; surplus: boolean;
}

interface Recommendation {
  from: string; fromName: string; to: string; toName: string;
  personnel: number; units: number; reason: string;
}

function computeRegionDeficits(incidents: Incident[]): RegionDeficit[] {
  const active = incidents.filter(i => i.status !== "Resolved");
  const byRegion: Record<string, Incident[]> = {};
  active.forEach(i => { if (!byRegion[i.region]) byRegion[i.region] = []; byRegion[i.region].push(i); });
  return REGION_IDS.map(id => {
    const r = byRegion[id] || [];
    const cP = r.reduce((s, i) => s + i.resources.personnel_total, 0);
    const cU = r.reduce((s, i) => s + i.resources.ses_units + i.resources.police_units + i.resources.medical_units, 0);
    const rP = r.reduce((s, i) => s + (SEVERITY_RESOURCE_NORM[i.severity]?.personnel ?? 4), 0);
    const rU = r.reduce((s, i) => s + (SEVERITY_RESOURCE_NORM[i.severity]?.units ?? 2), 0);
    const dP = rP - cP, dU = rU - cU;
    const dp = rP > 0 ? Math.round(((rP - cP) / rP) * 100) : 0;
    return { regionId: id, regionName: REGION_NAME_MAP[id] || id, activeCount: r.length, criticalCount: r.filter(i => i.severity === "Critical").length, currentPersonnel: cP, requiredPersonnel: rP, currentUnits: cU, requiredUnits: rU, deficitPersonnel: Math.max(0, dP), deficitUnits: Math.max(0, dU), deficitPercent: dp, surplus: dP < 0 };
  }).filter(r => r.activeCount > 0);
}

function computeRecommendations(deficits: RegionDeficit[]): Recommendation[] {
  const needHelp = deficits.filter(d => d.deficitPersonnel > 0).sort((a, b) => b.deficitPercent - a.deficitPercent);
  const canHelp = deficits.filter(d => d.surplus).sort((a, b) => a.deficitPercent - b.deficitPercent);
  const recs: Recommendation[] = [];
  for (const need of needHelp) {
    for (const donor of canHelp) {
      if (recs.length >= 5) break;
      const sP = donor.currentPersonnel - donor.requiredPersonnel;
      const sU = donor.currentUnits - donor.requiredUnits;
      if (sP <= 0) continue;
      recs.push({ from: donor.regionId, fromName: donor.regionName, to: need.regionId, toName: need.regionName, personnel: Math.min(sP, need.deficitPersonnel), units: Math.min(Math.max(0, sU), need.deficitUnits), reason: need.criticalCount > 0 ? `${need.criticalCount} критичних подій` : `${need.activeCount} активних подій` });
    }
  }
  return recs;
}

// ═══ SERVICE TAB TYPE ═══
type ServiceTab = "overview" | "ses" | "ngu" | "police" | "medical" | "resources" | "incidents" | "personnel" | "analytics";

const Dashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { incidents, loading: incidentsLoading, setSelectedRegion } = useIncidentStore();
  useIncidents();

  const navigateToRegion = useCallback((regionId: string) => {
    setSelectedRegion(regionId);
    navigate("/situation-center");
  }, [setSelectedRegion, navigate]);

  const [personnel, setPersonnel] = useState<any[]>([]);
  const [loadingPersonnel, setLoadingPersonnel] = useState(true);
  const [activeTab, setActiveTab] = useState<ServiceTab>("overview");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const tabContentRef = useRef<HTMLDivElement>(null);

  useState(() => {
    supabase.from("personnel").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { setPersonnel(data || []); setLoadingPersonnel(false); });
  });

  // ═══ FILTERED INCIDENTS ═══
  const filteredIncidents = useMemo(() => {
    let list = incidents.filter(i => i.status !== "Resolved");
    if (regionFilter !== "all") list = list.filter(i => i.region === regionFilter);
    return list;
  }, [incidents, regionFilter]);

  const allActiveIncidents = useMemo(() => incidents.filter(i => i.status !== "Resolved"), [incidents]);

  // ═══ GENERAL STATS ═══
  const stats = useMemo(() => {
    const active = allActiveIncidents.length;
    const todayCount = incidents.filter(i => isToday(new Date(i.timestamp))).length;
    const resolved = incidents.filter(i => i.status === "Resolved").length;
    const rate = incidents.length > 0 ? Math.round((resolved / incidents.length) * 100) : 0;
    return [
      { title: "Активні інциденти", value: String(active), icon: AlertTriangle, change: `${incidents.length} всього`, color: "text-destructive" },
      { title: "Персонал задіяно", value: String(allActiveIncidents.reduce((s, i) => s + i.resources.personnel_total, 0)), icon: Users, change: `${personnel.filter((p: any) => p.status === "На службі").length} на службі`, color: "text-primary" },
      { title: "Врятовано сьогодні", value: String(incidents.filter(i => isToday(new Date(i.timestamp))).reduce((s, i) => s + i.impact.rescued, 0)), icon: TrendingUp, change: `${todayCount} подій за добу`, color: "text-primary" },
      { title: "Показник вирішення", value: `${rate}%`, icon: FileText, change: `${resolved}/${incidents.length}`, color: "text-primary" },
    ];
  }, [incidents, personnel, allActiveIncidents]);

  // ═══ SERVICE-LEVEL STATS ═══
  const sesData = useMemo(() => {
    const incs = filteredIncidents.filter(i => i.category === "SES" || i.resources.ses_units > 0);
    const fires = incs.filter(i => i.type === "Fire");
    const eod = incs.filter(i => i.type === "EOD");
    const rescue = incs.filter(i => i.type === "Rescue");
    const byRegion = Object.entries(REGION_NAME_MAP).map(([id, name]) => {
      const rIncs = incs.filter(i => i.region === id);
      return { region: name, incidents: rIncs.length, personnel: rIncs.reduce((s, i) => s + i.resources.personnel_total, 0), units: rIncs.reduce((s, i) => s + i.resources.ses_units, 0), rescued: rIncs.reduce((s, i) => s + i.impact.rescued, 0) };
    }).filter(r => r.incidents > 0).sort((a, b) => b.incidents - a.incidents);

    const avgResponseMin = incs.length > 0 ? Math.round(15 + Math.random() * 10) : 0; // simulated
    const equipmentList = [...new Set(incs.flatMap(i => i.resources.specialized_equipment || []))];
    const heatmapData = byRegion.map(r => ({ name: r.region.replace(" область", "").replace("ська", "").substring(0, 8), пожежі: fires.filter(f => f.regionName === r.region).length, НС: r.incidents, персонал: r.personnel }));

    return {
      total: incs.length, fires: fires.length, eod: eod.length, rescue: rescue.length,
      units: incs.reduce((s, i) => s + i.resources.ses_units, 0),
      personnel: incs.reduce((s, i) => s + i.resources.personnel_total, 0),
      rescued: incs.reduce((s, i) => s + i.impact.rescued, 0),
      injured: incs.reduce((s, i) => s + i.impact.injured, 0),
      equipment: equipmentList, avgResponseMin, byRegion, heatmapData,
      eodArea: eod.length * 2.5, // km² simulated
      eodNeutralized: eod.reduce((s, i) => s + i.impact.rescued, 0),
      reserveUnits: Math.max(0, 25 - incs.reduce((s, i) => s + i.resources.ses_units, 0)),
    };
  }, [filteredIncidents]);

  const nguData = useMemo(() => {
    // NGU uses police_units as proxy + combined category
    const incs = filteredIncidents.filter(i => i.category === "Combined" || i.lead_agency === "НГУ" || (i.resources.police_units > 0 && i.resources.ses_units > 0));
    const patrolIncs = filteredIncidents.filter(i => i.resources.police_units > 0);
    const byRegion = Object.entries(REGION_NAME_MAP).map(([id, name]) => {
      const rIncs = incs.filter(i => i.region === id);
      return { region: name, incidents: rIncs.length, personnel: rIncs.reduce((s, i) => s + i.resources.personnel_total, 0) };
    }).filter(r => r.incidents > 0).sort((a, b) => b.incidents - a.incidents);

    const critInfraIncs = incs.filter(i => i.severity === "Critical" || i.severity === "High");
    const readinessPercent = Math.min(100, Math.round(70 + Math.random() * 25));
    const readinessData = [
      { subject: "Особовий склад", value: readinessPercent, fullMark: 100 },
      { subject: "Спецтехніка", value: Math.round(60 + Math.random() * 30), fullMark: 100 },
      { subject: "Озброєння", value: Math.round(75 + Math.random() * 20), fullMark: 100 },
      { subject: "Зв'язок", value: Math.round(80 + Math.random() * 15), fullMark: 100 },
      { subject: "Логістика", value: Math.round(55 + Math.random() * 35), fullMark: 100 },
      { subject: "Медзабезпечення", value: Math.round(65 + Math.random() * 25), fullMark: 100 },
    ];

    return {
      total: incs.length, personnel: incs.reduce((s, i) => s + i.resources.personnel_total, 0),
      patrolJoint: patrolIncs.length, critInfra: critInfraIncs.length,
      infraIncidents: critInfraIncs.filter(i => i.type === "Crime" || i.type === "EOD").length,
      readinessPercent, readinessData, byRegion,
      specialUnits: Math.round(3 + Math.random() * 5),
      vehiclesActive: Math.round(8 + Math.random() * 12),
    };
  }, [filteredIncidents]);

  const policeData = useMemo(() => {
    const incs = filteredIncidents.filter(i => i.category === "Police" || i.resources.police_units > 0);
    const crimes = incs.filter(i => i.type === "Crime");
    const critical = incs.filter(i => i.severity === "Critical" || i.severity === "High");
    const byRegion = Object.entries(REGION_NAME_MAP).map(([id, name]) => {
      const rIncs = incs.filter(i => i.region === id);
      return { region: name, incidents: rIncs.length, patrols: rIncs.reduce((s, i) => s + i.resources.police_units, 0), personnel: rIncs.reduce((s, i) => s + i.resources.personnel_total, 0), crimes: rIncs.filter(i => i.type === "Crime").length };
    }).filter(r => r.incidents > 0).sort((a, b) => b.incidents - a.incidents);

    const callCategories = [
      { name: "Тяжкі злочини", value: crimes.filter(c => c.severity === "Critical" || c.severity === "High").length },
      { name: "Адмінпорушення", value: Math.max(1, incs.length - crimes.length) },
      { name: "ДТП", value: incs.filter(i => i.type === "Rescue" && i.resources.police_units > 0).length },
      { name: "Інші виклики", value: Math.max(0, incs.length - crimes.length - 2) },
    ].filter(c => c.value > 0);

    const resolvedRate = incs.length > 0 ? Math.round((incs.filter(i => i.status === "Resolved" || i.status === "Containment").length / incs.length) * 100) : 0;
    const avgArrivalMin = incs.length > 0 ? Math.round(7 + Math.random() * 8) : 0;

    const patrolStatus = [
      { name: "На завданні", value: incs.reduce((s, i) => s + i.resources.police_units, 0) },
      { name: "Вільні", value: Math.max(2, 15 - incs.reduce((s, i) => s + i.resources.police_units, 0)) },
      { name: "У відділку", value: Math.round(3 + Math.random() * 4) },
    ];

    return {
      total: incs.length, crimes: crimes.length, critical: critical.length,
      patrols: incs.reduce((s, i) => s + i.resources.police_units, 0),
      personnel: incs.reduce((s, i) => s + i.resources.personnel_total, 0),
      arrests: crimes.filter(c => c.status === "Containment" || c.status === "Resolved").length,
      resolvedRate, avgArrivalMin, callCategories, patrolStatus, byRegion,
    };
  }, [filteredIncidents]);

  const medicalData = useMemo(() => {
    const incs = filteredIncidents.filter(i => i.category === "Medical" || i.resources.medical_units > 0);
    const byRegion = Object.entries(REGION_NAME_MAP).map(([id, name]) => {
      const rIncs = incs.filter(i => i.region === id);
      return { region: name, incidents: rIncs.length, brigades: rIncs.reduce((s, i) => s + i.resources.medical_units, 0), injured: rIncs.reduce((s, i) => s + i.impact.injured, 0), rescued: rIncs.reduce((s, i) => s + i.impact.rescued, 0), fatalities: rIncs.reduce((s, i) => s + i.impact.fatalities, 0) };
    }).filter(r => r.incidents > 0).sort((a, b) => b.incidents - a.incidents);

    const totalInjured = incs.reduce((s, i) => s + i.impact.injured, 0);
    const totalFatalities = incs.reduce((s, i) => s + i.impact.fatalities, 0);
    const hospitalLoad = [
      { name: "Реанімація", load: Math.min(100, Math.round(40 + totalInjured * 8 + Math.random() * 20)), status: "" as string },
      { name: "Хірургія", load: Math.min(100, Math.round(30 + totalInjured * 5 + Math.random() * 15)), status: "" },
      { name: "Травматологія", load: Math.min(100, Math.round(35 + totalInjured * 6 + Math.random() * 18)), status: "" },
    ].map(h => ({ ...h, status: h.load > 85 ? "critical" : h.load > 60 ? "warning" : "normal" }));

    const bloodSupply = [
      { group: "I (O)", level: Math.round(40 + Math.random() * 50) },
      { group: "II (A)", level: Math.round(30 + Math.random() * 60) },
      { group: "III (B)", level: Math.round(35 + Math.random() * 55) },
      { group: "IV (AB)", level: Math.round(45 + Math.random() * 45) },
    ];

    const emdCalls = [
      { name: "Екстрені", value: incs.filter(i => i.severity === "Critical" || i.severity === "High").length },
      { name: "Неекстрені", value: Math.max(1, incs.length - incs.filter(i => i.severity === "Critical" || i.severity === "High").length) },
    ];

    return {
      total: incs.length, brigades: incs.reduce((s, i) => s + i.resources.medical_units, 0),
      personnel: incs.reduce((s, i) => s + i.resources.personnel_total, 0),
      injured: totalInjured, fatalities: totalFatalities,
      rescued: incs.reduce((s, i) => s + i.impact.rescued, 0),
      hospitalLoad, bloodSupply, emdCalls, byRegion,
      freeBrigades: Math.max(2, 12 - incs.reduce((s, i) => s + i.resources.medical_units, 0)),
    };
  }, [filteredIncidents]);

  // Charts
  const monthlyData = useMemo(() => {
    const counts: Record<number, number> = {};
    incidents.forEach(i => { const m = getMonth(new Date(i.timestamp)); counts[m] = (counts[m] || 0) + 1; });
    return MONTH_NAMES.map((name, idx) => ({ name, value: counts[idx] || 0 }));
  }, [incidents]);

  const trendData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = subDays(startOfDay(now), 6 - i);
      const dayIncs = incidents.filter(inc => startOfDay(new Date(inc.timestamp)).getTime() === d.getTime());
      return { name: DAY_NAMES[getDay(d)], incidents: dayIncs.length, resolved: dayIncs.filter(inc => inc.status === "Resolved").length };
    });
  }, [incidents]);

  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    incidents.forEach(i => { const t = INCIDENT_TYPE_LABELS[i.type] || i.type; counts[t] = (counts[t] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [incidents]);

  const severityData = useMemo(() => {
    const counts: Record<string, number> = {};
    incidents.forEach(i => { const s = SEVERITY_CONFIG[i.severity]?.label || i.severity; counts[s] = (counts[s] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [incidents]);

  const regionDeficits = useMemo(() => computeRegionDeficits(incidents), [incidents]);
  const recommendations = useMemo(() => computeRecommendations(regionDeficits), [regionDeficits]);
  const criticalDeficits = useMemo(() => regionDeficits.filter(d => d.deficitPercent > 30), [regionDeficits]);

  const REGION_OPTIONS = useMemo(() => {
    const regs = new Set(incidents.filter(i => i.status !== "Resolved").map(i => i.region));
    return Object.entries(REGION_NAME_MAP).filter(([id]) => regs.has(id)).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [incidents]);

  // Personnel CRUD
  const [editingPerson, setEditingPerson] = useState<any>(null);
  const [personDialogOpen, setPersonDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchPersonnel = async () => {
    const { data } = await supabase.from("personnel").select("*").order("created_at", { ascending: false });
    setPersonnel(data || []);
  };
  const openPersonDialog = (person?: any) => { setEditingPerson(person || { name: "", rank: "", department: "", status: "На службі" }); setPersonDialogOpen(true); };
  const savePerson = async () => {
    if (!editingPerson || !user) return;
    setSaving(true);
    if (editingPerson.id) await supabase.from("personnel").update({ name: editingPerson.name, rank: editingPerson.rank, department: editingPerson.department, status: editingPerson.status } as any).eq("id", editingPerson.id);
    else await supabase.from("personnel").insert({ user_id: user.id, name: editingPerson.name, rank: editingPerson.rank, department: editingPerson.department, status: editingPerson.status } as any);
    setSaving(false); setPersonDialogOpen(false); fetchPersonnel();
  };
  const deletePerson = async (id: string) => { await supabase.from("personnel").delete().eq("id", id); fetchPersonnel(); };

  // ═══ PDF REPORT GENERATOR ═══
  const generateServicePdf = useCallback(async () => {
    if (!user) return;
    setGeneratingPdf(true);
    const pdf = new jsPDF("p", "mm", "a4");
    const pageW = pdf.internal.pageSize.getWidth();
    const now = new Date();
    const tabLabels: Record<string, string> = { overview: "Загальний огляд", ses: "ДСНС", ngu: "Національна гвардія", police: "Національна поліція", medical: "Медична служба / ЕМД", resources: "Ресурси", incidents: "Інциденти", personnel: "Персонал", analytics: "Аналітика" };
    const serviceName = tabLabels[activeTab] || "Звіт";
    const regionLabel = regionFilter === "all" ? "Вся Україна" : (REGION_NAME_MAP[regionFilter] || regionFilter);

    // Header
    pdf.setFillColor(15, 23, 42);
    pdf.rect(0, 0, pageW, 32, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(16); pdf.setFont("helvetica", "bold");
    pdf.text(`ОПЕРАТИВНИЙ ЗВІТ — ${serviceName.toUpperCase()}`, pageW / 2, 12, { align: "center" });
    pdf.setFontSize(9); pdf.setFont("helvetica", "normal");
    pdf.text(`Регіон: ${regionLabel} | Зріз: ${format(now, "HH:mm dd.MM.yyyy")}`, pageW / 2, 20, { align: "center" });
    pdf.text(`Офіцер: ${user.email ?? "—"} | Система: Ситуаційний центр`, pageW / 2, 26, { align: "center" });

    let y = 38;
    pdf.setTextColor(0, 0, 0);

    // Critical indicators block
    pdf.setFontSize(12); pdf.setFont("helvetica", "bold");
    pdf.text("I. КРИТИЧНІ ІНДИКАТОРИ", 14, y); y += 5;

    if (activeTab === "ses" || activeTab === "overview") {
      autoTable(pdf, {
        startY: y,
        head: [["Показник", "Значення", "Показник", "Значення"]],
        body: [
          ["Інцидентів ДСНС", String(sesData.total), "Пожеж", String(sesData.fires)],
          ["Підрозділів залучено", String(sesData.units), "Врятовано людей", String(sesData.rescued)],
          ["Особовий склад", String(sesData.personnel), "Резерв техніки", String(sesData.reserveUnits)],
          ["Піротехнічних виїздів", String(sesData.eod), "Обстежено (км²)", String(sesData.eodArea.toFixed(1))],
          ["Сер. час реагування", `${sesData.avgResponseMin} хв`, "Постраждалих", String(sesData.injured)],
        ],
        theme: "grid",
        headStyles: { fillColor: [185, 28, 28], textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 45 }, 1: { cellWidth: 30 }, 2: { fontStyle: "bold", cellWidth: 45 }, 3: { cellWidth: 30 } },
      });
      y = (pdf as any).lastAutoTable.finalY + 6;
    }

    if (activeTab === "police" || activeTab === "overview") {
      pdf.setFontSize(11); pdf.setFont("helvetica", "bold");
      pdf.text(activeTab === "overview" ? "Поліція:" : "II. ДЕТАЛІ ПОЛІЦІЇ", 14, y); y += 4;
      autoTable(pdf, {
        startY: y,
        head: [["Показник", "Значення", "Показник", "Значення"]],
        body: [
          ["Інцидентів НПУ", String(policeData.total), "Кримінальних подій", String(policeData.crimes)],
          ["Патрулів залучено", String(policeData.patrols), "Затримань", String(policeData.arrests)],
          ["Розкриття (%)", `${policeData.resolvedRate}%`, "Сер. час прибуття", `${policeData.avgArrivalMin} хв`],
        ],
        theme: "grid",
        headStyles: { fillColor: [29, 78, 216], textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 45 }, 1: { cellWidth: 30 }, 2: { fontStyle: "bold", cellWidth: 45 }, 3: { cellWidth: 30 } },
      });
      y = (pdf as any).lastAutoTable.finalY + 6;
    }

    if (activeTab === "ngu" || activeTab === "overview") {
      pdf.setFontSize(11); pdf.setFont("helvetica", "bold");
      pdf.text(activeTab === "overview" ? "НГУ:" : "II. ДЕТАЛІ НГУ", 14, y); y += 4;
      autoTable(pdf, {
        startY: y,
        head: [["Показник", "Значення", "Показник", "Значення"]],
        body: [
          ["Операцій", String(nguData.total), "Особовий склад", String(nguData.personnel)],
          ["Спільне патрулювання", String(nguData.patrolJoint), "Крит. інфраструктура", String(nguData.critInfra)],
          ["Спецпідрозділів", String(nguData.specialUnits), "Техніки активно", String(nguData.vehiclesActive)],
        ],
        theme: "grid",
        headStyles: { fillColor: [75, 85, 99], textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 45 }, 1: { cellWidth: 30 }, 2: { fontStyle: "bold", cellWidth: 45 }, 3: { cellWidth: 30 } },
      });
      y = (pdf as any).lastAutoTable.finalY + 6;
    }

    if (activeTab === "medical" || activeTab === "overview") {
      pdf.setFontSize(11); pdf.setFont("helvetica", "bold");
      pdf.text(activeTab === "overview" ? "Медицина:" : "II. ДЕТАЛІ МЕДИЧНОЇ СЛУЖБИ", 14, y); y += 4;
      autoTable(pdf, {
        startY: y,
        head: [["Показник", "Значення", "Показник", "Значення"]],
        body: [
          ["Бригад залучено", String(medicalData.brigades), "Вільних бригад", String(medicalData.freeBrigades)],
          ["Постраждалих", String(medicalData.injured), "Загиблих", String(medicalData.fatalities)],
          ["Врятовано", String(medicalData.rescued), "Активних подій", String(medicalData.total)],
        ],
        theme: "grid",
        headStyles: { fillColor: [21, 128, 61], textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 45 }, 1: { cellWidth: 30 }, 2: { fontStyle: "bold", cellWidth: 45 }, 3: { cellWidth: 30 } },
      });
      y = (pdf as any).lastAutoTable.finalY + 6;
    }

    // Regional breakdown table
    if (y < 240) {
      pdf.setFontSize(11); pdf.setFont("helvetica", "bold");
      pdf.text("РОЗПОДІЛ ПО РЕГІОНАМ", 14, y); y += 4;

      const regData = regionFilter === "all"
        ? regionDeficits.slice(0, 10).map(d => [d.regionName, String(d.activeCount), String(d.criticalCount), `${d.currentPersonnel}/${d.requiredPersonnel}`, d.deficitPercent > 30 ? `Дефіцит ${d.deficitPercent}%` : d.surplus ? "Надлишок" : "Норма"])
        : [[regionLabel, String(filteredIncidents.length), String(filteredIncidents.filter(i => i.severity === "Critical").length), String(filteredIncidents.reduce((s, i) => s + i.resources.personnel_total, 0)), "—"]];

      autoTable(pdf, {
        startY: y,
        head: [["Регіон", "Активних", "Критичних", "Персонал", "Статус"]],
        body: regData,
        theme: "striped",
        headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontSize: 7 },
        bodyStyles: { fontSize: 7 },
      });
      y = (pdf as any).lastAutoTable.finalY + 6;
    }

    // Incident registry
    const relevantIncs = regionFilter === "all" ? incidents : incidents.filter(i => i.region === regionFilter);
    if (relevantIncs.length > 0) {
      if (y > 240) { pdf.addPage(); y = 15; }
      pdf.setFontSize(11); pdf.setFont("helvetica", "bold");
      pdf.text("РЕЄСТР ІНЦИДЕНТІВ", 14, y); y += 4;
      autoTable(pdf, {
        startY: y,
        head: [["Час", "Регіон", "Тип", "Назва", "Ос.скл.", "Р/П/З"]],
        body: relevantIncs.sort((a, b) => b.risk_level - a.risk_level).slice(0, 30).map(inc => [
          format(new Date(inc.timestamp), "HH:mm"), inc.regionName, INCIDENT_TYPE_LABELS[inc.type] || inc.type,
          inc.title.substring(0, 35), String(inc.resources.personnel_total),
          `${inc.impact.rescued}/${inc.impact.injured}/${inc.impact.fatalities}`,
        ]),
        theme: "striped",
        headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontSize: 7 },
        bodyStyles: { fontSize: 7 },
      });
    }

    // Footer
    const totalPages = pdf.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      pdf.setPage(p);
      pdf.setFontSize(7); pdf.setTextColor(120, 120, 120);
      pdf.text(`Сторінка ${p}/${totalPages} | Конфіденційно | ${format(now, "dd.MM.yyyy HH:mm")}`, pageW / 2, pdf.internal.pageSize.getHeight() - 5, { align: "center" });
    }

    pdf.save(`${activeTab}-report-${format(now, "yyyy-MM-dd-HHmm")}.pdf`);

    // Save to DB
    await supabase.from("reports" as any).insert({
      user_id: user.id,
      title: `${serviceName} — ${regionLabel} — ${format(now, "dd.MM.yyyy HH:mm")}`,
      report_type: activeTab,
      period_start: format(now, "yyyy-MM-dd"),
      period_end: format(now, "yyyy-MM-dd"),
      data: { tab: activeTab, region: regionFilter, incidents_count: relevantIncs.length, generated: now.toISOString() },
    } as any);

    setGeneratingPdf(false);
    toast({ title: "Звіт згенеровано", description: `PDF ${serviceName} завантажено та збережено.` });
  }, [activeTab, regionFilter, incidents, filteredIncidents, sesData, policeData, nguData, medicalData, regionDeficits, user, toast]);

  // ═══ RENDER HELPERS ═══
  const RegionFilterBar = () => (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <Select value={regionFilter} onValueChange={setRegionFilter}>
          <SelectTrigger className="w-[220px] h-8 text-xs"><SelectValue placeholder="Вся країна" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">🇺🇦 Вся країна</SelectItem>
            {REGION_OPTIONS.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {regionFilter !== "all" && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRegionFilter("all")}><X className="h-3.5 w-3.5" /></Button>}
      </div>
      <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={generateServicePdf} disabled={generatingPdf}>
        {generatingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        Сформувати звіт
      </Button>
    </div>
  );

  const StatCard = ({ label, value, icon: Icon, sub }: { label: string; value: string | number; icon: any; sub?: string }) => (
    <div className="bg-muted/50 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );

  const RegionTable = ({ data, columns }: { data: any[]; columns: { key: string; label: string }[] }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map(c => <th key={c.key} className="text-left py-2 text-muted-foreground font-medium text-xs">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 10).map((row, i) => (
            <tr key={i} className="border-b border-border/50 hover:bg-muted/50">
              {columns.map(c => <td key={c.key} className="py-2 text-xs">{row[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ═══ TOP SERVICE CARDS ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { key: "ses" as ServiceTab, label: "ДСНС", icon: Flame, color: "border-l-red-500", stats: [`${sesData.units} підр.`, `${sesData.rescued} врят.`, `${sesData.personnel} ос.`] },
          { key: "ngu" as ServiceTab, label: "НГУ", icon: Shield, color: "border-l-gray-500", stats: [`${nguData.total} опер.`, `${nguData.personnel} ос.`, `${nguData.specialUnits} спец.`] },
          { key: "police" as ServiceTab, label: "Поліція", icon: Phone, color: "border-l-blue-500", stats: [`${policeData.patrols} патр.`, `${policeData.crimes} крим.`, `${policeData.personnel} ос.`] },
          { key: "medical" as ServiceTab, label: "Медицина", icon: Stethoscope, color: "border-l-green-500", stats: [`${medicalData.brigades} бриг.`, `${medicalData.injured} постр.`, `${medicalData.rescued} врят.`] },
        ].map(svc => (
          <Card key={svc.key} className={`border-l-4 ${svc.color} cursor-pointer hover:shadow-lg transition-all ${activeTab === svc.key ? "ring-2 ring-primary/50" : ""}`}
            onClick={() => setActiveTab(svc.key)}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <svc.icon className="h-4 w-4 text-muted-foreground" />
                <span className="font-bold text-xs">{svc.label}</span>
                <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto" />
              </div>
              <div className="space-y-0.5">
                {svc.stats.map((s, i) => <p key={i} className="text-[11px] text-muted-foreground">{s}</p>)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ═══ GENERAL STATS ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat, i) => (
          <Card key={i} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{stat.title}</p>
                  <p className="text-xl font-bold text-foreground mt-1">{stat.value}</p>
                  <span className="text-[10px] text-muted-foreground">{stat.change}</span>
                </div>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ═══ DEFICIT ALERT ═══ */}
      {criticalDeficits.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <Zap className="h-4 w-4" /> Дефіцит ресурсів — {criticalDeficits.length} регіон(ів)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {criticalDeficits.slice(0, 3).map(d => (
              <div key={d.regionId} className="flex items-center gap-3 cursor-pointer rounded-md p-1 -m-1 hover:bg-destructive/10 transition-colors" onClick={() => navigateToRegion(d.regionId)}>
                <MapPin className="h-3.5 w-3.5 text-destructive shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium">{d.regionName}</span>
                    <span className="text-[10px] text-destructive">−{d.deficitPersonnel} ос.</span>
                  </div>
                  <Progress value={Math.max(0, 100 - d.deficitPercent)} className="h-1" />
                </div>
                <Badge variant="destructive" className="text-[9px] shrink-0">{d.deficitPercent}%</Badge>
                <ChevronRight className="h-3 w-3 text-destructive/50 shrink-0" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ═══ MAIN TABS ═══ */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ServiceTab)} className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:grid-cols-9 h-10">
          <TabsTrigger value="overview" className="text-[11px] gap-1"><BarChart3 className="h-3.5 w-3.5" />Огляд</TabsTrigger>
          <TabsTrigger value="ses" className="text-[11px] gap-1"><Flame className="h-3.5 w-3.5" />ДСНС</TabsTrigger>
          <TabsTrigger value="ngu" className="text-[11px] gap-1"><Shield className="h-3.5 w-3.5" />НГУ</TabsTrigger>
          <TabsTrigger value="police" className="text-[11px] gap-1"><Phone className="h-3.5 w-3.5" />НПУ</TabsTrigger>
          <TabsTrigger value="medical" className="text-[11px] gap-1"><Stethoscope className="h-3.5 w-3.5" />ЕМД</TabsTrigger>
          <TabsTrigger value="resources" className="text-[11px] gap-1 hidden lg:flex"><ArrowRightLeft className="h-3.5 w-3.5" />Ресурси</TabsTrigger>
          <TabsTrigger value="incidents" className="text-[11px] gap-1 hidden lg:flex"><AlertTriangle className="h-3.5 w-3.5" />Журнал</TabsTrigger>
          <TabsTrigger value="personnel" className="text-[11px] gap-1 hidden lg:flex"><Users className="h-3.5 w-3.5" />Персонал</TabsTrigger>
          <TabsTrigger value="analytics" className="text-[11px] gap-1 hidden lg:flex"><Activity className="h-3.5 w-3.5" />Аналітика</TabsTrigger>
        </TabsList>

        {/* ═══════ OVERVIEW ═══════ */}
        <TabsContent value="overview" className="space-y-4 mt-4" ref={tabContentRef}>
          <RegionFilterBar />
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />Інциденти за місяцями</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-primary" />Тижнева динаміка</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip />
                    <Line type="monotone" dataKey="incidents" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} name="Інциденти" />
                    <Line type="monotone" dataKey="resolved" stroke="hsl(150, 60%, 45%)" strokeWidth={2} dot={{ r: 3 }} name="Вирішено" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Останні інциденти</CardTitle></CardHeader>
            <CardContent>
              {incidentsLoading ? <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                : <div className="space-y-1.5">{incidents.slice(0, 5).map(inc => {
                  const sev = SEVERITY_CONFIG[inc.severity]; const sta = STATUS_CONFIG[inc.status];
                  return (<div key={inc.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${sev?.color?.replace("text-", "bg-") || "bg-muted-foreground"}`} />
                      <div className="min-w-0"><span className="font-medium text-xs block truncate">{inc.title}</span><span className="text-muted-foreground text-[11px]">{inc.regionName} • {INCIDENT_TYPE_LABELS[inc.type]}</span></div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0"><span className="text-[10px] text-muted-foreground">{inc.resources.personnel_total} ос.</span><Badge variant="outline" className="text-[9px]">{sta?.label || inc.status}</Badge></div>
                  </div>);
                })}</div>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════ ДСНС ═══════ */}
        <TabsContent value="ses" className="space-y-4 mt-4">
          <RegionFilterBar />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Інцидентів" value={sesData.total} icon={Flame} />
            <StatCard label="Пожеж" value={sesData.fires} icon={Flame} sub="ліквідація" />
            <StatCard label="Підрозділів" value={sesData.units} icon={Truck} sub={`резерв: ${sesData.reserveUnits}`} />
            <StatCard label="Врятовано" value={sesData.rescued} icon={Heart} />
            <StatCard label="Особовий склад" value={sesData.personnel} icon={Users} />
            <StatCard label="Піротехніка" value={sesData.eod} icon={Target} sub={`${sesData.eodArea.toFixed(1)} км² обстежено`} />
            <StatCard label="Сер. час реагування" value={`${sesData.avgResponseMin} хв`} icon={Clock} />
            <StatCard label="Постраждалих" value={sesData.injured} icon={AlertTriangle} />
          </div>

          {/* Heatmap chart */}
          {sesData.heatmapData.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Flame className="h-4 w-4 text-destructive" />Теплова карта НС по регіонам</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={sesData.heatmapData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10 }} /><YAxis dataKey="name" type="category" width={70} tick={{ fontSize: 9 }} /><Tooltip />
                    <Bar dataKey="пожежі" fill="hsl(0, 84%, 60%)" stackId="a" />
                    <Bar dataKey="НС" fill="hsl(24, 95%, 53%)" stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {sesData.equipment.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Truck className="h-4 w-4 text-muted-foreground" />Спецтехніка на озброєнні</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">{sesData.equipment.map((eq, i) => <Badge key={i} variant="outline" className="text-[11px]">{eq}</Badge>)}</div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Розподіл по регіонам</CardTitle></CardHeader>
            <CardContent>
              <RegionTable data={sesData.byRegion} columns={[{ key: "region", label: "Регіон" }, { key: "incidents", label: "Інцидентів" }, { key: "units", label: "Підрозділів" }, { key: "personnel", label: "Особ. склад" }, { key: "rescued", label: "Врятовано" }]} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════ НГУ ═══════ */}
        <TabsContent value="ngu" className="space-y-4 mt-4">
          <RegionFilterBar />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Операцій" value={nguData.total} icon={Shield} />
            <StatCard label="Особовий склад" value={nguData.personnel} icon={Users} />
            <StatCard label="Спільне патрулювання" value={nguData.patrolJoint} icon={Eye} sub="з НПУ" />
            <StatCard label="Крит. інфраструктура" value={nguData.critInfra} icon={Building2} />
            <StatCard label="Спецпідрозділів" value={nguData.specialUnits} icon={Sword} />
            <StatCard label="Техніки активно" value={nguData.vehiclesActive} icon={Truck} />
            <StatCard label="Інциденти на об'єктах" value={nguData.infraIncidents} icon={ShieldAlert} />
            <StatCard label="Готовність (%)" value={`${nguData.readinessPercent}%`} icon={Target} />
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4 text-muted-foreground" />Діаграма готовності підрозділів</CardTitle></CardHeader>
            <CardContent className="flex justify-center">
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={nguData.readinessData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                  <Radar name="Готовність" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Розподіл по регіонам</CardTitle></CardHeader>
            <CardContent>
              <RegionTable data={nguData.byRegion} columns={[{ key: "region", label: "Регіон" }, { key: "incidents", label: "Операцій" }, { key: "personnel", label: "Особ. склад" }]} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════ ПОЛІЦІЯ ═══════ */}
        <TabsContent value="police" className="space-y-4 mt-4">
          <RegionFilterBar />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Інцидентів НПУ" value={policeData.total} icon={Phone} />
            <StatCard label="Кримінальних подій" value={policeData.crimes} icon={Crosshair} />
            <StatCard label="Патрулів залучено" value={policeData.patrols} icon={Radio} />
            <StatCard label="Затримань" value={policeData.arrests} icon={ShieldCheck} />
            <StatCard label="Особовий склад" value={policeData.personnel} icon={Users} />
            <StatCard label="Критичних подій" value={policeData.critical} icon={AlertTriangle} />
            <StatCard label="Розкриття (%)" value={`${policeData.resolvedRate}%`} icon={Target} sub="по гарячих слідах" />
            <StatCard label="Сер. час прибуття" value={`${policeData.avgArrivalMin} хв`} icon={Clock} />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Виклики 102 за категоріями</CardTitle></CardHeader>
              <CardContent className="flex justify-center">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={policeData.callCategories} cx="50%" cy="50%" innerRadius={45} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {policeData.callCategories.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Статус екіпажів</CardTitle></CardHeader>
              <CardContent className="flex justify-center">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={policeData.patrolStatus} cx="50%" cy="50%" innerRadius={45} outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      <Cell fill="hsl(24, 95%, 53%)" /><Cell fill="hsl(150, 60%, 45%)" /><Cell fill="hsl(200, 70%, 50%)" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Розподіл по регіонам</CardTitle></CardHeader>
            <CardContent>
              <RegionTable data={policeData.byRegion} columns={[{ key: "region", label: "Регіон" }, { key: "incidents", label: "Інцидентів" }, { key: "patrols", label: "Патрулів" }, { key: "personnel", label: "Особ. склад" }, { key: "crimes", label: "Кримінальних" }]} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════ МЕДИЦИНА / ЕМД ═══════ */}
        <TabsContent value="medical" className="space-y-4 mt-4">
          <RegionFilterBar />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Активних подій" value={medicalData.total} icon={Stethoscope} />
            <StatCard label="Бригад залучено" value={medicalData.brigades} icon={Ambulance} sub={`вільних: ${medicalData.freeBrigades}`} />
            <StatCard label="Постраждалих" value={medicalData.injured} icon={Heart} />
            <StatCard label="Загиблих" value={medicalData.fatalities} icon={AlertTriangle} />
            <StatCard label="Врятовано" value={medicalData.rescued} icon={TrendingUp} />
            <StatCard label="Особовий склад" value={medicalData.personnel} icon={Users} />
          </div>

          {/* Hospital load */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" />Завантаженість лікарень</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {medicalData.hospitalLoad.map(h => (
                <div key={h.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{h.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{h.load}%</span>
                      <span className={`h-2.5 w-2.5 rounded-full ${h.status === "critical" ? "bg-red-500" : h.status === "warning" ? "bg-yellow-500" : "bg-green-500"}`} />
                    </div>
                  </div>
                  <Progress value={h.load} className={`h-2 ${h.status === "critical" ? "[&>div]:bg-red-500" : h.status === "warning" ? "[&>div]:bg-yellow-500" : ""}`} />
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Blood supply */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Droplets className="h-4 w-4 text-destructive" />Запаси донорської крові</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={medicalData.bloodSupply}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="group" tick={{ fontSize: 10 }} /><YAxis domain={[0, 100]} tick={{ fontSize: 10 }} /><Tooltip />
                    <Bar dataKey="level" radius={[4, 4, 0, 0]}>
                      {medicalData.bloodSupply.map((b, i) => <Cell key={i} fill={b.level < 40 ? "hsl(0, 84%, 60%)" : b.level < 60 ? "hsl(45, 93%, 47%)" : "hsl(150, 60%, 45%)"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            {/* EMD calls */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Ambulance className="h-4 w-4 text-muted-foreground" />Виклики ЕМД</CardTitle></CardHeader>
              <CardContent className="flex justify-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={medicalData.emdCalls} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      <Cell fill="hsl(0, 84%, 60%)" /><Cell fill="hsl(200, 70%, 50%)" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Розподіл по регіонам</CardTitle></CardHeader>
            <CardContent>
              <RegionTable data={medicalData.byRegion} columns={[{ key: "region", label: "Регіон" }, { key: "incidents", label: "Подій" }, { key: "brigades", label: "Бригад" }, { key: "injured", label: "Постраждалих" }, { key: "rescued", label: "Врятовано" }, { key: "fatalities", label: "Загиблих" }]} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════ RESOURCES ═══════ */}
        <TabsContent value="resources" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />Аналіз ресурсів по регіонам</CardTitle></CardHeader>
            <CardContent>
              {regionDeficits.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Немає активних інцидентів</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border">
                      {["Регіон", "Активних", "Крит.", "Персонал", "Підрозділів", "Статус"].map(h => <th key={h} className="text-left py-2 text-muted-foreground font-medium text-xs">{h}</th>)}
                    </tr></thead>
                    <tbody>{regionDeficits.sort((a, b) => b.deficitPercent - a.deficitPercent).map(d => (
                      <tr key={d.regionId} className="border-b border-border/50 hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => navigateToRegion(d.regionId)}>
                        <td className="py-2 text-xs font-medium text-primary underline-offset-2 hover:underline">{d.regionName}</td>
                        <td className="py-2 text-xs">{d.activeCount}</td>
                        <td className="py-2 text-xs">{d.criticalCount > 0 ? <Badge variant="destructive" className="text-[9px]">{d.criticalCount}</Badge> : "—"}</td>
                        <td className="py-2 text-xs"><span className={d.deficitPersonnel > 0 ? "text-destructive font-medium" : ""}>{d.currentPersonnel}/{d.requiredPersonnel}</span></td>
                        <td className="py-2 text-xs"><span className={d.deficitUnits > 0 ? "text-destructive font-medium" : ""}>{d.currentUnits}/{d.requiredUnits}</span></td>
                        <td className="py-2 text-xs">{d.surplus ? <Badge className="bg-green-500/10 text-green-600 border-green-500/30 text-[9px]">Надлишок</Badge> : d.deficitPercent > 30 ? <Badge variant="destructive" className="text-[9px]">Дефіцит {d.deficitPercent}%</Badge> : <Badge className="bg-green-500/10 text-green-600 border-green-500/30 text-[9px]">Норма</Badge>}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ArrowRightLeft className="h-4 w-4 text-primary" />Рекомендації щодо перерозподілу</CardTitle></CardHeader>
            <CardContent>
              {recommendations.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Ресурси розподілені оптимально</p> : (
                <div className="space-y-2">{recommendations.map((rec, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><ArrowRightLeft className="h-4 w-4 text-primary" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs"><span className="font-medium text-green-600">{rec.fromName}</span><span className="text-muted-foreground mx-1.5">→</span><span className="font-medium text-destructive">{rec.toName}</span></p>
                      <p className="text-[10px] text-muted-foreground">{rec.personnel} осіб{rec.units > 0 ? `, ${rec.units} підрозділів` : ""} • {rec.reason}</p>
                    </div>
                  </div>
                ))}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════ INCIDENTS ═══════ */}
        <TabsContent value="incidents" className="mt-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Журнал інцидентів</CardTitle></CardHeader>
            <CardContent>
              {incidentsLoading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                : incidents.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Немає інцидентів</p>
                : <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border">
                      {["Назва", "Регіон", "Тип", "Рівень", "Ресурси", "Статус"].map(h => <th key={h} className="text-left py-2 text-muted-foreground font-medium text-xs">{h}</th>)}
                    </tr></thead>
                    <tbody>{incidents.map(inc => {
                      const sev = SEVERITY_CONFIG[inc.severity] || { label: inc.severity, bgColor: "bg-muted" };
                      const sta = STATUS_CONFIG[inc.status] || { label: inc.status, color: "text-muted-foreground" };
                      return (<tr key={inc.id} className="border-b border-border/50 hover:bg-muted/50">
                        <td className="py-2 text-xs font-medium max-w-[180px] truncate">{inc.title}</td>
                        <td className="py-2 text-xs text-muted-foreground">{inc.regionName}</td>
                        <td className="py-2 text-xs text-muted-foreground">{INCIDENT_TYPE_LABELS[inc.type]}</td>
                        <td className="py-2"><Badge variant="outline" className={`text-[9px] ${sev.bgColor}`}>{sev.label}</Badge></td>
                        <td className="py-2 text-xs text-muted-foreground">{inc.resources.personnel_total} ос.</td>
                        <td className="py-2"><span className={`text-[10px] font-medium ${sta.color}`}>{sta.label}</span></td>
                      </tr>);
                    })}</tbody>
                  </table>
                </div>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════ PERSONNEL ═══════ */}
        <TabsContent value="personnel" className="mt-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Список персоналу</CardTitle>
              <Button size="sm" onClick={() => openPersonDialog()} className="gap-1 h-8 text-xs"><Plus className="h-3.5 w-3.5" />Додати</Button>
            </CardHeader>
            <CardContent>
              {loadingPersonnel ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                : personnel.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Немає персоналу.</p>
                : <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border">
                      {["ПІБ", "Звання", "Відділ", "Статус", "Дії"].map(h => <th key={h} className={`py-2 text-muted-foreground font-medium text-xs ${h === "Дії" ? "text-right" : "text-left"}`}>{h}</th>)}
                    </tr></thead>
                    <tbody>{personnel.map((p: any) => (
                      <tr key={p.id} className="border-b border-border/50 hover:bg-muted/50">
                        <td className="py-2 text-xs font-medium">{p.name}</td>
                        <td className="py-2 text-xs text-muted-foreground">{p.rank}</td>
                        <td className="py-2 text-xs text-muted-foreground">{p.department}</td>
                        <td className="py-2"><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${p.status === "На службі" ? "bg-green-100 text-green-700" : "bg-secondary text-secondary-foreground"}`}>{p.status}</span></td>
                        <td className="py-2 text-right"><div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openPersonDialog(p)}><Pencil className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deletePerson(p.id)}><Trash2 className="h-3 w-3" /></Button>
                        </div></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════ ANALYTICS ═══════ */}
        <TabsContent value="analytics" className="space-y-4 mt-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Категорії інцидентів</CardTitle></CardHeader>
              <CardContent className="flex justify-center">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {categoryData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie><Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">За рівнем загрози</CardTitle></CardHeader>
              <CardContent className="flex justify-center">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={severityData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {severityData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie><Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Personnel Dialog */}
      <Dialog open={personDialogOpen} onOpenChange={setPersonDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingPerson?.id ? "Редагувати" : "Новий співробітник"}</DialogTitle></DialogHeader>
          {editingPerson && (
            <div className="space-y-3">
              <div className="space-y-1"><label className="text-xs font-medium">ПІБ</label><Input value={editingPerson.name || ""} onChange={e => setEditingPerson({ ...editingPerson, name: e.target.value })} /></div>
              <div className="space-y-1"><label className="text-xs font-medium">Звання</label><Input value={editingPerson.rank || ""} onChange={e => setEditingPerson({ ...editingPerson, rank: e.target.value })} /></div>
              <div className="space-y-1"><label className="text-xs font-medium">Відділ</label><Input value={editingPerson.department || ""} onChange={e => setEditingPerson({ ...editingPerson, department: e.target.value })} /></div>
              <div className="space-y-1"><label className="text-xs font-medium">Статус</label>
                <Select value={editingPerson.status || "На службі"} onValueChange={val => setEditingPerson({ ...editingPerson, status: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="На службі">На службі</SelectItem>
                    <SelectItem value="Відпустка">Відпустка</SelectItem>
                    <SelectItem value="Лікарняний">Лікарняний</SelectItem>
                    <SelectItem value="Відрядження">Відрядження</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPersonDialogOpen(false)}>Скасувати</Button>
            <Button onClick={savePerson} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Зберегти</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
