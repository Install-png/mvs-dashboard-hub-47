import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Unit {
  id: string;
  name: string;
  service: string;
  region_id: string;
  region_name: string;
  city: string;
  lat: number;
  lng: number;
}

export interface Resource {
  id: string;
  unit_id: string;
  type: string;
  label: string;
  status: "available" | "deployed" | "maintenance" | "reserve";
  is_reserve: boolean;
  quantity: number;
}

export const RESOURCE_TYPES = [
  "Автодрабина",
  "Автоцистерна (АЦ)",
  "Реанімобіль",
  "Швидка медична допомога",
  "БТР",
  "Патрульний автомобіль",
  "Спецавтомобіль",
  "Дрон / БПЛА",
  "Підіймач",
  "Тепловізор",
  "Газодимозахисний комплект",
];

export function useResources() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [u, r] = await Promise.all([
      supabase.from("units").select("*").order("name"),
      supabase.from("resources").select("*").order("type"),
    ]);
    setUnits((u.data as Unit[]) ?? []);
    setResources((r.data as Resource[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("units-resources")
      .on("postgres_changes", { event: "*", schema: "public", table: "units" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "resources" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  return { units, resources, loading, reload: load };
}
