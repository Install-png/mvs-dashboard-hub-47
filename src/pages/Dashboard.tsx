import { useState, useEffect, useMemo } from "react";
import { startOfDay, subDays, getMonth, getDay, isToday } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, Users, FileText, AlertTriangle, TrendingUp,
  BarChart3, Activity, LogOut, Bell, Search, Pencil, Plus, Trash2, Save, X, Loader2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from "recharts";

const CHART_COLORS = ["hsl(24, 95%, 53%)", "hsl(24, 80%, 65%)", "hsl(30, 100%, 75%)", "hsl(30, 40%, 85%)"];

interface StatItem {
  title: string;
  value: string;
  icon: string;
  change: string;
}

interface IncidentRow {
  id: string;
  user_id: string;
  type: string;
  location: string;
  time: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface PersonnelRow {
  id: string;
  user_id: string;
  name: string;
  rank: string;
  department: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText, Users, AlertTriangle, TrendingUp
};

const MONTH_NAMES = ["Січ", "Лют", "Бер", "Кві", "Тра", "Чер", "Лип", "Сер", "Вер", "Жов", "Лис", "Гру"];
const DAY_NAMES = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

const computeStats = (events: IncidentRow[], personnel: PersonnelRow[]): StatItem[] => {
  const active = events.filter(e => e.status !== "Завершено").length;
  const personnelCount = personnel.length;
  const todayCount = events.filter(e => isToday(new Date(e.created_at))).length;
  const resolved = events.filter(e => e.status === "Завершено").length;
  const rate = events.length > 0 ? Math.round((resolved / events.length) * 100) : 0;

  return [
    { title: "Активні справи", value: String(active), icon: "FileText", change: `${events.length} всього` },
    { title: "Співробітники", value: String(personnelCount), icon: "Users", change: `${personnel.filter(p => p.status === "На службі").length} на службі` },
    { title: "Інциденти сьогодні", value: String(todayCount), icon: "AlertTriangle", change: `${resolved} вирішено` },
    { title: "Показник розкриття", value: `${rate}%`, icon: "TrendingUp", change: `${resolved}/${events.length}` },
  ];
};

const computeMonthlyData = (events: IncidentRow[]) => {
  const counts: Record<number, number> = {};
  events.forEach(e => {
    const m = getMonth(new Date(e.created_at));
    counts[m] = (counts[m] || 0) + 1;
  });
  return MONTH_NAMES.map((name, i) => ({ name, value: counts[i] || 0 }));
};

const computeWeeklyTrend = (events: IncidentRow[]) => {
  const now = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(startOfDay(now), 6 - i);
    return { date: d, label: DAY_NAMES[getDay(d)] };
  });

  return days.map(({ date, label }) => {
    const dayEvents = events.filter(e => {
      const ed = startOfDay(new Date(e.created_at));
      return ed.getTime() === date.getTime();
    });
    return {
      name: label,
      incidents: dayEvents.length,
      resolved: dayEvents.filter(e => e.status === "Завершено").length,
    };
  });
};

const computeCategoryData = (events: IncidentRow[]) => {
  const counts: Record<string, number> = {};
  events.forEach(e => {
    const type = e.type || "Інше";
    counts[type] = (counts[type] || 0) + 1;
  });
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return [{ name: "Немає даних", value: 1 }];
  return entries.map(([name, value]) => ({ name, value }));
};

