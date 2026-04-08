import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { startOfDay, subDays, getMonth, getDay, isToday, format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  SEVERITY_CONFIG, STATUS_CONFIG, INCIDENT_TYPE_LABELS,
  type Incident, type SeverityLevel,
} from "@/data/mockIncidents";
import {
  Shield, Users, FileText, AlertTriangle, TrendingUp,
  BarChart3, Activity, Pencil, Plus, Trash2, Loader2,
  Flame, Phone, ShieldCheck, ArrowRightLeft, MapPin, Zap,
  Truck, Heart, ChevronRight, X, Download, Clock,
  Target, Eye, Building2, Crosshair, Radio, Stethoscope,
  Droplets, Ambulance, ShieldAlert, Sword,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { CYRILLIC_FONT } from "@/lib/cyrillic-font";

function setupCyrillicPdf(pdf: jsPDF) {
  pdf.addFileToVFS("Roboto-Regular.ttf", CYRILLIC_FONT);
  pdf.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  pdf.setFont("Roboto");
}

const CHART_COLORS = ["hsl(24,95%,53%)", "hsl(200,70%,50%)", "hsl(150,60%,45%)", "hsl(280,60%,55%)", "hsl(340,70%,55%)", "hsl(30,100%,75%)"];
const MONTH_NAMES = ["Січ", "Лют", "Бер", "Кві", "Тра", "Чер", "Лип", "Сер", "Вер", "Жов", "Лис", "Гру"];
const DAY_NAMES = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const REGION_IDS = Object.keys(REGION_NAME_MAP);

const SEVERITY_RESOURCE_NORM: Record<string, { personnel: number; units: number }> = {
  Critical: { personnel: 30, units: 8 }, High: { personnel: 15, units: 5 }, Major: { personnel: 8, units: 3 },
  Medium: { personnel: 4, units: 2 }, Minor: { personnel: 2, units: 1 }, Low: { personnel: 1, units: 1 },
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
      if (sP <= 0) continue;
      recs.push({ from: donor.regionId, fromName: donor.regionName, to: need.regionId, toName: need.regionName, personnel: Math.min(sP, need.deficitPersonnel), units: Math.min(Math.max(0, donor.currentUnits - donor.requiredUnits), need.deficitUnits), reason: need.criticalCount > 0 ? `${need.criticalCount} критичних` : `${need.activeCount} активних` });
    }
  }
  return recs;
}

type ServiceKey = "ses" | "ngu" | "police" | "medical";

const Dashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { incidents, loading: incidentsLoading, setSelectedRegion, newIncidentIds, updatedIncidentIds } = useIncidentStore();
  useIncidents();

  const [regionFilter, setRegionFilter] = useState("all");
  const [serviceDialog, setServiceDialog] = useState<ServiceKey | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [loadingPersonnel, setLoadingPersonnel] = useState(true);
  const [personDialogOpen, setPersonDialogOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useState(() => {
    supabase.from("personnel").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { setPersonnel(data || []); setLoadingPersonnel(false); });
  });

  const navigateToRegion = useCallback((regionId: string) => {
    setSelectedRegion(regionId);
    navigate("/situation-center");
  }, [setSelectedRegion, navigate]);

  const filteredIncidents = useMemo(() => {
    let list = incidents.filter(i => i.status !== "Resolved");
    if (regionFilter !== "all") list = list.filter(i => i.region === regionFilter);
    return list;
  }, [incidents, regionFilter]);

  const allActive = useMemo(() => incidents.filter(i => i.status !== "Resolved"), [incidents]);

  // ═══ KPI ═══
  const kpis = useMemo(() => {
    const active = allActive.length;
    const todayIncs = incidents.filter(i => isToday(new Date(i.timestamp)));
    const resolved = incidents.filter(i => i.status === "Resolved").length;
    const rate = incidents.length > 0 ? Math.round((resolved / incidents.length) * 100) : 0;
    const totalPersonnel = allActive.reduce((s, i) => s + i.resources.personnel_total, 0);
    const rescued = todayIncs.reduce((s, i) => s + i.impact.rescued, 0);
    return { active, todayCount: todayIncs.length, resolved, rate, totalPersonnel, rescued };
  }, [incidents, allActive]);

  // ═══ SERVICE DATA ═══
  const serviceStats = useMemo(() => {
    const fi = filteredIncidents;
    const sesIncs = fi.filter(i => i.category === "SES" || i.resources.ses_units > 0);
    const polIncs = fi.filter(i => i.category === "Police" || i.resources.police_units > 0);
    const medIncs = fi.filter(i => i.category === "Medical" || i.resources.medical_units > 0);
    const nguIncs = fi.filter(i => i.category === "Combined" || i.lead_agency === "НГУ" || (i.resources.police_units > 0 && i.resources.ses_units > 0));

    const makeByRegion = (incs: Incident[]) => Object.entries(REGION_NAME_MAP).map(([id, name]) => {
      const r = incs.filter(i => i.region === id);
      return { region: name, incidents: r.length, personnel: r.reduce((s, i) => s + i.resources.personnel_total, 0), units: r.reduce((s, i) => s + i.resources.ses_units + i.resources.police_units + i.resources.medical_units, 0), rescued: r.reduce((s, i) => s + i.impact.rescued, 0), injured: r.reduce((s, i) => s + i.impact.injured, 0) };
    }).filter(r => r.incidents > 0).sort((a, b) => b.incidents - a.incidents);

    return {
      ses: {
        total: sesIncs.length, fires: sesIncs.filter(i => i.type === "Fire").length,
        units: sesIncs.reduce((s, i) => s + i.resources.ses_units, 0),
        personnel: sesIncs.reduce((s, i) => s + i.resources.personnel_total, 0),
        rescued: sesIncs.reduce((s, i) => s + i.impact.rescued, 0),
        eod: sesIncs.filter(i => i.type === "EOD").length,
        avgResponse: sesIncs.length > 0 ? Math.round(12 + Math.random() * 8) : 0,
        reserve: Math.max(0, 25 - sesIncs.reduce((s, i) => s + i.resources.ses_units, 0)),
        equipment: [...new Set(sesIncs.flatMap(i => i.resources.specialized_equipment || []))],
        byRegion: makeByRegion(sesIncs),
      },
      ngu: {
        total: nguIncs.length, personnel: nguIncs.reduce((s, i) => s + i.resources.personnel_total, 0),
        patrol: fi.filter(i => i.resources.police_units > 0).length,
        critInfra: nguIncs.filter(i => i.severity === "Critical" || i.severity === "High").length,
        specialUnits: Math.round(3 + Math.random() * 5),
        vehicles: Math.round(8 + Math.random() * 12),
        readiness: Math.min(100, Math.round(70 + Math.random() * 25)),
        readinessData: [
          { subject: "Особовий склад", value: Math.round(70 + Math.random() * 25), fullMark: 100 },
          { subject: "Спецтехніка", value: Math.round(60 + Math.random() * 30), fullMark: 100 },
          { subject: "Озброєння", value: Math.round(75 + Math.random() * 20), fullMark: 100 },
          { subject: "Зв'язок", value: Math.round(80 + Math.random() * 15), fullMark: 100 },
          { subject: "Логістика", value: Math.round(55 + Math.random() * 35), fullMark: 100 },
        ],
        byRegion: makeByRegion(nguIncs),
      },
      police: {
        total: polIncs.length, crimes: polIncs.filter(i => i.type === "Crime").length,
        patrols: polIncs.reduce((s, i) => s + i.resources.police_units, 0),
        personnel: polIncs.reduce((s, i) => s + i.resources.personnel_total, 0),
        arrests: polIncs.filter(c => c.status === "Containment" || c.status === "Resolved").length,
        resolvedRate: polIncs.length > 0 ? Math.round((polIncs.filter(i => i.status === "Resolved" || i.status === "Containment").length / polIncs.length) * 100) : 0,
        avgArrival: polIncs.length > 0 ? Math.round(7 + Math.random() * 8) : 0,
        callCategories: [
          { name: "Тяжкі", value: polIncs.filter(c => c.type === "Crime" && (c.severity === "Critical" || c.severity === "High")).length || 1 },
          { name: "Адмін", value: Math.max(1, polIncs.length - polIncs.filter(c => c.type === "Crime").length) },
          { name: "ДТП", value: polIncs.filter(i => i.type === "Rescue" && i.resources.police_units > 0).length || 1 },
        ],
        patrolStatus: [
          { name: "На завданні", value: polIncs.reduce((s, i) => s + i.resources.police_units, 0) },
          { name: "Вільні", value: Math.max(2, 15 - polIncs.reduce((s, i) => s + i.resources.police_units, 0)) },
          { name: "У відділку", value: Math.round(3 + Math.random() * 4) },
        ],
        byRegion: makeByRegion(polIncs),
      },
      medical: {
        total: medIncs.length,
        brigades: medIncs.reduce((s, i) => s + i.resources.medical_units, 0),
        personnel: medIncs.reduce((s, i) => s + i.resources.personnel_total, 0),
        injured: medIncs.reduce((s, i) => s + i.impact.injured, 0),
        fatalities: medIncs.reduce((s, i) => s + i.impact.fatalities, 0),
        rescued: medIncs.reduce((s, i) => s + i.impact.rescued, 0),
        freeBrigades: Math.max(2, 12 - medIncs.reduce((s, i) => s + i.resources.medical_units, 0)),
        hospitalLoad: [
          { name: "Реанімація", load: Math.min(100, Math.round(40 + medIncs.reduce((s, i) => s + i.impact.injured, 0) * 8)) },
          { name: "Хірургія", load: Math.min(100, Math.round(30 + medIncs.reduce((s, i) => s + i.impact.injured, 0) * 5)) },
          { name: "Травматологія", load: Math.min(100, Math.round(35 + medIncs.reduce((s, i) => s + i.impact.injured, 0) * 6)) },
        ].map(h => ({ ...h, status: h.load > 85 ? "critical" : h.load > 60 ? "warning" : "normal" })),
        bloodSupply: [
          { group: "I (O)", level: Math.round(40 + Math.random() * 50) },
          { group: "II (A)", level: Math.round(30 + Math.random() * 60) },
          { group: "III (B)", level: Math.round(35 + Math.random() * 55) },
          { group: "IV (AB)", level: Math.round(45 + Math.random() * 45) },
        ],
        byRegion: makeByRegion(medIncs),
      },
    };
  }, [filteredIncidents]);

  // Charts
  const trendData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = subDays(startOfDay(now), 6 - i);
      const dayIncs = incidents.filter(inc => startOfDay(new Date(inc.timestamp)).getTime() === d.getTime());
      return { name: DAY_NAMES[getDay(d)], інциденти: dayIncs.length, вирішено: dayIncs.filter(inc => inc.status === "Resolved").length };
    });
  }, [incidents]);

  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    incidents.forEach(i => { const t = INCIDENT_TYPE_LABELS[i.type] || i.type; counts[t] = (counts[t] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [incidents]);

  const regionDeficits = useMemo(() => computeRegionDeficits(incidents), [incidents]);
  const recommendations = useMemo(() => computeRecommendations(regionDeficits), [regionDeficits]);
  const criticalDeficits = useMemo(() => regionDeficits.filter(d => d.deficitPercent > 30), [regionDeficits]);

  const REGION_OPTIONS = useMemo(() => {
    const regs = new Set(incidents.filter(i => i.status !== "Resolved").map(i => i.region));
    return Object.entries(REGION_NAME_MAP).filter(([id]) => regs.has(id)).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [incidents]);

  // Personnel CRUD
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

  // PDF
  const generatePdf = useCallback(async () => {
    if (!user) return;
    setGeneratingPdf(true);
    const pdf = new jsPDF("p", "mm", "a4");
    const pageW = pdf.internal.pageSize.getWidth();
    const now = new Date();
    const regionLabel = regionFilter === "all" ? "Вся Україна" : (REGION_NAME_MAP[regionFilter] || regionFilter);

    pdf.setFillColor(15, 23, 42); pdf.rect(0, 0, pageW, 28, "F");
    pdf.setTextColor(255, 255, 255); pdf.setFontSize(14); pdf.setFont("helvetica", "bold");
    pdf.text("ОПЕРАТИВНИЙ ЗВІТ — СИТУАЦІЙНИЙ ЦЕНТР", pageW / 2, 11, { align: "center" });
    pdf.setFontSize(9); pdf.setFont("helvetica", "normal");
    pdf.text(`${regionLabel} | ${format(now, "HH:mm dd.MM.yyyy")} | ${user.email ?? "—"}`, pageW / 2, 19, { align: "center" });

    let y = 34; pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(11); pdf.setFont("helvetica", "bold"); pdf.text("КРИТИЧНІ ІНДИКАТОРИ", 14, y); y += 5;
    autoTable(pdf, { startY: y, head: [["Показник", "Значення", "Показник", "Значення"]], body: [
      ["Активних інцидентів", String(kpis.active), "Персонал задіяно", String(kpis.totalPersonnel)],
      ["ДСНС подій", String(serviceStats.ses.total), "Поліція подій", String(serviceStats.police.total)],
      ["НГУ операцій", String(serviceStats.ngu.total), "Медицина подій", String(serviceStats.medical.total)],
      ["Врятовано сьогодні", String(kpis.rescued), "Показник вирішення", `${kpis.rate}%`],
    ], theme: "grid", headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontSize: 8 }, bodyStyles: { fontSize: 8 }, columnStyles: { 0: { fontStyle: "bold", cellWidth: 45 }, 1: { cellWidth: 30 }, 2: { fontStyle: "bold", cellWidth: 45 }, 3: { cellWidth: 30 } } });
    y = (pdf as any).lastAutoTable.finalY + 6;

    if (regionDeficits.length > 0) {
      pdf.setFontSize(11); pdf.setFont("helvetica", "bold"); pdf.text("РЕСУРСИ ПО РЕГІОНАМ", 14, y); y += 4;
      autoTable(pdf, { startY: y, head: [["Регіон", "Активних", "Крит.", "Персонал", "Статус"]], body: regionDeficits.slice(0, 12).map(d => [d.regionName, String(d.activeCount), String(d.criticalCount), `${d.currentPersonnel}/${d.requiredPersonnel}`, d.surplus ? "Надлишок" : d.deficitPercent > 30 ? `Дефіцит ${d.deficitPercent}%` : "Норма"]), theme: "striped", headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontSize: 7 }, bodyStyles: { fontSize: 7 } });
      y = (pdf as any).lastAutoTable.finalY + 6;
    }

    const relevantIncs = regionFilter === "all" ? incidents : incidents.filter(i => i.region === regionFilter);
    if (relevantIncs.length > 0) {
      if (y > 230) { pdf.addPage(); y = 15; }
      pdf.setFontSize(11); pdf.setFont("helvetica", "bold"); pdf.text("РЕЄСТР ІНЦИДЕНТІВ", 14, y); y += 4;
      autoTable(pdf, { startY: y, head: [["Час", "Регіон", "Тип", "Назва", "Ос.скл.", "Р/П/З"]], body: relevantIncs.sort((a, b) => b.risk_level - a.risk_level).slice(0, 30).map(inc => [format(new Date(inc.timestamp), "HH:mm"), inc.regionName, INCIDENT_TYPE_LABELS[inc.type] || inc.type, inc.title.substring(0, 35), String(inc.resources.personnel_total), `${inc.impact.rescued}/${inc.impact.injured}/${inc.impact.fatalities}`]), theme: "striped", headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontSize: 7 }, bodyStyles: { fontSize: 7 } });
    }

    const totalPages = pdf.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) { pdf.setPage(p); pdf.setFontSize(7); pdf.setTextColor(120, 120, 120); pdf.text(`Сторінка ${p}/${totalPages} | Конфіденційно | ${format(now, "dd.MM.yyyy HH:mm")}`, pageW / 2, pdf.internal.pageSize.getHeight() - 5, { align: "center" }); }
    pdf.save(`report-${format(now, "yyyy-MM-dd-HHmm")}.pdf`);

    await supabase.from("reports" as any).insert({ user_id: user.id, title: `Звіт — ${regionLabel} — ${format(now, "dd.MM.yyyy HH:mm")}`, report_type: "overview", period_start: format(now, "yyyy-MM-dd"), period_end: format(now, "yyyy-MM-dd"), data: { region: regionFilter, incidents_count: relevantIncs.length, generated: now.toISOString() } } as any);
    setGeneratingPdf(false);
    toast({ title: "Звіт згенеровано", description: "PDF завантажено та збережено." });
  }, [incidents, regionFilter, kpis, serviceStats, regionDeficits, user, toast]);

  // ═══ SERVICE CARDS CONFIG ═══
  const services: { key: ServiceKey; label: string; icon: any; borderColor: string; stats: { label: string; value: string | number }[] }[] = [
    { key: "ses", label: "ДСНС", icon: Flame, borderColor: "border-l-red-500", stats: [{ label: "Інцидентів", value: serviceStats.ses.total }, { label: "Підрозділів", value: serviceStats.ses.units }, { label: "Особового складу", value: serviceStats.ses.personnel }, { label: "Врятовано", value: serviceStats.ses.rescued }] },
    { key: "ngu", label: "Нац. гвардія", icon: Shield, borderColor: "border-l-slate-500", stats: [{ label: "Операцій", value: serviceStats.ngu.total }, { label: "Спецпідрозділів", value: serviceStats.ngu.specialUnits }, { label: "Особового складу", value: serviceStats.ngu.personnel }, { label: "Готовність", value: `${serviceStats.ngu.readiness}%` }] },
    { key: "police", label: "Нац. поліція", icon: Phone, borderColor: "border-l-blue-500", stats: [{ label: "Інцидентів", value: serviceStats.police.total }, { label: "Патрулів", value: serviceStats.police.patrols }, { label: "Особового складу", value: serviceStats.police.personnel }, { label: "Розкриття", value: `${serviceStats.police.resolvedRate}%` }] },
    { key: "medical", label: "Медична служба", icon: Stethoscope, borderColor: "border-l-emerald-500", stats: [{ label: "Подій", value: serviceStats.medical.total }, { label: "Бригад", value: serviceStats.medical.brigades }, { label: "Постраждалих", value: serviceStats.medical.injured }, { label: "Врятовано", value: serviceStats.medical.rescued }] },
  ];

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-5">
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-lg md:text-xl font-bold tracking-tight" style={{ fontFamily: "Montserrat, sans-serif" }}>
          Оперативна панель
        </h1>
        <div className="flex items-center gap-2">
          <Select value={regionFilter} onValueChange={setRegionFilter}>
            <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue placeholder="Вся країна" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">🇺🇦 Вся країна</SelectItem>
              {REGION_OPTIONS.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {regionFilter !== "all" && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRegionFilter("all")}><X className="h-3.5 w-3.5" /></Button>}
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={generatePdf} disabled={generatingPdf}>
            {generatingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Звіт
          </Button>
        </div>
      </div>

      {/* ═══ KPI ROW ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Активні", value: kpis.active, icon: AlertTriangle, accent: "text-destructive", bg: "bg-destructive/10", pulse: newIncidentIds.size > 0 },
          { label: "За добу", value: kpis.todayCount, icon: Clock, accent: "text-orange-500", bg: "bg-orange-500/10", pulse: false },
          { label: "Персонал", value: kpis.totalPersonnel, icon: Users, accent: "text-primary", bg: "bg-primary/10", pulse: false },
          { label: "Врятовано", value: kpis.rescued, icon: Heart, accent: "text-emerald-600", bg: "bg-emerald-500/10", pulse: false },
          { label: "Вирішення", value: `${kpis.rate}%`, icon: TrendingUp, accent: "text-primary", bg: "bg-primary/10", pulse: false },
        ].map(k => (
          <Card key={k.label} className={cn(k.pulse && "animate-card-pulse-new")}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", k.bg)}>
                <k.icon className={cn("h-4 w-4", k.accent)} />
              </div>
              <div>
                <p className="text-xl font-bold leading-none">{k.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{k.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ═══ MAIN GRID: Services + Sidebar ═══ */}
      <div className="grid lg:grid-cols-[1fr_300px] gap-4">
        <div className="space-y-4">
          {/* Service cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {services.map(svc => (
              <Card key={svc.key} className={cn("border-l-4 cursor-pointer hover:shadow-lg transition-all group", svc.borderColor)}
                onClick={() => setServiceDialog(svc.key)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <svc.icon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-sm">{svc.label}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {svc.stats.map(s => (
                      <div key={s.label}>
                        <p className="text-lg font-bold leading-none">{s.value}</p>
                        <p className="text-[10px] text-muted-foreground">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid md:grid-cols-2 gap-3">
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs flex items-center gap-1.5 text-muted-foreground">
                  <Activity className="h-3.5 w-3.5" /> Динаміка за тиждень
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-3">
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip />
                    <Line type="monotone" dataKey="інциденти" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2 }} />
                    <Line type="monotone" dataKey="вирішено" stroke="hsl(150,60%,45%)" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs flex items-center gap-1.5 text-muted-foreground">
                  <BarChart3 className="h-3.5 w-3.5" /> Категорії інцидентів
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-3 flex justify-center">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {categoryData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Recent incidents */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
              <CardTitle className="text-xs text-muted-foreground">Останні інциденти</CardTitle>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => navigate("/situation-center")}>
                Всі <ChevronRight className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {incidentsLoading ? <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : (
                <div className="space-y-1">
                  {incidents.slice(0, 6).map(inc => {
                    const sev = SEVERITY_CONFIG[inc.severity]; const sta = STATUS_CONFIG[inc.status];
                    const isNew = newIncidentIds.has(inc.id);
                    const isUpdated = updatedIncidentIds.has(inc.id);
                    return (
                      <div key={inc.id} className={cn(
                        "flex items-center justify-between py-2 px-2 rounded-md hover:bg-muted/50 transition-all",
                        isNew && inc.severity === "Critical" && "animate-card-pulse-critical",
                        isNew && inc.severity !== "Critical" && "animate-card-pulse-new",
                        isUpdated && "animate-highlight-flash",
                      )}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={cn("h-2 w-2 rounded-full shrink-0", sev?.color?.replace("text-", "bg-") || "bg-muted-foreground", isNew && "animate-pulse")} />
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{inc.title}</p>
                            <p className="text-[10px] text-muted-foreground">{inc.regionName} • {INCIDENT_TYPE_LABELS[inc.type]}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-muted-foreground">{inc.resources.personnel_total} ос.</span>
                          <span className={cn("text-[9px] font-medium", sta?.color)}>{sta?.label || inc.status}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Personnel mini-table */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
              <CardTitle className="text-xs text-muted-foreground">Персонал</CardTitle>
              <Button size="sm" variant="outline" onClick={() => openPersonDialog()} className="gap-1 h-6 text-[10px]"><Plus className="h-3 w-3" />Додати</Button>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {loadingPersonnel ? <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div> : personnel.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">Немає персоналу</p> : (
                <div className="space-y-1">
                  {personnel.slice(0, 5).map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50">
                      <div>
                        <p className="text-xs font-medium">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">{p.rank} • {p.department}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn("text-[9px]", p.status === "На службі" ? "border-emerald-300 text-emerald-700" : "")}>{p.status}</Badge>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); openPersonDialog(p); }}><Pencil className="h-2.5 w-2.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={(e) => { e.stopPropagation(); deletePerson(p.id); }}><Trash2 className="h-2.5 w-2.5" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ═══ RIGHT SIDEBAR ═══ */}
        <div className="space-y-3">
          {/* Deficits */}
          {criticalDeficits.length > 0 ? (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs flex items-center gap-1.5 text-destructive">
                  <Zap className="h-3.5 w-3.5" /> Дефіцит ресурсів
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-2">
                {criticalDeficits.slice(0, 5).map(d => (
                  <div key={d.regionId} className="cursor-pointer rounded-md p-2 hover:bg-destructive/10 transition-colors" onClick={() => navigateToRegion(d.regionId)}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-medium">{d.regionName}</span>
                      <Badge variant="destructive" className="text-[8px]">{d.deficitPercent}%</Badge>
                    </div>
                    <Progress value={Math.max(0, 100 - d.deficitPercent)} className="h-1" />
                    <p className="text-[9px] text-muted-foreground mt-0.5">−{d.deficitPersonnel} ос. • {d.activeCount} подій</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-emerald-500/5 border-emerald-500/30">
              <CardContent className="p-4 text-center">
                <ShieldCheck className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
                <p className="text-xs font-medium text-emerald-700">Ресурси в нормі</p>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <Card>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs flex items-center gap-1.5 text-muted-foreground">
                  <ArrowRightLeft className="h-3.5 w-3.5" /> Перерозподіл
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1.5">
                {recommendations.slice(0, 4).map((rec, i) => (
                  <div key={i} className="text-[10px] p-2 rounded bg-muted/50">
                    <span className="text-emerald-600 font-medium">{rec.fromName}</span>
                    <span className="mx-1 text-muted-foreground">→</span>
                    <span className="text-destructive font-medium">{rec.toName}</span>
                    <p className="text-muted-foreground">{rec.personnel} ос. • {rec.reason}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Resources table */}
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> Ресурси по регіонам
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <ScrollArea className="max-h-[300px]">
                {regionDeficits.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">Немає активних</p> : (
                  <div className="space-y-1">
                    {regionDeficits.sort((a, b) => b.deficitPercent - a.deficitPercent).slice(0, 10).map(d => (
                      <div key={d.regionId} className="flex items-center justify-between py-1.5 px-1 rounded hover:bg-muted/50 cursor-pointer text-[10px]" onClick={() => navigateToRegion(d.regionId)}>
                        <span className="font-medium">{d.regionName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{d.currentPersonnel}/{d.requiredPersonnel}</span>
                          {d.surplus ? <span className="text-emerald-600 text-[9px]">✓</span> : d.deficitPercent > 30 ? <span className="text-destructive text-[9px]">−{d.deficitPercent}%</span> : <span className="text-emerald-600 text-[9px]">✓</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ═══ SERVICE DETAIL DIALOG ═══ */}
      <Dialog open={!!serviceDialog} onOpenChange={(o) => !o && setServiceDialog(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {serviceDialog === "ses" && (
            <>
              <DialogHeader><DialogTitle className="flex items-center gap-2"><Flame className="h-5 w-5 text-red-500" /> ДСНС — Детальна аналітика</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                {[{ l: "Інцидентів", v: serviceStats.ses.total }, { l: "Пожеж", v: serviceStats.ses.fires }, { l: "Підрозділів", v: serviceStats.ses.units }, { l: "Врятовано", v: serviceStats.ses.rescued }, { l: "Особовий склад", v: serviceStats.ses.personnel }, { l: "Піротехніка", v: serviceStats.ses.eod }, { l: "Сер. реагування", v: `${serviceStats.ses.avgResponse} хв` }, { l: "Резерв техніки", v: serviceStats.ses.reserve }].map(s => (
                  <div key={s.l} className="bg-muted/50 rounded-lg p-3"><p className="text-lg font-bold">{s.v}</p><p className="text-[10px] text-muted-foreground">{s.l}</p></div>
                ))}
              </div>
              {serviceStats.ses.equipment.length > 0 && <div className="mt-3"><p className="text-xs font-medium mb-1.5">Спецтехніка на озброєнні</p><div className="flex flex-wrap gap-1">{serviceStats.ses.equipment.map((eq, i) => <Badge key={i} variant="outline" className="text-[10px]">{eq}</Badge>)}</div></div>}
              {serviceStats.ses.byRegion.length > 0 && <div className="mt-3"><p className="text-xs font-medium mb-1.5">По регіонам</p><table className="w-full text-xs"><thead><tr className="border-b">{["Регіон", "Подій", "Підр.", "Особ.", "Врятовано"].map(h => <th key={h} className="text-left py-1.5 text-muted-foreground font-medium">{h}</th>)}</tr></thead><tbody>{serviceStats.ses.byRegion.slice(0, 8).map((r, i) => <tr key={i} className="border-b border-border/50"><td className="py-1.5">{r.region}</td><td>{r.incidents}</td><td>{r.units}</td><td>{r.personnel}</td><td>{r.rescued}</td></tr>)}</tbody></table></div>}
            </>
          )}
          {serviceDialog === "ngu" && (
            <>
              <DialogHeader><DialogTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-slate-600" /> Національна гвардія — Детальна аналітика</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                {[{ l: "Операцій", v: serviceStats.ngu.total }, { l: "Особовий склад", v: serviceStats.ngu.personnel }, { l: "Спецпідрозділів", v: serviceStats.ngu.specialUnits }, { l: "Техніки", v: serviceStats.ngu.vehicles }, { l: "Спільне патрулювання", v: serviceStats.ngu.patrol }, { l: "Крит. інфраструктура", v: serviceStats.ngu.critInfra }, { l: "Готовність", v: `${serviceStats.ngu.readiness}%` }].map(s => (
                  <div key={s.l} className="bg-muted/50 rounded-lg p-3"><p className="text-lg font-bold">{s.v}</p><p className="text-[10px] text-muted-foreground">{s.l}</p></div>
                ))}
              </div>
              <div className="mt-3"><p className="text-xs font-medium mb-1.5">Діаграма готовності</p>
                <ResponsiveContainer width="100%" height={250}><RadarChart cx="50%" cy="50%" outerRadius="70%" data={serviceStats.ngu.readinessData}><PolarGrid stroke="hsl(var(--border))" /><PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} /><PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} /><Radar name="Готовність" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} /></RadarChart></ResponsiveContainer>
              </div>
            </>
          )}
          {serviceDialog === "police" && (
            <>
              <DialogHeader><DialogTitle className="flex items-center gap-2"><Phone className="h-5 w-5 text-blue-500" /> Національна поліція — Детальна аналітика</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                {[{ l: "Інцидентів", v: serviceStats.police.total }, { l: "Кримінальних", v: serviceStats.police.crimes }, { l: "Патрулів", v: serviceStats.police.patrols }, { l: "Затримань", v: serviceStats.police.arrests }, { l: "Особовий склад", v: serviceStats.police.personnel }, { l: "Розкриття", v: `${serviceStats.police.resolvedRate}%` }, { l: "Сер. прибуття", v: `${serviceStats.police.avgArrival} хв` }].map(s => (
                  <div key={s.l} className="bg-muted/50 rounded-lg p-3"><p className="text-lg font-bold">{s.v}</p><p className="text-[10px] text-muted-foreground">{s.l}</p></div>
                ))}
              </div>
              <div className="grid md:grid-cols-2 gap-3 mt-3">
                <div><p className="text-xs font-medium mb-1.5">Виклики 102</p><ResponsiveContainer width="100%" height={180}><PieChart><Pie data={serviceStats.police.callCategories} cx="50%" cy="50%" innerRadius={35} outerRadius={65} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>{serviceStats.police.callCategories.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
                <div><p className="text-xs font-medium mb-1.5">Статус екіпажів</p><ResponsiveContainer width="100%" height={180}><PieChart><Pie data={serviceStats.police.patrolStatus} cx="50%" cy="50%" innerRadius={35} outerRadius={65} dataKey="value" label={({ name, value }) => `${name}: ${value}`}><Cell fill="hsl(24,95%,53%)" /><Cell fill="hsl(150,60%,45%)" /><Cell fill="hsl(200,70%,50%)" /></Pie><Tooltip /></PieChart></ResponsiveContainer></div>
              </div>
            </>
          )}
          {serviceDialog === "medical" && (
            <>
              <DialogHeader><DialogTitle className="flex items-center gap-2"><Stethoscope className="h-5 w-5 text-emerald-500" /> Медична служба — Детальна аналітика</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                {[{ l: "Подій", v: serviceStats.medical.total }, { l: "Бригад", v: serviceStats.medical.brigades }, { l: "Вільних бригад", v: serviceStats.medical.freeBrigades }, { l: "Постраждалих", v: serviceStats.medical.injured }, { l: "Загиблих", v: serviceStats.medical.fatalities }, { l: "Врятовано", v: serviceStats.medical.rescued }].map(s => (
                  <div key={s.l} className="bg-muted/50 rounded-lg p-3"><p className="text-lg font-bold">{s.v}</p><p className="text-[10px] text-muted-foreground">{s.l}</p></div>
                ))}
              </div>
              <div className="mt-3"><p className="text-xs font-medium mb-2">Завантаженість лікарень</p><div className="space-y-2">
                {serviceStats.medical.hospitalLoad.map(h => (
                  <div key={h.name} className="flex items-center gap-3">
                    <span className="text-xs w-28">{h.name}</span>
                    <Progress value={h.load} className={cn("flex-1 h-2", h.status === "critical" ? "[&>div]:bg-destructive" : h.status === "warning" ? "[&>div]:bg-orange-500" : "[&>div]:bg-emerald-500")} />
                    <span className={cn("text-xs font-medium w-10 text-right", h.status === "critical" ? "text-destructive" : h.status === "warning" ? "text-orange-500" : "text-emerald-600")}>{h.load}%</span>
                  </div>
                ))}
              </div></div>
              <div className="mt-3"><p className="text-xs font-medium mb-1.5">Запаси крові</p><ResponsiveContainer width="100%" height={160}><BarChart data={serviceStats.medical.bloodSupply}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="group" tick={{ fontSize: 10 }} /><YAxis domain={[0, 100]} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="level" radius={[4, 4, 0, 0]}>{serviceStats.medical.bloodSupply.map((b, i) => <Cell key={i} fill={b.level < 40 ? "hsl(0,84%,60%)" : b.level < 60 ? "hsl(45,93%,47%)" : "hsl(150,60%,45%)"} />)}</Bar></BarChart></ResponsiveContainer></div>
            </>
          )}
        </DialogContent>
      </Dialog>

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
