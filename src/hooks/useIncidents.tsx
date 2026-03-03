import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Incident, IncidentType, IncidentStatus, SeverityLevel } from "@/data/mockIncidents";
import { VALID_STATUSES, VALID_SEVERITIES, VALID_TYPES } from "@/data/mockIncidents";
import { toast } from "sonner";

function isValidDate(v: any): boolean {
  if (!v) return false;
  const d = new Date(v);
  return !isNaN(d.getTime());
}

// Map DB row to front-end Incident type
function rowToIncident(row: any): Incident {
  return {
    id: row.id,
    timestamp: isValidDate(row.time) ? row.time : (isValidDate(row.created_at) ? row.created_at : new Date().toISOString()),
    coordinates: [row.coordinates_lng ?? 0, row.coordinates_lat ?? 0],
    region: row.region_id ?? "",
    regionName: row.region_name ?? row.location ?? "",
    title: row.title ?? "",
    type: (row.type || "Rescue") as IncidentType,
    status: (row.status || "Ongoing") as IncidentStatus,
    severity: (row.severity || "Major") as SeverityLevel,
    resources: {
      ses_units: row.ses_units ?? 0,
      police_units: row.police_units ?? 0,
      medical_units: row.medical_units ?? 0,
      personnel_total: row.personnel_total ?? 0,
    },
    impact: {
      rescued: row.rescued ?? 0,
      injured: row.injured ?? 0,
      fatalities: row.fatalities ?? 0,
      damage_est: row.damage_est ?? "",
      damage_uah: Number(row.damage_uah ?? 0),
    },
    estimated_resolution_time: row.estimated_resolution_time ?? new Date(Date.now() + 3 * 3600000).toISOString(),
    risk_level: row.risk_level ?? 5,
    description: row.description ?? "",
    lead_agency: row.lead_agency ?? "ДСНС",
  };
}

function validateIncident(inc: Partial<Incident>): string | null {
  if (!inc.title?.trim()) return "Назва інциденту обов'язкова";
  if (inc.title.length > 200) return "Назва занадто довга (макс. 200 символів)";
  if (inc.severity && !VALID_SEVERITIES.includes(inc.severity)) return `Невірний рівень: ${inc.severity}`;
  if (inc.status && !VALID_STATUSES.includes(inc.status)) return `Невірний статус: ${inc.status}`;
  if (inc.type && !VALID_TYPES.includes(inc.type)) return `Невірний тип: ${inc.type}`;
  return null;
}

// Map front-end Incident to DB insert/update shape
function incidentToRow(inc: Partial<Incident>, userId: string) {
  return {
    user_id: userId,
    title: (inc.title ?? "").trim().substring(0, 200),
    type: inc.type ?? "Rescue",
    status: inc.status ?? "Ongoing",
    time: inc.timestamp ?? new Date().toISOString(),
    location: inc.regionName ?? "",
    description: (inc.description ?? "").substring(0, 2000),
    service: inc.lead_agency ?? "ДСНС",
    coordinates_lng: inc.coordinates?.[0] ?? 0,
    coordinates_lat: inc.coordinates?.[1] ?? 0,
    region_id: inc.region ?? "",
    region_name: inc.regionName ?? "",
    severity: inc.severity ?? "Major",
    lead_agency: inc.lead_agency ?? "ДСНС",
    ses_units: inc.resources?.ses_units ?? 0,
    police_units: inc.resources?.police_units ?? 0,
    medical_units: inc.resources?.medical_units ?? 0,
    personnel_total: inc.resources?.personnel_total ?? 0,
    rescued: inc.impact?.rescued ?? 0,
    injured: inc.impact?.injured ?? 0,
    fatalities: inc.impact?.fatalities ?? 0,
    damage_est: inc.impact?.damage_est ?? "",
    damage_uah: inc.impact?.damage_uah ?? 0,
    estimated_resolution_time: inc.estimated_resolution_time ?? new Date(Date.now() + 3 * 3600000).toISOString(),
    risk_level: inc.risk_level ?? 5,
  };
}

