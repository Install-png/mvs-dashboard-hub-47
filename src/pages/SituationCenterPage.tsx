import { useState, useMemo, useRef } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { uk } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import UkraineMap, { REGION_NAME_MAP } from "@/components/UkraineMap";
import type { RegionData } from "@/components/UkraineMap";
import {
  INCIDENT_TYPE_LABELS, SEVERITY_CONFIG, STATUS_CONFIG, TYPE_ICONS,
  type Incident, type IncidentType, type SeverityLevel, type IncidentStatus,
} from "@/data/mockIncidents";
import { useIncidents } from "@/hooks/useIncidents";
import { useAuth } from "@/hooks/useAuth";
import {
  CalendarIcon, X, FileText, MapPin, Clock, Users, Flame,
  ShieldCheck, AlertTriangle, Download, Plus, Filter,
  Ambulance, Shield, TrendingUp, Activity, BarChart2, Trash2, Edit,
} from "lucide-react";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const REGION_IDS = Object.keys(REGION_NAME_MAP);
const REGIONS_LIST = REGION_IDS.map((id) => ({ id, name: REGION_NAME_MAP[id] }));

type FilterService = "all" | "ses" | "police" | "medical";
type FilterSeverity = "all" | SeverityLevel;
type FilterStatus = "all" | IncidentStatus;

