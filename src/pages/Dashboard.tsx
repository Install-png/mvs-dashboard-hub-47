import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Shield, Users, FileText, AlertTriangle, TrendingUp,
  BarChart3, Activity, LogOut, Bell, Search, Pencil, Plus, Trash2, Save, X
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

interface EventItem {
  id: number;
  type: string;
  location: string;
  time: string;
  status: string;
}

interface PersonnelItem {
  id: number;
  name: string;
  rank: string;
  department: string;
  status: string;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText, Users, AlertTriangle, TrendingUp
};

const initialStats: StatItem[] = [
  { title: "Активні справи", value: "1,247", icon: "FileText", change: "+12%" },
  { title: "Співробітники", value: "3,891", icon: "Users", change: "+3%" },
  { title: "Інциденти сьогодні", value: "47", icon: "AlertTriangle", change: "-8%" },
  { title: "Показник розкриття", value: "87%", icon: "TrendingUp", change: "+5%" },
];

const initialEvents: EventItem[] = [
  { id: 1, type: "Крадіжка", location: "м. Київ, вул. Хрещатик", time: "14:32", status: "В роботі" },
  { id: 2, type: "ДТП", location: "м. Одеса, пр. Шевченка", time: "13:15", status: "Розслідується" },
  { id: 3, type: "Шахрайство", location: "м. Львів, вул. Свободи", time: "12:48", status: "Завершено" },
  { id: 4, type: "Порушення", location: "м. Харків, вул. Сумська", time: "11:20", status: "В роботі" },
  { id: 5, type: "Крадіжка", location: "м. Дніпро, пр. Гагаріна", time: "10:05", status: "Завершено" },
];

const initialPersonnel: PersonnelItem[] = [
  { id: 1, name: "Іванов Іван Іванович", rank: "Капітан", department: "Слідчий відділ", status: "На службі" },
  { id: 2, name: "Петренко Олена Сергіївна", rank: "Лейтенант", department: "Кіберполіція", status: "На службі" },
  { id: 3, name: "Сидоренко Андрій Петрович", rank: "Майор", department: "Патрульна поліція", status: "Відпустка" },
  { id: 4, name: "Коваленко Марія Олександрівна", rank: "Старший лейтенант", department: "Слідчий відділ", status: "На службі" },
  { id: 5, name: "Бондаренко Віктор Миколайович", rank: "Полковник", department: "Управління", status: "На службі" },
];

const monthlyData = [
  { name: "Січ", value: 420 },
  { name: "Лют", value: 380 },
  { name: "Бер", value: 510 },
  { name: "Кві", value: 470 },
  { name: "Тра", value: 540 },
  { name: "Чер", value: 610 },
];

const trendData = [
  { name: "Пн", incidents: 45, resolved: 38 },
  { name: "Вт", incidents: 52, resolved: 47 },
  { name: "Ср", incidents: 38, resolved: 35 },
  { name: "Чт", incidents: 65, resolved: 58 },
  { name: "Пт", incidents: 48, resolved: 44 },
  { name: "Сб", incidents: 30, resolved: 28 },
  { name: "Нд", incidents: 22, resolved: 20 },
];

const categoryData = [
  { name: "Крадіжки", value: 35 },
  { name: "ДТП", value: 25 },
  { name: "Шахрайство", value: 20 },
  { name: "Інше", value: 20 },
];

