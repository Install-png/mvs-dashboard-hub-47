import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, startOfDay } from "date-fns";
import { uk } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useCalendarEvents, CalendarEvent, emptyEvent } from "@/hooks/useCalendarEvents";
import { useIncidentStore } from "@/stores/useIncidentStore";
import { useIncidents } from "@/hooks/useIncidents";
import { SEVERITY_CONFIG, STATUS_CONFIG, INCIDENT_TYPE_LABELS } from "@/data/mockIncidents";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Loader2, AlertTriangle, Flame, Shield, Phone, Users, MapPin, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const CalendarPage = () => {
  const { events, loading, saveEvent, deleteEvent } = useCalendarEvents();
  const { incidents } = useIncidentStore();
  useIncidents();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<CalendarEvent>>(emptyEvent());
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"incidents" | "events">("incidents");

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

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach((e) => { const key = e.event_date; if (!map[key]) map[key] = []; map[key].push(e); });
    return map;
  }, [events]);

  const incidentsByDate = useMemo(() => {
    const map: Record<string, typeof incidents> = {};
    incidents.forEach((inc) => {
      const key = format(new Date(inc.timestamp), "yyyy-MM-dd");
      if (!map[key]) map[key] = [];
      map[key].push(inc);
    });
    return map;
  }, [incidents]);

  const selectedDateKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
  const selectedEvents = selectedDate ? eventsByDate[selectedDateKey] || [] : [];
  const selectedIncidents = selectedDate ? incidentsByDate[selectedDateKey] || [] : [];

  // Stats for selected day
  const dayStats = useMemo(() => {
    const incs = selectedIncidents;
    return {
      total: incs.length,
      critical: incs.filter(i => i.severity === "Critical" || i.severity === "High").length,
      personnel: incs.reduce((s, i) => s + i.resources.personnel_total, 0),
      rescued: incs.reduce((s, i) => s + i.impact.rescued, 0),
      injured: incs.reduce((s, i) => s + i.impact.injured, 0),
      ses: incs.filter(i => i.category === "SES" || i.resources.ses_units > 0).length,
      police: incs.filter(i => i.category === "Police" || i.resources.police_units > 0).length,
      medical: incs.filter(i => i.category === "Medical" || i.resources.medical_units > 0).length,
    };
  }, [selectedIncidents]);

  const openNew = (date?: Date) => {
    setEditing({ ...emptyEvent(), event_date: format(date || selectedDate || new Date(), "yyyy-MM-dd") });
    setDialogOpen(true);
  };
  const openEdit = (ev: CalendarEvent) => { setEditing({ ...ev }); setDialogOpen(true); };
  const handleSave = async () => { setSaving(true); await saveEvent(editing); setSaving(false); setDialogOpen(false); };
  const handleDelete = async (id: string) => { await deleteEvent(id); };
  const setField = (key: string, val: any) => setEditing((prev) => ({ ...prev, [key]: val }));

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <h1 className="text-xl md:text-2xl font-bold" style={{ fontFamily: "Montserrat, sans-serif" }}>
        Календар подій та інцидентів
      </h1>

      <div className="grid lg:grid-cols-[1fr_380px] gap-4">
        {/* Calendar Grid */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <CardTitle className="text-base capitalize">
                {format(currentMonth, "LLLL yyyy", { locale: uk })}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <>
                  <div className="grid grid-cols-7 text-center text-xs text-muted-foreground font-medium mb-1">
                    {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"].map((d) => (
                      <div key={d} className="py-1">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5">
                    {days.map((day, i) => {
                      const key = format(day, "yyyy-MM-dd");
                      const dayEvents = eventsByDate[key] || [];
                      const dayIncidents = incidentsByDate[key] || [];
                      const hasCritical = dayIncidents.some(inc => inc.severity === "Critical");
                      const isSelected = selectedDate && isSameDay(day, selectedDate);
                      const isCurrentMonth = isSameMonth(day, currentMonth);
                      const isToday = isSameDay(day, new Date());
                      return (
                        <button
                          key={i}
                          onClick={() => setSelectedDate(day)}
                          className={cn(
                            "relative aspect-square flex flex-col items-center justify-start p-1 rounded-lg text-sm transition-all",
                            !isCurrentMonth && "text-muted-foreground/40",
                            isSelected && "bg-primary/10 ring-2 ring-primary shadow-sm",
                            isToday && !isSelected && "bg-accent",
                            hasCritical && !isSelected && "bg-destructive/5",
                            "hover:bg-muted"
                          )}
                        >
                          <span className={cn("text-xs leading-none", isToday && "font-bold text-primary")}>
                            {format(day, "d")}
                          </span>
                          <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                            {dayIncidents.length > 0 && (
                              <span className={cn("h-1.5 w-1.5 rounded-full", hasCritical ? "bg-destructive" : "bg-orange-400")} />
                            )}
                            {dayEvents.length > 0 && (
                              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                            )}
                          </div>
                          {dayIncidents.length > 0 && isCurrentMonth && (
                            <span className="text-[8px] text-muted-foreground leading-none mt-0.5">{dayIncidents.length}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {/* Legend */}
                  <div className="flex items-center gap-4 mt-3 pt-2 border-t border-border">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-destructive" />
                      <span className="text-[10px] text-muted-foreground">Критичні</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-orange-400" />
                      <span className="text-[10px] text-muted-foreground">Інциденти</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-primary" />
                      <span className="text-[10px] text-muted-foreground">Події</span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Day summary stats */}
          {selectedDate && selectedIncidents.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { label: "Інцидентів", value: dayStats.total, icon: AlertTriangle, color: "text-orange-500" },
                { label: "Критичних", value: dayStats.critical, icon: Flame, color: "text-destructive" },
                { label: "Персоналу", value: dayStats.personnel, icon: Users, color: "text-primary" },
                { label: "Врятовано", value: dayStats.rescued, icon: Shield, color: "text-green-600" },
              ].map((s) => (
                <Card key={s.label}>
                  <CardContent className="p-3 flex items-center gap-2.5">
                    <s.icon className={cn("h-4 w-4 shrink-0", s.color)} />
                    <div>
                      <p className="text-lg font-bold text-foreground leading-none">{s.value}</p>
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Right panel: Day details */}
        <Card className="h-fit lg:max-h-[calc(100vh-180px)] flex flex-col">
          <CardHeader className="pb-2 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-sm">
                {selectedDate ? format(selectedDate, "d MMMM yyyy", { locale: uk }) : "Оберіть день"}
              </CardTitle>
              {selectedDate && (
                <Button size="sm" variant="outline" className="gap-1 h-7 text-[11px]" onClick={() => openNew()}>
                  <Plus className="h-3 w-3" /> Подія
                </Button>
              )}
            </div>
            {selectedDate && (selectedIncidents.length > 0 || selectedEvents.length > 0) && (
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <TabsList className="grid grid-cols-2 h-8">
                  <TabsTrigger value="incidents" className="text-[11px] gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Інциденти ({selectedIncidents.length})
                  </TabsTrigger>
                  <TabsTrigger value="events" className="text-[11px] gap-1">
                    <Clock className="h-3 w-3" />
                    Події ({selectedEvents.length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            {!selectedDate ? (
              <p className="text-sm text-muted-foreground text-center py-8 px-4">Натисніть на день у календарі</p>
            ) : (
              <ScrollArea className="h-full max-h-[500px] px-4 pb-4">
                {/* Incidents tab */}
                {activeTab === "incidents" && (
                  selectedIncidents.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Немає інцидентів за цей день</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedIncidents.map((inc) => {
                        const sev = SEVERITY_CONFIG[inc.severity];
                        const sta = STATUS_CONFIG[inc.status];
                        return (
                          <div key={inc.id} className="p-3 rounded-lg bg-muted/50 border border-border/50 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className={cn("h-2 w-2 rounded-full shrink-0", sev?.color?.replace("text-", "bg-") || "bg-muted-foreground")} />
                                  <p className="font-medium text-xs truncate">{inc.title}</p>
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                  <MapPin className="h-3 w-3" />
                                  <span>{inc.regionName}</span>
                                  <span>•</span>
                                  <span>{INCIDENT_TYPE_LABELS[inc.type]}</span>
                                </div>
                              </div>
                              <Badge variant="outline" className={cn("text-[9px] shrink-0", sev?.bgColor)}>
                                {sev?.label || inc.severity}
                              </Badge>
                            </div>

                            {inc.description && (
                              <p className="text-[11px] text-muted-foreground line-clamp-2">{inc.description}</p>
                            )}

                            <div className="grid grid-cols-3 gap-1.5">
                              {inc.resources.ses_units > 0 && (
                                <div className="bg-red-50 dark:bg-red-950/20 rounded px-2 py-1 text-center">
                                  <p className="text-xs font-medium text-red-700 dark:text-red-400">{inc.resources.ses_units}</p>
                                  <p className="text-[9px] text-red-600/70 dark:text-red-500/70">ДСНС</p>
                                </div>
                              )}
                              {inc.resources.police_units > 0 && (
                                <div className="bg-blue-50 dark:bg-blue-950/20 rounded px-2 py-1 text-center">
                                  <p className="text-xs font-medium text-blue-700 dark:text-blue-400">{inc.resources.police_units}</p>
                                  <p className="text-[9px] text-blue-600/70 dark:text-blue-500/70">Поліція</p>
                                </div>
                              )}
                              {inc.resources.medical_units > 0 && (
                                <div className="bg-green-50 dark:bg-green-950/20 rounded px-2 py-1 text-center">
                                  <p className="text-xs font-medium text-green-700 dark:text-green-400">{inc.resources.medical_units}</p>
                                  <p className="text-[9px] text-green-600/70 dark:text-green-500/70">Медична</p>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/30">
                              <span>{inc.resources.personnel_total} ос. задіяно</span>
                              <span className={sta?.color}>● {sta?.label || inc.status}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}

                {/* Events tab */}
                {activeTab === "events" && (
                  selectedEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Немає подій на цей день</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedEvents.map((ev) => (
                        <div key={ev.id} className="p-3 rounded-lg bg-muted/50 border border-border/50 space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-xs">{ev.title || "Без назви"}</p>
                              {ev.event_time && <p className="text-[10px] text-muted-foreground">{ev.event_time}</p>}
                              {ev.location && (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <MapPin className="h-2.5 w-2.5 text-muted-foreground" />
                                  <p className="text-[10px] text-muted-foreground">{ev.location}</p>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(ev)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDelete(ev.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          {ev.description && (
                            <p className="text-[11px] text-muted-foreground">{ev.description}</p>
                          )}

                          <div className="flex gap-1 flex-wrap">
                            {ev.service_ses && <Badge variant="outline" className="text-[9px] border-red-300 text-red-700">ДСНС</Badge>}
                            {ev.service_police && <Badge variant="outline" className="text-[9px] border-blue-300 text-blue-700">Поліція</Badge>}
                            {ev.service_national_guard && <Badge variant="outline" className="text-[9px] border-green-300 text-green-700">Нацгвардія</Badge>}
                          </div>

                          {/* Service details */}
                          {ev.service_ses && (ev.ses_people_rescued > 0 || ev.ses_fires_extinguished > 0 || ev.ses_personnel_involved > 0) && (
                            <div className="grid grid-cols-3 gap-1 text-center bg-red-50/50 dark:bg-red-950/10 rounded p-1.5">
                              <div><p className="text-xs font-medium">{ev.ses_people_rescued}</p><p className="text-[8px] text-muted-foreground">Врятовано</p></div>
                              <div><p className="text-xs font-medium">{ev.ses_fires_extinguished}</p><p className="text-[8px] text-muted-foreground">Пожеж лікв.</p></div>
                              <div><p className="text-xs font-medium">{ev.ses_personnel_involved}</p><p className="text-[8px] text-muted-foreground">Персонал</p></div>
                            </div>
                          )}
                          {ev.service_police && (ev.police_calls > 0 || ev.police_arrests > 0) && (
                            <div className="grid grid-cols-3 gap-1 text-center bg-blue-50/50 dark:bg-blue-950/10 rounded p-1.5">
                              <div><p className="text-xs font-medium">{ev.police_calls}</p><p className="text-[8px] text-muted-foreground">Виклики</p></div>
                              <div><p className="text-xs font-medium">{ev.police_arrests}</p><p className="text-[8px] text-muted-foreground">Затримання</p></div>
                              <div><p className="text-xs font-medium">{ev.police_patrols_deployed}</p><p className="text-[8px] text-muted-foreground">Патрулі</p></div>
                            </div>
                          )}
                          {ev.service_national_guard && (ev.ng_personnel_deployed > 0 || ev.ng_operations_conducted > 0) && (
                            <div className="grid grid-cols-3 gap-1 text-center bg-green-50/50 dark:bg-green-950/10 rounded p-1.5">
                              <div><p className="text-xs font-medium">{ev.ng_personnel_deployed}</p><p className="text-[8px] text-muted-foreground">Персонал</p></div>
                              <div><p className="text-xs font-medium">{ev.ng_equipment_units}</p><p className="text-[8px] text-muted-foreground">Техніка</p></div>
                              <div><p className="text-xs font-medium">{ev.ng_operations_conducted}</p><p className="text-[8px] text-muted-foreground">Операцій</p></div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                )}
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Service breakdown for selected day */}
      {selectedDate && selectedIncidents.length > 0 && (
        <div className="grid md:grid-cols-3 gap-3">
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Flame className="h-4 w-4 text-red-500" />
                <span className="text-xs font-bold">ДСНС</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Інцидентів:</span> <span className="font-medium">{dayStats.ses}</span></div>
                <div><span className="text-muted-foreground">Підрозділів:</span> <span className="font-medium">{selectedIncidents.reduce((s, i) => s + i.resources.ses_units, 0)}</span></div>
                <div><span className="text-muted-foreground">Врятовано:</span> <span className="font-medium">{selectedIncidents.filter(i => i.category === "SES").reduce((s, i) => s + i.impact.rescued, 0)}</span></div>
                <div><span className="text-muted-foreground">Персонал:</span> <span className="font-medium">{selectedIncidents.filter(i => i.category === "SES").reduce((s, i) => s + i.resources.personnel_total, 0)}</span></div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Phone className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-bold">Поліція</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Інцидентів:</span> <span className="font-medium">{dayStats.police}</span></div>
                <div><span className="text-muted-foreground">Патрулів:</span> <span className="font-medium">{selectedIncidents.reduce((s, i) => s + i.resources.police_units, 0)}</span></div>
                <div><span className="text-muted-foreground">Затримань:</span> <span className="font-medium">{selectedIncidents.filter(i => i.category === "Police" && i.status === "Containment").length}</span></div>
                <div><span className="text-muted-foreground">Персонал:</span> <span className="font-medium">{selectedIncidents.filter(i => i.category === "Police").reduce((s, i) => s + i.resources.personnel_total, 0)}</span></div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-green-500" />
                <span className="text-xs font-bold">Медична служба</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Подій:</span> <span className="font-medium">{dayStats.medical}</span></div>
                <div><span className="text-muted-foreground">Бригад:</span> <span className="font-medium">{selectedIncidents.reduce((s, i) => s + i.resources.medical_units, 0)}</span></div>
                <div><span className="text-muted-foreground">Постраждалих:</span> <span className="font-medium">{dayStats.injured}</span></div>
                <div><span className="text-muted-foreground">Персонал:</span> <span className="font-medium">{selectedIncidents.filter(i => i.category === "Medical").reduce((s, i) => s + i.resources.personnel_total, 0)}</span></div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Event Editor Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing.id ? "Редагувати подію" : "Нова подія"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Назва</label>
              <Input value={editing.title || ""} onChange={(e) => setField("title", e.target.value)} placeholder="Назва події" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Дата</label>
                <Input type="date" value={editing.event_date || ""} onChange={(e) => setField("event_date", e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Час</label>
                <Input type="time" value={editing.event_time || ""} onChange={(e) => setField("event_time", e.target.value || null)} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Місцезнаходження</label>
              <Input value={editing.location || ""} onChange={(e) => setField("location", e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Опис</label>
              <Textarea value={editing.description || ""} onChange={(e) => setField("description", e.target.value)} rows={2} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Залучені служби</label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={editing.service_ses || false} onCheckedChange={(c) => setField("service_ses", !!c)} /> ДСНС
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={editing.service_police || false} onCheckedChange={(c) => setField("service_police", !!c)} /> Поліція
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={editing.service_national_guard || false} onCheckedChange={(c) => setField("service_national_guard", !!c)} /> Нацгвардія
                </label>
              </div>
              <Input placeholder="Інше..." value={editing.service_other || ""} onChange={(e) => setField("service_other", e.target.value)} />
            </div>

            {editing.service_ses && (
              <Card className="border-red-200">
                <CardHeader className="py-2 px-4"><CardTitle className="text-sm text-red-700">ДСНС — деталі</CardTitle></CardHeader>
                <CardContent className="px-4 pb-3 grid grid-cols-2 gap-3">
                  <div className="space-y-1"><label className="text-xs">Врятовано людей</label><Input type="number" min={0} value={editing.ses_people_rescued || 0} onChange={(e) => setField("ses_people_rescued", +e.target.value)} /></div>
                  <div className="space-y-1"><label className="text-xs">Пожеж ліквідовано</label><Input type="number" min={0} value={editing.ses_fires_extinguished || 0} onChange={(e) => setField("ses_fires_extinguished", +e.target.value)} /></div>
                  <div className="space-y-1"><label className="text-xs">Задіяного персоналу</label><Input type="number" min={0} value={editing.ses_personnel_involved || 0} onChange={(e) => setField("ses_personnel_involved", +e.target.value)} /></div>
                  <div className="space-y-1"><label className="text-xs">Техніка</label><Input value={editing.ses_equipment_used || ""} onChange={(e) => setField("ses_equipment_used", e.target.value)} /></div>
                </CardContent>
              </Card>
            )}

            {editing.service_police && (
              <Card className="border-blue-200">
                <CardHeader className="py-2 px-4"><CardTitle className="text-sm text-blue-700">Поліція — деталі</CardTitle></CardHeader>
                <CardContent className="px-4 pb-3 grid grid-cols-2 gap-3">
                  <div className="space-y-1"><label className="text-xs">Виклики</label><Input type="number" min={0} value={editing.police_calls || 0} onChange={(e) => setField("police_calls", +e.target.value)} /></div>
                  <div className="space-y-1"><label className="text-xs">Затримання</label><Input type="number" min={0} value={editing.police_arrests || 0} onChange={(e) => setField("police_arrests", +e.target.value)} /></div>
                  <div className="space-y-1"><label className="text-xs">Протоколів</label><Input type="number" min={0} value={editing.police_reports_filed || 0} onChange={(e) => setField("police_reports_filed", +e.target.value)} /></div>
                  <div className="space-y-1"><label className="text-xs">Патрулів</label><Input type="number" min={0} value={editing.police_patrols_deployed || 0} onChange={(e) => setField("police_patrols_deployed", +e.target.value)} /></div>
                </CardContent>
              </Card>
            )}

            {editing.service_national_guard && (
              <Card className="border-green-200">
                <CardHeader className="py-2 px-4"><CardTitle className="text-sm text-green-700">Нацгвардія — деталі</CardTitle></CardHeader>
                <CardContent className="px-4 pb-3 grid grid-cols-2 gap-3">
                  <div className="space-y-1"><label className="text-xs">Персоналу задіяно</label><Input type="number" min={0} value={editing.ng_personnel_deployed || 0} onChange={(e) => setField("ng_personnel_deployed", +e.target.value)} /></div>
                  <div className="space-y-1"><label className="text-xs">Одиниць техніки</label><Input type="number" min={0} value={editing.ng_equipment_units || 0} onChange={(e) => setField("ng_equipment_units", +e.target.value)} /></div>
                  <div className="space-y-1"><label className="text-xs">Операцій</label><Input type="number" min={0} value={editing.ng_operations_conducted || 0} onChange={(e) => setField("ng_operations_conducted", +e.target.value)} /></div>
                </CardContent>
              </Card>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Скасувати</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Зберегти
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarPage;
