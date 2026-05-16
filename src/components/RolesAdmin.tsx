import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Shield, ShieldCheck, User as UserIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useUserRole, ALL_PRIVILEGES, AppPrivilege, AppRole } from "@/hooks/useUserRole";

interface Row {
  id: string;
  full_name: string;
  role: AppRole;
  privileges: AppPrivilege[];
}

const RolesAdmin = () => {
  const { isAdmin, role, privileges, loading: meLoading } = useUserRole();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }, { data: privs }] = await Promise.all([
      supabase.from("profiles").select("id, full_name"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("user_privileges").select("user_id, privilege"),
    ]);
    const merged: Row[] = (profiles ?? []).map((p: any) => {
      const userRoles = (roles ?? []).filter((r: any) => r.user_id === p.id);
      const isA = userRoles.some((r: any) => r.role === "admin");
      return {
        id: p.id,
        full_name: p.full_name || "(без імені)",
        role: isA ? "admin" : "user",
        privileges: (privs ?? [])
          .filter((x: any) => x.user_id === p.id)
          .map((x: any) => x.privilege as AppPrivilege),
      };
    });
    setRows(merged);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const togglePrivilege = async (userId: string, priv: AppPrivilege, on: boolean) => {
    if (on) {
      const { error } = await supabase
        .from("user_privileges")
        .insert({ user_id: userId, privilege: priv });
      if (error) return toast.error(error.message);
      toast.success("Привілей надано");
    } else {
      const { error } = await supabase
        .from("user_privileges")
        .delete()
        .eq("user_id", userId)
        .eq("privilege", priv);
      if (error) return toast.error(error.message);
      toast.success("Привілей відкликано");
    }
    load();
  };

  const setRole = async (userId: string, makeAdmin: boolean) => {
    if (makeAdmin) {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" });
      if (error) return toast.error(error.message);
      toast.success("Призначено адміністратором");
    } else {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");
      if (error) return toast.error(error.message);
      toast.success("Адмінські права відкликано");
    }
    load();
  };

  if (meLoading) return <Loader2 className="h-5 w-5 animate-spin" />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {role === "admin" ? <ShieldCheck className="h-5 w-5 text-primary" /> : <UserIcon className="h-5 w-5" />}
            Ваш акаунт
          </CardTitle>
          <CardDescription>
            Поточна роль та активні привілеї
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Роль:</span>
            <Badge variant={role === "admin" ? "default" : "secondary"} className="uppercase">
              {role === "admin" ? "Адміністратор (Голова Ситуаційного центру)" : "Користувач (підрозділ)"}
            </Badge>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Привілеї:</div>
            <div className="flex flex-wrap gap-1">
              {role === "admin" ? (
                <Badge>Усі (адмін)</Badge>
              ) : privileges.length === 0 ? (
                <span className="text-xs text-muted-foreground">Базовий доступ — лише перегляд</span>
              ) : (
                privileges.map((p) => (
                  <Badge key={p} variant="outline">
                    {ALL_PRIVILEGES.find((x) => x.v === p)?.label ?? p}
                  </Badge>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {!isAdmin && (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Керування ролями та привілеями доступне лише головному адміністратору.
            Зверніться до Голови Ситуаційного центру для розширення прав.
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" /> Користувачі системи
            </CardTitle>
            <CardDescription>
              Призначайте адмінські права та видавайте гранулярні привілеї підрозділам
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <div className="space-y-4">
                {rows.map((u) => (
                  <div key={u.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        {u.role === "admin" ? (
                          <ShieldCheck className="h-4 w-4 text-primary" />
                        ) : (
                          <UserIcon className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-medium">{u.full_name}</span>
                        <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                          {u.role === "admin" ? "Адмін" : "Користувач"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Адмінські права</span>
                        <Switch
                          checked={u.role === "admin"}
                          onCheckedChange={(v) => setRole(u.id, v)}
                        />
                      </div>
                    </div>
                    {u.role !== "admin" && (
                      <div className="grid sm:grid-cols-2 gap-2 pt-2 border-t">
                        {ALL_PRIVILEGES.map((p) => {
                          const on = u.privileges.includes(p.v);
                          return (
                            <label
                              key={p.v}
                              className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                            >
                              <Switch
                                checked={on}
                                onCheckedChange={(v) => togglePrivilege(u.id, p.v, v)}
                              />
                              <div className="flex-1">
                                <div className="text-sm font-medium">{p.label}</div>
                                <div className="text-xs text-muted-foreground">{p.desc}</div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
                {rows.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    Користувачів ще немає
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RolesAdmin;
