import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { uk } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useCalendarEvents, CalendarEvent, emptyEvent } from "@/hooks/useCalendarEvents";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const CalendarPage = () => {
  const { events, loading, saveEvent, deleteEvent } = useCalendarEvents();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<CalendarEvent>>(emptyEvent());
  const [saving, setSaving] = useState(false);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = useMemo(() => {
    const result: Date[] = [];
    let day = calStart;
    while (day <= calEnd) {
      result.push(day);
      day = addDays(day, 1);
    }
    return result;
  }, [calStart, calEnd]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach((e) => {
      const key = e.event_date;
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [events]);

  const selectedEvents = selectedDate
    ? eventsByDate[format(selectedDate, "yyyy-MM-dd")] || []
    : [];

  const openNew = (date?: Date) => {
    setEditing({ ...emptyEvent(), event_date: format(date || selectedDate || new Date(), "yyyy-MM-dd") });
    setDialogOpen(true);
  };

  const openEdit = (ev: CalendarEvent) => {
    setEditing({ ...ev });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    await saveEvent(editing);
    setSaving(false);
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    await deleteEvent(id);
  };

  const setField = (key: string, val: any) => setEditing((prev) => ({ ...prev, [key]: val }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold" style={{ fontFamily: "Montserrat, sans-serif" }}>
        Календар подій
      </h1>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <Card className="lg:col-span-2">
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
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isToday = isSameDay(day, new Date());
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedDate(day)}
                        className={cn(
                          "relative aspect-square flex flex-col items-center justify-start p-1 rounded-lg text-sm transition-colors",
                          !isCurrentMonth && "text-muted-foreground/40",
                          isSelected && "bg-primary/10 ring-2 ring-primary",
                          isToday && !isSelected && "bg-accent",
                          "hover:bg-muted"
                        )}
                      >
                        <span className={cn("text-xs", isToday && "font-bold text-primary")}>
                          {format(day, "d")}
                        </span>
                        {dayEvents.length > 0 && (
                          <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                            {dayEvents.slice(0, 3).map((_, j) => (
                              <span key={j} className="h-1.5 w-1.5 rounded-full bg-primary" />
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Day details */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              {selectedDate ? format(selectedDate, "d MMMM yyyy", { locale: uk }) : "Оберіть день"}
            </CardTitle>
            {selectedDate && (
              <Button size="sm" className="gap-1" onClick={() => openNew()}>
                <Plus className="h-4 w-4" /> Додати
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!selectedDate ? (
              <p className="text-sm text-muted-foreground text-center py-8">Натисніть на день у календарі</p>
            ) : selectedEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Немає подій на цей день</p>
            ) : (
              <div className="space-y-3">
                {selectedEvents.map((ev) => (
                  <div key={ev.id} className="p-3 rounded-lg bg-muted/50 space-y-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">{ev.title || "Без назви"}</p>
                        {ev.location && <p className="text-xs text-muted-foreground">{ev.location}</p>}
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
                    <div className="flex gap-1 flex-wrap">
                      {ev.service_ses && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">ДСНС</span>}
                      {ev.service_police && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Поліція</span>}
                      {ev.service_national_guard && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Нацгвардія</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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

            {/* Services checkboxes */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Залучені служби</label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={editing.service_ses || false} onCheckedChange={(c) => setField("service_ses", !!c)} />
                  ДСНС
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={editing.service_police || false} onCheckedChange={(c) => setField("service_police", !!c)} />
                  Поліція
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={editing.service_national_guard || false} onCheckedChange={(c) => setField("service_national_guard", !!c)} />
                  Нацгвардія
                </label>
              </div>
              <Input placeholder="Інше..." value={editing.service_other || ""} onChange={(e) => setField("service_other", e.target.value)} />
            </div>

            {/* SES conditional fields */}
            {editing.service_ses && (
              <Card className="border-red-200">
                <CardHeader className="py-2 px-4"><CardTitle className="text-sm text-red-700">ДСНС — деталі</CardTitle></CardHeader>
                <CardContent className="px-4 pb-3 grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs">Врятовано людей</label>
                    <Input type="number" min={0} value={editing.ses_people_rescued || 0} onChange={(e) => setField("ses_people_rescued", +e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs">Пожеж ліквідовано</label>
                    <Input type="number" min={0} value={editing.ses_fires_extinguished || 0} onChange={(e) => setField("ses_fires_extinguished", +e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs">Задіяного персоналу</label>
                    <Input type="number" min={0} value={editing.ses_personnel_involved || 0} onChange={(e) => setField("ses_personnel_involved", +e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs">Техніка</label>
                    <Input value={editing.ses_equipment_used || ""} onChange={(e) => setField("ses_equipment_used", e.target.value)} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Police conditional fields */}
            {editing.service_police && (
              <Card className="border-blue-200">
                <CardHeader className="py-2 px-4"><CardTitle className="text-sm text-blue-700">Поліція — деталі</CardTitle></CardHeader>
                <CardContent className="px-4 pb-3 grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs">Виклики</label>
                    <Input type="number" min={0} value={editing.police_calls || 0} onChange={(e) => setField("police_calls", +e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs">Затримання</label>
                    <Input type="number" min={0} value={editing.police_arrests || 0} onChange={(e) => setField("police_arrests", +e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs">Протоколів</label>
                    <Input type="number" min={0} value={editing.police_reports_filed || 0} onChange={(e) => setField("police_reports_filed", +e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs">Патрулів</label>
                    <Input type="number" min={0} value={editing.police_patrols_deployed || 0} onChange={(e) => setField("police_patrols_deployed", +e.target.value)} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* National Guard conditional fields */}
            {editing.service_national_guard && (
              <Card className="border-green-200">
                <CardHeader className="py-2 px-4"><CardTitle className="text-sm text-green-700">Нацгвардія — деталі</CardTitle></CardHeader>
                <CardContent className="px-4 pb-3 grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs">Персоналу задіяно</label>
                    <Input type="number" min={0} value={editing.ng_personnel_deployed || 0} onChange={(e) => setField("ng_personnel_deployed", +e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs">Одиниць техніки</label>
                    <Input type="number" min={0} value={editing.ng_equipment_units || 0} onChange={(e) => setField("ng_equipment_units", +e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs">Операцій</label>
                    <Input type="number" min={0} value={editing.ng_operations_conducted || 0} onChange={(e) => setField("ng_operations_conducted", +e.target.value)} />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Скасувати</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Зберегти
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarPage;
