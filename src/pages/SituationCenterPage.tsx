import { useState, useMemo } from "react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import UkraineMap, { OBLAST_PATHS } from "@/components/UkraineMap";
import type { RegionData } from "@/components/UkraineMap";
import { useCalendarEvents, CalendarEvent } from "@/hooks/useCalendarEvents";
import {
  CalendarIcon, X, FileText, MapPin, Clock, Users, Flame,
  ShieldCheck, Phone, AlertTriangle, ChevronRight, Download
} from "lucide-react";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const SituationCenterPage = () => {
  const { events, loading } = useCalendarEvents();
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(),
    to: new Date(),
  });
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);

  // Map events to regions by location matching
  const regionData = useMemo((): RegionData[] => {
    return OBLAST_PATHS.map((oblast) => {
      const matching = events.filter((e) => {
        const loc = (e.location || "").toLowerCase();
        const name = oblast.name.toLowerCase().replace("ська", "").replace("ська", "");
        return loc.includes(name) || loc.includes(oblast.id);
      });
      return {
        id: oblast.id,
        name: oblast.name,
        activeIncidents: matching.length,
      };
    });
  }, [events]);

  // Get events for selected region
  const selectedRegionInfo = useMemo(() => {
    if (!selectedRegion) return null;
    const oblast = OBLAST_PATHS.find((o) => o.id === selectedRegion);
    if (!oblast) return null;

    const regionEvents = events.filter((e) => {
      const loc = (e.location || "").toLowerCase();
      const name = oblast.name.toLowerCase().replace("ська", "").replace("ська", "");
      return loc.includes(name) || loc.includes(selectedRegion);
    });

    return { oblast, events: regionEvents };
  }, [selectedRegion, events]);

  // Global stats
  const globalStats = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const todayEvents = events.filter((e) => e.event_date === todayStr);
    return {
      total: events.length,
      today: todayEvents.length,
      sesActive: todayEvents.filter((e) => e.service_ses).length,
      policeActive: todayEvents.filter((e) => e.service_police).length,
      ngActive: todayEvents.filter((e) => e.service_national_guard).length,
      rescued: todayEvents.reduce((s, e) => s + (e.ses_people_rescued || 0), 0),
    };
  }, [events]);

  // Time elapsed helper
  const timeElapsed = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "< 1 год";
    if (hours < 24) return `${hours} год`;
    return `${Math.floor(hours / 24)} дн`;
  };

  // Executive summary for selected event
  const execSummary = (ev: CalendarEvent) => {
    const totalUnits =
      (ev.ses_personnel_involved || 0) +
      (ev.police_patrols_deployed || 0) +
      (ev.ng_personnel_deployed || 0);
    return { totalUnits, rescued: ev.ses_people_rescued || 0 };
  };

  const handleGeneratePDF = async () => {
    const el = document.getElementById("situation-center-content");
    if (!el) return;
    const canvas = await html2canvas(el, { scale: 1.5, backgroundColor: "#0f172a" });
    const pdf = new jsPDF("l", "mm", "a4");
    const imgData = canvas.toDataURL("image/png");
    const w = pdf.internal.pageSize.getWidth();
    const h = (canvas.height * w) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, w, h);
    pdf.save(`situation-center-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-0px)] bg-[hsl(222,47%,6%)] text-[hsl(210,40%,95%)]">
      {/* Top Nav Bar */}
      <header className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-[hsl(215,20%,18%)] bg-[hsl(222,47%,8%)]">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h1 className="text-lg font-bold tracking-tight" style={{ fontFamily: "Montserrat" }}>
            Ситуаційний центр
          </h1>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Global status badges */}
          <div className="hidden md:flex items-center gap-2 text-xs">
            <Badge variant="outline" className="border-destructive/50 text-destructive bg-destructive/10">
              🔴 Активних: {globalStats.today}
            </Badge>
            <Badge variant="outline" className="border-[hsl(24,95%,53%)]/50 text-[hsl(24,95%,53%)] bg-[hsl(24,95%,53%)]/10">
              🚒 ДСНС: {globalStats.sesActive}
            </Badge>
            <Badge variant="outline" className="border-blue-400/50 text-blue-400 bg-blue-400/10">
              🚓 Поліція: {globalStats.policeActive}
            </Badge>
            <Badge variant="outline" className="border-green-400/50 text-green-400 bg-green-400/10">
              🛡️ Нацгвардія: {globalStats.ngActive}
            </Badge>
          </div>

          {/* Date picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 bg-[hsl(215,20%,14%)] border-[hsl(215,20%,22%)] text-[hsl(210,40%,90%)] hover:bg-[hsl(215,20%,18%)]">
                <CalendarIcon className="h-4 w-4" />
                <span className="hidden sm:inline">{format(dateRange.from, "dd MMM", { locale: uk })}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={dateRange.from}
                onSelect={(d) => d && setDateRange({ from: d, to: d })}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          {/* Generate Report */}
          <Button
            size="sm"
            onClick={handleGeneratePDF}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Щоденний звіт (PDF)</span>
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div id="situation-center-content" className="flex flex-1 overflow-hidden">
        {/* Map area */}
        <div className="flex-1 relative p-2 md:p-4 flex flex-col">
          {/* Stats summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            <MiniStat label="Всього подій" value={globalStats.total} icon={<FileText className="h-4 w-4" />} />
            <MiniStat label="Врятовано сьогодні" value={globalStats.rescued} icon={<Users className="h-4 w-4" />} color="text-green-400" />
            <MiniStat label="ДСНС залучено" value={globalStats.sesActive} icon={<Flame className="h-4 w-4" />} color="text-orange-400" />
            <MiniStat label="Поліція залучена" value={globalStats.policeActive} icon={<Phone className="h-4 w-4" />} color="text-blue-400" />
          </div>

          {/* Map */}
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <div className="w-full max-w-3xl">
              <UkraineMap
                regions={regionData}
                selectedRegion={selectedRegion}
                onSelectRegion={setSelectedRegion}
              />
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2 justify-center">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" /> Активний інцидент
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" /> Моніторинг
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-green-500" /> Вирішено
            </span>
          </div>
        </div>

        {/* Right Sidebar */}
        <div
          className={cn(
            "border-l border-[hsl(215,20%,18%)] bg-[hsl(222,47%,8%)] transition-all duration-300 overflow-hidden flex flex-col",
            selectedRegion ? "w-80 md:w-96" : "w-0"
          )}
        >
          {selectedRegionInfo && (
            <>
              <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(215,20%,18%)]">
                <div>
                  <h2 className="font-bold text-sm" style={{ fontFamily: "Montserrat" }}>
                    {selectedRegionInfo.oblast.name}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {selectedRegionInfo.events.length} подій
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => setSelectedRegion(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <ScrollArea className="flex-1 px-4 py-3">
                {selectedRegionInfo.events.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Немає подій для цього регіону
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedRegionInfo.events.map((ev) => {
                      const summary = execSummary(ev);
                      return (
                        <Card
                          key={ev.id}
                          className="bg-[hsl(215,20%,12%)] border-[hsl(215,20%,20%)] cursor-pointer hover:border-primary/40 transition-colors"
                          onClick={() => setDetailEvent(ev)}
                        >
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-start justify-between">
                              <h3 className="font-semibold text-sm leading-tight">
                                {ev.title || "Без назви"}
                              </h3>
                              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {timeElapsed(ev.created_at)}
                              <MapPin className="h-3 w-3 ml-1" />
                              {ev.location || "—"}
                            </div>
                            {/* Service badges */}
                            <div className="flex flex-wrap gap-1">
                              {ev.service_ses && (
                                <Badge variant="outline" className="text-[10px] h-5 border-orange-500/40 text-orange-400 bg-orange-500/10">
                                  🚒 ДСНС: {ev.ses_personnel_involved || 0}
                                </Badge>
                              )}
                              {ev.service_police && (
                                <Badge variant="outline" className="text-[10px] h-5 border-blue-500/40 text-blue-400 bg-blue-500/10">
                                  🚓 Поліція: {ev.police_patrols_deployed || 0}
                                </Badge>
                              )}
                              {ev.service_national_guard && (
                                <Badge variant="outline" className="text-[10px] h-5 border-green-500/40 text-green-400 bg-green-500/10">
                                  🛡️ НГ: {ev.ng_personnel_deployed || 0}
                                </Badge>
                              )}
                            </div>
                            {/* Quick exec summary */}
                            {summary.totalUnits > 0 && (
                              <div className="flex gap-3 text-[10px] text-muted-foreground pt-1">
                                <span>👥 Всього: {summary.totalUnits}</span>
                                {summary.rescued > 0 && <span>🆘 Врятовано: {summary.rescued}</span>}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </>
          )}
        </div>
      </div>

      {/* Detail Event Dialog */}
      <Dialog open={!!detailEvent} onOpenChange={(open) => !open && setDetailEvent(null)}>
        <DialogContent className="max-w-lg bg-[hsl(222,47%,10%)] border-[hsl(215,20%,20%)] text-[hsl(210,40%,95%)]">
          {detailEvent && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg" style={{ fontFamily: "Montserrat" }}>
                  {detailEvent.title || "Деталі події"}
                </DialogTitle>
              </DialogHeader>

              {/* Executive Summary Card */}
              <Card className="bg-[hsl(215,20%,12%)] border-[hsl(215,20%,20%)]">
                <CardContent className="p-4">
                  <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                    Зведення
                  </h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-green-400">
                        {detailEvent.ses_people_rescued || 0}
                      </p>
                      <p className="text-[10px] text-muted-foreground">👥 Врятовано</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-primary">
                        {(detailEvent.ses_personnel_involved || 0) +
                          (detailEvent.police_patrols_deployed || 0) +
                          (detailEvent.ng_personnel_deployed || 0)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">🚜 Всього одиниць</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-yellow-400">
                        {(detailEvent.ses_fires_extinguished || 0) +
                          (detailEvent.police_arrests || 0) +
                          (detailEvent.ng_operations_conducted || 0)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">⚡ Операцій</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Separator className="bg-[hsl(215,20%,20%)]" />

              {/* Service breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Деталі по службах
                </h4>

                {detailEvent.service_ses && (
                  <DetailRow
                    icon={<Flame className="h-4 w-4 text-orange-400" />}
                    title="ДСНС"
                    items={[
                      `Врятовано: ${detailEvent.ses_people_rescued || 0}`,
                      `Пожеж ліквідовано: ${detailEvent.ses_fires_extinguished || 0}`,
                      `Особовий склад: ${detailEvent.ses_personnel_involved || 0}`,
                      detailEvent.ses_equipment_used ? `Техніка: ${detailEvent.ses_equipment_used}` : null,
                    ]}
                  />
                )}
                {detailEvent.service_police && (
                  <DetailRow
                    icon={<Phone className="h-4 w-4 text-blue-400" />}
                    title="Поліція"
                    items={[
                      `Викликів: ${detailEvent.police_calls || 0}`,
                      `Затримань: ${detailEvent.police_arrests || 0}`,
                      `Рапортів: ${detailEvent.police_reports_filed || 0}`,
                      `Патрулів: ${detailEvent.police_patrols_deployed || 0}`,
                    ]}
                  />
                )}
                {detailEvent.service_national_guard && (
                  <DetailRow
                    icon={<ShieldCheck className="h-4 w-4 text-green-400" />}
                    title="Нацгвардія"
                    items={[
                      `Особовий склад: ${detailEvent.ng_personnel_deployed || 0}`,
                      `Техніки: ${detailEvent.ng_equipment_units || 0}`,
                      `Операцій: ${detailEvent.ng_operations_conducted || 0}`,
                    ]}
                  />
                )}
              </div>

              {detailEvent.description && (
                <>
                  <Separator className="bg-[hsl(215,20%,20%)]" />
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Опис
                    </h4>
                    <p className="text-sm text-[hsl(210,20%,75%)]">{detailEvent.description}</p>
                  </div>
                </>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {detailEvent.location || "—"}
                <Clock className="h-3 w-3 ml-2" />
                {detailEvent.event_date} {detailEvent.event_time || ""}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Mini stat component
const MiniStat = ({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color?: string }) => (
  <div className="flex items-center gap-2 bg-[hsl(215,20%,12%)] rounded-lg px-3 py-2 border border-[hsl(215,20%,18%)]">
    <div className={cn("shrink-0", color || "text-muted-foreground")}>{icon}</div>
    <div className="min-w-0">
      <p className="text-lg font-bold leading-none">{value}</p>
      <p className="text-[10px] text-muted-foreground truncate">{label}</p>
    </div>
  </div>
);

// Service detail row
const DetailRow = ({ icon, title, items }: { icon: React.ReactNode; title: string; items: (string | null)[] }) => (
  <div className="flex gap-3 items-start bg-[hsl(215,20%,10%)] rounded-lg p-3 border border-[hsl(215,20%,18%)]">
    {icon}
    <div>
      <p className="font-semibold text-sm mb-1">{title}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
        {items.filter(Boolean).map((item, i) => (
          <span key={i}>{item}</span>
        ))}
      </div>
    </div>
  </div>
);

export default SituationCenterPage;
