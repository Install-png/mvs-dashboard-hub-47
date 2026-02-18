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
import { FileBarChart, Download, Loader2, Trash2 } from "lucide-react";
import jsPDF from "jspdf";
import { useEffect } from "react";

interface ReportRow {
  id: string;
  title: string;
  report_type: string;
  period_start: string;
  period_end: string;
  generated_at: string;
  data: any;
}

const ReportsPage = () => {
  const { events } = useCalendarEvents();
  const { user } = useAuth();
  const { toast } = useToast();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reportType, setReportType] = useState("daily");

  const fetchReports = async () => {
    const { data, error } = await supabase
      .from("reports" as any)
      .select("*")
      .order("generated_at", { ascending: false });
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
      ses: {
        events: ses.length,
        rescued: ses.reduce((s, e) => s + (e.ses_people_rescued || 0), 0),
        fires: ses.reduce((s, e) => s + (e.ses_fires_extinguished || 0), 0),
        personnel: ses.reduce((s, e) => s + (e.ses_personnel_involved || 0), 0),
      },
      police: {
        events: police.length,
        calls: police.reduce((s, e) => s + (e.police_calls || 0), 0),
        arrests: police.reduce((s, e) => s + (e.police_arrests || 0), 0),
        patrols: police.reduce((s, e) => s + (e.police_patrols_deployed || 0), 0),
      },
      ng: {
        events: ng.length,
        personnel: ng.reduce((s, e) => s + (e.ng_personnel_deployed || 0), 0),
        operations: ng.reduce((s, e) => s + (e.ng_operations_conducted || 0), 0),
        equipment: ng.reduce((s, e) => s + (e.ng_equipment_units || 0), 0),
      },
    };
  };

  const generateReport = async () => {
    if (!user) return;
    setGenerating(true);
    const { start, end } = getPeriod();
    const filtered = filterEvents(events, start, end);
    const kpi = computeKPI(filtered);

    const typeLabel = reportType === "daily" ? "Щоденний" : reportType === "monthly" ? "Щомісячний" : "Річний";
    const title = `${typeLabel} звіт — ${start} — ${end}`;

    // Save to DB
    await supabase.from("reports" as any).insert({
      user_id: user.id,
      title,
      report_type: reportType,
      period_start: start,
      period_end: end,
      data: kpi,
    } as any);

    // Generate PDF
    const pdf = new jsPDF("p", "mm", "a4");
    pdf.setFontSize(18);
    pdf.text("МВС — Звіт", 14, 20);
    pdf.setFontSize(12);
    pdf.text(title, 14, 30);
    pdf.text(`Всього подій: ${kpi.total_events}`, 14, 42);

    let y = 54;
    pdf.setFontSize(14);
    pdf.text("ДСНС", 14, y); y += 8;
    pdf.setFontSize(10);
    pdf.text(`Подій: ${kpi.ses.events}  |  Врятовано: ${kpi.ses.rescued}  |  Пожеж: ${kpi.ses.fires}  |  Персонал: ${kpi.ses.personnel}`, 14, y); y += 12;

    pdf.setFontSize(14);
    pdf.text("Поліція", 14, y); y += 8;
    pdf.setFontSize(10);
    pdf.text(`Подій: ${kpi.police.events}  |  Виклики: ${kpi.police.calls}  |  Затримання: ${kpi.police.arrests}  |  Патрулі: ${kpi.police.patrols}`, 14, y); y += 12;

    pdf.setFontSize(14);
    pdf.text("Нацгвардія", 14, y); y += 8;
    pdf.setFontSize(10);
    pdf.text(`Подій: ${kpi.ng.events}  |  Персонал: ${kpi.ng.personnel}  |  Операцій: ${kpi.ng.operations}  |  Техніка: ${kpi.ng.equipment}`, 14, y); y += 16;

    // Events list
    if (filtered.length > 0) {
      pdf.setFontSize(12);
      pdf.text("Перелік подій:", 14, y); y += 8;
      pdf.setFontSize(9);
      filtered.slice(0, 30).forEach((ev) => {
        if (y > 275) { pdf.addPage(); y = 20; }
        pdf.text(`${ev.event_date} — ${ev.title || "Без назви"} — ${ev.location || ""}`, 14, y);
        y += 6;
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

      {/* Generator */}
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

      {/* Archive */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Архів звітів</CardTitle>
        </CardHeader>
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
