import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Boxes, Building2, Plus, Trash2, Truck, Loader2, Warehouse, Wrench, MapPin, AlertTriangle, History, Filter, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useResources, RESOURCE_TYPES } from "@/hooks/useResources";
import { useUserRole } from "@/hooks/useUserRole";
import { REGION_NAME_MAP } from "@/components/UkraineMap";

const SERVICES = ["ДСНС", "Поліція", "Нацгвардія", "Швидка допомога"];
const REGIONS = Object.entries(REGION_NAME_MAP).map(([id, name]) => ({ id, name }));
const ALL = "__all__";

const ResourcesPage = () => {
  const { isAdmin } = useUserRole();
  const { units, resources, loading } = useResources();

  const [uName, setUName] = useState("");
  const [uService, setUService] = useState(SERVICES[0]);
  const [uRegion, setURegion] = useState(REGIONS[0]?.id ?? "");
  const [uCity, setUCity] = useState("");
  const [uLat, setULat] = useState("");
  const [uLng, setULng] = useState("");
  const [saving, setSaving] = useState(false);

  const [rUnit, setRUnit] = useState("");
  const [rType, setRType] = useState(RESOURCE_TYPES[0]);
  const [rQty, setRQty] = useState("1");
  const [rReserve, setRReserve] = useState(false);

  const grouped = useMemo(() => {
    return units.map((u) => ({
      unit: u,
      items: resources.filter((r) => r.unit_id === u.id),
    }));
  }, [units, resources]);

  const stats = useMemo(() => {
    const total = resources.reduce((s, r) => s + r.quantity, 0);
    const available = resources.filter((r) => r.status === "available").reduce((s, r) => s + r.quantity, 0);
    const reserve = resources.filter((r) => r.is_reserve).reduce((s, r) => s + r.quantity, 0);
    const deployed = resources.filter((r) => r.status === "deployed").reduce((s, r) => s + r.quantity, 0);
    return { total, available, reserve, deployed };
  }, [resources]);

  const addUnit = async () => {
    if (!uName || !uCity) return toast.error("Назва та місто обов'язкові");
    setSaving(true);
    const { error } = await supabase.from("units").insert({
      name: uName,
      service: uService,
      region_id: uRegion,
      region_name: REGION_NAME_MAP[uRegion] ?? "",
      city: uCity,
      lat: parseFloat(uLat) || 0,
      lng: parseFloat(uLng) || 0,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Підрозділ додано");
    setUName(""); setUCity(""); setULat(""); setULng("");
  };

  const addResource = async () => {
    if (!rUnit) return toast.error("Оберіть підрозділ");
    const { error } = await supabase.from("resources").insert({
      unit_id: rUnit,
      type: rType,
      label: rType,
      quantity: parseInt(rQty) || 1,
      is_reserve: rReserve,
      status: rReserve ? "reserve" : "available",
    });
    if (error) return toast.error(error.message);
    toast.success("Ресурс додано");
    setRQty("1"); setRReserve(false);
  };

  const removeResource = async (id: string) => {
    const { error } = await supabase.from("resources").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Видалено");
  };

  const removeUnit = async (id: string) => {
    if (!confirm("Видалити підрозділ і всі його ресурси?")) return;
    const { error } = await supabase.from("units").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Підрозділ видалено");
  };

  const toggleReserve = async (r: any) => {
    const nextReserve = !r.is_reserve;
    const { error } = await supabase.from("resources").update({
      is_reserve: nextReserve,
      status: nextReserve ? "reserve" : "available",
    }).eq("id", r.id);
    if (error) return toast.error(error.message);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Boxes className="h-7 w-7 text-primary" /> Розподіл сил і ресурсів
        </h1>
        <p className="text-muted-foreground">Підрозділи, техніка, резерви та автоматичний розрахунок направлень</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Усього одиниць</div><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Доступно</div><div className="text-2xl font-bold text-green-500">{stats.available}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">У резерві</div><div className="text-2xl font-bold text-amber-500">{stats.reserve}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Задіяно</div><div className="text-2xl font-bold text-orange-500">{stats.deployed}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list"><Warehouse className="h-4 w-4 mr-2" />Підрозділи та ресурси</TabsTrigger>
          <TabsTrigger value="monitor"><MapPin className="h-4 w-4 mr-2" />Моніторинг по областях (ПТО)</TabsTrigger>
          {isAdmin && <TabsTrigger value="add"><Plus className="h-4 w-4 mr-2" />Додати</TabsTrigger>}
        </TabsList>

        <TabsContent value="list" className="mt-4">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : grouped.length === 0 ? (
            <Card><CardContent className="pt-6 text-center text-muted-foreground">Ще немає підрозділів. {isAdmin && "Додайте перший на вкладці «Додати»."}</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {grouped.map(({ unit, items }) => (
                <Card key={unit.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between flex-wrap gap-2">
                      <div>
                        <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />{unit.name}</CardTitle>
                        <CardDescription>
                          <Badge variant="outline" className="mr-2">{unit.service}</Badge>
                          {unit.city}, {unit.region_name}
                          {(unit.lat || unit.lng) ? <span className="ml-2 text-xs font-mono">{unit.lat.toFixed(3)}, {unit.lng.toFixed(3)}</span> : null}
                        </CardDescription>
                      </div>
                      {isAdmin && (
                        <Button variant="ghost" size="icon" onClick={() => removeUnit(unit.id)}><Trash2 className="h-4 w-4" /></Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {items.length === 0 ? (
                      <div className="text-sm text-muted-foreground">Немає ресурсів</div>
                    ) : (
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {items.map((r) => (
                          <div key={r.id} className="border rounded-md p-3 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Truck className="h-4 w-4 text-primary shrink-0" />
                              <div className="min-w-0">
                                <div className="text-sm font-medium truncate">{r.type}</div>
                                <div className="text-xs text-muted-foreground">
                                  ×{r.quantity}{" "}
                                  <Badge variant={r.status === "available" ? "default" : r.status === "deployed" ? "destructive" : "secondary"} className="ml-1 text-[10px] py-0">
                                    {r.status === "available" ? "Готова" : r.status === "deployed" ? "У дії" : r.status === "reserve" ? "Резерв" : "ТО"}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            {isAdmin && (
                              <div className="flex items-center gap-1">
                                <Switch checked={r.is_reserve} onCheckedChange={() => toggleReserve(r)} title="Резерв" />
                                <Button variant="ghost" size="icon" onClick={() => removeResource(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="monitor" className="mt-4">
          <RegionMonitor units={units} resources={resources} isAdmin={isAdmin} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="add" className="mt-4 space-y-4">
            <Card>
              <CardHeader><CardTitle>Новий підрозділ</CardTitle><CardDescription>Внесіть точку дислокації для автоматичного розрахунку відстаней</CardDescription></CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Назва</Label><Input value={uName} onChange={(e) => setUName(e.target.value)} placeholder="3-й ДПРЗ" /></div>
                <div className="space-y-1"><Label>Служба</Label>
                  <Select value={uService} onValueChange={setUService}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SERVICES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Область</Label>
                  <Select value={uRegion} onValueChange={setURegion}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{REGIONS.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Місто</Label><Input value={uCity} onChange={(e) => setUCity(e.target.value)} placeholder="Київ" /></div>
                <div className="space-y-1"><Label>Широта (lat)</Label><Input value={uLat} onChange={(e) => setULat(e.target.value)} placeholder="50.4501" /></div>
                <div className="space-y-1"><Label>Довгота (lng)</Label><Input value={uLng} onChange={(e) => setULng(e.target.value)} placeholder="30.5234" /></div>
                <div className="sm:col-span-2"><Button onClick={addUnit} disabled={saving}><Plus className="h-4 w-4 mr-2" />Додати підрозділ</Button></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Новий ресурс</CardTitle><CardDescription>Техніка або обладнання, прив'язане до підрозділу</CardDescription></CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Підрозділ</Label>
                  <Select value={rUnit} onValueChange={setRUnit}>
                    <SelectTrigger><SelectValue placeholder="Оберіть..." /></SelectTrigger>
                    <SelectContent>{units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name} — {u.city}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Тип</Label>
                  <Select value={rType} onValueChange={setRType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{RESOURCE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Кількість</Label><Input type="number" value={rQty} onChange={(e) => setRQty(e.target.value)} /></div>
                <div className="flex items-center gap-2 pt-6"><Switch checked={rReserve} onCheckedChange={setRReserve} /><Label>Помітити як резерв</Label></div>
                <div className="sm:col-span-2"><Button onClick={addResource}><Plus className="h-4 w-4 mr-2" />Додати ресурс</Button></div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default ResourcesPage;

async function logStatusChange(resource_id: string, action: string, from_status: string, to_status: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("resource_status_log").insert({
    resource_id, user_id: user.id, action, from_status, to_status,
  });
}

function RegionMonitor({ units, resources, isAdmin }: { units: any[]; resources: any[]; isAdmin: boolean }) {
  const [fRegion, setFRegion] = useState<string>(ALL);
  const [fService, setFService] = useState<string>(ALL);
  const [fType, setFType] = useState<string>(ALL);
  const [historyRegion, setHistoryRegion] = useState<{ id: string; name: string } | null>(null);

  const filteredUnits = useMemo(() => units.filter((u) =>
    (fRegion === ALL || u.region_id === fRegion) &&
    (fService === ALL || u.service === fService)
  ), [units, fRegion, fService]);

  const filteredResources = useMemo(() => {
    const unitIds = new Set(filteredUnits.map((u) => u.id));
    return resources.filter((r) => unitIds.has(r.unit_id) && (fType === ALL || r.type === fType));
  }, [resources, filteredUnits, fType]);

  const byRegion = useMemo(() => {
    const map = new Map<string, { region_id: string; region_name: string; units: any[]; res: any[] }>();
    REGIONS.forEach((r) => map.set(r.id, { region_id: r.id, region_name: r.name, units: [], res: [] }));
    filteredUnits.forEach((u) => {
      const g = map.get(u.region_id);
      if (g) g.units.push(u);
    });
    filteredResources.forEach((r) => {
      const u = units.find((x) => x.id === r.unit_id);
      if (!u) return;
      const g = map.get(u.region_id);
      if (g) g.res.push({ ...r, unit: u });
    });
    return Array.from(map.values()).filter((g) => g.units.length > 0 || g.res.length > 0);
  }, [filteredUnits, filteredResources, units]);

  const sendToPTO = async (r: any) => {
    const { error } = await supabase.from("resources").update({ status: "maintenance", is_reserve: false }).eq("id", r.id);
    if (error) return toast.error(error.message);
    await logStatusChange(r.id, "send_to_pto", r.status, "maintenance");
    toast.success("Направлено на ПТО");
  };
  const returnFromPTO = async (r: any) => {
    const { error } = await supabase.from("resources").update({ status: "available" }).eq("id", r.id);
    if (error) return toast.error(error.message);
    await logStatusChange(r.id, "return_from_pto", r.status, "available");
    toast.success("Повернено зі служби ПТО");
  };

  const hasFilters = fRegion !== ALL || fService !== ALL || fType !== ALL;
  const resetFilters = () => { setFRegion(ALL); setFService(ALL); setFType(ALL); };

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-2 text-sm font-medium"><Filter className="h-4 w-4" />Фільтри</div>
            <div className="space-y-1 min-w-[180px]">
              <Label className="text-xs">Область</Label>
              <Select value={fRegion} onValueChange={setFRegion}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Усі області</SelectItem>
                  {REGIONS.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 min-w-[160px]">
              <Label className="text-xs">Служба</Label>
              <Select value={fService} onValueChange={setFService}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Усі служби</SelectItem>
                  {SERVICES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 min-w-[200px]">
              <Label className="text-xs">Тип ресурсу</Label>
              <Select value={fType} onValueChange={setFType}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Усі типи</SelectItem>
                  {RESOURCE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters}><X className="h-4 w-4 mr-1" />Скинути</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {byRegion.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">Немає даних за обраними фільтрами.</CardContent></Card>
      ) : byRegion.map((g) => {
        const total = g.res.reduce((s, r) => s + r.quantity, 0);
        const maint = g.res.filter((r) => r.status === "maintenance").reduce((s, r) => s + r.quantity, 0);
        const available = g.res.filter((r) => r.status === "available").reduce((s, r) => s + r.quantity, 0);
        const deployed = g.res.filter((r) => r.status === "deployed").reduce((s, r) => s + r.quantity, 0);
        const reserve = g.res.filter((r) => r.is_reserve).reduce((s, r) => s + r.quantity, 0);
        const ptoPct = total ? Math.round((maint / total) * 100) : 0;
        const alert = total > 0 && available / Math.max(total, 1) < 0.3;
        return (
          <Card key={g.region_id} className={alert ? "border-destructive/50" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />{g.region_name}
                  {alert && <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Дефіцит</Badge>}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-muted-foreground">Підрозділів: {g.units.length} · Од. техніки: {total}</div>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setHistoryRegion({ id: g.region_id, name: g.region_name })}>
                    <History className="h-3 w-3 mr-1" />Історія ПТО
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="rounded-md border p-2"><div className="text-xs text-muted-foreground">Готова</div><div className="text-lg font-bold text-green-500">{available}</div></div>
                <div className="rounded-md border p-2"><div className="text-xs text-muted-foreground">У дії</div><div className="text-lg font-bold text-orange-500">{deployed}</div></div>
                <div className="rounded-md border p-2"><div className="text-xs text-muted-foreground">Резерв</div><div className="text-lg font-bold text-amber-500">{reserve}</div></div>
                <div className="rounded-md border p-2"><div className="text-xs text-muted-foreground">На ПТО</div><div className="text-lg font-bold text-blue-500">{maint}</div></div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span className="flex items-center gap-1"><Wrench className="h-3 w-3" />Завантаженість ПТО</span>
                  <span>{ptoPct}%</span>
                </div>
                <Progress value={ptoPct} />
              </div>

              {g.res.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Техніка регіону:</div>
                  <div className="grid sm:grid-cols-2 gap-1.5">
                    {g.res.map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-2 border rounded-md p-2 text-sm">
                        <div className="min-w-0">
                          <div className="truncate">{r.type} <span className="text-xs text-muted-foreground">×{r.quantity}</span></div>
                          <div className="text-xs text-muted-foreground truncate">{r.unit.name} · {r.unit.city}</div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant={r.status === "available" ? "default" : r.status === "maintenance" ? "secondary" : r.status === "deployed" ? "destructive" : "outline"} className="text-[10px]">
                            {r.status === "available" ? "Готова" : r.status === "maintenance" ? "ПТО" : r.status === "deployed" ? "У дії" : "Резерв"}
                          </Badge>
                          {isAdmin && (r.status === "maintenance"
                            ? <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => returnFromPTO(r)}>Повернути</Button>
                            : <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => sendToPTO(r)}><Wrench className="h-3 w-3 mr-1" />ПТО</Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <RegionHistoryDialog
        region={historyRegion}
        onOpenChange={(open) => !open && setHistoryRegion(null)}
        resources={resources}
        units={units}
      />
    </div>
  );
}

function RegionHistoryDialog({
  region, onOpenChange, resources, units,
}: {
  region: { id: string; name: string } | null;
  onOpenChange: (o: boolean) => void;
  resources: any[];
  units: any[];
}) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const regionResourceIds = useMemo(() => {
    if (!region) return [];
    const unitIds = new Set(units.filter((u) => u.region_id === region.id).map((u) => u.id));
    return resources.filter((r) => unitIds.has(r.unit_id)).map((r) => r.id);
  }, [region, units, resources]);

  useEffect(() => {
    if (!region || regionResourceIds.length === 0) { setLogs([]); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("resource_status_log")
        .select("*")
        .in("resource_id", regionResourceIds)
        .order("created_at", { ascending: false })
        .limit(200);
      if (!cancelled) {
        setLogs(data ?? []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [region, regionResourceIds]);

  const resourceMap = useMemo(() => {
    const m = new Map<string, any>();
    resources.forEach((r) => {
      const u = units.find((x) => x.id === r.unit_id);
      m.set(r.id, { ...r, unit: u });
    });
    return m;
  }, [resources, units]);

  return (
    <Dialog open={!!region} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><History className="h-5 w-5" />Історія ПТО — {region?.name}</DialogTitle>
          <DialogDescription>Усі направлення на технічне обслуговування та повернення.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
        ) : logs.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 text-sm">Записів ще немає.</div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => {
              const r = resourceMap.get(log.resource_id);
              const isPTO = log.action === "send_to_pto";
              return (
                <div key={log.id} className="border rounded-md p-3 flex items-start gap-3">
                  <div className={`mt-0.5 rounded-full p-1.5 ${isPTO ? "bg-blue-500/10 text-blue-500" : "bg-green-500/10 text-green-500"}`}>
                    {isPTO ? <Wrench className="h-3.5 w-3.5" /> : <Truck className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">
                      {isPTO ? "Направлено на ПТО" : "Повернено зі служби ПТО"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r ? `${r.type} · ${r.unit?.name ?? "—"} · ${r.unit?.city ?? ""}` : "Ресурс видалено"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(log.created_at).toLocaleString("uk-UA")}
                      {log.from_status && log.to_status && (
                        <span className="ml-2">· {log.from_status} → {log.to_status}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
