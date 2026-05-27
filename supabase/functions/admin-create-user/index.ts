// Admin-only: create a new user (with optional admin role)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Не авторизовано" }, 401);

    // Verify caller is admin
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: "Не авторизовано" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Лише адміністратор може створювати користувачів" }, 403);

    const body = await req.json();
    const { email, password, full_name, role } = body as {
      email: string; password: string; full_name?: string; role?: "admin" | "user";
    };

    if (!email || !password || password.length < 6) {
      return json({ error: "Email та пароль (мін. 6 символів) обов'язкові" }, 400);
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name ?? "" },
    });
    if (createErr || !created.user) return json({ error: createErr?.message ?? "Не вдалося створити" }, 400);

    const newUserId = created.user.id;

    // handle_new_user trigger inserts profile + default role.
    // If admin requested, ensure admin role exists.
    if (role === "admin") {
      await admin.from("user_roles").insert({
        user_id: newUserId,
        role: "admin",
        granted_by: userData.user.id,
      });
    }

    // Make sure profile has full_name even if trigger ran before metadata was applied
    if (full_name) {
      await admin.from("profiles").upsert({ id: newUserId, full_name }, { onConflict: "id" });
    }

    return json({ ok: true, user_id: newUserId });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
