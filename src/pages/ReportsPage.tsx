import { useState, useMemo } from "react";
import { format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { uk } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCalendarEvents, CalendarEvent } from "@/hooks/useCalendarEvents";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useIncidentStore } from "@/stores/useIncidentStore";
import { INCIDENT_TYPE_LABELS, STATUS_CONFIG, SEVERITY_CONFIG } from "@/data/mockIncidents";
import { REGION_NAME_MAP } from "@/components/UkraineMap";
import { FileBarChart, Download, Loader2, Trash2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { CYRILLIC_FONT } from "@/lib/cyrillic-font";
import { useEffect } from "react";

function setupCyrillicPdf(pdf: jsPDF) {
  pdf.addFileToVFS("Roboto-Regular.ttf", CYRILLIC_FONT);
  pdf.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  pdf.setFont("Roboto");
}
import { useEffect } from "react";

function safeDate(v: any): Date {
  if (!v) return new Date();
  const d = new Date(v);
  return isNaN(d.getTime()) ? new Date() : d;
}

interface ReportRow {
  id: string; title: string; report_type: string; period_start: string; period_end: string; generated_at: string; data: any;
}

const ReportsPage = () => {
  const { events } = useCalendarEvents();
  const { user } = useAuth();
  const { toast } = useToast();
  const incidents = useIncidentStore((s) => s.incidents);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reportType, setReportType] = useState("daily");

  const fetchReports = async () => {
    const { data, error } = await supabase.from("reports" as any).select("*").order("generated_at", { ascending: false });
    if (!error) setReports((data as unknown as ReportRow[]) || []);
    setLoadingReports(false);
  };

  useEffect(() => { fetchReports(); }, []);

  const getPeriod = () => {
    const now = new Date();
    if (reportType === "daily") return { start: format(now, "yyyy-MM-dd"), end: format(now, "yyyy-MM-dd") };
    if (reportType === "monthly") return { start: format(startOfMonth(now), "yyyy-MM-dd"), end: format(endOfMonth(now), "yyyy-MM-dd") };
    return { start: format(startOfYear(now), "yyyy-MM-dd"), end: format(endOfYear(now), "yyyy-MM-dd") };
  };

  const filterEvents = (evs: CalendarEvent[], start: string, end: string) =>
    evs.filter((e) => e.event_date >= start && e.event_date <= end);

  const computeKPI = (filtered: CalendarEvent[]) => {
    const ses = filtered.filter((e) => e.service_ses);
    const police = filtered.filter((e) => e.service_police);
    const ng = filtered.filter((e) => e.service_national_guard);
    return {
      total_events: filtered.length,
      ses: { events: ses.length, rescued: ses.reduce((s, e) => s + (e.ses_people_rescued || 0), 0), fires: ses.reduce((s, e) => s + (e.ses_fires_extinguished || 0), 0), personnel: ses.reduce((s, e) => s + (e.ses_personnel_involved || 0), 0) },
      police: { events: police.length, calls: police.reduce((s, e) => s + (e.police_calls || 0), 0), arrests: police.reduce((s, e) => s + (e.police_arrests || 0), 0), patrols: police.reduce((s, e) => s + (e.police_patrols_deployed || 0), 0) },
      ng: { events: ng.length, personnel: ng.reduce((s, e) => s + (e.ng_personnel_deployed || 0), 0), operations: ng.reduce((s, e) => s + (e.ng_operations_conducted || 0), 0), equipment: ng.reduce((s, e) => s + (e.ng_equipment_units || 0), 0) },
    };
  };

  const generateReport = async () => {
    if (!user) return;
    setGenerating(true);
    const { start, end } = getPeriod();
    const filtered = filterEvents(events, start, end);
    const kpi = computeKPI(filtered);

    // Filter incidents by period too
    const periodIncidents = incidents.filter((inc) => {
      const d = format(safeDate(inc.timestamp), "yyyy-MM-dd");
      return d >= start && d <= end;
    });

    const typeLabel = reportType === "daily" ? "Щоденний" : reportType === "monthly" ? "Щомісячний" : "Річний";
    const title = `${typeLabel} звіт — ${start} — ${end}`;

    await supabase.from("reports" as any).insert({
      user_id: user.id, title, report_type: reportType, period_start: start, period_end: end,
      data: { ...kpi, incident_count: periodIncidents.length },
    } as any);

    // Generate PDF with incident data + calendar data
    const pdf = new jsPDF("p", "mm", "a4");
    setupCyrillicPdf(pdf);
    const pageW = pdf.internal.pageSize.getWidth();

    pdf.setFillColor(15, 23, 42);
    pdf.rect(0, 0, pageW, 28, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(16);
    pdf.text("ОПЕРАТИВНИЙ ЗВІТ", pageW / 2, 12, { align: "center" });
    pdf.setFontSize(10);
    pdf.text(`${title} | Сформовано: ${format(new Date(), "HH:mm dd.MM.yyyy")}`, pageW / 2, 20, { align: "center" });
    pdf.text(`Офіцер: ${user.email ?? "—"}`, pageW / 2, 26, { align: "center" });

    // Executive Summary
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    let y = 36;
    pdf.text("I. ЗВЕДЕНА СТАТИСТИКА", 14, y); y += 4;

    const totalRescued = periodIncidents.reduce((s, i) => s + i.impact.rescued, 0);
    const totalInjured = periodIncidents.reduce((s, i) => s + i.impact.injured, 0);
    const totalFatalities = periodIncidents.reduce((s, i) => s + i.impact.fatalities, 0);
    const totalDamage = periodIncidents.reduce((s, i) => s + i.impact.damage_uah, 0);
    const totalPersonnel = periodIncidents.reduce((s, i) => s + i.resources.personnel_total, 0);

    autoTable(pdf, {
      startY: y,
      head: [["Показник", "Значення", "Показник", "Значення"]],
      body: [
        ["Інцидентів", String(periodIncidents.length), "Календарних подій", String(kpi.total_events)],
        ["Врятовано", String(totalRescued), "Постраждало", String(totalInjured)],
        ["Загиблих", String(totalFatalities), "Ос. складу", String(totalPersonnel)],
        ["Збитки (грн)", totalDamage.toLocaleString("uk-UA"), "Критичних", String(periodIncidents.filter(i => i.severity === "Critical").length)],
      ],
      theme: "grid",
      headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 40 }, 1: { cellWidth: 30 }, 2: { fontStyle: "bold", cellWidth: 40 }, 3: { cellWidth: 30 } },
    });

    // Service stats
    y = (pdf as any).lastAutoTable.finalY + 8;
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text("II. СТАТИСТИКА СЛУЖБ", 14, y); y += 4;

    autoTable(pdf, {
      startY: y,
      head: [["Служба", "Подій", "Ключовий показник 1", "Ключовий показник 2"]],
      body: [
        ["ДСНС", String(kpi.ses.events), `Врятовано: ${kpi.ses.rescued}`, `Пожеж: ${kpi.ses.fires}`],
        ["Поліція", String(kpi.police.events), `Виклики: ${kpi.police.calls}`, `Затримання: ${kpi.police.arrests}`],
        ["Нацгвардія", String(kpi.ng.events), `Персонал: ${kpi.ng.personnel}`, `Операцій: ${kpi.ng.operations}`],
      ],
      theme: "grid",
      headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
    });

    // Incidents data table with auto-pagination
    if (periodIncidents.length > 0) {
      y = (pdf as any).lastAutoTable.finalY + 8;
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.text("III. РЕЄСТР ІНЦИДЕНТІВ", 14, y); y += 4;

      const incRows = periodIncidents
        .sort((a, b) => b.risk_level - a.risk_level)
        .map((inc) => [
          format(safeDate(inc.timestamp), "HH:mm"),
          inc.regionName,
          INCIDENT_TYPE_LABELS[inc.type] || inc.type,
          inc.title.substring(0, 40),
          String(inc.resources.personnel_total),
          `${inc.impact.rescued}/${inc.impact.injured}/${inc.impact.fatalities}`,
        ]);

      autoTable(pdf, {
        startY: y,
        head: [["Час", "Локація", "Тип", "Назва", "Ос.скл.", "Р/П/З"]],
        body: incRows,
        theme: "striped",
        headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontSize: 7 },
        bodyStyles: { fontSize: 7 },
        // jspdf-autotable handles page breaks automatically
      });
    }

    pdf.save(`${reportType}-report-${start}.pdf`);
    setGenerating(false);
    fetchReports();
    toast({ title: "Звіт згенеровано", description: "PDF завантажено та збережено в архів." });
  };

  const deleteReport = async (id: string) => {
    await supabase.from("reports" as any).delete().eq("id", id);
    fetchReports();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold" style={{ fontFamily: "Montserrat, sans-serif" }}>Звіти</h1>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileBarChart className="h-5 w-5 text-primary" /> Генерація звіту
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Тип звіту</label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Щоденний</SelectItem>
                <SelectItem value="monthly">Щомісячний</SelectItem>
                <SelectItem value="yearly">Річний</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={generateReport} disabled={generating} className="gap-2">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Згенерувати PDF
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Архів звітів</CardTitle></CardHeader>
        <CardContent>
          {loadingReports ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : reports.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Немає збережених звітів</p>
          ) : (
            <div className="space-y-2">
              {reports.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">{r.title}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(r.generated_at), "d MMMM yyyy, HH:mm", { locale: uk })}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteReport(r.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsPage;