// ── Main Dashboard ──
const Dashboard = () => {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<IncidentRow[]>([]);
  const [personnel, setPersonnel] = useState<PersonnelRow[]>([]);
  const stats = useMemo(() => computeStats(events, personnel), [events, personnel]);
  const monthlyData = useMemo(() => computeMonthlyData(events), [events]);
  const trendData = useMemo(() => computeWeeklyTrend(events), [events]);
  const categoryData = useMemo(() => computeCategoryData(events), [events]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingPersonnel, setLoadingPersonnel] = useState(true);

  // Event editing
  const [editingEvent, setEditingEvent] = useState<Partial<IncidentRow> | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Personnel editing
  const [editingPerson, setEditingPerson] = useState<Partial<PersonnelRow> | null>(null);
  const [personDialogOpen, setPersonDialogOpen] = useState(false);

  // Fetch incidents
  const fetchEvents = async () => {
    const { data, error } = await supabase.from("incidents" as any).select("*").order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Помилка", description: error.message, variant: "destructive" });
    } else {
      setEvents((data as unknown as IncidentRow[]) || []);
    }
    setLoadingEvents(false);
  };

  // Fetch personnel
  const fetchPersonnel = async () => {
    const { data, error } = await supabase.from("personnel" as any).select("*").order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Помилка", description: error.message, variant: "destructive" });
    } else {
      setPersonnel((data as unknown as PersonnelRow[]) || []);
    }
    setLoadingPersonnel(false);
  };

  useEffect(() => {
    fetchEvents();
    fetchPersonnel();
  }, []);

  // Stats are now computed via useMemo, no manual save needed

  // Events CRUD
  const openEventDialog = (event?: IncidentRow) => {
    setEditingEvent(event || { type: "", location: "", time: "", status: "В роботі" });
    setEventDialogOpen(true);
  };

  const saveEvent = async () => {
    if (!editingEvent || !user) return;
    setSaving(true);

    if (editingEvent.id) {
      // Update
      const { error } = await supabase
        .from("incidents" as any)
        .update({ type: editingEvent.type, location: editingEvent.location, time: editingEvent.time, status: editingEvent.status } as any)
        .eq("id", editingEvent.id);
      if (error) toast({ title: "Помилка", description: error.message, variant: "destructive" });
    } else {
      // Insert
      const { error } = await supabase
        .from("incidents" as any)
        .insert({ user_id: user.id, type: editingEvent.type, location: editingEvent.location, time: editingEvent.time, status: editingEvent.status } as any);
      if (error) toast({ title: "Помилка", description: error.message, variant: "destructive" });
    }

    setSaving(false);
    setEventDialogOpen(false);
    fetchEvents();
  };

  const deleteEvent = async (id: string) => {
    const { error } = await supabase.from("incidents" as any).delete().eq("id", id);
    if (error) toast({ title: "Помилка", description: error.message, variant: "destructive" });
    fetchEvents();
  };

  // Personnel CRUD
  const openPersonDialog = (person?: PersonnelRow) => {
    setEditingPerson(person || { name: "", rank: "", department: "", status: "На службі" });
    setPersonDialogOpen(true);
  };

  const savePerson = async () => {
    if (!editingPerson || !user) return;
    setSaving(true);

    if (editingPerson.id) {
      const { error } = await supabase
        .from("personnel" as any)
        .update({ name: editingPerson.name, rank: editingPerson.rank, department: editingPerson.department, status: editingPerson.status } as any)
        .eq("id", editingPerson.id);
      if (error) toast({ title: "Помилка", description: error.message, variant: "destructive" });
    } else {
      const { error } = await supabase
        .from("personnel" as any)
        .insert({ user_id: user.id, name: editingPerson.name, rank: editingPerson.rank, department: editingPerson.department, status: editingPerson.status } as any);
      if (error) toast({ title: "Помилка", description: error.message, variant: "destructive" });
    }

    setSaving(false);
    setPersonDialogOpen(false);
    fetchPersonnel();
  };

  const deletePerson = async (id: string) => {
    const { error } = await supabase.from("personnel" as any).delete().eq("id", id);
    if (error) toast({ title: "Помилка", description: error.message, variant: "destructive" });
    fetchPersonnel();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Nav */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Shield className="h-7 w-7 text-primary" />
            <h1 className="text-lg font-bold text-foreground" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              МВС Панель управління
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Пошук..." className="pl-9 w-64" />
            </div>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-destructive-foreground rounded-full text-[10px] flex items-center justify-center">3</span>
            </Button>
            <Button variant="outline" size="sm" onClick={async () => { await signOut(); navigate("/"); }} className="gap-2">
              <LogOut className="h-4 w-4" /> Вийти
            </Button>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Stats */}
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

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-11">
            <TabsTrigger value="overview" className="gap-2"><BarChart3 className="h-4 w-4" />Огляд</TabsTrigger>
            <TabsTrigger value="events" className="gap-2"><AlertTriangle className="h-4 w-4" />Інциденти</TabsTrigger>
            <TabsTrigger value="personnel" className="gap-2"><Users className="h-4 w-4" />Персонал</TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2"><Activity className="h-4 w-4" />Аналітика</TabsTrigger>
          </TabsList>

          {/* ── Overview Tab ── */}
          <TabsContent value="overview" className="space-y-6 mt-4">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />Звернення за місяцями
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(30, 20%, 88%)" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="hsl(24, 95%, 53%)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />Динаміка за тиждень
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(30, 20%, 88%)" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="incidents" stroke="hsl(24, 95%, 53%)" strokeWidth={2} dot={{ r: 4 }} name="Інциденти" />
                      <Line type="monotone" dataKey="resolved" stroke="hsl(24, 80%, 70%)" strokeWidth={2} dot={{ r: 4 }} name="Вирішено" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Quick recent events */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Останні 3 інциденти</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingEvents ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : events.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Немає інцидентів</p>
                ) : (
                  <div className="space-y-2">
                    {events.slice(0, 3).map(ev => (
                      <div key={ev.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <span className="font-medium text-sm">{ev.type}</span>
                          <span className="text-muted-foreground text-sm ml-3">{ev.location}</span>
                        </div>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          ev.status === "Завершено" ? "bg-green-100 text-green-700" :
                          ev.status === "В роботі" ? "bg-accent text-accent-foreground" :
                          "bg-secondary text-secondary-foreground"
                        }`}>{ev.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Events Tab ── */}
          <TabsContent value="events" className="mt-4">
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Журнал інцидентів</CardTitle>
                <Button size="sm" onClick={() => openEventDialog()} className="gap-1"><Plus className="h-4 w-4" />Додати</Button>
              </CardHeader>
              <CardContent>
                {loadingEvents ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : events.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Немає інцидентів. Натисніть "Додати" щоб створити перший.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 text-muted-foreground font-medium">Тип</th>
                          <th className="text-left py-2 text-muted-foreground font-medium">Місцезнаходження</th>
                          <th className="text-left py-2 text-muted-foreground font-medium">Час</th>
                          <th className="text-left py-2 text-muted-foreground font-medium">Статус</th>
                          <th className="text-right py-2 text-muted-foreground font-medium">Дії</th>
                        </tr>
                      </thead>
                      <tbody>
                        {events.map(event => (
                          <tr key={event.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                            <td className="py-2.5 font-medium">{event.type}</td>
                            <td className="py-2.5 text-muted-foreground">{event.location}</td>
                            <td className="py-2.5 text-muted-foreground">{event.time}</td>
                            <td className="py-2.5">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                event.status === "Завершено" ? "bg-green-100 text-green-700" :
                                event.status === "В роботі" ? "bg-accent text-accent-foreground" :
                                "bg-secondary text-secondary-foreground"
                              }`}>{event.status}</span>
                            </td>
                            <td className="py-2.5 text-right">
                              <div className="flex gap-1 justify-end">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEventDialog(event)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteEvent(event.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
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

          {/* ── Personnel Tab ── */}
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
                  <p className="text-sm text-muted-foreground text-center py-8">Немає персоналу. Натисніть "Додати" щоб додати першого.</p>
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
                        {personnel.map(person => (
                          <tr key={person.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                            <td className="py-2.5 font-medium">{person.name}</td>
                            <td className="py-2.5 text-muted-foreground">{person.rank}</td>
                            <td className="py-2.5 text-muted-foreground">{person.department}</td>
                            <td className="py-2.5">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                person.status === "На службі" ? "bg-green-100 text-green-700" :
                                "bg-secondary text-secondary-foreground"
                              }`}>{person.status}</span>
                            </td>
                            <td className="py-2.5 text-right">
                              <div className="flex gap-1 justify-end">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openPersonDialog(person)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deletePerson(person.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
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

          {/* ── Analytics Tab ── */}
          <TabsContent value="analytics" className="space-y-6 mt-4">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Категорії інцидентів</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {categoryData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Звернення за місяцями</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(30, 20%, 88%)" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="hsl(24, 95%, 53%)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Тижнева динаміка інцидентів vs вирішених</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(30, 20%, 88%)" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="incidents" stroke="hsl(24, 95%, 53%)" strokeWidth={2} dot={{ r: 4 }} name="Інциденти" />
                    <Line type="monotone" dataKey="resolved" stroke="hsl(24, 80%, 70%)" strokeWidth={2} dot={{ r: 4 }} name="Вирішено" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Event Dialog */}
      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEvent?.id ? "Редагувати інцидент" : "Новий інцидент"}</DialogTitle>
          </DialogHeader>
          {editingEvent && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Тип</label>
                <Input value={editingEvent.type || ""} onChange={e => setEditingEvent({ ...editingEvent, type: e.target.value })} placeholder="Крадіжка, ДТП..." />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Місцезнаходження</label>
                <Input value={editingEvent.location || ""} onChange={e => setEditingEvent({ ...editingEvent, location: e.target.value })} placeholder="м. Київ, вул..." />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Час</label>
                <Input value={editingEvent.time || ""} onChange={e => setEditingEvent({ ...editingEvent, time: e.target.value })} placeholder="14:30" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Статус</label>
                <Select value={editingEvent.status || "В роботі"} onValueChange={val => setEditingEvent({ ...editingEvent, status: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="В роботі">В роботі</SelectItem>
                    <SelectItem value="Розслідується">Розслідується</SelectItem>
                    <SelectItem value="Завершено">Завершено</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEventDialogOpen(false)}>Скасувати</Button>
            <Button onClick={saveEvent} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Зберегти
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Personnel Dialog */}
      <Dialog open={personDialogOpen} onOpenChange={setPersonDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPerson?.id ? "Редагувати співробітника" : "Новий співробітник"}</DialogTitle>
          </DialogHeader>
          {editingPerson && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">ПІБ</label>
                <Input value={editingPerson.name || ""} onChange={e => setEditingPerson({ ...editingPerson, name: e.target.value })} placeholder="Прізвище Ім'я По батькові" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Звання</label>
                <Input value={editingPerson.rank || ""} onChange={e => setEditingPerson({ ...editingPerson, rank: e.target.value })} placeholder="Капітан, Лейтенант..." />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Відділ</label>
                <Input value={editingPerson.department || ""} onChange={e => setEditingPerson({ ...editingPerson, department: e.target.value })} placeholder="Слідчий відділ..." />
              </div>
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
            <Button onClick={savePerson} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Зберегти
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
