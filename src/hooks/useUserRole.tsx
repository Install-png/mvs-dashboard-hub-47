import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AppRole = "admin" | "user";
export type AppPrivilege =
  | "manage_incidents"
  | "manage_calendar"
  | "manage_reports"
  | "manage_users"
  | "export_data"
  | "view_audit_log";

export const ALL_PRIVILEGES: { v: AppPrivilege; label: string; desc: string }[] = [
  { v: "manage_incidents", label: "Керування інцидентами", desc: "Створення/редагування/видалення інцидентів" },
  { v: "manage_calendar", label: "Керування календарем", desc: "Створення та редагування подій календаря" },
  { v: "manage_reports", label: "Керування звітами", desc: "Генерація та експорт звітів" },
  { v: "manage_users", label: "Керування користувачами", desc: "Перегляд переліку користувачів" },
  { v: "export_data", label: "Експорт даних", desc: "Експорт PDF/CSV" },
  { v: "view_audit_log", label: "Перегляд аудиту", desc: "Доступ до журналу дій" },
];

export const useUserRole = () => {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [privileges, setPrivileges] = useState<AppPrivilege[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setRole(null);
      setPrivileges([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: roles }, { data: privs }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("user_privileges").select("privilege").eq("user_id", user.id),
    ]);
    const isAdmin = roles?.some((r: any) => r.role === "admin");
    setRole(isAdmin ? "admin" : roles && roles.length > 0 ? "user" : "user");
    setPrivileges((privs ?? []).map((p: any) => p.privilege as AppPrivilege));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isAdmin = role === "admin";
  const can = (p: AppPrivilege) => isAdmin || privileges.includes(p);

  return { role, isAdmin, privileges, can, loading, refresh };
};