const SituationCenterPage = () => {
  // Data from DB
  const { incidents, loading: incidentsLoading, createIncident, updateIncident, deleteIncident } = useIncidents();
  const { user } = useAuth();

  // State
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [filterService, setFilterService] = useState<FilterService>("all");
  const [filterSeverity, setFilterSeverity] = useState<FilterSeverity>("all");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Filtered incidents
  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      if (filterService === "ses" && inc.resources.ses_units === 0) return false;
      if (filterService === "police" && inc.resources.police_units === 0) return false;
      if (filterService === "medical" && inc.resources.medical_units === 0) return false;
      if (filterSeverity !== "all" && inc.severity !== filterSeverity) return false;
      if (filterStatus !== "all" && inc.status !== filterStatus) return false;
      if (dateFilter) {
        const d = format(dateFilter, "yyyy-MM-dd");
        const incDate = format(new Date(inc.timestamp), "yyyy-MM-dd");
        if (incDate !== d) return false;
      }
      return true;
    });
  }, [incidents, filterService, filterSeverity, filterStatus, dateFilter]);

  // Region data for map
  const regionData = useMemo((): RegionData[] => {
    return REGIONS_LIST.map((oblast) => {
      const matching = filteredIncidents.filter((inc) => inc.region === oblast.id);
      const active = matching.filter((inc) => inc.status !== "Resolved");
      return {
        id: oblast.id,
        name: oblast.name,
        activeIncidents: active.length,
        criticalCount: matching.filter((inc) => inc.severity === "Critical" && inc.status !== "Resolved").length,
      };
    });
  }, [filteredIncidents]);

  // Region events
  const selectedRegionIncidents = useMemo(() => {
    if (!selectedRegion) return [];
    return filteredIncidents
      .filter((inc) => inc.region === selectedRegion)
      .sort((a, b) => b.risk_level - a.risk_level);
  }, [selectedRegion, filteredIncidents]);

  // Global stats (last 24h)
  const globalStats = useMemo(() => {
    const cutoff = Date.now() - 24 * 3600000;
    const recent = incidents.filter((inc) => new Date(inc.timestamp).getTime() > cutoff);
    return {
      totalActive: incidents.filter((i) => i.status === "Ongoing").length,
      totalToday: recent.length,
      totalRescued: recent.reduce((s, i) => s + i.impact.rescued, 0),
      totalInjured: recent.reduce((s, i) => s + i.impact.injured, 0),
      totalPersonnel: recent.reduce((s, i) => s + i.resources.personnel_total, 0),
      totalSesUnits: recent.reduce((s, i) => s + i.resources.ses_units, 0),
      totalPoliceUnits: recent.reduce((s, i) => s + i.resources.police_units, 0),
      totalMedUnits: recent.reduce((s, i) => s + i.resources.medical_units, 0),
      criticalCount: recent.filter((i) => i.severity === "Critical").length,
    };
  }, [incidents]);

  // Sorted by impact score (risk_level * (rescued + injured + 1))
  const sortedBySeverity = useMemo(() => {
    return [...filteredIncidents].sort((a, b) => {
      const scoreA = a.risk_level * (a.impact.rescued + a.impact.injured + 1);
      const scoreB = b.risk_level * (b.impact.rescued + b.impact.injured + 1);
      return scoreB - scoreA;
    });
  }, [filteredIncidents]);

  // Resolution progress
  const getResolutionProgress = (inc: Incident) => {
    if (inc.status === "Resolved") return 100;
    const start = new Date(inc.timestamp).getTime();
    const end = new Date(inc.estimated_resolution_time).getTime();
    const now = Date.now();
    if (end <= start) return 50;
    const progress = ((now - start) / (end - start)) * 100;
    return Math.min(95, Math.max(5, progress));
  };

  // PDF Generation
  const handleGeneratePDF = () => {
    const pdf = new jsPDF("l", "mm", "a4");
    const pageW = pdf.internal.pageSize.getWidth();
    const today = format(new Date(), "dd MMMM yyyy", { locale: uk });

    // Header
    pdf.setFillColor(15, 23, 42);
    pdf.rect(0, 0, pageW, 30, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text("ЗВЕДЕНА ОПЕРАТИВНА ДОВІДКА", pageW / 2, 12, { align: "center" });
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Ситуаційний центр України | Дата: ${today}`, pageW / 2, 20, { align: "center" });
    pdf.text(`Сформовано: ${format(new Date(), "HH:mm")}`, pageW / 2, 26, { align: "center" });

    // National summary
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text("I. ЗАГАЛЬНОНАЦІОНАЛЬНА СТАТИСТИКА (останні 24 год)", 14, 40);

    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    const summaryData = [
      ["Всього інцидентів", String(globalStats.totalToday), "Критичних подій", String(globalStats.criticalCount)],
      ["Врятовано осіб", String(globalStats.totalRescued), "Постраждало", String(globalStats.totalInjured)],
      ["Всього особового складу", String(globalStats.totalPersonnel), "Активних подій", String(globalStats.totalActive)],
      ["Одиниць ДСНС", String(globalStats.totalSesUnits), "Поліц. нарядів", String(globalStats.totalPoliceUnits)],
    ];

    autoTable(pdf, {
      startY: 44,
      head: [["Показник", "Значення", "Показник", "Значення"]],
      body: summaryData,
      theme: "grid",
      headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 55 },
        1: { cellWidth: 30 },
        2: { fontStyle: "bold", cellWidth: 55 },
        3: { cellWidth: 30 },
      },
    });

    // Incidents table
    const startY = (pdf as any).lastAutoTable.finalY + 10;
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text("II. РЕЄСТР ІНЦИДЕНТІВ", 14, startY);

    const rows = sortedBySeverity.map((inc) => [
      inc.regionName,
      INCIDENT_TYPE_LABELS[inc.type],
      inc.title.substring(0, 35),
      inc.resources.personnel_total.toString(),
      inc.impact.rescued.toString(),
      inc.impact.injured.toString(),
      STATUS_CONFIG[inc.status].label,
      inc.severity === "Critical" ? "КРИТИЧНИЙ" : inc.severity === "Major" ? "Значний" : "Незначний",
    ]);

    autoTable(pdf, {
      startY: startY + 4,
      head: [["Область", "Тип", "Назва", "Ос. склад", "Врят.", "Постраж.", "Статус", "Рівень"]],
      body: rows,
      theme: "striped",
      headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 22 },
        2: { cellWidth: 65 },
        3: { cellWidth: 18 },
        4: { cellWidth: 14 },
        5: { cellWidth: 20 },
        6: { cellWidth: 22 },
        7: { cellWidth: 20 },
      },
      willDrawCell: (data: any) => {
        if (data.column.index === 7 && data.section === "body") {
          const val = data.cell.text[0];
          if (val === "КРИТИЧНИЙ") {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = "bold";
          } else if (val === "Значний") {
            data.cell.styles.textColor = [202, 138, 4];
          }
        }
      },
    });

    // Critical incidents highlight
    const criticals = sortedBySeverity.filter((i) => i.severity === "Critical").slice(0, 3);
    if (criticals.length > 0) {
      const critY = (pdf as any).lastAutoTable.finalY + 10;
      if (critY < 190) {
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0, 0, 0);
        pdf.text("III. ПРІОРИТЕТНІ ПОДІЇ (ТОП-3)", 14, critY);

        criticals.forEach((inc, idx) => {
          const y = critY + 8 + idx * 28;
          if (y > 190) return;
          pdf.setFillColor(254, 242, 242);
          pdf.roundedRect(14, y, pageW - 28, 24, 2, 2, "F");
          pdf.setFontSize(8);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(153, 27, 27);
          pdf.text(`${idx + 1}. ${inc.title}`, 18, y + 7);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(0, 0, 0);
          pdf.text(`Регіон: ${inc.regionName} | Ресурси: ${inc.resources.personnel_total} ос. | Врятовано: ${inc.impact.rescued} | Збитки: ${inc.impact.damage_uah.toLocaleString()} грн`, 18, y + 14);
          pdf.text(inc.description.substring(0, 100), 18, y + 21);
        });
      }
    }

    pdf.save(`operational-brief-${format(new Date(), "yyyy-MM-dd-HHmm")}.pdf`);
  };

  // Add incident form state
  const [newIncident, setNewIncident] = useState<Partial<Incident>>({
    title: "", type: "Fire", severity: "Major", status: "Ongoing",
    region: "kiev", description: "", lead_agency: "ДСНС",
    resources: { ses_units: 0, police_units: 0, medical_units: 0, personnel_total: 0 },
    impact: { rescued: 0, injured: 0, fatalities: 0, damage_est: "", damage_uah: 0 },
  });

  const handleAddIncident = async () => {
    if (!newIncident.title) return;
    const regionInfo = REGIONS_LIST.find((r) => r.id === newIncident.region);
    const coordMap: Record<string, [number, number]> = {
      kiev: [30.5234, 50.4501], lviv: [23.9936, 49.8397], kh: [36.2304, 49.9935],
      dp: [34.9981, 48.4647], od: [30.7233, 46.4775], if: [24.7111, 48.9226],
      vn: [28.4752, 49.2328], dn: [38.0027, 47.0954], zp: [33.4203, 47.8388],
      ks: [33.9902, 46.9658], mk: [31.9946, 46.9750], cn: [31.2977, 51.4982],
      rv: [26.2516, 50.6199], cv: [25.9403, 48.2916], km: [26.9878, 49.4226],
      te: [25.5948, 49.5534], uz: [22.3003, 48.6237], volyn: [24.3232, 50.7472],
      ck: [31.9795, 49.4444], kr: [32.2597, 48.5132], sm: [34.7981, 50.9077],
      pl: [34.5514, 49.5883], lg: [38.9228, 48.5740], ks_a: [33.9902, 46.9658],
    };
    const inc: Partial<Incident> = {
      timestamp: new Date().toISOString(),
      coordinates: coordMap[newIncident.region ?? "kiev"] ?? [31.5, 48.5],
      region: newIncident.region ?? "kiev",
      regionName: regionInfo?.name ?? "Київська",
      title: newIncident.title ?? "",
      type: newIncident.type as IncidentType,
      status: newIncident.status as IncidentStatus,
      severity: newIncident.severity as SeverityLevel,
      resources: newIncident.resources ?? { ses_units: 0, police_units: 0, medical_units: 0, personnel_total: 0 },
      impact: newIncident.impact ?? { rescued: 0, injured: 0, fatalities: 0, damage_est: "", damage_uah: 0 },
      estimated_resolution_time: new Date(Date.now() + 3 * 3600000).toISOString(),
      risk_level: newIncident.severity === "Critical" ? 8 : newIncident.severity === "Major" ? 5 : 3,
      description: newIncident.description ?? "",
      lead_agency: newIncident.lead_agency ?? "ДСНС",
    };

    if (editingIncident) {
      await updateIncident(editingIncident.id, inc);
      setEditingIncident(null);
    } else {
      await createIncident(inc);
    }

    setShowAddForm(false);
    setNewIncident({
      title: "", type: "Fire", severity: "Major", status: "Ongoing",
      region: "kiev", description: "", lead_agency: "ДСНС",
      resources: { ses_units: 0, police_units: 0, medical_units: 0, personnel_total: 0 },
      impact: { rescued: 0, injured: 0, fatalities: 0, damage_est: "", damage_uah: 0 },
    });
  };

  const handleEditIncident = (inc: Incident) => {
    setNewIncident({
      title: inc.title, type: inc.type, severity: inc.severity, status: inc.status,
      region: inc.region, description: inc.description, lead_agency: inc.lead_agency,
      resources: { ...inc.resources }, impact: { ...inc.impact },
    });
    setEditingIncident(inc);
    setShowAddForm(true);
  };

  const handleDeleteIncident = async (id: string) => {
    await deleteIncident(id);
    if (selectedIncident?.id === id) setSelectedIncident(null);
  };

  return (
    <div className="flex flex-col h-screen bg-[hsl(222,47%,6%)] text-[hsl(210,40%,95%)] overflow-hidden">

      {/* ═══ TOP NAV ═══ */}
      <header className="flex items-center justify-between px-4 md:px-6 py-2.5 border-b border-[hsl(215,20%,14%)] bg-[hsl(222,47%,8%)] shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Shield className="h-6 w-6 text-primary" />
            {globalStats.criticalCount > 0 && (
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 animate-ping" />
            )}
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wide leading-none" style={{ fontFamily: "Montserrat" }}>
              Єдиний ситуаційний центр
            </h1>
            <p className="text-[10px] text-[hsl(215,20%,55%)] leading-none mt-0.5">
              Національна платформа моніторингу надзвичайних ситуацій
            </p>
          </div>
        </div>

        {/* National 24h stats */}
        <div className="hidden lg:flex items-center gap-2">
          <StatChip icon="🔴" label="Активних" value={globalStats.totalActive} highlight />
          <StatChip icon="🆘" label="Врятовано" value={globalStats.totalRescued} color="text-green-400" />
          <StatChip icon="🚒" label="ДСНС" value={globalStats.totalSesUnits} color="text-orange-400" />
          <StatChip icon="🚓" label="Поліція" value={globalStats.totalPoliceUnits} color="text-blue-400" />
          <StatChip icon="🚑" label="Медики" value={globalStats.totalMedUnits} color="text-pink-400" />
          <StatChip icon="👥" label="Ос. склад" value={globalStats.totalPersonnel} color="text-purple-400" />
        </div>

        <div className="flex items-center gap-2">
          {/* Date filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm"
                className="h-7 gap-1.5 text-xs bg-[hsl(215,20%,12%)] border-[hsl(215,20%,20%)] text-[hsl(210,40%,85%)] hover:bg-[hsl(215,20%,16%)]">
                <CalendarIcon className="h-3 w-3" />
                {dateFilter ? format(dateFilter, "dd.MM", { locale: uk }) : "Весь час"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={dateFilter} onSelect={setDateFilter} className="p-3 pointer-events-auto" />
              {dateFilter && (
                <div className="p-2 border-t">
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setDateFilter(undefined)}>
                    Скинути фільтр
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          <Button size="sm"
            onClick={() => setShowAddForm(true)}
            className="h-7 gap-1.5 text-xs bg-[hsl(215,20%,16%)] border border-[hsl(215,20%,24%)] text-white hover:bg-[hsl(215,20%,22%)]">
            <Plus className="h-3 w-3" /> Додати
          </Button>

          <Button size="sm" onClick={handleGeneratePDF}
            className="h-7 gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90">
            <Download className="h-3 w-3" />
            <span className="hidden sm:inline">Зведений PDF</span>
          </Button>
        </div>
      </header>

      {/* ═══ MAIN LAYOUT ═══ */}
      <div ref={contentRef} className="flex flex-1 overflow-hidden">

        {/* LEFT PANEL — Incident List */}
        <div className="w-72 shrink-0 flex flex-col border-r border-[hsl(215,20%,14%)] bg-[hsl(222,47%,8%)]">
          {/* Filters */}
          <div className="px-3 py-2 border-b border-[hsl(215,20%,14%)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-[hsl(215,20%,60%)] uppercase tracking-wider">
                Інциденти ({filteredIncidents.length})
              </span>
              <Button variant="ghost" size="icon" className="h-5 w-5"
                onClick={() => setShowFilters(!showFilters)}>
                <Filter className="h-3 w-3" />
              </Button>
            </div>

            {showFilters && (
              <div className="space-y-1.5">
                <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
                  <SelectTrigger className="h-7 text-xs bg-[hsl(215,20%,12%)] border-[hsl(215,20%,20%)]">
                    <SelectValue placeholder="Статус" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Всі статуси</SelectItem>
                    <SelectItem value="Ongoing">Активний</SelectItem>
                    <SelectItem value="Containment">Контроль</SelectItem>
                    <SelectItem value="Resolved">Вирішено</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterSeverity} onValueChange={(v) => setFilterSeverity(v as FilterSeverity)}>
                  <SelectTrigger className="h-7 text-xs bg-[hsl(215,20%,12%)] border-[hsl(215,20%,20%)]">
                    <SelectValue placeholder="Рівень" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Всі рівні</SelectItem>
                    <SelectItem value="Critical">Критичний</SelectItem>
                    <SelectItem value="Major">Значний</SelectItem>
                    <SelectItem value="Minor">Незначний</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterService} onValueChange={(v) => setFilterService(v as FilterService)}>
                  <SelectTrigger className="h-7 text-xs bg-[hsl(215,20%,12%)] border-[hsl(215,20%,20%)]">
                    <SelectValue placeholder="Служба" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Всі служби</SelectItem>
                    <SelectItem value="ses">🚒 ДСНС</SelectItem>
                    <SelectItem value="police">🚓 Поліція</SelectItem>
                    <SelectItem value="medical">🚑 Медицина</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Incident list sorted by impact score */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1.5">
              {sortedBySeverity.map((inc) => {
                const sev = SEVERITY_CONFIG[inc.severity];
                const sta = STATUS_CONFIG[inc.status];
                const progress = getResolutionProgress(inc);
                return (
                  <div
                    key={inc.id}
                    onClick={() => { setSelectedIncident(inc); setSelectedRegion(inc.region); }}
                    className={cn(
                      "rounded-lg p-2.5 cursor-pointer border transition-all duration-150",
                      selectedIncident?.id === inc.id
                        ? "bg-[hsl(215,35%,18%)] border-primary/50"
                        : "bg-[hsl(215,20%,11%)] border-[hsl(215,20%,18%)] hover:border-[hsl(215,20%,30%)] hover:bg-[hsl(215,20%,14%)]"
                    )}
                  >
                    <div className="flex items-start gap-2 mb-1.5">
                      <span className="text-sm mt-0.5 shrink-0">{TYPE_ICONS[inc.type]}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold leading-tight text-white truncate">{inc.title}</p>
                        <p className="text-[10px] text-[hsl(215,20%,55%)]">{inc.regionName}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={cn("text-[9px] font-bold uppercase", sev.color)}>{sev.label}</span>
                        <span className={cn("text-[9px]", sta.color)}>{sta.label}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-[hsl(215,20%,50%)] mb-1.5">
                      <span>👥 {inc.resources.personnel_total}</span>
                      {inc.impact.rescued > 0 && <span className="text-green-400">🆘 {inc.impact.rescued}</span>}
                      {inc.impact.injured > 0 && <span className="text-yellow-400">⚠️ {inc.impact.injured}</span>}
                      <span className="ml-auto">{formatDistanceToNow(new Date(inc.timestamp), { locale: uk, addSuffix: true })}</span>
                    </div>
                    {inc.status !== "Resolved" && (
                      <Progress
                        value={progress}
                        className="h-1 bg-[hsl(215,20%,20%)]"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* CENTER — Map */}
        <div className="flex-1 relative flex flex-col overflow-hidden">
          {/* Resources at a glance bar */}
          <div className="flex gap-2 px-4 py-2 bg-[hsl(222,47%,7%)] border-b border-[hsl(215,20%,14%)] shrink-0">
            <ResourceGlance icon="🚒" label="Пожежні авто" value={globalStats.totalSesUnits} />
            <ResourceGlance icon="🚓" label="Патрульні" value={globalStats.totalPoliceUnits} />
            <ResourceGlance icon="🚑" label="Медики на місці" value={globalStats.totalMedUnits} />
            <div className="ml-auto flex items-center gap-2 text-xs text-[hsl(215,20%,55%)]">
              <Activity className="h-3 w-3 text-red-400 animate-pulse" />
              <span>Оновлено: {format(new Date(), "HH:mm:ss")}</span>
            </div>
          </div>

          {/* Map */}
          <div className="flex-1 p-4 flex items-center justify-center overflow-hidden">
            <div className="w-full max-w-4xl">
              <UkraineMap
                regions={regionData}
                incidents={filteredIncidents}
                selectedRegion={selectedRegion ?? ""}
                onSelectRegion={(id) => {
                  setSelectedRegion(id);
                  setSelectedIncident(null);
                }}
                onSelectIncident={(inc) => {
                  setSelectedIncident(inc);
                  setSelectedRegion(inc.region);
                }}
              />
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-[10px] text-[hsl(215,20%,50%)] px-4 pb-2 shrink-0 flex-wrap">
            <span className="font-semibold text-[hsl(215,20%,60%)]">Хітмап:</span>
            <LegendItem color="hsl(215,20%,16%)" label="Без подій" />
            <LegendItem color="hsl(0,55%,22%)" label="Критичний регіон" />
            <LegendItem color="hsl(20,60%,24%)" label="≥4 події" />
            <Separator orientation="vertical" className="h-3 bg-[hsl(215,20%,20%)]" />
            <span className="font-semibold text-[hsl(215,20%,60%)]">Маркери:</span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse inline-block" />Активний
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-yellow-500 inline-block" />Контроль
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />Вирішено
            </span>
          </div>
        </div>

        {/* RIGHT SIDEBAR — Region/Incident Detail */}
        <div className={cn(
          "border-l border-[hsl(215,20%,14%)] bg-[hsl(222,47%,8%)] transition-all duration-300 flex flex-col overflow-hidden shrink-0",
          (selectedRegion || selectedIncident) ? "w-80" : "w-0"
        )}>
          {selectedIncident ? (
            <IncidentDetail
              incident={selectedIncident}
              progress={getResolutionProgress(selectedIncident)}
              onClose={() => setSelectedIncident(null)}
              onEdit={handleEditIncident}
              onDelete={handleDeleteIncident}
              canEdit={user?.id === (selectedIncident as any).id ? false : true}
            />
          ) : selectedRegion ? (
            <RegionPanel
              regionName={REGION_NAME_MAP[selectedRegion] ?? selectedRegion}
              incidents={selectedRegionIncidents}
              onClose={() => setSelectedRegion(null)}
              onSelectIncident={setSelectedIncident}
              getProgress={getResolutionProgress}
            />
          ) : null}
        </div>
      </div>

      {/* ═══ ADD INCIDENT DIALOG ═══ */}
      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="max-w-lg bg-[hsl(222,47%,10%)] border-[hsl(215,20%,22%)] text-[hsl(210,40%,95%)]">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Montserrat" }}>{editingIncident ? "Редагувати інцидент" : "Новий інцидент"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Назва *</label>
                <Input
                  value={newIncident.title ?? ""}
                  onChange={(e) => setNewIncident((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Назва інциденту..."
                  className="bg-[hsl(215,20%,12%)] border-[hsl(215,20%,22%)] text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Тип</label>
                <Select value={newIncident.type} onValueChange={(v) => setNewIncident((p) => ({ ...p, type: v as IncidentType }))}>
                  <SelectTrigger className="bg-[hsl(215,20%,12%)] border-[hsl(215,20%,22%)] text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(INCIDENT_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{TYPE_ICONS[k as IncidentType]} {v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Регіон</label>
                <Select value={newIncident.region} onValueChange={(v) => setNewIncident((p) => ({ ...p, region: v }))}>
                  <SelectTrigger className="bg-[hsl(215,20%,12%)] border-[hsl(215,20%,22%)] text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    {REGIONS_LIST.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Рівень</label>
                <Select value={newIncident.severity} onValueChange={(v) => setNewIncident((p) => ({ ...p, severity: v as SeverityLevel }))}>
                  <SelectTrigger className="bg-[hsl(215,20%,12%)] border-[hsl(215,20%,22%)] text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Critical">🔴 Критичний</SelectItem>
                    <SelectItem value="Major">🟡 Значний</SelectItem>
                    <SelectItem value="Minor">🟢 Незначний</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Провідна служба</label>
                <Select value={newIncident.lead_agency} onValueChange={(v) => setNewIncident((p) => ({ ...p, lead_agency: v }))}>
                  <SelectTrigger className="bg-[hsl(215,20%,12%)] border-[hsl(215,20%,22%)] text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ДСНС">🚒 ДСНС</SelectItem>
                    <SelectItem value="Поліція">🚓 Поліція</SelectItem>
                    <SelectItem value="Медицина">🚑 Медицина</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Ресурси</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "🚒 ДСНС", field: "ses_units" },
                  { label: "🚓 Поліція", field: "police_units" },
                  { label: "🚑 Медики", field: "medical_units" },
                ].map(({ label, field }) => (
                  <div key={field}>
                    <label className="text-[10px] text-muted-foreground">{label}</label>
                    <Input
                      type="number" min={0}
                      value={(newIncident.resources as any)?.[field] ?? 0}
                      onChange={(e) => setNewIncident((p) => ({
                        ...p,
                        resources: {
                          ...(p.resources ?? { ses_units: 0, police_units: 0, medical_units: 0, personnel_total: 0 }),
                          [field]: Number(e.target.value),
                          personnel_total: (
                            (field === "ses_units" ? Number(e.target.value) : (p.resources?.ses_units ?? 0)) +
                            (field === "police_units" ? Number(e.target.value) : (p.resources?.police_units ?? 0)) +
                            (field === "medical_units" ? Number(e.target.value) : (p.resources?.medical_units ?? 0))
                          ) * 5,
                        },
                      }))}
                      className="bg-[hsl(215,20%,12%)] border-[hsl(215,20%,22%)] text-sm mt-0.5"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button onClick={handleAddIncident} className="flex-1" disabled={!newIncident.title}>
              {editingIncident ? "Зберегти зміни" : "Додати інцидент"}
            </Button>
            <Button variant="outline" onClick={() => { setShowAddForm(false); setEditingIncident(null); }} className="border-[hsl(215,20%,22%)]">
              Скасувати
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ═══ SUB-COMPONENTS ═══

const StatChip = ({ icon, label, value, color, highlight }: {
  icon: string; label: string; value: number; color?: string; highlight?: boolean
}) => (
  <div className={cn(
    "flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs",
    highlight
      ? "bg-red-500/10 border-red-500/30 text-red-400"
      : "bg-[hsl(215,20%,12%)] border-[hsl(215,20%,20%)]"
  )}>
    <span>{icon}</span>
    <span className="text-[hsl(215,20%,55%)] hidden xl:inline">{label}:</span>
    <span className={cn("font-bold", color ?? "text-white")}>{value}</span>
  </div>
);

const ResourceGlance = ({ icon, label, value }: { icon: string; label: string; value: number }) => (
  <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-[hsl(215,20%,11%)] border border-[hsl(215,20%,18%)]">
    <span className="text-base">{icon}</span>
    <div>
      <p className="text-sm font-bold text-white leading-none">{value}</p>
      <p className="text-[9px] text-[hsl(215,20%,50%)]">{label}</p>
    </div>
  </div>
);

const LegendItem = ({ color, label }: { color: string; label: string }) => (
  <span className="flex items-center gap-1">
    <span className="h-2.5 w-2.5 rounded-sm inline-block" style={{ background: color }} />
    {label}
  </span>
);

const IncidentDetail = ({ incident, progress, onClose, onEdit, onDelete }: {
  incident: Incident; progress: number; onClose: () => void;
  onEdit?: (inc: Incident) => void; onDelete?: (id: string) => Promise<void>; canEdit?: boolean;
}) => {
  const sev = SEVERITY_CONFIG[incident.severity];
  const sta = STATUS_CONFIG[incident.status];

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(215,20%,14%)]">
        <div className="flex items-center gap-2">
          <span className="text-xl">{TYPE_ICONS[incident.type]}</span>
          <div>
            <h2 className="font-bold text-xs leading-tight" style={{ fontFamily: "Montserrat" }}>
              {INCIDENT_TYPE_LABELS[incident.type]}
            </h2>
            <p className="text-[10px] text-muted-foreground">{incident.regionName}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onEdit && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(incident)}>
              <Edit className="h-3.5 w-3.5" />
            </Button>
          )}
          {onDelete && (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-300" onClick={() => onDelete(incident.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div>
            <h3 className="font-bold text-sm leading-tight mb-2">{incident.title}</h3>
            <div className="flex gap-2 flex-wrap">
              <Badge className={cn("text-[10px] h-5 border", sev.bgColor, sev.color)}>
                {sev.label}
              </Badge>
              <Badge variant="outline" className={cn("text-[10px] h-5", sta.color)}>
                {sta.label}
              </Badge>
              <Badge variant="outline" className="text-[10px] h-5 border-[hsl(215,20%,25%)]">
                {incident.lead_agency}
              </Badge>
            </div>
          </div>

          {/* Executive Summary */}
          <Card className="bg-[hsl(215,20%,10%)] border-[hsl(215,20%,18%)]">
            <CardContent className="p-3">
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Зведення міністра
              </p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xl font-bold text-green-400">{incident.impact.rescued}</p>
                  <p className="text-[9px] text-muted-foreground">👥 Врятовано</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-yellow-400">{incident.impact.injured}</p>
                  <p className="text-[9px] text-muted-foreground">⚠️ Постраждало</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-red-400">{incident.impact.fatalities}</p>
                  <p className="text-[9px] text-muted-foreground">💔 Загинуло</p>
                </div>
              </div>
              <Separator className="my-2 bg-[hsl(215,20%,20%)]" />
              <div className="grid grid-cols-2 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-primary">{incident.resources.personnel_total}</p>
                  <p className="text-[9px] text-muted-foreground">🚜 Ос. склад</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-blue-400">
                    {incident.resources.ses_units + incident.resources.police_units + incident.resources.medical_units}
                  </p>
                  <p className="text-[9px] text-muted-foreground">🔢 Одиниць техніки</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resources breakdown */}
          <div className="space-y-1.5">
            <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Ресурси служб</p>
            {incident.resources.ses_units > 0 && (
              <ResourceRow icon="🚒" label="ДСНС" value={incident.resources.ses_units} color="text-orange-400" />
            )}
            {incident.resources.police_units > 0 && (
              <ResourceRow icon="🚓" label="Поліція" value={incident.resources.police_units} color="text-blue-400" />
            )}
            {incident.resources.medical_units > 0 && (
              <ResourceRow icon="🚑" label="Медицина" value={incident.resources.medical_units} color="text-pink-400" />
            )}
          </div>

          {/* Progress / ETA */}
          {incident.status !== "Resolved" && (
            <div>
              <div className="flex justify-between text-[9px] text-muted-foreground mb-1">
                <span>Прогрес ліквідації</span>
                <span>ETA: {format(new Date(incident.estimated_resolution_time), "HH:mm dd.MM")}</span>
              </div>
              <Progress value={progress} className="h-1.5 bg-[hsl(215,20%,18%)]" />
              <p className="text-[9px] text-muted-foreground mt-0.5">{Math.round(progress)}%</p>
            </div>
          )}

          {/* Financial impact */}
          {incident.impact.damage_uah > 0 && (
            <div className="bg-[hsl(215,20%,10%)] rounded-lg p-3 border border-[hsl(215,20%,18%)]">
              <p className="text-[9px] font-semibold text-muted-foreground uppercase mb-1">💰 Оцінка збитків</p>
              <p className="text-sm font-bold text-yellow-400">
                {incident.impact.damage_uah.toLocaleString()} грн
              </p>
              <p className="text-[10px] text-muted-foreground">{incident.impact.damage_est}</p>
            </div>
          )}

          {/* Description */}
          {incident.description && (
            <div>
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Опис ситуації</p>
              <p className="text-xs text-[hsl(215,20%,70%)] leading-relaxed">{incident.description}</p>
            </div>
          )}

          {/* Risk level */}
          <div>
            <div className="flex justify-between text-[9px] text-muted-foreground mb-1">
              <span>Рівень ризику</span>
              <span className={cn(
                incident.risk_level >= 8 ? "text-red-400" :
                incident.risk_level >= 5 ? "text-yellow-400" : "text-green-400"
              )}>{incident.risk_level}/10</span>
            </div>
            <Progress
              value={incident.risk_level * 10}
              className="h-1.5 bg-[hsl(215,20%,18%)]"
            />
          </div>

          <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(incident.timestamp), { locale: uk, addSuffix: true })}
            <MapPin className="h-3 w-3 ml-2" />
            {incident.coordinates[1].toFixed(4)}°N {incident.coordinates[0].toFixed(4)}°E
          </div>
        </div>
      </ScrollArea>
    </>
  );
};

const ResourceRow = ({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) => (
  <div className="flex items-center gap-2 px-2.5 py-1.5 bg-[hsl(215,20%,12%)] rounded-md border border-[hsl(215,20%,18%)]">
    <span>{icon}</span>
    <span className="text-xs flex-1">{label}</span>
    <span className={cn("text-xs font-bold", color)}>{value} од.</span>
  </div>
);

const RegionPanel = ({ regionName, incidents, onClose, onSelectIncident, getProgress }: {
  regionName: string;
  incidents: Incident[];
  onClose: () => void;
  onSelectIncident: (inc: Incident) => void;
  getProgress: (inc: Incident) => number;
}) => (
  <>
    <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(215,20%,14%)]">
      <div>
        <h2 className="font-bold text-sm" style={{ fontFamily: "Montserrat" }}>{regionName}</h2>
        <p className="text-[10px] text-muted-foreground">{incidents.length} подій</p>
      </div>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
    <ScrollArea className="flex-1">
      {incidents.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">Немає подій в цьому регіоні</p>
      ) : (
        <div className="p-3 space-y-2">
          {incidents.map((inc) => {
            const sev = SEVERITY_CONFIG[inc.severity];
            return (
              <Card key={inc.id}
                onClick={() => onSelectIncident(inc)}
                className="bg-[hsl(215,20%,11%)] border-[hsl(215,20%,18%)] cursor-pointer hover:border-[hsl(215,20%,30%)] transition-colors"
              >
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <span>{TYPE_ICONS[inc.type]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold leading-tight truncate">{inc.title}</p>
                      <p className="text-[10px] text-muted-foreground">{inc.lead_agency}</p>
                    </div>
                    <span className={cn("text-[9px] font-bold", sev.color)}>{sev.label}</span>
                  </div>
                  <div className="flex gap-2 text-[10px] text-muted-foreground">
                    {inc.resources.ses_units > 0 && <span>🚒 {inc.resources.ses_units}</span>}
                    {inc.resources.police_units > 0 && <span>🚓 {inc.resources.police_units}</span>}
                    {inc.resources.medical_units > 0 && <span>🚑 {inc.resources.medical_units}</span>}
                    <span className="ml-auto">👥 {inc.resources.personnel_total}</span>
                  </div>
                  {inc.impact.rescued > 0 && (
                    <p className="text-[10px] text-green-400">🆘 Врятовано: {inc.impact.rescued}</p>
                  )}
                  {inc.status !== "Resolved" && (
                    <Progress value={getProgress(inc)} className="h-1 bg-[hsl(215,20%,20%)]" />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </ScrollArea>
  </>
);

export default SituationCenterPage;
