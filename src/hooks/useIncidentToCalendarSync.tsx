import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIncidentStore } from "@/stores/useIncidentStore";
import type { Incident } from "@/data/mockIncidents";

/**
 * ════════════════════════════════════════════════════════════════
 * AUTO-SYNC: Інцидент → Календар
 * 
 * Коли інцидент у Сит. центрі стає Resolved, автоматично створюємо
 * (або оновлюємо) архівний запис у calendar_events за датою інциденту
 * з агрегованими цифрами по службах. Дубль уникаємо за маркером
 * "[auto:<incidentId>]" у description.
 * ════════════════════════════════════════════════════════════════
 */

const MARKER = (id: string) => `[auto:${id}]`;
const isAutoFromIncident = (desc: string | null | undefined, id: string) =>
  !!desc && desc.includes(MARKER(id));

function buildAutoEvent(inc: Incident, userId: string) {
  const eventDate = (() => {
    try {
      const d = new Date(inc.timestamp);
      if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
      return d.toISOString().slice(0, 10);
    } catch { return new Date().toISOString().slice(0, 10); }
  })();

  const description = [
    MARKER(inc.id),
    `Авто-зведення з Ситуаційного центру.`,
    `Тип: ${inc.type} | Рівень: ${inc.severity}`,
    `Локація: ${inc.regionName}${inc.address ? ", " + inc.address : ""}`,
    `Ресурси: ДСНС ${inc.resources.ses_units}, Поліція ${inc.resources.police_units}, Медичні ${inc.resources.medical_units}, особовий склад ${inc.resources.personnel_total}`,
    `Результат: врятовано ${inc.impact.rescued}, поранено ${inc.impact.injured}, загинуло ${inc.impact.fatalities}`,
    inc.description ? `\n${inc.description}` : "",
  ].join("\n");

  return {
    user_id: userId,
    title: `${inc.title || inc.type} — ${inc.regionName}`.slice(0, 200),
    description: description.slice(0, 2000),
    event_date: eventDate,
    service_ses: inc.resources.ses_units > 0,
    service_police: inc.resources.police_units > 0,
    service_national_guard: inc.lead_agency === "НГУ",
    service_other: inc.lead_agency && !["ДСНС", "Поліція", "НГУ"].includes(inc.lead_agency) ? inc.lead_agency : "",
    ses_people_rescued: inc.impact.rescued,
    ses_personnel_involved: inc.resources.personnel_total,
    ses_fires_extinguished: inc.type === "Fire" ? 1 : 0,
    ses_equipment_used: (inc.resources.specialized_equipment || []).join(", "),
    police_calls: inc.resources.police_units,
    police_patrols_deployed: inc.resources.police_units,
    police_arrests: inc.type === "Crime" ? 1 : 0,
    police_reports_filed: inc.type === "Crime" ? 1 : 0,
    ng_personnel_deployed: inc.lead_agency === "НГУ" ? inc.resources.personnel_total : 0,
    ng_equipment_units: 0,
    ng_operations_conducted: inc.lead_agency === "НГУ" ? 1 : 0,
    status: "completed" as const,
    is_archived: true,
    archived_at: new Date().toISOString(),
  };
}

async function upsertAutoEvent(inc: Incident, userId: string) {
  // Шукаємо існуючий за маркером
  const { data: existing } = await supabase
    .from("calendar_events" as any)
    .select("id, description")
    .ilike("description", `%${MARKER(inc.id)}%`)
    .limit(1);

  const payload = buildAutoEvent(inc, userId);

  if (existing && existing.length > 0) {
    const { id } = existing[0] as any;
    await supabase.from("calendar_events" as any).update(payload as any).eq("id", id);
  } else {
    await supabase.from("calendar_events" as any).insert(payload as any);
  }
}

/**
 * Активує авто-синхронізацію. Підключіть один раз на верхньому рівні
 * (напр. у DashboardLayout або App), щоб працювало по всьому застосунку.
 */
export function useIncidentToCalendarSync() {
  const { user } = useAuth();
  const { incidents } = useIncidentStore();
  const syncedRef = useRef<Set<string>>(new Set());
  const initialDoneRef = useRef(false);

  useEffect(() => {
    if (!user) return;

    // На першому проході запам'ятовуємо вже-resolved інциденти,
    // але також синхронізуємо ті, що ще не мають запису в календарі (backfill).
    const resolved = incidents.filter(i => i.status === "Resolved");

    (async () => {
      for (const inc of resolved) {
        if (syncedRef.current.has(inc.id)) continue;
        // Тільки для інцидентів автора (RLS дозволяє редагувати свої calendar_events)
        // Якщо інцидент не належить поточному юзеру — пропускаємо (його синхронізує власник)
        try {
          await upsertAutoEvent(inc, user.id);
          syncedRef.current.add(inc.id);
        } catch (e) {
          // тиха помилка — RLS або інше; не спамимо тостами
          console.warn("[sync] skip incident", inc.id, e);
        }
      }
      initialDoneRef.current = true;
    })();
  }, [incidents, user]);
}
