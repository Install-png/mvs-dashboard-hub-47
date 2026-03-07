import { useState, useMemo } from "react";
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
  Truck, Heart, Siren, ChevronRight, X,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from "recharts";

const CHART_COLORS = ["hsl(24, 95%, 53%)", "hsl(24, 80%, 65%)", "hsl(30, 100%, 75%)", "hsl(30, 40%, 85%)", "hsl(200, 70%, 50%)", "hsl(150, 60%, 45%)"];
const MONTH_NAMES = ["Січ", "Лют", "Бер", "Кві", "Тра", "Чер", "Лип", "Сер", "Вер", "Жов", "Лис", "Гру"];
const DAY_NAMES = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

const REGION_IDS = Object.keys(REGION_NAME_MAP);

// ═══ RESOURCE THRESHOLDS (min resources per active incident by severity) ═══
const SEVERITY_RESOURCE_NORM: Record<string, { personnel: number; units: number }> = {
  Critical: { personnel: 30, units: 8 },
  High: { personnel: 15, units: 5 },
  Major: { personnel: 8, units: 3 },
  Medium: { personnel: 4, units: 2 },
  Minor: { personnel: 2, units: 1 },
  Low: { personnel: 1, units: 1 },
};

interface RegionDeficit {
  regionId: string;
  regionName: string;
  activeCount: number;
  criticalCount: number;
  currentPersonnel: number;
  requiredPersonnel: number;
  currentUnits: number;
  requiredUnits: number;
  deficitPersonnel: number;
  deficitUnits: number;
  deficitPercent: number;
  surplus: boolean;
}

interface Recommendation {
  from: string;
  fromName: string;
  to: string;
  toName: string;
  personnel: number;
  units: number;
  reason: string;
}

function computeRegionDeficits(incidents: Incident[]): RegionDeficit[] {
  const active = incidents.filter(i => i.status !== "Resolved");
  const byRegion: Record<string, Incident[]> = {};
  active.forEach(i => {
    if (!byRegion[i.region]) byRegion[i.region] = [];
    byRegion[i.region].push(i);
  });

  return REGION_IDS.map(id => {
    const regionIncs = byRegion[id] || [];
    const currentPersonnel = regionIncs.reduce((s, i) => s + i.resources.personnel_total, 0);
    const currentUnits = regionIncs.reduce((s, i) => s + i.resources.ses_units + i.resources.police_units + i.resources.medical_units, 0);
    const requiredPersonnel = regionIncs.reduce((s, i) => s + (SEVERITY_RESOURCE_NORM[i.severity]?.personnel ?? 4), 0);
    const requiredUnits = regionIncs.reduce((s, i) => s + (SEVERITY_RESOURCE_NORM[i.severity]?.units ?? 2), 0);
    const deficitPersonnel = requiredPersonnel - currentPersonnel;
    const deficitUnits = requiredUnits - currentUnits;
    const deficitPercent = requiredPersonnel > 0 ? Math.round(((requiredPersonnel - currentPersonnel) / requiredPersonnel) * 100) : 0;

    return {
      regionId: id,
      regionName: REGION_NAME_MAP[id] || id,
      activeCount: regionIncs.length,
      criticalCount: regionIncs.filter(i => i.severity === "Critical").length,
      currentPersonnel,
      requiredPersonnel,
      currentUnits,
      requiredUnits,
      deficitPersonnel: Math.max(0, deficitPersonnel),
      deficitUnits: Math.max(0, deficitUnits),
      deficitPercent,
      surplus: deficitPersonnel < 0,
    };
  }).filter(r => r.activeCount > 0);
}

function computeRecommendations(deficits: RegionDeficit[]): Recommendation[] {
  const needHelp = deficits.filter(d => d.deficitPersonnel > 0).sort((a, b) => b.deficitPercent - a.deficitPercent);
  const canHelp = deficits.filter(d => d.surplus).sort((a, b) => a.deficitPercent - b.deficitPercent); // most surplus first

  const recs: Recommendation[] = [];
  for (const need of needHelp) {
    for (const donor of canHelp) {
      if (recs.length >= 5) break;
      const surplusP = donor.currentPersonnel - donor.requiredPersonnel;
      const surplusU = donor.currentUnits - donor.requiredUnits;
      if (surplusP <= 0) continue;
      const transferP = Math.min(surplusP, need.deficitPersonnel);
      const transferU = Math.min(Math.max(0, surplusU), need.deficitUnits);
      if (transferP > 0) {
        recs.push({
          from: donor.regionId,
          fromName: donor.regionName,
          to: need.regionId,
          toName: need.regionName,
          personnel: transferP,
          units: transferU,
          reason: need.criticalCount > 0 ? `${need.criticalCount} критичних подій` : `${need.activeCount} активних подій`,
        });
      }
    }
  }
  return recs;
}

const Dashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // ═══ USE ZUSTAND STORE — SINGLE SOURCE OF TRUTH ═══
  const { incidents, loading: incidentsLoading } = useIncidentStore();
  useIncidents(); // triggers fetch + realtime subscription

  // Personnel (still separate table)
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [loadingPersonnel, setLoadingPersonnel] = useState(true);

  useState(() => {
    supabase.from("personnel").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { setPersonnel(data || []); setLoadingPersonnel(false); });
  });

  // ═══ COMPUTE ALL STATS FROM ZUSTAND INCIDENTS ═══
  const stats = useMemo(() => {
    const active = incidents.filter(i => i.status !== "Resolved").length;
    const todayCount = incidents.filter(i => isToday(new Date(i.timestamp))).length;
    const resolved = incidents.filter(i => i.status === "Resolved").length;
    const rate = incidents.length > 0 ? Math.round((resolved / incidents.length) * 100) : 0;
    return [
      { title: "Активні інциденти", value: String(active), icon: "AlertTriangle", change: `${incidents.length} всього`, color: "text-red-500" },
      { title: "Персонал задіяно", value: String(incidents.reduce((s, i) => s + i.resources.personnel_total, 0)), icon: "Users", change: `${personnel.filter((p: any) => p.status === "На службі").length} на службі`, color: "text-blue-500" },
      { title: "Врятовано сьогодні", value: String(incidents.filter(i => isToday(new Date(i.timestamp))).reduce((s, i) => s + i.impact.rescued, 0)), icon: "TrendingUp", change: `${todayCount} подій за добу`, color: "text-green-500" },
      { title: "Показник вирішення", value: `${rate}%`, icon: "FileText", change: `${resolved}/${incidents.length}`, color: "text-primary" },
    ];
  }, [incidents, personnel]);

  // Service stats from incidents (not calendar events)
  const serviceStats = useMemo(() => {
    const active = incidents.filter(i => i.status !== "Resolved");
    return {
      ses: {
        units: active.reduce((s, i) => s + i.resources.ses_units, 0),
        rescued: active.reduce((s, i) => s + i.impact.rescued, 0),
        personnel: active.filter(i => i.category === "SES" || i.resources.ses_units > 0).reduce((s, i) => s + i.resources.personnel_total, 0),
      },
      police: {
        units: active.reduce((s, i) => s + i.resources.police_units, 0),
        incidents: active.filter(i => i.category === "Police" || i.resources.police_units > 0).length,
        personnel: active.filter(i => i.category === "Police" || i.resources.police_units > 0).reduce((s, i) => s + i.resources.personnel_total, 0),
      },
      medical: {
        units: active.reduce((s, i) => s + i.resources.medical_units, 0),
        injured: active.reduce((s, i) => s + i.impact.injured, 0),
        personnel: active.filter(i => i.category === "Medical" || i.resources.medical_units > 0).reduce((s, i) => s + i.resources.personnel_total, 0),
      },
    };
  }, [incidents]);

  // Monthly & weekly charts
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
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return entries.length === 0 ? [{ name: "Немає даних", value: 1 }] : entries.map(([name, value]) => ({ name, value }));
  }, [incidents]);

  const severityData = useMemo(() => {
    const counts: Record<string, number> = {};
    incidents.forEach(i => { const s = SEVERITY_CONFIG[i.severity]?.label || i.severity; counts[s] = (counts[s] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [incidents]);

  // ═══ RESOURCE DEFICIT ANALYSIS ═══
  const regionDeficits = useMemo(() => computeRegionDeficits(incidents), [incidents]);
  const recommendations = useMemo(() => computeRecommendations(regionDeficits), [regionDeficits]);
  const criticalDeficits = useMemo(() => regionDeficits.filter(d => d.deficitPercent > 30), [regionDeficits]);

  // ═══ SERVICE DETAIL DIALOG ═══
  type ServiceType = "ses" | "police" | "medical" | null;
  const [activeService, setActiveService] = useState<ServiceType>(null);
  const [serviceRegionFilter, setServiceRegionFilter] = useState<string>("all");

  const serviceDetailData = useMemo(() => {
    if (!activeService) return null;
    const filterIncs = (incs: Incident[]) => {
      let filtered = incs.filter(i => i.status !== "Resolved");
      if (serviceRegionFilter !== "all") {
        filtered = filtered.filter(i => i.region === serviceRegionFilter);
      }
      return filtered;
    };

    const allActive = filterIncs(incidents);

    if (activeService === "ses") {
      const sesIncs = allActive.filter(i => i.category === "SES" || i.resources.ses_units > 0);
      return {
        label: "ДСНС",
        icon: Flame,
        color: "text-red-500",
        bgColor: "bg-red-500/10",
        totalIncidents: sesIncs.length,
        totalUnits: sesIncs.reduce((s, i) => s + i.resources.ses_units, 0),
        totalPersonnel: sesIncs.reduce((s, i) => s + i.resources.personnel_total, 0),
        totalRescued: sesIncs.reduce((s, i) => s + i.impact.rescued, 0),
        equipment: sesIncs.flatMap(i => i.resources.specialized_equipment || []),
        stats: [
          { label: "Підрозділів залучено", value: sesIncs.reduce((s, i) => s + i.resources.ses_units, 0) },
          { label: "Особовий склад", value: sesIncs.reduce((s, i) => s + i.resources.personnel_total, 0) },
          { label: "Врятовано людей", value: sesIncs.reduce((s, i) => s + i.impact.rescued, 0) },
          { label: "Пожеж ліквідовано", value: sesIncs.filter(i => i.type === "Fire").length },
          { label: "Спецтехніки одиниць", value: sesIncs.reduce((s, i) => s + i.resources.ses_units, 0) },
          { label: "Медичних випадків", value: sesIncs.reduce((s, i) => s + i.impact.injured, 0) },
        ],
        incidents: sesIncs,
      };
    }
    if (activeService === "police") {
      const polIncs = allActive.filter(i => i.category === "Police" || i.resources.police_units > 0);
      return {
        label: "Поліція",
        icon: Phone,
        color: "text-blue-500",
        bgColor: "bg-blue-500/10",
        totalIncidents: polIncs.length,
        totalUnits: polIncs.reduce((s, i) => s + i.resources.police_units, 0),
        totalPersonnel: polIncs.reduce((s, i) => s + i.resources.personnel_total, 0),
        totalRescued: 0,
        equipment: [],
        stats: [
          { label: "Патрулів залучено", value: polIncs.reduce((s, i) => s + i.resources.police_units, 0) },
          { label: "Особовий склад", value: polIncs.reduce((s, i) => s + i.resources.personnel_total, 0) },
          { label: "Інцидентів у роботі", value: polIncs.length },
          { label: "Кримінальних подій", value: polIncs.filter(i => i.type === "Crime").length },
          { label: "Затримань", value: polIncs.filter(i => i.type === "Crime" && i.status === "Resolved").length },
          { label: "Критичних подій", value: polIncs.filter(i => i.severity === "Critical").length },
        ],
        incidents: polIncs,
      };
    }
    // medical
    const medIncs = allActive.filter(i => i.category === "Medical" || i.resources.medical_units > 0);
    return {
      label: "Медична служба",
      icon: ShieldCheck,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      totalIncidents: medIncs.length,
      totalUnits: medIncs.reduce((s, i) => s + i.resources.medical_units, 0),
      totalPersonnel: medIncs.reduce((s, i) => s + i.resources.personnel_total, 0),
      totalRescued: medIncs.reduce((s, i) => s + i.impact.rescued, 0),
      equipment: [],
      stats: [
        { label: "Бригад залучено", value: medIncs.reduce((s, i) => s + i.resources.medical_units, 0) },
        { label: "Особовий склад", value: medIncs.reduce((s, i) => s + i.resources.personnel_total, 0) },
        { label: "Постраждалих", value: medIncs.reduce((s, i) => s + i.impact.injured, 0) },
        { label: "Загиблих", value: medIncs.reduce((s, i) => s + i.impact.fatalities, 0) },
        { label: "Врятовано", value: medIncs.reduce((s, i) => s + i.impact.rescued, 0) },
        { label: "Активних подій", value: medIncs.length },
      ],
      incidents: medIncs,
    };
  }, [activeService, serviceRegionFilter, incidents]);

  // ═══ REGION LIST FOR FILTER ═══
  const REGION_OPTIONS = useMemo(() => {
    const regionsWithIncs = new Set(incidents.filter(i => i.status !== "Resolved").map(i => i.region));
    return Object.entries(REGION_NAME_MAP)
      .filter(([id]) => regionsWithIncs.has(id))
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [incidents]);

  // Personnel CRUD
  const [editingPerson, setEditingPerson] = useState<any>(null);
  const [personDialogOpen, setPersonDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchPersonnel = async () => {
    const { data } = await supabase.from("personnel").select("*").order("created_at", { ascending: false });
    setPersonnel(data || []);
  };

  const openPersonDialog = (person?: any) => {
    setEditingPerson(person || { name: "", rank: "", department: "", status: "На службі" });
    setPersonDialogOpen(true);
  };

  const savePerson = async () => {
    if (!editingPerson || !user) return;
    setSaving(true);
    if (editingPerson.id) {
      await supabase.from("personnel").update({ name: editingPerson.name, rank: editingPerson.rank, department: editingPerson.department, status: editingPerson.status } as any).eq("id", editingPerson.id);
    } else {
      await supabase.from("personnel").insert({ user_id: user.id, name: editingPerson.name, rank: editingPerson.rank, department: editingPerson.department, status: editingPerson.status } as any);
    }
    setSaving(false);
    setPersonDialogOpen(false);
    fetchPersonnel();
  };

  const deletePerson = async (id: string) => {
    await supabase.from("personnel").delete().eq("id", id);
    fetchPersonnel();
  };

  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = { FileText, Users, AlertTriangle, TrendingUp };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ═══ SERVICE WIDGETS — CLICKABLE ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-red-500 cursor-pointer hover:shadow-lg hover:border-l-red-400 transition-all"
          onClick={() => { setActiveService("ses"); setServiceRegionFilter("all"); }}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <Flame className="h-5 w-5 text-red-500" />
                </div>
                <h3 className="font-bold text-sm">ДСНС</h3>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><p className="text-xl font-bold text-foreground">{serviceStats.ses.units}</p><p className="text-xs text-muted-foreground">Підрозділів</p></div>
              <div><p className="text-xl font-bold text-foreground">{serviceStats.ses.rescued}</p><p className="text-xs text-muted-foreground">Врятовано</p></div>
              <div><p className="text-xl font-bold text-foreground">{serviceStats.ses.personnel}</p><p className="text-xs text-muted-foreground">Персоналу</p></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 cursor-pointer hover:shadow-lg hover:border-l-blue-400 transition-all"
          onClick={() => { setActiveService("police"); setServiceRegionFilter("all"); }}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Phone className="h-5 w-5 text-blue-500" />
                </div>
                <h3 className="font-bold text-sm">Поліція</h3>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><p className="text-xl font-bold text-foreground">{serviceStats.police.units}</p><p className="text-xs text-muted-foreground">Патрулів</p></div>
              <div><p className="text-xl font-bold text-foreground">{serviceStats.police.incidents}</p><p className="text-xs text-muted-foreground">Інцидентів</p></div>
              <div><p className="text-xl font-bold text-foreground">{serviceStats.police.personnel}</p><p className="text-xs text-muted-foreground">Персоналу</p></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 cursor-pointer hover:shadow-lg hover:border-l-green-400 transition-all"
          onClick={() => { setActiveService("medical"); setServiceRegionFilter("all"); }}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5 text-green-500" />
                </div>
                <h3 className="font-bold text-sm">Медична служба</h3>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><p className="text-xl font-bold text-foreground">{serviceStats.medical.units}</p><p className="text-xs text-muted-foreground">Бригад</p></div>
              <div><p className="text-xl font-bold text-foreground">{serviceStats.medical.injured}</p><p className="text-xs text-muted-foreground">Постраждалих</p></div>
              <div><p className="text-xl font-bold text-foreground">{serviceStats.medical.personnel}</p><p className="text-xs text-muted-foreground">Персоналу</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ GENERAL STATS ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const Icon = iconMap[stat.icon] || FileText;
          return (
            <Card key={i} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
                    <span className="text-xs font-medium text-muted-foreground">{stat.change}</span>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ═══ RESOURCE DEFICIT ALERT ═══ */}
      {criticalDeficits.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <Zap className="h-5 w-5" />
              Дефіцит ресурсів — {criticalDeficits.length} регіон(ів)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {criticalDeficits.slice(0, 4).map(d => (
              <div key={d.regionId} className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-destructive shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{d.regionName}</span>
                    <span className="text-xs text-destructive font-medium">−{d.deficitPersonnel} ос. / −{d.deficitUnits} підр.</span>
                  </div>
                  <Progress value={Math.max(0, 100 - d.deficitPercent)} className="h-1.5" />
                </div>
                <Badge variant="destructive" className="text-[10px] shrink-0">{d.deficitPercent}%</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ═══ TABS ═══ */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-11">
          <TabsTrigger value="overview" className="gap-2"><BarChart3 className="h-4 w-4" />Огляд</TabsTrigger>
          <TabsTrigger value="resources" className="gap-2"><ArrowRightLeft className="h-4 w-4" />Ресурси</TabsTrigger>
          <TabsTrigger value="incidents" className="gap-2"><AlertTriangle className="h-4 w-4" />Інциденти</TabsTrigger>
          <TabsTrigger value="personnel" className="gap-2"><Users className="h-4 w-4" />Персонал</TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2"><Activity className="h-4 w-4" />Аналітика</TabsTrigger>
        </TabsList>

        {/* ═══ OVERVIEW ═══ */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" />Інциденти за місяцями</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Activity className="h-5 w-5 text-primary" />Динаміка за тиждень</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip />
                    <Line type="monotone" dataKey="incidents" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} name="Інциденти" />
                    <Line type="monotone" dataKey="resolved" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 4 }} name="Вирішено" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Latest incidents from store */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Останні інциденти</CardTitle></CardHeader>
            <CardContent>
              {incidentsLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : incidents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Немає інцидентів</p>
              ) : (
                <div className="space-y-2">
                  {incidents.slice(0, 5).map(inc => {
                    const sev = SEVERITY_CONFIG[inc.severity];
                    const sta = STATUS_CONFIG[inc.status];
                    return (
                      <div key={inc.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${sev?.color?.replace("text-", "bg-") || "bg-muted-foreground"}`} />
                          <div className="min-w-0">
                            <span className="font-medium text-sm block truncate">{inc.title}</span>
                            <span className="text-muted-foreground text-xs">{inc.regionName} • {INCIDENT_TYPE_LABELS[inc.type]}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">{inc.resources.personnel_total} ос.</span>
                          <Badge variant="outline" className="text-[10px]">{sta?.label || inc.status}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ RESOURCES TAB — DEFICIT ANALYSIS ═══ */}
        <TabsContent value="resources" className="space-y-6 mt-4">
          {/* Region table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Аналіз ресурсів по регіонам
              </CardTitle>
            </CardHeader>
            <CardContent>
              {regionDeficits.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Немає активних інцидентів</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 text-muted-foreground font-medium">Регіон</th>
                        <th className="text-center py-2 text-muted-foreground font-medium">Активних</th>
                        <th className="text-center py-2 text-muted-foreground font-medium">Крит.</th>
                        <th className="text-center py-2 text-muted-foreground font-medium">Персонал</th>
                        <th className="text-center py-2 text-muted-foreground font-medium">Підрозділів</th>
                        <th className="text-center py-2 text-muted-foreground font-medium">Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {regionDeficits.sort((a, b) => b.deficitPercent - a.deficitPercent).map(d => (
                        <tr key={d.regionId} className="border-b border-border/50 hover:bg-muted/50">
                          <td className="py-2.5 font-medium">{d.regionName}</td>
                          <td className="py-2.5 text-center">{d.activeCount}</td>
                          <td className="py-2.5 text-center">
                            {d.criticalCount > 0 ? <Badge variant="destructive" className="text-[10px]">{d.criticalCount}</Badge> : "—"}
                          </td>
                          <td className="py-2.5 text-center">
                            <span className={d.deficitPersonnel > 0 ? "text-destructive font-medium" : "text-foreground"}>
                              {d.currentPersonnel}/{d.requiredPersonnel}
                            </span>
                          </td>
                          <td className="py-2.5 text-center">
                            <span className={d.deficitUnits > 0 ? "text-destructive font-medium" : "text-foreground"}>
                              {d.currentUnits}/{d.requiredUnits}
                            </span>
                          </td>
                          <td className="py-2.5 text-center">
                            {d.surplus ? (
                              <Badge className="bg-green-500/10 text-green-600 border-green-500/30 text-[10px]">Надлишок</Badge>
                            ) : d.deficitPercent > 30 ? (
                              <Badge variant="destructive" className="text-[10px]">Дефіцит {d.deficitPercent}%</Badge>
                            ) : d.deficitPercent > 0 ? (
                              <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30 text-[10px]">Частковий −{d.deficitPercent}%</Badge>
                            ) : (
                              <Badge className="bg-green-500/10 text-green-600 border-green-500/30 text-[10px]">Норма</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Redistribution recommendations */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-primary" />
                Рекомендації щодо перерозподілу
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recommendations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {regionDeficits.length === 0 ? "Немає активних інцидентів" : "Ресурси розподілені оптимально або немає донорських регіонів"}
                </p>
              ) : (
                <div className="space-y-3">
                  {recommendations.map((rec, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <ArrowRightLeft className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="font-medium text-green-600">{rec.fromName}</span>
                          <span className="text-muted-foreground mx-2">→</span>
                          <span className="font-medium text-destructive">{rec.toName}</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {rec.personnel} осіб{rec.units > 0 ? `, ${rec.units} підрозділів` : ""} • {rec.reason}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ INCIDENTS ═══ */}
        <TabsContent value="incidents" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Журнал інцидентів (з Ситуаційного центру)</CardTitle>
            </CardHeader>
            <CardContent>
              {incidentsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : incidents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Немає інцидентів</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 text-muted-foreground font-medium">Назва</th>
                        <th className="text-left py-2 text-muted-foreground font-medium">Регіон</th>
                        <th className="text-left py-2 text-muted-foreground font-medium">Тип</th>
                        <th className="text-center py-2 text-muted-foreground font-medium">Рівень</th>
                        <th className="text-center py-2 text-muted-foreground font-medium">Ресурси</th>
                        <th className="text-left py-2 text-muted-foreground font-medium">Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {incidents.map(inc => {
                        const sev = SEVERITY_CONFIG[inc.severity] || { label: inc.severity, bgColor: "bg-muted" };
                        const sta = STATUS_CONFIG[inc.status] || { label: inc.status, color: "text-muted-foreground" };
                        return (
                          <tr key={inc.id} className="border-b border-border/50 hover:bg-muted/50">
                            <td className="py-2.5 font-medium max-w-[200px] truncate">{inc.title}</td>
                            <td className="py-2.5 text-muted-foreground">{inc.regionName}</td>
                            <td className="py-2.5 text-muted-foreground">{INCIDENT_TYPE_LABELS[inc.type]}</td>
                            <td className="py-2.5 text-center">
                              <Badge variant="outline" className={`text-[10px] ${sev.bgColor}`}>{sev.label}</Badge>
                            </td>
                            <td className="py-2.5 text-center text-muted-foreground">{inc.resources.personnel_total} ос.</td>
                            <td className="py-2.5">
                              <span className={`text-xs font-medium ${sta.color}`}>{sta.label}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ PERSONNEL ═══ */}
        <TabsContent value="personnel" className="mt-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Список персоналу</CardTitle>
              <Button size="sm" onClick={() => openPersonDialog()} className="gap-1"><Plus className="h-4 w-4" />Додати</Button>
            </CardHeader>
            <CardContent>
              {loadingPersonnel ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : personnel.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Немає персоналу.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 text-muted-foreground font-medium">ПІБ</th>
                        <th className="text-left py-2 text-muted-foreground font-medium">Звання</th>
                        <th className="text-left py-2 text-muted-foreground font-medium">Відділ</th>
                        <th className="text-left py-2 text-muted-foreground font-medium">Статус</th>
                        <th className="text-right py-2 text-muted-foreground font-medium">Дії</th>
                      </tr>
                    </thead>
                    <tbody>
                      {personnel.map((person: any) => (
                        <tr key={person.id} className="border-b border-border/50 hover:bg-muted/50">
                          <td className="py-2.5 font-medium">{person.name}</td>
                          <td className="py-2.5 text-muted-foreground">{person.rank}</td>
                          <td className="py-2.5 text-muted-foreground">{person.department}</td>
                          <td className="py-2.5">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                              person.status === "На службі" ? "bg-green-100 text-green-700" : "bg-secondary text-secondary-foreground"
                            }`}>{person.status}</span>
                          </td>
                          <td className="py-2.5 text-right">
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openPersonDialog(person)}><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deletePerson(person.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ ANALYTICS ═══ */}
        <TabsContent value="analytics" className="space-y-6 mt-4">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Категорії інцидентів</CardTitle></CardHeader>
              <CardContent className="flex justify-center">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {categoryData.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">За рівнем загрози</CardTitle></CardHeader>
              <CardContent className="flex justify-center">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={severityData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {severityData.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Тижнева динаміка</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip />
                  <Line type="monotone" dataKey="incidents" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} name="Інциденти" />
                  <Line type="monotone" dataKey="resolved" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 4 }} name="Вирішено" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Personnel Dialog */}
      <Dialog open={personDialogOpen} onOpenChange={setPersonDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingPerson?.id ? "Редагувати співробітника" : "Новий співробітник"}</DialogTitle></DialogHeader>
          {editingPerson && (
            <div className="space-y-4">
              <div className="space-y-2"><label className="text-sm font-medium">ПІБ</label><Input value={editingPerson.name || ""} onChange={e => setEditingPerson({ ...editingPerson, name: e.target.value })} /></div>
              <div className="space-y-2"><label className="text-sm font-medium">Звання</label><Input value={editingPerson.rank || ""} onChange={e => setEditingPerson({ ...editingPerson, rank: e.target.value })} /></div>
              <div className="space-y-2"><label className="text-sm font-medium">Відділ</label><Input value={editingPerson.department || ""} onChange={e => setEditingPerson({ ...editingPerson, department: e.target.value })} /></div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Статус</label>
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

      {/* ═══ SERVICE DETAIL DIALOG ═══ */}
      <Dialog open={!!activeService} onOpenChange={(open) => { if (!open) setActiveService(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          {serviceDetailData && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg ${serviceDetailData.bgColor} flex items-center justify-center`}>
                    <serviceDetailData.icon className={`h-5 w-5 ${serviceDetailData.color}`} />
                  </div>
                  <div>
                    <span className="text-lg">{serviceDetailData.label}</span>
                    <p className="text-xs text-muted-foreground font-normal mt-0.5">
                      {serviceRegionFilter === "all" ? "Загальна картина по країні" : REGION_NAME_MAP[serviceRegionFilter]}
                    </p>
                  </div>
                </DialogTitle>
              </DialogHeader>

              {/* Region Filter */}
              <div className="flex items-center gap-2 py-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <Select value={serviceRegionFilter} onValueChange={setServiceRegionFilter}>
                  <SelectTrigger className="w-[240px] h-8 text-xs">
                    <SelectValue placeholder="Вся країна" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">🇺🇦 Вся країна</SelectItem>
                    {REGION_OPTIONS.map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {serviceRegionFilter !== "all" && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setServiceRegionFilter("all")}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              <Separator />

              <ScrollArea className="flex-1 pr-2">
                <div className="space-y-4 py-2">
                  {/* Key Stats Grid */}
                  <div className="grid grid-cols-3 gap-3">
                    {serviceDetailData.stats.map((stat, idx) => (
                      <div key={idx} className="bg-muted/50 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Equipment list for SES */}
                  {serviceDetailData.equipment.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Truck className="h-4 w-4 text-muted-foreground" /> Спецтехніка на озброєнні
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {[...new Set(serviceDetailData.equipment)].map((eq, i) => (
                          <Badge key={i} variant="outline" className="text-[11px]">{eq}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Incidents list for this service */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">
                      Активні інциденти ({serviceDetailData.incidents.length})
                    </h4>
                    {serviceDetailData.incidents.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {serviceRegionFilter === "all" ? "Немає активних інцидентів" : "Немає інцидентів у цьому регіоні"}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {serviceDetailData.incidents.slice(0, 20).map(inc => {
                          const sev = SEVERITY_CONFIG[inc.severity];
                          const sta = STATUS_CONFIG[inc.status];
                          return (
                            <div key={inc.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/50">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className={`h-2 w-2 rounded-full shrink-0 ${sev?.color?.replace("text-", "bg-") || "bg-muted-foreground"}`} />
                                <div className="min-w-0">
                                  <span className="font-medium text-xs block truncate">{inc.title}</span>
                                  <span className="text-muted-foreground text-[11px]">
                                    {inc.regionName} • {inc.resources.personnel_total} ос. • {INCIDENT_TYPE_LABELS[inc.type]}
                                  </span>
                                </div>
                              </div>
                              <Badge variant="outline" className="text-[10px] shrink-0">{sta?.label || inc.status}</Badge>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