export function useIncidents() {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all incidents
  const fetchIncidents = useCallback(async () => {
    const { data, error } = await supabase
      .from("incidents")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching incidents:", error);
      toast.error("Помилка завантаження інцидентів");
    } else {
      setIncidents((data ?? []).map(rowToIncident));
    }
    setLoading(false);
  }, []);

  // Realtime subscription
  useEffect(() => {
    fetchIncidents();

    const channel = supabase
      .channel("incidents-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incidents" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setIncidents((prev) => [rowToIncident(payload.new), ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setIncidents((prev) =>
              prev.map((inc) => (inc.id === (payload.new as any).id ? rowToIncident(payload.new) : inc))
            );
          } else if (payload.eventType === "DELETE") {
            setIncidents((prev) => prev.filter((inc) => inc.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchIncidents]);

  // Create
  const createIncident = useCallback(
    async (inc: Partial<Incident>) => {
      if (!user) {
        toast.error("Необхідна авторизація");
        return null;
      }
      const validationError = validateIncident(inc);
      if (validationError) {
        toast.error(validationError);
        return null;
      }
      const row = incidentToRow(inc, user.id);
      const { data, error } = await supabase
        .from("incidents")
        .insert(row as any)
        .select()
        .single();

      if (error) {
        console.error("Error creating incident:", error);
        toast.error("Помилка створення інциденту");
        return null;
      }
      toast.success("Інцидент створено");
      return rowToIncident(data);
    },
    [user]
  );

  // Update
  const updateIncident = useCallback(
    async (id: string, updates: Partial<Incident>) => {
      if (!user) {
        toast.error("Необхідна авторизація");
        return false;
      }
      const validationError = validateIncident({ title: "placeholder", ...updates });
      if (validationError) {
        toast.error(validationError);
        return false;
      }
      const partial: Record<string, any> = {};
      if (updates.title !== undefined) partial.title = updates.title;
      if (updates.type !== undefined) partial.type = updates.type;
      if (updates.status !== undefined) partial.status = updates.status;
      if (updates.severity !== undefined) partial.severity = updates.severity;
      if (updates.description !== undefined) partial.description = updates.description;
      if (updates.lead_agency !== undefined) {
        partial.lead_agency = updates.lead_agency;
        partial.service = updates.lead_agency;
      }
      if (updates.region !== undefined) partial.region_id = updates.region;
      if (updates.regionName !== undefined) {
        partial.region_name = updates.regionName;
        partial.location = updates.regionName;
      }
      if (updates.coordinates) {
        partial.coordinates_lng = updates.coordinates[0];
        partial.coordinates_lat = updates.coordinates[1];
      }
      if (updates.resources) {
        partial.ses_units = updates.resources.ses_units;
        partial.police_units = updates.resources.police_units;
        partial.medical_units = updates.resources.medical_units;
        partial.personnel_total = updates.resources.personnel_total;
      }
      if (updates.impact) {
        partial.rescued = updates.impact.rescued;
        partial.injured = updates.impact.injured;
        partial.fatalities = updates.impact.fatalities;
        partial.damage_est = updates.impact.damage_est;
        partial.damage_uah = updates.impact.damage_uah;
      }
      if (updates.risk_level !== undefined) partial.risk_level = updates.risk_level;
      if (updates.estimated_resolution_time !== undefined)
        partial.estimated_resolution_time = updates.estimated_resolution_time;

      const { error } = await supabase.from("incidents").update(partial).eq("id", id);
      if (error) {
        console.error("Error updating incident:", error);
        toast.error("Помилка оновлення інциденту");
        return false;
      }
      toast.success("Інцидент оновлено");
      return true;
    },
    [user]
  );

  // Delete
  const deleteIncident = useCallback(
    async (id: string) => {
      if (!user) {
        toast.error("Необхідна авторизація");
        return false;
      }
      const { error } = await supabase.from("incidents").delete().eq("id", id);
      if (error) {
        console.error("Error deleting incident:", error);
        toast.error("Помилка видалення інциденту");
        return false;
      }
      toast.success("Інцидент видалено");
      return true;
    },
    [user]
  );

  return { incidents, loading, createIncident, updateIncident, deleteIncident, refetch: fetchIncidents };
}
