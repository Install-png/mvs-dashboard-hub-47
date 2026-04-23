import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, isBefore, startOfDay } from "date-fns";
import { uk } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCalendarEvents, CalendarEvent, CalendarEventStatus, emptyEvent } from "@/hooks/useCalendarEvents";
import { useIncidentStore } from "@/stores/useIncidentStore";
import { useIncidents } from "@/hooks/useIncidents";
import { useUnifiedStats } from "@/hooks/useUnifiedStats";
import { SEVERITY_CONFIG, STATUS_CONFIG, INCIDENT_TYPE_LABELS } from "@/data/mockIncidents";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Loader2, AlertTriangle, Flame, Shield, ShieldCheck, Phone, MapPin, Clock, FileText, Calendar as CalendarIcon, Archive, ArchiveRestore, CheckCircle2, XCircle, History, Link2, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

type ArchiveFilter = "active" | "archived" | "all";

const STATUS_META: Record<CalendarEventStatus, { label: string; color: string; icon: any }> = {
  planned: { label: "Заплановано", color: "border-primary/40 text-primary bg-primary/10", icon: Clock },
  completed: { label: "Виконано", color: "border-emerald-300 text-emerald-700 bg-emerald-500/10", icon: CheckCircle2 },
  cancelled: { label: "Скасовано", color: "border-muted-foreground/40 text-muted-foreground bg-muted", icon: XCircle },
};

