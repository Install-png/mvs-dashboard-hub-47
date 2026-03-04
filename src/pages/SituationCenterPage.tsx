import { useState, useMemo, useRef, useEffect, useCallback, memo } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import UkraineMap, { REGION_NAME_MAP } from "@/components/UkraineMap";
import type { RegionData } from "@/components/UkraineMap";
import {
  INCIDENT_TYPE_LABELS, SEVERITY_CONFIG, STATUS_CONFIG, TYPE_ICONS,
  CATEGORY_LABELS, VALID_CATEGORIES,
  type Incident, type IncidentType, type SeverityLevel, type IncidentStatus, type IncidentCategory,
} from "@/data/mockIncidents";

const DEFAULT_SEV = { label: "Невідомо", color: "text-muted-foreground", bgColor: "bg-muted border-border" };
const DEFAULT_STA = { label: "Невідомо", color: "text-muted-foreground" };
import { useIncidents } from "@/hooks/useIncidents";
import { useAuth } from "@/hooks/useAuth";
import { useIncidentStore } from "@/stores/useIncidentStore";
import type { FilterService, FilterSeverity, FilterStatus } from "@/stores/useIncidentStore";
import {
  CalendarIcon, X, FileText, MapPin, Clock, Users, Flame,
  ShieldCheck, AlertTriangle, Download, Plus, Filter, Search,
  Ambulance, Shield, TrendingUp, Activity, BarChart2, Trash2, Edit, History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function safeDate(v: any): Date {
  if (!v) return new Date();
  const d = new Date(v);
  return isNaN(d.getTime()) ? new Date() : d;
}

const REGION_IDS = Object.keys(REGION_NAME_MAP);
const REGIONS_LIST = REGION_IDS.map((id) => ({ id, name: REGION_NAME_MAP[id] }));

// ═══ LIVE UTC+2 CLOCK ═══
const LiveClock = memo(() => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const utc2 = new Date(time.getTime() + (2 * 60 - time.getTimezoneOffset()) * 60000);
  return (
    <div className="flex items-center gap-1.5 text-xs font-mono">
      <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
      <span className="text-green-400">{format(utc2, "HH:mm:ss")}</span>
      <span className="text-[hsl(215,20%,45%)]">UTC+2</span>
    </div>
  );
});
LiveClock.displayName = "LiveClock";