// ── Editable Stat Card ──
const EditableStatCard = ({ stat, onSave }: { stat: StatItem; onSave: (s: StatItem) => void }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(stat);
  const Icon = iconMap[stat.icon] || FileText;

  if (editing) {
    return (
      <Card className="border-primary/30 shadow-lg">
        <CardContent className="p-4 space-y-2">
          <Input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="Назва" className="text-sm" />
          <Input value={draft.value} onChange={e => setDraft({ ...draft, value: e.target.value })} placeholder="Значення" className="text-lg font-bold" />
          <Input value={draft.change} onChange={e => setDraft({ ...draft, change: e.target.value })} placeholder="Зміна" className="text-xs" />
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={() => { onSave(draft); setEditing(false); }} className="gap-1"><Save className="h-3 w-3" />Зберегти</Button>
            <Button size="sm" variant="ghost" onClick={() => { setDraft(stat); setEditing(false); }}><X className="h-3 w-3" /></Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-lg transition-shadow group relative">
      <button onClick={() => setEditing(true)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-muted">
        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{stat.title}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
            <span className={`text-xs font-medium ${stat.change.startsWith('+') ? 'text-green-600' : 'text-red-500'}`}>
              {stat.change} за місяць
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ── Main Dashboard ──
const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<StatItem[]>(initialStats);
  const [events, setEvents] = useState<EventItem[]>(initialEvents);
  const [personnel, setPersonnel] = useState<PersonnelItem[]>(initialPersonnel);

  // Event editing
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);

  // Personnel editing
  const [editingPerson, setEditingPerson] = useState<PersonnelItem | null>(null);
  const [personDialogOpen, setPersonDialogOpen] = useState(false);

  const handleSaveStat = (index: number, updated: StatItem) => {
    setStats(prev => prev.map((s, i) => i === index ? updated : s));
  };

  // Events CRUD
  const openEventDialog = (event?: EventItem) => {
    setEditingEvent(event || { id: Date.now(), type: "", location: "", time: "", status: "В роботі" });
    setEventDialogOpen(true);
  };
  const saveEvent = () => {
    if (!editingEvent) return;
    setEvents(prev => {
      const exists = prev.find(e => e.id === editingEvent.id);
      if (exists) return prev.map(e => e.id === editingEvent.id ? editingEvent : e);
      return [...prev, editingEvent];
    });
    setEventDialogOpen(false);
  };
  const deleteEvent = (id: number) => setEvents(prev => prev.filter(e => e.id !== id));

  // Personnel CRUD
  const openPersonDialog = (person?: PersonnelItem) => {
    setEditingPerson(person || { id: Date.now(), name: "", rank: "", department: "", status: "На службі" });
    setPersonDialogOpen(true);
  };
  const savePerson = () => {
    if (!editingPerson) return;
    setPersonnel(prev => {
      const exists = prev.find(p => p.id === editingPerson.id);
      if (exists) return prev.map(p => p.id === editingPerson.id ? editingPerson : p);
      return [...prev, editingPerson];
    });
    setPersonDialogOpen(false);
  };
  const deletePerson = (id: number) => setPersonnel(prev => prev.filter(p => p.id !== id));

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
            <Button variant="outline" size="sm" onClick={() => navigate("/")} className="gap-2">
              <LogOut className="h-4 w-4" /> Вийти
            </Button>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <EditableStatCard key={i} stat={stat} onSave={(s) => handleSaveStat(i, s)} />
          ))}
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
            <DialogTitle>{editingEvent && events.find(e => e.id === editingEvent.id) ? "Редагувати інцидент" : "Новий інцидент"}</DialogTitle>
          </DialogHeader>
          {editingEvent && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Тип</label>
                <Input value={editingEvent.type} onChange={e => setEditingEvent({ ...editingEvent, type: e.target.value })} placeholder="Крадіжка, ДТП..." />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Місцезнаходження</label>
                <Input value={editingEvent.location} onChange={e => setEditingEvent({ ...editingEvent, location: e.target.value })} placeholder="м. Київ, вул..." />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Час</label>
                <Input value={editingEvent.time} onChange={e => setEditingEvent({ ...editingEvent, time: e.target.value })} placeholder="14:30" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Статус</label>
                <Select value={editingEvent.status} onValueChange={val => setEditingEvent({ ...editingEvent, status: val })}>
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
            <Button onClick={saveEvent}>Зберегти</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Personnel Dialog */}
      <Dialog open={personDialogOpen} onOpenChange={setPersonDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPerson && personnel.find(p => p.id === editingPerson.id) ? "Редагувати співробітника" : "Новий співробітник"}</DialogTitle>
          </DialogHeader>
          {editingPerson && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">ПІБ</label>
                <Input value={editingPerson.name} onChange={e => setEditingPerson({ ...editingPerson, name: e.target.value })} placeholder="Прізвище Ім'я По батькові" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Звання</label>
                <Input value={editingPerson.rank} onChange={e => setEditingPerson({ ...editingPerson, rank: e.target.value })} placeholder="Капітан, Лейтенант..." />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Відділ</label>
                <Input value={editingPerson.department} onChange={e => setEditingPerson({ ...editingPerson, department: e.target.value })} placeholder="Слідчий відділ..." />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Статус</label>
                <Select value={editingPerson.status} onValueChange={val => setEditingPerson({ ...editingPerson, status: val })}>
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
            <Button onClick={savePerson}>Зберегти</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
