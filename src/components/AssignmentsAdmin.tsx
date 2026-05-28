import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MapPinned, Plus, X, Loader2, Bell } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { REGION_NAME_MAP } from "@/components/UkraineMap";

const SERVICES = ["ДСНС", "Поліція", "Нацгвардія", "Швидка допомога"];
const REGIONS = Object.entries(REGION_NAME_MAP).map(([id, name]) => ({ id, name }));

interface Row { id: string; user_id: string; region_id: string; region_name: string; service: string; full_name?: string }

const AssignmentsAdmin = () => {
  const { isAdmin } = useUserRole();
  const [rows, setRows] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [uId, setUId] = useState("");
  const [region, setRegion] = useState(REGIONS[0]?.id ?? "");
  const [service, setService] = useState(SERVICES[0]);

  const load = async () => {
    setLoading(true);
    const [a, p] = await Promise.all([
      supabase.from("admin_assignments").select("*"),
      supabase.from("profiles").select("id, full_name"),
    ]);
    const profs = (p.data ?? []) as any[];
    setProfiles(profs);
    const enriched = ((a.data ?? []) as any[]).map((r) => ({
      ...r,
      full_name: profs.find((x) => x.id === r.user_id)?.full_name || "(без імені)",
    }));
    setRows(enriched);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const add = async () => {
    if (!uId) return toast.error("Оберіть користувача");
    const { error } = await supabase.from("admin_assignments").insert({
      user_id: uId,
      region_id: region,
      region_name: REGION_NAME_MAP[region] ?? "",
      service,
    });
    if (error) return toast.error(error.message);
    toast.success("Зону відповідальності призначено");
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("admin_assignments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  if (!isAdmin) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><MapPinned className="h-5 w-5 text-primary" />Зони відповідальності</CardTitle>
        <CardDescription>
          <Bell className="h-3 w-3 inline mr-1" />
          Призначені адміни автоматично отримують сповіщення (in-app + email) про інциденти у своєму регіоні та службі
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-4 gap-2 items-end">
          <div className="space-y-1 sm:col-span-2">
            <Label>Користувач</Label>
            <Select value={uId} onValueChange={setUId}>
              <SelectTrigger><SelectValue placeholder="Оберіть..." /></SelectTrigger>
              <SelectContent>{profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || "(без імені)"}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Область</Label>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{REGIONS.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Служба</Label>
            <Select value={service} onValueChange={setService}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SERVICES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-4"><Button onClick={add}><Plus className="h-4 w-4 mr-2" />Призначити</Button></div>
        </div>

        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">Поки немає призначень</div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="border rounded-md p-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{r.full_name}</span>
                  <Badge variant="outline">{r.region_name || r.region_id}</Badge>
                  <Badge>{r.service}</Badge>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(r.id)}><X className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AssignmentsAdmin;