const SituationCenterPage = () => {
  const { createIncident, updateIncident, deleteIncident, getAuditLog } = useIncidents();
  const { user } = useAuth();

  // Store
  const {
    incidents, loading: incidentsLoading,
    filterService, filterSeverity, filterStatus, dateFilter, searchQuery,
    selectedRegion, selectedIncident, hoveredIncidentId, highlightedIncidentId,
    setFilterService, setFilterSeverity, setFilterStatus, setDateFilter, setSearchQuery,
    setSelectedRegion, setSelectedIncident, setHoveredIncidentId, selectIncidentById,
  } = useIncidentStore();

  // Local UI state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const listRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Auto-scroll sidebar when incident selected from map
  useEffect(() => {
    if (selectedIncident && listRefs.current[selectedIncident.id]) {
      listRefs.current[selectedIncident.id]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedIncident?.id]);

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
        const incDate = format(safeDate(inc.timestamp), "yyyy-MM-dd");
        if (incDate !== d) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          inc.id.toLowerCase().includes(q) ||
          inc.title.toLowerCase().includes(q) ||
          inc.regionName.toLowerCase().includes(q) ||
          inc.address.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [incidents, filterService, filterSeverity, filterStatus, dateFilter, searchQuery]);

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

  // Region stats panel
  const regionStats = useMemo(() => {
    if (!selectedRegion) return null;
    const regionIncs = filteredIncidents.filter((inc) => inc.region === selectedRegion);
    return {
      total: regionIncs.length,
      active: regionIncs.filter((i) => i.status !== "Resolved").length,
      personnel: regionIncs.reduce((s, i) => s + i.resources.personnel_total, 0),
      sesUnits: regionIncs.reduce((s, i) => s + i.resources.ses_units, 0),
      policeUnits: regionIncs.reduce((s, i) => s + i.resources.police_units, 0),
      medicalUnits: regionIncs.reduce((s, i) => s + i.resources.medical_units, 0),
      rescued: regionIncs.reduce((s, i) => s + i.impact.rescued, 0),
      injured: regionIncs.reduce((s, i) => s + i.impact.injured, 0),
      incidents: regionIncs,
    };
  }, [selectedRegion, filteredIncidents]);

  // Global stats (last 24h)
  const globalStats = useMemo(() => {
    const cutoff = Date.now() - 24 * 3600000;
    const recent = incidents.filter((inc) => new Date(inc.timestamp).getTime() > cutoff);
    return {
      totalActive: incidents.filter((i) => i.status !== "Resolved").length,
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

  const sortedBySeverity = useMemo(() => {
    return [...filteredIncidents].sort((a, b) => {
      const scoreA = a.risk_level * (a.impact.rescued + a.impact.injured + 1);
      const scoreB = b.risk_level * (b.impact.rescued + b.impact.injured + 1);
      return scoreB - scoreA;
    });
  }, [filteredIncidents]);

  const getResolutionProgress = (inc: Incident) => {
    if (inc.status === "Resolved") return 100;
    const start = safeDate(inc.timestamp).getTime();
    const end = safeDate(inc.estimated_resolution_time).getTime();
    const now = Date.now();
    if (end <= start) return 50;
    return Math.min(95, Math.max(5, ((now - start) / (end - start)) * 100));
  };

  // Search handler
  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    // If search matches exactly one incident ID, auto-focus
    if (q.length > 3) {
      const match = incidents.find((i) => i.id.toLowerCase() === q.toLowerCase());
      if (match) {
        selectIncidentById(match.id);
      }
    }
  }, [incidents, selectIncidentById, setSearchQuery]);

  // PDF — context-aware (filtered state only)
  const handleGeneratePDF = useCallback(() => {
    const pdf = new jsPDF("l", "mm", "a4");
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
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

    // Context line
    const filters: string[] = [];
    if (filterStatus !== "all") filters.push(`Статус: ${STATUS_CONFIG[filterStatus]?.label ?? filterStatus}`);
    if (filterSeverity !== "all") filters.push(`Рівень: ${SEVERITY_CONFIG[filterSeverity]?.label ?? filterSeverity}`);
    if (selectedRegion) filters.push(`Регіон: ${REGION_NAME_MAP[selectedRegion] ?? selectedRegion}`);
    if (dateFilter) filters.push(`Дата: ${format(dateFilter, "dd.MM.yyyy")}`);
    const filterLine = filters.length > 0 ? `Фільтри: ${filters.join(", ")}` : "Без фільтрів (усі дані)";
    
    pdf.text(`Ситуаційний центр | ${today} | ${format(new Date(), "HH:mm")}`, pageW / 2, 20, { align: "center" });
    pdf.text(filterLine, pageW / 2, 26, { align: "center" });

    // Executive Summary
    const data = sortedBySeverity;
    const totalRescued = data.reduce((s, i) => s + i.impact.rescued, 0);
    const totalInjured = data.reduce((s, i) => s + i.impact.injured, 0);
    const totalFatalities = data.reduce((s, i) => s + i.impact.fatalities, 0);
    const totalPersonnel = data.reduce((s, i) => s + i.resources.personnel_total, 0);
    const totalDamage = data.reduce((s, i) => s + i.impact.damage_uah, 0);

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text("I. ЗВЕДЕНА СТАТИСТИКА", 14, 40);

    autoTable(pdf, {
      startY: 44,
      head: [["Показник", "Значення", "Показник", "Значення"]],
      body: [
        ["Інцидентів у вибірці", String(data.length), "Критичних", String(data.filter(i => i.severity === "Critical").length)],
        ["Врятовано осіб", String(totalRescued), "Постраждало", String(totalInjured)],
        ["Загиблих", String(totalFatalities), "Особового складу", String(totalPersonnel)],
        ["Збитки (грн)", totalDamage.toLocaleString("uk-UA"), "Активних подій", String(data.filter(i => i.status !== "Resolved").length)],
      ],
      theme: "grid",
      headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 55 }, 1: { cellWidth: 30 }, 2: { fontStyle: "bold", cellWidth: 55 }, 3: { cellWidth: 30 } },
    });

    // Incidents table with auto-pagination
    let startY = (pdf as any).lastAutoTable.finalY + 10;
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text("II. РЕЄСТР ІНЦИДЕНТІВ", 14, startY);

    const rows = data.map((inc) => [
      format(safeDate(inc.timestamp), "HH:mm dd.MM"),
      inc.regionName,
      INCIDENT_TYPE_LABELS[inc.type],
      inc.title.substring(0, 35),
      String(inc.resources.personnel_total),
      `${inc.impact.rescued}/${inc.impact.injured}/${inc.impact.fatalities}`,
      (STATUS_CONFIG[inc.status] || DEFAULT_STA).label,
      (SEVERITY_CONFIG[inc.severity] || DEFAULT_SEV).label,
    ]);

    autoTable(pdf, {
      startY: startY + 4,
      head: [["Час", "Локація", "Тип", "Назва", "Ос.скл.", "Р/П/З", "Статус", "Рівень"]],
      body: rows,
      theme: "striped",
      headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 22 }, 1: { cellWidth: 28 }, 2: { cellWidth: 20 }, 3: { cellWidth: 60 },
        4: { cellWidth: 16 }, 5: { cellWidth: 18 }, 6: { cellWidth: 20 }, 7: { cellWidth: 20 },
      },
      willDrawCell: (d: any) => {
        if (d.column.index === 7 && d.section === "body") {
          const v = d.cell.text[0];
          if (v === "Критичний") { d.cell.styles.textColor = [220, 38, 38]; d.cell.styles.fontStyle = "bold"; }
        }
      },
      // Auto-pagination is handled by jspdf-autotable automatically
    });

    // Critical incidents highlight (new page if needed)
    const criticals = data.filter((i) => i.severity === "Critical").slice(0, 5);
    if (criticals.length > 0) {
      const critY = (pdf as any).lastAutoTable.finalY + 10;
      if (critY > pageH - 50) pdf.addPage();
      const y0 = critY > pageH - 50 ? 20 : critY;

      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(0, 0, 0);
      pdf.text("III. ПРІОРИТЕТНІ ПОДІЇ", 14, y0);

      criticals.forEach((inc, idx) => {
        const y = y0 + 8 + idx * 28;
        if (y > pageH - 20) { pdf.addPage(); return; }
        pdf.setFillColor(254, 242, 242);
        pdf.roundedRect(14, y, pageW - 28, 24, 2, 2, "F");
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(153, 27, 27);
        pdf.text(`${idx + 1}. ${inc.title}`, 18, y + 7);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(0, 0, 0);
        pdf.text(`${inc.regionName} | ${inc.resources.personnel_total} ос. | Врят: ${inc.impact.rescued} | Збитки: ${inc.impact.damage_uah.toLocaleString()} грн`, 18, y + 14);
        pdf.text(inc.description.substring(0, 120), 18, y + 21);
      });
    }

    pdf.save(`operational-brief-${format(new Date(), "yyyy-MM-dd-HHmm")}.pdf`);
  }, [sortedBySeverity, filterStatus, filterSeverity, selectedRegion, dateFilter]);

  // Add incident form state
  const [newIncident, setNewIncident] = useState<Partial<Incident>>({
    title: "", type: "Fire", severity: "Major", status: "Ongoing", category: "SES",
    region: "kiev", description: "", lead_agency: "ДСНС", address: "",
    resources: { ses_units: 0, police_units: 0, medical_units: 0, personnel_total: 0, specialized_equipment: [] },
    impact: { rescued: 0, injured: 0, fatalities: 0, damage_est: "", damage_uah: 0 },
  });

  const coordMap: Record<string, [number, number]> = {
    kiev: [30.5234, 50.4501], lviv: [23.9936, 49.8397], kh: [36.2304, 49.9935],
    dp: [34.9981, 48.4647], od: [30.7233, 46.4775], "if": [24.7111, 48.9226],
    vn: [28.4752, 49.2328], dn: [38.0027, 47.0954], zp: [33.4203, 47.8388],
    ks: [33.9902, 46.9658], mk: [31.9946, 46.975], cn: [31.2977, 51.4982],
    rv: [26.2516, 50.6199], cv: [25.9403, 48.2916], km: [26.9878, 49.4226],
    te: [25.5948, 49.5534], uz: [22.3003, 48.6237], volyn: [24.3232, 50.7472],
    ck: [31.9795, 49.4444], kr: [32.2597, 48.5132], sm: [34.7981, 50.9077],
    pl: [34.5514, 49.5883], lg: [38.9228, 48.574], crimea: [34.1, 44.95],
  };

  const handleAddIncident = async () => {
    if (!newIncident.title) return;
    const regionInfo = REGIONS_LIST.find((r) => r.id === newIncident.region);
    const inc: Partial<Incident> = {
      timestamp: new Date().toISOString(),
      coordinates: coordMap[newIncident.region ?? "kiev"] ?? [31.5, 48.5],
      region: newIncident.region ?? "kiev",
      regionName: regionInfo?.name ?? "Київська",
      address: newIncident.address ?? "",
      title: newIncident.title ?? "",
      type: newIncident.type as IncidentType,
      category: newIncident.category as IncidentCategory,
      status: newIncident.status as IncidentStatus,
      severity: newIncident.severity as SeverityLevel,
      resources: newIncident.resources ?? { ses_units: 0, police_units: 0, medical_units: 0, personnel_total: 0, specialized_equipment: [] },
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
    resetForm();
  };

  const resetForm = () => {
    setNewIncident({
      title: "", type: "Fire", severity: "Major", status: "Ongoing", category: "SES",
      region: "kiev", description: "", lead_agency: "ДСНС", address: "",
      resources: { ses_units: 0, police_units: 0, medical_units: 0, personnel_total: 0, specialized_equipment: [] },
      impact: { rescued: 0, injured: 0, fatalities: 0, damage_est: "", damage_uah: 0 },
    });
  };

  const handleEditIncident = (inc: Incident) => {
    setNewIncident({
      title: inc.title, type: inc.type, severity: inc.severity, status: inc.status,
      category: inc.category, region: inc.region, description: inc.description,
      lead_agency: inc.lead_agency, address: inc.address,
      resources: { ...inc.resources }, impact: { ...inc.impact },
    });
    setEditingIncident(inc);
    setShowAddForm(true);
  };

  const handleDeleteIncident = async (id: string) => {
    await deleteIncident(id);
    if (selectedIncident?.id === id) setSelectedIncident(null);
  };

  const handleViewAudit = async (incidentId: string) => {
    const log = await getAuditLog(incidentId);
    setAuditLog(log);
    setShowAudit(true);
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
              Національна платформа моніторингу
            </p>
          </div>
          <LiveClock />
        </div>

        {/* National 24h stats */}
        <div className="hidden lg:flex items-center gap-2">
          <StatChip icon="🔴" label="Активних" value={globalStats.totalActive} highlight />
          <StatChip icon="🆘" label="Врятовано" value={globalStats.totalRescued} color="text-green-400" />
          <StatChip icon="🚒" label="ДСНС" value={globalStats.totalSesUnits} color="text-orange-400" />
          <StatChip icon="🚓" label="Поліція" value={globalStats.totalPoliceUnits} color="text-blue-400" />
          <StatChip icon="🚑" label="Медики" value={globalStats.totalMedUnits} color="text-pink-400" />
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[hsl(215,20%,45%)]" />
            <Input
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="ID або назва..."
              className="h-7 w-40 pl-7 text-xs bg-[hsl(215,20%,12%)] border-[hsl(215,20%,20%)] text-[hsl(210,40%,85%)]"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-1.5 top-1/2 -translate-y-1/2">
                <X className="h-3 w-3 text-[hsl(215,20%,45%)]" />
              </button>
            )}
          </div>

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

          <Button size="sm" onClick={() => setShowAddForm(true)}
            className="h-7 gap-1.5 text-xs bg-[hsl(215,20%,16%)] border border-[hsl(215,20%,24%)] text-white hover:bg-[hsl(215,20%,22%)]">
            <Plus className="h-3 w-3" /> Додати
          </Button>

          <Button size="sm" onClick={handleGeneratePDF}
            className="h-7 gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90">
            <Download className="h-3 w-3" />
            <span className="hidden sm:inline">PDF</span>
          </Button>
        </div>
      </header>

      {/* ═══ MAIN LAYOUT ═══ */}
      <div ref={contentRef} className="flex flex-1 overflow-hidden">

        {/* LEFT PANEL — Incident List */}
        <div className="w-72 shrink-0 flex flex-col border-r border-[hsl(215,20%,14%)] bg-[hsl(222,47%,8%)]">
          <div className="px-3 py-2 border-b border-[hsl(215,20%,14%)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-[hsl(215,20%,60%)] uppercase tracking-wider">
                Інциденти ({filteredIncidents.length})
              </span>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setShowFilters(!showFilters)}>
                <Filter className="h-3 w-3" />
              </Button>
            </div>

            {showFilters && (
              <div className="space-y-1.5">
                <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
                  <SelectTrigger className="h-7 text-xs bg-[hsl(215,20%,12%)] border-[hsl(215,20%,20%)]"><SelectValue placeholder="Статус" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Всі статуси</SelectItem>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterSeverity} onValueChange={(v) => setFilterSeverity(v as FilterSeverity)}>
                  <SelectTrigger className="h-7 text-xs bg-[hsl(215,20%,12%)] border-[hsl(215,20%,20%)]"><SelectValue placeholder="Рівень" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Всі рівні</SelectItem>
                    {Object.entries(SEVERITY_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterService} onValueChange={(v) => setFilterService(v as FilterService)}>
                  <SelectTrigger className="h-7 text-xs bg-[hsl(215,20%,12%)] border-[hsl(215,20%,20%)]"><SelectValue placeholder="Служба" /></SelectTrigger>
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

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1.5">
              {sortedBySeverity.map((inc) => {
                const sev = SEVERITY_CONFIG[inc.severity] || DEFAULT_SEV;
                const sta = STATUS_CONFIG[inc.status] || DEFAULT_STA;
                const progress = getResolutionProgress(inc);
                const isHovered = hoveredIncidentId === inc.id;
                const isHighlighted = highlightedIncidentId === inc.id;
                return (
                  <div
                    key={inc.id}
                    ref={(el) => { listRefs.current[inc.id] = el; }}
                    onClick={() => { setSelectedIncident(inc); setSelectedRegion(inc.region); }}
                    onMouseEnter={() => setHoveredIncidentId(inc.id)}
                    onMouseLeave={() => setHoveredIncidentId(null)}
                    className={cn(
                      "rounded-lg p-2.5 cursor-pointer border transition-all duration-150",
                      selectedIncident?.id === inc.id
                        ? "bg-[hsl(215,35%,18%)] border-primary/50"
                        : isHighlighted
                        ? "bg-[hsl(215,35%,20%)] border-primary/70 ring-1 ring-primary/40"
                        : isHovered
                        ? "bg-[hsl(215,20%,15%)] border-[hsl(215,20%,30%)]"
                        : "bg-[hsl(215,20%,11%)] border-[hsl(215,20%,18%)] hover:border-[hsl(215,20%,30%)]"
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
                      <span className="ml-auto">{formatDistanceToNow(safeDate(inc.timestamp), { locale: uk, addSuffix: true })}</span>
                    </div>
                    {inc.status !== "Resolved" && <Progress value={progress} className="h-1 bg-[hsl(215,20%,20%)]" />}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* CENTER — Map */}
        <div className="flex-1 relative flex flex-col overflow-hidden">
          <div className="flex gap-2 px-4 py-2 bg-[hsl(222,47%,7%)] border-b border-[hsl(215,20%,14%)] shrink-0">
            <ResourceGlance icon="🚒" label="Пожежні авто" value={globalStats.totalSesUnits} />
            <ResourceGlance icon="🚓" label="Патрульні" value={globalStats.totalPoliceUnits} />
            <ResourceGlance icon="🚑" label="Медики на місці" value={globalStats.totalMedUnits} />
            <div className="ml-auto flex items-center gap-2 text-xs text-[hsl(215,20%,55%)]">
              <Activity className="h-3 w-3 text-red-400 animate-pulse" />
              <span>LIVE</span>
            </div>
          </div>

          <div className="flex-1 p-4 flex items-center justify-center overflow-hidden">
            <div className="w-full max-w-4xl">
              <UkraineMap
                regions={regionData}
                incidents={filteredIncidents}
                selectedRegion={selectedRegion ?? ""}
                onSelectRegion={(id) => { setSelectedRegion(id); setSelectedIncident(null); }}
                onSelectIncident={(inc) => { setSelectedIncident(inc); setSelectedRegion(inc.region); }}
                hoveredIncidentId={hoveredIncidentId}
                highlightedIncidentId={highlightedIncidentId}
              />
            </div>
          </div>

          <div className="flex items-center gap-4 text-[10px] text-[hsl(215,20%,50%)] px-4 pb-2 shrink-0 flex-wrap">
            <span className="font-semibold text-[hsl(215,20%,60%)]">Хітмап:</span>
            <LegendItem color="hsl(215,20%,16%)" label="Без подій" />
            <LegendItem color="hsl(0,55%,22%)" label="Критичний" />
            <Separator orientation="vertical" className="h-3 bg-[hsl(215,20%,20%)]" />
            <span className="font-semibold text-[hsl(215,20%,60%)]">Маркери:</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 animate-pulse inline-block" />Активний</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-500 inline-block" />Контроль</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500 inline-block" />Вирішено</span>
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
              onViewAudit={handleViewAudit}
              canEdit
            />
          ) : selectedRegion && regionStats ? (
            <RegionPanel
              regionName={REGION_NAME_MAP[selectedRegion] ?? selectedRegion}
              regionStats={regionStats}
              onClose={() => setSelectedRegion(null)}
              onSelectIncident={setSelectedIncident}
              getProgress={getResolutionProgress}
            />
          ) : null}
        </div>
      </div>

      {/* ═══ ADD INCIDENT DIALOG ═══ */}
      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="max-w-lg bg-[hsl(222,47%,10%)] border-[hsl(215,20%,22%)] text-[hsl(210,40%,95%)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Montserrat" }}>{editingIncident ? "Редагувати інцидент" : "Новий інцидент"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Назва *</label>
                <Input value={newIncident.title ?? ""} onChange={(e) => setNewIncident((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Назва інциденту..." className="bg-[hsl(215,20%,12%)] border-[hsl(215,20%,22%)] text-sm" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Адреса</label>
                <Input value={newIncident.address ?? ""} onChange={(e) => setNewIncident((p) => ({ ...p, address: e.target.value }))}
                  placeholder="Точна адреса..." className="bg-[hsl(215,20%,12%)] border-[hsl(215,20%,22%)] text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Тип</label>
                <Select value={newIncident.type} onValueChange={(v) => setNewIncident((p) => ({ ...p, type: v as IncidentType }))}>
                  <SelectTrigger className="bg-[hsl(215,20%,12%)] border-[hsl(215,20%,22%)] text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(INCIDENT_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{TYPE_ICONS[k as IncidentType]} {v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Категорія</label>
                <Select value={newIncident.category} onValueChange={(v) => setNewIncident((p) => ({ ...p, category: v as IncidentCategory }))}>
                  <SelectTrigger className="bg-[hsl(215,20%,12%)] border-[hsl(215,20%,22%)] text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Регіон</label>
                <Select value={newIncident.region} onValueChange={(v) => setNewIncident((p) => ({ ...p, region: v }))}>
                  <SelectTrigger className="bg-[hsl(215,20%,12%)] border-[hsl(215,20%,22%)] text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-48">
                    {REGIONS_LIST.map((r) => (<SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Рівень</label>
                <Select value={newIncident.severity} onValueChange={(v) => setNewIncident((p) => ({ ...p, severity: v as SeverityLevel }))}>
                  <SelectTrigger className="bg-[hsl(215,20%,12%)] border-[hsl(215,20%,22%)] text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SEVERITY_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Статус</label>
                <Select value={newIncident.status} onValueChange={(v) => setNewIncident((p) => ({ ...p, status: v as IncidentStatus }))}>
                  <SelectTrigger className="bg-[hsl(215,20%,12%)] border-[hsl(215,20%,22%)] text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Провідна служба</label>
                <Select value={newIncident.lead_agency} onValueChange={(v) => setNewIncident((p) => ({ ...p, lead_agency: v }))}>
                  <SelectTrigger className="bg-[hsl(215,20%,12%)] border-[hsl(215,20%,22%)] text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ДСНС">🚒 ДСНС</SelectItem>
                    <SelectItem value="Поліція">🚓 Поліція</SelectItem>
                    <SelectItem value="Медицина">🚑 Медицина</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Опис</label>
              <Textarea value={newIncident.description ?? ""} onChange={(e) => setNewIncident((p) => ({ ...p, description: e.target.value }))}
                placeholder="Опис ситуації..." className="bg-[hsl(215,20%,12%)] border-[hsl(215,20%,22%)] text-sm min-h-[60px]" />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Ресурси</label>
              <div className="grid grid-cols-3 gap-2">
                {(["ses_units", "police_units", "medical_units"] as const).map((field) => (
                  <div key={field}>
                    <label className="text-[10px] text-muted-foreground">
                      {field === "ses_units" ? "🚒 ДСНС" : field === "police_units" ? "🚓 Поліція" : "🚑 Медики"}
                    </label>
                    <Input type="number" min={0}
                      value={(newIncident.resources as any)?.[field] ?? 0}
                      onChange={(e) => setNewIncident((p) => {
                        const res = { ...(p.resources ?? { ses_units: 0, police_units: 0, medical_units: 0, personnel_total: 0, specialized_equipment: [] }), [field]: Number(e.target.value) };
                        res.personnel_total = (res.ses_units + res.police_units + res.medical_units) * 5;
                        return { ...p, resources: res };
                      })}
                      className="bg-[hsl(215,20%,12%)] border-[hsl(215,20%,22%)] text-sm mt-0.5" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button onClick={handleAddIncident} className="flex-1" disabled={!newIncident.title}>
              {editingIncident ? "Зберегти зміни" : "Додати інцидент"}
            </Button>
            <Button variant="outline" onClick={() => { setShowAddForm(false); setEditingIncident(null); resetForm(); }}
              className="border-[hsl(215,20%,22%)]">Скасувати</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ AUDIT LOG DIALOG ═══ */}
      <Dialog open={showAudit} onOpenChange={setShowAudit}>
        <DialogContent className="max-w-md bg-[hsl(222,47%,10%)] border-[hsl(215,20%,22%)] text-[hsl(210,40%,95%)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><History className="h-4 w-4" /> Журнал змін</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-2">
              {auditLog.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Немає записів</p>
              ) : auditLog.map((entry: any) => (
                <div key={entry.id} className="p-2.5 rounded-lg bg-[hsl(215,20%,12%)] border border-[hsl(215,20%,18%)]">
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="outline" className="text-[10px]">
                      {entry.action === "create" ? "Створено" : entry.action === "update" ? "Оновлено" : "Видалено"}
                    </Badge>
                    <span className="text-[10px] text-[hsl(215,20%,50%)]">
                      {format(safeDate(entry.created_at), "dd.MM.yyyy HH:mm", { locale: uk })}
                    </span>
                  </div>
                  <p className="text-[10px] text-[hsl(215,20%,55%)]">
                    Оператор: {entry.user_id?.substring(0, 8)}...
                  </p>
                  {entry.changes && Object.keys(entry.changes).length > 0 && (
                    <div className="mt-1 text-[9px] text-[hsl(215,20%,50%)]">
                      Змінено: {Object.keys(entry.changes).join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ═══ SUB-COMPONENTS ═══

const StatChip = memo(({ icon, label, value, color, highlight }: {
  icon: string; label: string; value: number; color?: string; highlight?: boolean
}) => (
  <div className={cn(
    "flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs",
    highlight ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-[hsl(215,20%,12%)] border-[hsl(215,20%,20%)]"
  )}>
    <span>{icon}</span>
    <span className="text-[hsl(215,20%,55%)] hidden xl:inline">{label}:</span>
    <span className={cn("font-bold", color ?? "text-white")}>{value}</span>
  </div>
));
StatChip.displayName = "StatChip";

const ResourceGlance = memo(({ icon, label, value }: { icon: string; label: string; value: number }) => (
  <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-[hsl(215,20%,11%)] border border-[hsl(215,20%,18%)]">
    <span className="text-base">{icon}</span>
    <div>
      <p className="text-sm font-bold text-white leading-none">{value}</p>
      <p className="text-[9px] text-[hsl(215,20%,50%)]">{label}</p>
    </div>
  </div>
));
ResourceGlance.displayName = "ResourceGlance";

const LegendItem = ({ color, label }: { color: string; label: string }) => (
  <span className="flex items-center gap-1">
    <span className="h-2.5 w-2.5 rounded-sm inline-block" style={{ background: color }} />{label}
  </span>
);

const IncidentDetail = memo(({ incident, progress, onClose, onEdit, onDelete, onViewAudit }: {
  incident: Incident; progress: number; onClose: () => void;
  onEdit?: (inc: Incident) => void; onDelete?: (id: string) => Promise<void>;
  onViewAudit?: (id: string) => void; canEdit?: boolean;
}) => {
  const sev = SEVERITY_CONFIG[incident.severity] || DEFAULT_SEV;
  const sta = STATUS_CONFIG[incident.status] || DEFAULT_STA;

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(215,20%,14%)]">
        <div className="flex items-center gap-2">
          <span className="text-xl">{TYPE_ICONS[incident.type]}</span>
          <div>
            <h3 className="text-xs font-bold text-white leading-tight">{incident.title}</h3>
            <p className="text-[10px] text-[hsl(215,20%,55%)]">{INCIDENT_TYPE_LABELS[incident.type]} • {CATEGORY_LABELS[incident.category] ?? incident.category}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onViewAudit && (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-[hsl(215,20%,55%)]" onClick={() => onViewAudit(incident.id)}>
              <History className="h-3 w-3" />
            </Button>
          )}
          {onEdit && (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-[hsl(215,20%,55%)]" onClick={() => onEdit(incident)}>
              <Edit className="h-3 w-3" />
            </Button>
          )}
          {onDelete && (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => onDelete(incident.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="h-3 w-3" /></Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Status badges */}
          <div className="flex gap-2 flex-wrap">
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", sev.bgColor, sev.color)}>{sev.label}</span>
            <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border border-[hsl(215,20%,22%)]", sta.color)}>{sta.label}</span>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-[hsl(215,20%,22%)] text-[hsl(215,20%,60%)]">
              Risk: {incident.risk_level}/10
            </span>
          </div>

          {/* Description */}
          <div>
            <h4 className="text-[10px] font-semibold text-[hsl(215,20%,60%)] uppercase mb-1">Опис</h4>
            <p className="text-xs text-[hsl(210,40%,85%)] leading-relaxed">{incident.description || "—"}</p>
          </div>

          {/* Location */}
          <div>
            <h4 className="text-[10px] font-semibold text-[hsl(215,20%,60%)] uppercase mb-1">Локація</h4>
            <p className="text-xs text-white">{incident.regionName}</p>
            {incident.address && <p className="text-[10px] text-[hsl(215,20%,55%)]">{incident.address}</p>}
            <p className="text-[10px] text-[hsl(215,20%,45%)]">
              {incident.coordinates[1].toFixed(4)}°N {incident.coordinates[0].toFixed(4)}°E
            </p>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-[10px] font-semibold text-[hsl(215,20%,60%)] uppercase mb-2">Ресурси</h4>
            <div className="grid grid-cols-2 gap-2">
              <MiniStat label="ДСНС" value={incident.resources.ses_units} icon="🚒" />
              <MiniStat label="Поліція" value={incident.resources.police_units} icon="🚓" />
              <MiniStat label="Медики" value={incident.resources.medical_units} icon="🚑" />
              <MiniStat label="Ос. склад" value={incident.resources.personnel_total} icon="👥" />
            </div>
            {incident.resources.specialized_equipment?.length > 0 && (
              <div className="mt-2">
                <p className="text-[10px] text-[hsl(215,20%,50%)]">Спецтехніка:</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {incident.resources.specialized_equipment.map((eq, i) => (
                    <Badge key={i} variant="outline" className="text-[9px]">{eq}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Impact */}
          <div>
            <h4 className="text-[10px] font-semibold text-[hsl(215,20%,60%)] uppercase mb-2">Наслідки</h4>
            <div className="grid grid-cols-3 gap-2">
              <MiniStat label="Врятовано" value={incident.impact.rescued} icon="🆘" color="text-green-400" />
              <MiniStat label="Постраждало" value={incident.impact.injured} icon="⚠️" color="text-yellow-400" />
              <MiniStat label="Загиблих" value={incident.impact.fatalities} icon="💀" color="text-red-400" />
            </div>
            {incident.impact.damage_uah > 0 && (
              <p className="text-[10px] text-[hsl(215,20%,55%)] mt-2">
                💰 Збитки: {incident.impact.damage_uah.toLocaleString("uk-UA")} грн
              </p>
            )}
          </div>

          {/* Progress */}
          <div>
            <div className="flex justify-between text-[9px] text-muted-foreground mb-1">
              <span>Прогрес ліквідації</span>
              <span>ETA: {format(safeDate(incident.estimated_resolution_time), "HH:mm dd.MM")}</span>
            </div>
            <Progress value={progress} className="h-1.5 bg-[hsl(215,20%,18%)]" />
            <p className="text-[9px] text-muted-foreground mt-0.5">{Math.round(progress)}%</p>
          </div>

          {/* Timestamps */}
          <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(safeDate(incident.timestamp), { locale: uk, addSuffix: true })}
            <span className="ml-2 text-[hsl(215,20%,40%)]">
              Оновлено: {format(safeDate(incident.last_updated), "HH:mm dd.MM")}
            </span>
          </div>
        </div>
      </ScrollArea>
    </>
  );
});
IncidentDetail.displayName = "IncidentDetail";

const MiniStat = ({ label, value, icon, color }: { label: string; value: number; icon: string; color?: string }) => (
  <div className="bg-[hsl(215,20%,11%)] rounded-md p-2 border border-[hsl(215,20%,18%)]">
    <div className="flex items-center gap-1">
      <span className="text-xs">{icon}</span>
      <span className={cn("text-sm font-bold", color ?? "text-white")}>{value}</span>
    </div>
    <p className="text-[9px] text-[hsl(215,20%,50%)]">{label}</p>
  </div>
);

const RegionPanel = memo(({ regionName, regionStats, onClose, onSelectIncident, getProgress }: {
  regionName: string;
  regionStats: { total: number; active: number; personnel: number; sesUnits: number; policeUnits: number; medicalUnits: number; rescued: number; injured: number; incidents: Incident[] };
  onClose: () => void;
  onSelectIncident: (inc: Incident) => void;
  getProgress: (inc: Incident) => number;
}) => (
  <>
    <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(215,20%,14%)]">
      <div>
        <h3 className="text-sm font-bold text-white">{regionName}</h3>
        <p className="text-[10px] text-[hsl(215,20%,55%)]">{regionStats.total} подій, {regionStats.active} активних</p>
      </div>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="h-3 w-3" /></Button>
    </div>

    {/* Region resource stats */}
    <div className="p-3 border-b border-[hsl(215,20%,14%)]">
      <h4 className="text-[10px] font-semibold text-[hsl(215,20%,60%)] uppercase mb-2">Ресурси в регіоні</h4>
      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="ДСНС" value={regionStats.sesUnits} icon="🚒" />
        <MiniStat label="Поліція" value={regionStats.policeUnits} icon="🚓" />
        <MiniStat label="Медики" value={regionStats.medicalUnits} icon="🚑" />
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2">
        <MiniStat label="Ос. склад" value={regionStats.personnel} icon="👥" />
        <MiniStat label="Врятовано" value={regionStats.rescued} icon="🆘" color="text-green-400" />
        <MiniStat label="Поранено" value={regionStats.injured} icon="⚠️" color="text-yellow-400" />
      </div>
    </div>

    <ScrollArea className="flex-1">
      <div className="p-2 space-y-1.5">
        {regionStats.incidents.sort((a, b) => b.risk_level - a.risk_level).map((inc) => {
          const sev = SEVERITY_CONFIG[inc.severity] || DEFAULT_SEV;
          const sta = STATUS_CONFIG[inc.status] || DEFAULT_STA;
          return (
            <div key={inc.id} onClick={() => onSelectIncident(inc)}
              className="rounded-lg p-2.5 cursor-pointer border bg-[hsl(215,20%,11%)] border-[hsl(215,20%,18%)] hover:border-[hsl(215,20%,30%)] transition-colors">
              <div className="flex items-start gap-2">
                <span className="text-sm">{TYPE_ICONS[inc.type]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-white truncate">{inc.title}</p>
                  <div className="flex gap-2 text-[9px] mt-1">
                    <span className={sev.color}>{sev.label}</span>
                    <span className={sta.color}>{sta.label}</span>
                    <span className="text-[hsl(215,20%,50%)]">👥{inc.resources.personnel_total}</span>
                  </div>
                </div>
              </div>
              {inc.status !== "Resolved" && <Progress value={getProgress(inc)} className="h-1 mt-2 bg-[hsl(215,20%,20%)]" />}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  </>
));
RegionPanel.displayName = "RegionPanel";

export default SituationCenterPage;
