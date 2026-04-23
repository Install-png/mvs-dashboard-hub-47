import { useMemo } from "react";
import { isToday, isYesterday, isSameDay, startOfDay, endOfDay, isWithinInterval, format } from "date-fns";
import { useIncidentStore } from "@/stores/useIncidentStore";
import type { Incident } from "@/data/mockIncidents";

/**
 * ════════════════════════════════════════════════════════════════
 * UNIFIED STATS — JEDYNE źródło prawdy для Дашборду / Ситуаційного центру / Календаря
 * 
 * Усі цифри (кількість інцидентів, врятовані, поранені, ресурси, по службах)
 * рахуються тут із одного store. Ніяких локальних підрахунків в компонентах.
 * ════════════════════════════════════════════════════════════════
 */

export interface PeriodStats {
  total: number;
  active: number;
  critical: number;
  resolved: number;
  rescued: number;
  injured: number;
  fatalities: number;
  damage_uah: number;
  personnel: number;
  ses_units: number;
  police_units: number;
  medical_units: number;
  byService: { ses: number; police: number; medical: number; combined: number };
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  incidents: Incident[];
}

const EMPTY_STATS: PeriodStats = {
  total: 0, active: 0, critical: 0, resolved: 0,
  rescued: 0, injured: 0, fatalities: 0, damage_uah: 0,
  personnel: 0, ses_units: 0, police_units: 0, medical_units: 0,
  byService: { ses: 0, police: 0, medical: 0, combined: 0 },
  bySeverity: {}, byType: {}, byStatus: {}, incidents: [],
};

function aggregate(incs: Incident[]): PeriodStats {
  if (incs.length === 0) return { ...EMPTY_STATS };
  const stats: PeriodStats = {
    total: incs.length,
    active: 0, critical: 0, resolved: 0,
    rescued: 0, injured: 0, fatalities: 0, damage_uah: 0,
    personnel: 0, ses_units: 0, police_units: 0, medical_units: 0,
    byService: { ses: 0, police: 0, medical: 0, combined: 0 },
    bySeverity: {}, byType: {}, byStatus: {}, incidents: incs,
  };
  for (const i of incs) {
    if (i.status === "Resolved") stats.resolved++; else stats.active++;
    if (i.severity === "Critical") stats.critical++;
    stats.rescued += i.impact.rescued || 0;
    stats.injured += i.impact.injured || 0;
    stats.fatalities += i.impact.fatalities || 0;
    stats.damage_uah += Number(i.impact.damage_uah) || 0;
    stats.personnel += i.resources.personnel_total || 0;
    stats.ses_units += i.resources.ses_units || 0;
    stats.police_units += i.resources.police_units || 0;
    stats.medical_units += i.resources.medical_units || 0;
    const cat = i.category?.toLowerCase() as keyof typeof stats.byService;
    if (cat && cat in stats.byService) stats.byService[cat]++;
    stats.bySeverity[i.severity] = (stats.bySeverity[i.severity] || 0) + 1;
    stats.byType[i.type] = (stats.byType[i.type] || 0) + 1;
    stats.byStatus[i.status] = (stats.byStatus[i.status] || 0) + 1;
  }
  return stats;
}

function safeDate(v: any): Date | null {
  try {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  } catch { return null; }
}

/** Фільтрує інциденти за датою їх створення (timestamp) */
function filterByDate(incs: Incident[], date: Date): Incident[] {
  return incs.filter(i => {
    const d = safeDate(i.timestamp);
    return d ? isSameDay(d, date) : false;
  });
}

function filterByRange(incs: Incident[], from: Date, to: Date): Incident[] {
  const start = startOfDay(from), end = endOfDay(to);
  return incs.filter(i => {
    const d = safeDate(i.timestamp);
    return d ? isWithinInterval(d, { start, end }) : false;
  });
}

/**
 * Хук уніфікованої статистики
 * Усі компоненти використовують ОДНІ й ТІ Ж цифри
 */
export function useUnifiedStats() {
  const { incidents } = useIncidentStore();

  return useMemo(() => {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 3600000);

    const all = aggregate(incidents);
    const todayStats = aggregate(filterByDate(incidents, today));
    const yesterdayStats = aggregate(filterByDate(incidents, yesterday));

    // Trend: today vs yesterday
    const trends = {
      total: todayStats.total - yesterdayStats.total,
      critical: todayStats.critical - yesterdayStats.critical,
      rescued: todayStats.rescued - yesterdayStats.rescued,
      injured: todayStats.injured - yesterdayStats.injured,
      personnel: todayStats.personnel - yesterdayStats.personnel,
    };

    /**
     * Групування інцидентів за датами — для календаря
     * Кожна дата отримує "auto-aggregate" — як архівну подію з підрахованими цифрами.
     */
    const byDateMap = new Map<string, Incident[]>();
    incidents.forEach(i => {
      const d = safeDate(i.timestamp);
      if (!d) return;
      const k = format(d, "yyyy-MM-dd");
      if (!byDateMap.has(k)) byDateMap.set(k, []);
      byDateMap.get(k)!.push(i);
    });

    const byDate: Record<string, PeriodStats> = {};
    byDateMap.forEach((list, key) => { byDate[key] = aggregate(list); });

    /** Для будь-якої довільної дати */
    const statsForDate = (date: Date): PeriodStats => {
      const k = format(date, "yyyy-MM-dd");
      return byDate[k] || { ...EMPTY_STATS };
    };

    /** Для довільного діапазону */
    const statsForRange = (from: Date, to: Date): PeriodStats =>
      aggregate(filterByRange(incidents, from, to));

    return {
      all,
      today: todayStats,
      yesterday: yesterdayStats,
      trends,
      byDate,
      statsForDate,
      statsForRange,
    };
  }, [incidents]);
}
