import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Shield, Users, FileText, AlertTriangle, TrendingUp, 
  BarChart3, Activity, LogOut, Bell, Search
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from "recharts";

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

const CHART_COLORS = ["hsl(24, 95%, 53%)", "hsl(24, 80%, 65%)", "hsl(30, 100%, 75%)", "hsl(30, 40%, 85%)"];

const stats = [
  { title: "Активні справи", value: "1,247", icon: FileText, change: "+12%" },
  { title: "Співробітники", value: "3,891", icon: Users, change: "+3%" },
  { title: "Інциденти сьогодні", value: "47", icon: AlertTriangle, change: "-8%" },
  { title: "Показник розкриття", value: "87%", icon: TrendingUp, change: "+5%" },
];

const recentEvents = [
  { id: 1, type: "Крадіжка", location: "м. Київ, вул. Хрещатик", time: "14:32", status: "В роботі" },
  { id: 2, type: "ДТП", location: "м. Одеса, пр. Шевченка", time: "13:15", status: "Розслідується" },
  { id: 3, type: "Шахрайство", location: "м. Львів, вул. Свободи", time: "12:48", status: "Завершено" },
  { id: 4, type: "Порушення", location: "м. Харків, вул. Сумська", time: "11:20", status: "В роботі" },
  { id: 5, type: "Крадіжка", location: "м. Дніпро, пр. Гагаріна", time: "10:05", status: "Завершено" },
];

const Dashboard = () => {
  const navigate = useNavigate();

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
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-destructive-foreground rounded-full text-[10px] flex items-center justify-center">
                3
              </span>
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
          {stats.map((stat) => (
            <Card key={stat.title} className="hover:shadow-lg transition-shadow">
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
                    <stat.icon className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Звернення за місяцями
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
                <Activity className="h-5 w-5 text-primary" />
                Динаміка за тиждень
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(30, 20%, 88%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="incidents" stroke="hsl(24, 95%, 53%)" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="resolved" stroke="hsl(24, 80%, 70%)" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Pie chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Категорії інцидентів</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Recent Events Table */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Останні події</CardTitle>
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
                    </tr>
                  </thead>
                  <tbody>
                    {recentEvents.map((event) => (
                      <tr key={event.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                        <td className="py-2.5 font-medium">{event.type}</td>
                        <td className="py-2.5 text-muted-foreground">{event.location}</td>
                        <td className="py-2.5 text-muted-foreground">{event.time}</td>
                        <td className="py-2.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            event.status === "Завершено"
                              ? "bg-green-100 text-green-700"
                              : event.status === "В роботі"
                              ? "bg-accent text-accent-foreground"
                              : "bg-secondary text-secondary-foreground"
                          }`}>
                            {event.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