const CalendarPage = () => {
  const { events, loading, saveEvent, deleteEvent, archiveEvent, setEventStatus } = useCalendarEvents();
  const { incidents } = useIncidentStore();
  useIncidents();
  const unified = useUnifiedStats();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<CalendarEvent>>(emptyEvent());
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"incidents" | "events">("events");
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>("active");

  const today = startOfDay(new Date());
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = useMemo(() => {
    const result: Date[] = [];
    let day = calStart;
    while (day <= calEnd) { result.push(day); day = addDays(day, 1); }
    return result;
  }, [calStart.getTime(), calEnd.getTime()]);

  // Filter events by archive state
  const filteredEvents = useMemo(() => {
    if (archiveFilter === "all") return events;
    if (archiveFilter === "archived") return events.filter(e => e.is_archived);
    return events.filter(e => !e.is_archived);
  }, [events, archiveFilter]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    filteredEvents.forEach(e => { const k = e.event_date; if (!map[k]) map[k] = []; map[k].push(e); });
    return map;
  }, [filteredEvents]);

  const incidentsByDate = useMemo(() => {
    const map: Record<string, typeof incidents> = {};
    incidents.forEach(inc => {
      try {
        const d = new Date(inc.timestamp);
        if (isNaN(d.getTime())) return;
        const k = format(d, "yyyy-MM-dd");
        if (!map[k]) map[k] = [];
        map[k].push(inc);
      } catch { /* skip */ }
    });
    return map;
  }, [incidents]);

  const selectedDateKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
  const selectedEvents = selectedDate ? eventsByDate[selectedDateKey] || [] : [];
  const selectedIncidents = selectedDate ? incidentsByDate[selectedDateKey] || [] : [];
  const isPastDate = selectedDate ? isBefore(selectedDate, today) : false;
  const isFutureDate = selectedDate ? isBefore(today, selectedDate) : false;

  // ═══ ЄДИНЕ ДЖЕРЕЛО ЦИФР — useUnifiedStats ═══
  // Цифри тут гарантовано співпадають із Дашбордом та Ситуаційним центром
  const dayUnified = useMemo(() => selectedDate ? unified.statsForDate(selectedDate) : null, [selectedDate, unified]);
  const dayStats = useMemo(() => ({
    total: dayUnified?.total ?? 0,
    critical: dayUnified?.critical ?? 0,
    personnel: dayUnified?.personnel ?? 0,
    rescued: dayUnified?.rescued ?? 0,
    injured: dayUnified?.injured ?? 0,
  }), [dayUnified]);

  // Monthly summary (count from full events list to be accurate)
  const monthSummary = useMemo(() => {
    let totalInc = 0, totalEvents = 0, archivedEvents = 0, plannedFuture = 0, daysWithInc = 0;
    days.filter(d => isSameMonth(d, currentMonth)).forEach(d => {
      const k = format(d, "yyyy-MM-dd");
      const di = incidentsByDate[k]?.length || 0;
      const allDayEvents = events.filter(e => e.event_date === k);
      const de = allDayEvents.length;
      const dArch = allDayEvents.filter(e => e.is_archived).length;
      const dPlan = allDayEvents.filter(e => !e.is_archived && e.status === "planned").length;
      totalInc += di; totalEvents += de; archivedEvents += dArch; plannedFuture += dPlan;
      if (di > 0) daysWithInc++;
    });
    return { totalInc, totalEvents, archivedEvents, plannedFuture, daysWithInc };
  }, [days, currentMonth, incidentsByDate, events]);

  const openNew = (date?: Date) => {
    setEditing({ ...emptyEvent(), event_date: format(date || selectedDate || new Date(), "yyyy-MM-dd") });
    setDialogOpen(true);
  };
  const openEdit = (ev: CalendarEvent) => { setEditing({ ...ev }); setDialogOpen(true); };
  const handleSave = async () => { setSaving(true); await saveEvent(editing); setSaving(false); setDialogOpen(false); };
  const handleDelete = async (id: string) => { await deleteEvent(id); };
  const setField = (key: string, val: any) => setEditing(prev => ({ ...prev, [key]: val }));

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-lg md:text-xl font-bold tracking-tight" style={{ fontFamily: "Montserrat, sans-serif" }}>
          <CalendarIcon className="inline h-5 w-5 mr-2 text-primary -mt-0.5" />
          Календар та планування
        </h1>
        <div className="flex items-center gap-2">
          <Select value={archiveFilter} onValueChange={(v) => setArchiveFilter(v as ArchiveFilter)}>
            <SelectTrigger className="w-[170px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">📋 Активні</SelectItem>
              <SelectItem value="archived">🗄️ Архів</SelectItem>
              <SelectItem value="all">🌐 Всі події</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => openNew()}>
            <Plus className="h-3.5 w-3.5" /> Нова подія
          </Button>
        </div>
      </div>

      {/* Month summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Інцидентів за місяць", value: monthSummary.totalInc, icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-500/10" },
          { label: "Всього подій", value: monthSummary.totalEvents, icon: FileText, color: "text-primary", bg: "bg-primary/10" },
          { label: "Заплановано", value: monthSummary.plannedFuture, icon: Clock, color: "text-blue-600", bg: "bg-blue-500/10" },
          { label: "В архіві", value: monthSummary.archivedEvents, icon: Archive, color: "text-muted-foreground", bg: "bg-muted" },
          { label: "Днів з інцид.", value: monthSummary.daysWithInc, icon: CalendarIcon, color: "text-emerald-600", bg: "bg-emerald-500/10" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 flex items-center gap-2.5">
              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", s.bg)}>
                <s.icon className={cn("h-4 w-4", s.color)} />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold leading-none">{s.value}</p>
                <p className="text-[10px] text-muted-foreground truncate">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-4">
        {/* ═══ CALENDAR GRID ═══ */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm capitalize">
                {format(currentMonth, "LLLL yyyy", { locale: uk })}
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={() => { setCurrentMonth(new Date()); setSelectedDate(new Date()); }}>
                Сьогодні
              </Button>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {loading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <>
                <div className="grid grid-cols-7 text-center text-[11px] text-muted-foreground font-medium mb-1">
                  {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"].map(d => <div key={d} className="py-1.5">{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-px bg-border/30 rounded-lg overflow-hidden">
                  {days.map((day, i) => {
                    const key = format(day, "yyyy-MM-dd");
                    const dayEvents = eventsByDate[key] || [];
                    const dayIncidents = incidentsByDate[key] || [];
                    const hasCritical = dayIncidents.some(inc => inc.severity === "Critical");
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isToday = isSameDay(day, new Date());
                    const isPast = isBefore(day, today);

                    return (
                      <button
                        key={i}
                        onClick={() => { setSelectedDate(day); if (dayIncidents.length > 0) setActiveTab("incidents"); else if (dayEvents.length > 0) setActiveTab("events"); }}
                        className={cn(
                          "relative min-h-[68px] md:min-h-[78px] flex flex-col items-start p-1.5 text-sm transition-all bg-background",
                          !isCurrentMonth && "bg-muted/30 text-muted-foreground/40",
                          isSelected && "bg-primary/10 ring-2 ring-primary ring-inset z-10",
                          isToday && !isSelected && "bg-accent/60",
                          hasCritical && !isSelected && "bg-destructive/5",
                          isPast && !isToday && isCurrentMonth && "opacity-90",
                          "hover:bg-muted/50"
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className={cn(
                            "text-xs leading-none",
                            isToday && "font-bold text-primary",
                            isSelected && "font-bold",
                            isPast && !isToday && "text-muted-foreground"
                          )}>
                            {format(day, "d")}
                          </span>
                          {isToday && <span className="h-1 w-1 rounded-full bg-primary" />}
                        </div>

                        <div className="flex flex-col gap-0.5 w-full mt-1">
                          {dayIncidents.length > 0 && (
                            <div className={cn("text-[8px] leading-tight rounded px-1 py-0.5 truncate", hasCritical ? "bg-destructive/15 text-destructive font-medium" : "bg-orange-500/10 text-orange-600")}>
                              {hasCritical && "⚠ "}{dayIncidents.length} інц.
                            </div>
                          )}
                          {dayEvents.length > 0 && (
                            <div className={cn(
                              "text-[8px] leading-tight rounded px-1 py-0.5 truncate",
                              dayEvents.some(e => e.is_archived) && !dayEvents.some(e => !e.is_archived)
                                ? "bg-muted text-muted-foreground"
                                : "bg-primary/10 text-primary"
                            )}>
                              {dayEvents.length} под.
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-3 mt-3 pt-2 border-t flex-wrap">
                  <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-destructive" /><span className="text-[10px] text-muted-foreground">Критичні</span></div>
                  <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-orange-500" /><span className="text-[10px] text-muted-foreground">Інциденти</span></div>
                  <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary" /><span className="text-[10px] text-muted-foreground">Активні події</span></div>
                  <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-muted-foreground/50" /><span className="text-[10px] text-muted-foreground">Архів</span></div>
                  <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" /><span className="text-[10px] text-muted-foreground">Сьогодні</span></div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ═══ RIGHT PANEL ═══ */}
        <div className="space-y-3">
          {/* Date header */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">
                      {selectedDate ? format(selectedDate, "d MMMM yyyy", { locale: uk }) : "Оберіть день"}
                    </p>
                    {isPastDate && <Badge variant="outline" className="text-[9px] gap-0.5 h-4"><History className="h-2.5 w-2.5" />Архів</Badge>}
                    {isFutureDate && <Badge variant="outline" className="text-[9px] gap-0.5 h-4 border-blue-300 text-blue-700"><Clock className="h-2.5 w-2.5" />Майбутнє</Badge>}
                  </div>
                  {selectedDate && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {selectedIncidents.length} інцидентів • {selectedEvents.length} подій
                    </p>
                  )}
                </div>
                <Button size="sm" variant={isPastDate ? "outline" : "default"} className="gap-1 h-7 text-[10px] shrink-0" onClick={() => openNew()}>
                  <Plus className="h-3 w-3" /> {isPastDate ? "Звіт" : "Подія"}
                </Button>
              </div>

              {/* Day stats */}
              {selectedIncidents.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t">
                  {[
                    { label: "Інцид.", value: dayStats.total, color: "text-orange-500" },
                    { label: "Крит.", value: dayStats.critical, color: "text-destructive" },
                    { label: "Персонал", value: dayStats.personnel, color: "text-primary" },
                    { label: "Врятовано", value: dayStats.rescued, color: "text-emerald-600" },
                  ].map(s => (
                    <div key={s.label} className="text-center">
                      <p className={cn("text-sm font-bold leading-none", s.color)}>{s.value}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ═══ АВТО-ЗВЕДЕННЯ З СИТ. ЦЕНТРУ — синхронізовано з дашбордом ═══ */}
          {selectedDate && dayUnified && dayUnified.total > 0 && (
            <Card className="border-l-4 border-l-primary bg-gradient-to-br from-primary/5 to-transparent">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="h-6 w-6 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
                      <Link2 className="h-3 w-3 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold leading-tight">Авто-зведення</p>
                      <p className="text-[9px] text-muted-foreground leading-tight">З ситуаційного центру</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[8px] gap-0.5 h-4 border-emerald-300 text-emerald-700 bg-emerald-500/10">
                    <Activity className="h-2.5 w-2.5" /> live
                  </Badge>
                </div>

                {/* Розподіл по службах */}
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <div className="flex items-center justify-between text-[10px] px-2 py-1 rounded bg-red-500/10 border border-red-500/20">
                    <span className="flex items-center gap-1 text-red-700"><Flame className="h-2.5 w-2.5" />ДСНС</span>
                    <span className="font-bold text-red-700">{dayUnified.byService.ses}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20">
                    <span className="flex items-center gap-1 text-blue-700"><Phone className="h-2.5 w-2.5" />Поліція</span>
                    <span className="font-bold text-blue-700">{dayUnified.byService.police}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
                    <span className="flex items-center gap-1 text-emerald-700"><Shield className="h-2.5 w-2.5" />Медицина</span>
                    <span className="font-bold text-emerald-700">{dayUnified.byService.medical}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] px-2 py-1 rounded bg-purple-500/10 border border-purple-500/20">
                    <span className="flex items-center gap-1 text-purple-700"><ShieldCheck className="h-2.5 w-2.5" />Комбін.</span>
                    <span className="font-bold text-purple-700">{dayUnified.byService.combined}</span>
                  </div>
                </div>

                {/* Підсумкові ресурси */}
                <div className="grid grid-cols-3 gap-1 text-center pt-1 border-t">
                  <div>
                    <p className="text-xs font-bold text-primary leading-none">{dayUnified.ses_units + dayUnified.police_units + dayUnified.medical_units}</p>
                    <p className="text-[8px] text-muted-foreground mt-0.5">Підрозділів</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-orange-600 leading-none">{dayUnified.personnel}</p>
                    <p className="text-[8px] text-muted-foreground mt-0.5">Особовий склад</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-destructive leading-none">{dayUnified.fatalities}</p>
                    <p className="text-[8px] text-muted-foreground mt-0.5">Загиблих</p>
                  </div>
                </div>

                {/* Створити звіт у календарі на основі цих даних */}
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-[10px] gap-1 mt-1"
                  onClick={() => {
                    const ses = dayUnified.byService.ses > 0;
                    const pol = dayUnified.byService.police > 0;
                    setEditing({
                      ...emptyEvent(),
                      event_date: format(selectedDate, "yyyy-MM-dd"),
                      title: `Зведення за ${format(selectedDate, "d MMMM yyyy", { locale: uk })}`,
                      description: `Авто-сформовано з даних Сит. центру.\nІнцидентів: ${dayUnified.total}, критичних: ${dayUnified.critical}.\nВрятовано: ${dayUnified.rescued}, поранено: ${dayUnified.injured}, загинуло: ${dayUnified.fatalities}.`,
                      service_ses: ses,
                      service_police: pol,
                      ses_people_rescued: dayUnified.rescued,
                      ses_personnel_involved: dayUnified.personnel,
                      ses_fires_extinguished: dayUnified.byType["Fire"] || 0,
                      police_calls: dayUnified.byService.police,
                      status: "completed",
                    });
                    setDialogOpen(true);
                  }}
                >
                  <FileText className="h-3 w-3" /> Створити звіт зі зведення
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Tabs */}
          {selectedDate && (
            <Card className="flex flex-col" style={{ maxHeight: "calc(100vh - 380px)" }}>
              <CardHeader className="pb-0 pt-3 px-3 flex-shrink-0">
                <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)}>
                  <TabsList className="grid grid-cols-2 h-8">
                    <TabsTrigger value="incidents" className="text-[10px] gap-1">
                      <AlertTriangle className="h-3 w-3" /> Інциденти ({selectedIncidents.length})
                    </TabsTrigger>
                    <TabsTrigger value="events" className="text-[10px] gap-1">
                      <FileText className="h-3 w-3" /> Події ({selectedEvents.length})
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full px-3 pb-3 pt-2" style={{ maxHeight: "calc(100vh - 480px)" }}>
                  {/* INCIDENTS */}
                  {activeTab === "incidents" && (
                    selectedIncidents.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">Немає інцидентів</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedIncidents.map(inc => {
                          const sev = SEVERITY_CONFIG[inc.severity];
                          const sta = STATUS_CONFIG[inc.status];
                          return (
                            <div key={inc.id} className="p-3 rounded-lg border bg-card space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className={cn("h-2 w-2 rounded-full shrink-0", sev?.color?.replace("text-", "bg-") || "bg-muted-foreground")} />
                                    <p className="font-medium text-xs truncate">{inc.title}</p>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                    <MapPin className="h-2.5 w-2.5" />{inc.regionName} • {INCIDENT_TYPE_LABELS[inc.type]}
                                  </p>
                                </div>
                                <Badge variant="outline" className={cn("text-[9px] shrink-0", sev?.bgColor)}>{sev?.label || inc.severity}</Badge>
                              </div>

                              {inc.description && <p className="text-[10px] text-muted-foreground line-clamp-2">{inc.description}</p>}

                              <div className="flex items-center gap-3 text-[10px]">
                                {inc.resources.ses_units > 0 && <span className="text-red-600">ДСНС: {inc.resources.ses_units}</span>}
                                {inc.resources.police_units > 0 && <span className="text-blue-600">Поліція: {inc.resources.police_units}</span>}
                                {inc.resources.medical_units > 0 && <span className="text-emerald-600">Медичні: {inc.resources.medical_units}</span>}
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t">
                                <span>{inc.resources.personnel_total} ос.</span>
                                <span className={sta?.color}>● {sta?.label || inc.status}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}

                  {/* EVENTS */}
                  {activeTab === "events" && (
                    selectedEvents.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-xs text-muted-foreground mb-2">
                          {archiveFilter === "archived" ? "Немає архівних подій" : "Немає подій"}
                        </p>
                        <Button size="sm" variant="outline" className="gap-1 h-7 text-[10px]" onClick={() => openNew()}>
                          <Plus className="h-3 w-3" /> {isPastDate ? "Додати звіт" : "Запланувати"}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedEvents.map(ev => {
                          const statusMeta = STATUS_META[ev.status] || STATUS_META.planned;
                          const StatusIcon = statusMeta.icon;
                          return (
                            <div key={ev.id} className={cn("p-3 rounded-lg border bg-card space-y-2", ev.is_archived && "opacity-75 border-dashed")}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="font-medium text-xs">{ev.title || "Без назви"}</p>
                                    <Badge variant="outline" className={cn("text-[8px] gap-0.5 h-4", statusMeta.color)}>
                                      <StatusIcon className="h-2.5 w-2.5" />{statusMeta.label}
                                    </Badge>
                                    {ev.is_archived && (
                                      <Badge variant="outline" className="text-[8px] gap-0.5 h-4 bg-muted text-muted-foreground">
                                        <Archive className="h-2.5 w-2.5" />Архів
                                      </Badge>
                                    )}
                                  </div>
                                  {ev.event_time && <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5"><Clock className="h-2.5 w-2.5" />{ev.event_time}</p>}
                                  {ev.location && <p className="text-[10px] text-muted-foreground flex items-center gap-1"><MapPin className="h-2.5 w-2.5" />{ev.location}</p>}
                                </div>
                                <div className="flex gap-0.5 shrink-0">
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(ev)} title="Редагувати"><Pencil className="h-3 w-3" /></Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => archiveEvent(ev.id, !ev.is_archived)}
                                    title={ev.is_archived ? "Відновити" : "В архів"}
                                  >
                                    {ev.is_archived ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDelete(ev.id)} title="Видалити"><Trash2 className="h-3 w-3" /></Button>
                                </div>
                              </div>

                              {ev.description && <p className="text-[10px] text-muted-foreground">{ev.description}</p>}

                              <div className="flex gap-1 flex-wrap">
                                {ev.service_ses && <Badge variant="outline" className="text-[8px] border-red-300 text-red-700">ДСНС</Badge>}
                                {ev.service_police && <Badge variant="outline" className="text-[8px] border-blue-300 text-blue-700">Поліція</Badge>}
                                {ev.service_national_guard && <Badge variant="outline" className="text-[8px] border-emerald-300 text-emerald-700">НГУ</Badge>}
                                {ev.service_other && <Badge variant="outline" className="text-[8px]">{ev.service_other}</Badge>}
                              </div>

                              {ev.service_ses && (ev.ses_people_rescued > 0 || ev.ses_fires_extinguished > 0 || ev.ses_personnel_involved > 0) && (
                                <div className="flex gap-3 text-[10px] text-red-600 bg-red-50/50 dark:bg-red-950/10 rounded px-2 py-1">
                                  <span>Врят: {ev.ses_people_rescued}</span>
                                  <span>Пожеж: {ev.ses_fires_extinguished}</span>
                                  <span>Ос: {ev.ses_personnel_involved}</span>
                                </div>
                              )}
                              {ev.service_police && (ev.police_calls > 0 || ev.police_arrests > 0 || ev.police_patrols_deployed > 0) && (
                                <div className="flex gap-3 text-[10px] text-blue-600 bg-blue-50/50 dark:bg-blue-950/10 rounded px-2 py-1">
                                  <span>Викл: {ev.police_calls}</span>
                                  <span>Затр: {ev.police_arrests}</span>
                                  <span>Патр: {ev.police_patrols_deployed}</span>
                                </div>
                              )}
                              {ev.service_national_guard && (ev.ng_personnel_deployed > 0 || ev.ng_equipment_units > 0) && (
                                <div className="flex gap-3 text-[10px] text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/10 rounded px-2 py-1">
                                  <span>Ос: {ev.ng_personnel_deployed}</span>
                                  <span>Техн: {ev.ng_equipment_units}</span>
                                  <span>Опер: {ev.ng_operations_conducted}</span>
                                </div>
                              )}

                              {!ev.is_archived && ev.status === "planned" && (
                                <div className="flex gap-1 pt-1 border-t">
                                  <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 flex-1" onClick={() => setEventStatus(ev.id, "completed")}>
                                    <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Виконано
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 flex-1" onClick={() => setEventStatus(ev.id, "cancelled")}>
                                    <XCircle className="h-3 w-3 text-muted-foreground" /> Скасувати
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Service summary for selected day */}
          {selectedDate && selectedIncidents.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "ДСНС", icon: Flame, color: "border-l-red-500", count: selectedIncidents.filter(i => i.category === "SES" || i.resources.ses_units > 0).length },
                { label: "Поліція", icon: Phone, color: "border-l-blue-500", count: selectedIncidents.filter(i => i.category === "Police" || i.resources.police_units > 0).length },
                { label: "Медики", icon: Shield, color: "border-l-emerald-500", count: selectedIncidents.filter(i => i.category === "Medical" || i.resources.medical_units > 0).length },
              ].map(s => (
                <Card key={s.label} className={cn("border-l-4", s.color)}>
                  <CardContent className="p-2.5 text-center">
                    <s.icon className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xs font-bold">{s.count}</p>
                    <p className="text-[8px] text-muted-foreground">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══ EVENT EDITOR DIALOG ═══ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editing.id ? <><Pencil className="h-4 w-4" /> Редагувати подію</> : <><Plus className="h-4 w-4" /> Нова подія</>}
              {editing.is_archived && <Badge variant="outline" className="text-[10px] gap-0.5"><Archive className="h-2.5 w-2.5" />Архів</Badge>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Назва</label>
              <Input value={editing.title || ""} onChange={e => setField("title", e.target.value)} placeholder="Назва події або звіту" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><label className="text-xs font-medium">Дата</label><Input type="date" value={editing.event_date || ""} onChange={e => setField("event_date", e.target.value)} /></div>
              <div className="space-y-1.5"><label className="text-xs font-medium">Час</label><Input type="time" value={editing.event_time || ""} onChange={e => setField("event_time", e.target.value || null)} /></div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Статус</label>
                <Select value={editing.status || "planned"} onValueChange={v => setField("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Заплановано</SelectItem>
                    <SelectItem value="completed">Виконано</SelectItem>
                    <SelectItem value="cancelled">Скасовано</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><label className="text-xs font-medium">Місце</label><Input value={editing.location || ""} onChange={e => setField("location", e.target.value)} placeholder="Локація" /></div>
            <div className="space-y-1.5"><label className="text-xs font-medium">Опис / Звіт / Нотатки</label><Textarea value={editing.description || ""} onChange={e => setField("description", e.target.value)} rows={3} placeholder="Опис, звіт, нотатки..." /></div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Залучені служби</label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-xs"><Checkbox checked={editing.service_ses || false} onCheckedChange={c => setField("service_ses", !!c)} /> ДСНС</label>
                <label className="flex items-center gap-2 text-xs"><Checkbox checked={editing.service_police || false} onCheckedChange={c => setField("service_police", !!c)} /> Поліція</label>
                <label className="flex items-center gap-2 text-xs"><Checkbox checked={editing.service_national_guard || false} onCheckedChange={c => setField("service_national_guard", !!c)} /> НГУ</label>
              </div>
              <Input placeholder="Інше..." value={editing.service_other || ""} onChange={e => setField("service_other", e.target.value)} className="mt-1" />
            </div>

            {editing.service_ses && (
              <Card className="border-red-200"><CardHeader className="py-2 px-3"><CardTitle className="text-xs text-red-700">ДСНС — деталі</CardTitle></CardHeader>
                <CardContent className="px-3 pb-3 grid grid-cols-2 gap-2">
                  <div className="space-y-1"><label className="text-[10px]">Врятовано</label><Input type="number" min={0} value={editing.ses_people_rescued || 0} onChange={e => setField("ses_people_rescued", +e.target.value)} className="h-8" /></div>
                  <div className="space-y-1"><label className="text-[10px]">Пожеж лікв.</label><Input type="number" min={0} value={editing.ses_fires_extinguished || 0} onChange={e => setField("ses_fires_extinguished", +e.target.value)} className="h-8" /></div>
                  <div className="space-y-1"><label className="text-[10px]">Персонал</label><Input type="number" min={0} value={editing.ses_personnel_involved || 0} onChange={e => setField("ses_personnel_involved", +e.target.value)} className="h-8" /></div>
                  <div className="space-y-1"><label className="text-[10px]">Техніка</label><Input value={editing.ses_equipment_used || ""} onChange={e => setField("ses_equipment_used", e.target.value)} className="h-8" /></div>
                </CardContent>
              </Card>
            )}

            {editing.service_police && (
              <Card className="border-blue-200"><CardHeader className="py-2 px-3"><CardTitle className="text-xs text-blue-700">Поліція — деталі</CardTitle></CardHeader>
                <CardContent className="px-3 pb-3 grid grid-cols-2 gap-2">
                  <div className="space-y-1"><label className="text-[10px]">Виклики</label><Input type="number" min={0} value={editing.police_calls || 0} onChange={e => setField("police_calls", +e.target.value)} className="h-8" /></div>
                  <div className="space-y-1"><label className="text-[10px]">Затримання</label><Input type="number" min={0} value={editing.police_arrests || 0} onChange={e => setField("police_arrests", +e.target.value)} className="h-8" /></div>
                  <div className="space-y-1"><label className="text-[10px]">Протоколів</label><Input type="number" min={0} value={editing.police_reports_filed || 0} onChange={e => setField("police_reports_filed", +e.target.value)} className="h-8" /></div>
                  <div className="space-y-1"><label className="text-[10px]">Патрулів</label><Input type="number" min={0} value={editing.police_patrols_deployed || 0} onChange={e => setField("police_patrols_deployed", +e.target.value)} className="h-8" /></div>
                </CardContent>
              </Card>
            )}

            {editing.service_national_guard && (
              <Card className="border-emerald-200"><CardHeader className="py-2 px-3"><CardTitle className="text-xs text-emerald-700">НГУ — деталі</CardTitle></CardHeader>
                <CardContent className="px-3 pb-3 grid grid-cols-2 gap-2">
                  <div className="space-y-1"><label className="text-[10px]">Персоналу</label><Input type="number" min={0} value={editing.ng_personnel_deployed || 0} onChange={e => setField("ng_personnel_deployed", +e.target.value)} className="h-8" /></div>
                  <div className="space-y-1"><label className="text-[10px]">Техніки</label><Input type="number" min={0} value={editing.ng_equipment_units || 0} onChange={e => setField("ng_equipment_units", +e.target.value)} className="h-8" /></div>
                  <div className="space-y-1"><label className="text-[10px]">Операцій</label><Input type="number" min={0} value={editing.ng_operations_conducted || 0} onChange={e => setField("ng_operations_conducted", +e.target.value)} className="h-8" /></div>
                </CardContent>
              </Card>
            )}
          </div>
          <DialogFooter className="gap-2">
            {editing.id && (
              <Button
                variant="outline"
                onClick={() => { archiveEvent(editing.id!, !editing.is_archived); setDialogOpen(false); }}
                className="gap-1.5 mr-auto"
              >
                {editing.is_archived ? <><ArchiveRestore className="h-3.5 w-3.5" /> Відновити</> : <><Archive className="h-3.5 w-3.5" /> В архів</>}
              </Button>
            )}
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Скасувати</Button>
            <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Зберегти</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarPage;
