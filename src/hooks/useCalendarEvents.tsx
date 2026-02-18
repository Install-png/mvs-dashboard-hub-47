import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  description: string;
  event_date: string;
  event_time: string | null;
  location: string;
  service_ses: boolean;
  service_police: boolean;
  service_national_guard: boolean;
  service_other: string;
  ses_people_rescued: number;
  ses_fires_extinguished: number;
  ses_equipment_used: string;
  ses_personnel_involved: number;
  police_calls: number;
  police_arrests: number;
  police_reports_filed: number;
  police_patrols_deployed: number;
  ng_personnel_deployed: number;
  ng_equipment_units: number;
  ng_operations_conducted: number;
  created_at: string;
  updated_at: string;
}

export const emptyEvent = (): Partial<CalendarEvent> => ({
  title: "",
  description: "",
  event_date: new Date().toISOString().slice(0, 10),
  event_time: null,
  location: "",
  service_ses: false,
  service_police: false,
  service_national_guard: false,
  service_other: "",
  ses_people_rescued: 0,
  ses_fires_extinguished: 0,
  ses_equipment_used: "",
  ses_personnel_involved: 0,
  police_calls: 0,
  police_arrests: 0,
  police_reports_filed: 0,
  police_patrols_deployed: 0,
  ng_personnel_deployed: 0,
  ng_equipment_units: 0,
  ng_operations_conducted: 0,
});

export function useCalendarEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchEvents = useCallback(async () => {
    const { data, error } = await supabase
      .from("calendar_events" as any)
      .select("*")
      .order("event_date", { ascending: false });
    if (error) {
      toast({ title: "Помилка", description: error.message, variant: "destructive" });
    } else {
      setEvents((data as unknown as CalendarEvent[]) || []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const saveEvent = async (ev: Partial<CalendarEvent>) => {
    if (!user) return;
    const payload = { ...ev, user_id: user.id } as any;
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;

    if (ev.id) {
      const { error } = await supabase
        .from("calendar_events" as any)
        .update(payload)
        .eq("id", ev.id);
      if (error) toast({ title: "Помилка", description: error.message, variant: "destructive" });
    } else {
      const { error } = await supabase
        .from("calendar_events" as any)
        .insert(payload);
      if (error) toast({ title: "Помилка", description: error.message, variant: "destructive" });
    }
    await fetchEvents();
  };

  const deleteEvent = async (id: string) => {
    const { error } = await supabase.from("calendar_events" as any).delete().eq("id", id);
    if (error) toast({ title: "Помилка", description: error.message, variant: "destructive" });
    await fetchEvents();
  };

  return { events, loading, fetchEvents, saveEvent, deleteEvent };
}
