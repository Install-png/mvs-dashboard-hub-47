import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Truck, Navigation, Send, MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useResources, RESOURCE_TYPES } from "@/hooks/useResources";
import { useAuth } from "@/hooks/useAuth";
import { haversineKm, etaMinutes } from "@/lib/distance";

interface Props {
  incidentId: string;
  incidentCoords: [number, number]; // [lng, lat]
  incidentCity?: string;
}

const ResourceDispatcher = ({ incidentId, incidentCoords, incidentCity }: Props) => {
  const { user } = useAuth();
  const { units, resources } = useResources();
  const [type, setType] = useState(RESOURCE_TYPES[0]);
  const [dispatching, setDispatching] = useState<string | null>(null);

  const suggestions = useMemo(() => {
    const matching = resources.filter((r) => r.type === type && r.status === "available" && r.quantity > 0);
    const enriched = matching.map((r) => {
      const u = units.find((x) => x.id === r.unit_id);
      if (!u || (!u.lat && !u.lng)) return null;
      const km = haversineKm(incidentCoords, [u.lng, u.lat]);
      const sameCity = incidentCity && u.city && u.city.toLowerCase() === incidentCity.toLowerCase();
      return { resource: r, unit: u, km, eta: etaMinutes(km), sameCity };
    }).filter(Boolean) as { resource: any; unit: any; km: number; eta: number; sameCity: boolean }[];
    return enriched.sort((a, b) => (Number(b.sameCity) - Number(a.sameCity)) || a.km - b.km).slice(0, 5);
  }, [type, resources, units, incidentCoords, incidentCity]);

  const dispatch = async (s: typeof suggestions[number]) => {
    if (!user) return toast.error("Необхідна авторизація");
    setDispatching(s.resource.id);
    const { error: e1 } = await supabase.from("resource_dispatches").insert({
      incident_id: incidentId,
      resource_id: s.resource.id,
      user_id: user.id,
      eta_minutes: s.eta,
      distance_km: s.km,
    });
    if (e1) { setDispatching(null); return toast.error(e1.message); }
    await supabase.from("resources").update({ status: "deployed" }).eq("id", s.resource.id);
    toast.success(`${s.resource.type} направлено з «${s.unit.name}», ETA ~${s.eta} хв`);
    setDispatching(null);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><Navigation className="h-4 w-4 text-primary" />Розрахунок ресурсів</CardTitle>
        <CardDescription>Автоматичний підбір найближчого підрозділу з потрібною технікою</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label>Потрібна техніка</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{RESOURCE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        {suggestions.length === 0 ? (
          <div className="text-sm text-muted-foreground border rounded-md p-3 text-center">
            Немає доступних одиниць цього типу. Перевірте розділ «Ресурси» або змініть тип.
          </div>
        ) : (
          <div className="space-y-2">
            {suggestions.map((s) => (
              <div key={s.resource.id} className="border rounded-md p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-primary" />
                    <span className="font-medium truncate">{s.unit.name}</span>
                    {s.sameCity && <Badge variant="outline" className="text-[10px]">У місті</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                    <MapPin className="h-3 w-3" />
                    {s.unit.city} · {s.km.toFixed(1)} км · ETA ~{s.eta} хв · ×{s.resource.quantity}
                  </div>
                </div>
                <Button size="sm" onClick={() => dispatch(s)} disabled={dispatching === s.resource.id}>
                  <Send className="h-3.5 w-3.5 mr-1" />Направити
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ResourceDispatcher;
