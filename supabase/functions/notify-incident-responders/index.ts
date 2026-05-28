import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { incident } = await req.json();
    if (!incident?.id || !incident?.region_id) {
      return new Response(JSON.stringify({ error: "incident.id and region_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const service = incident.service || incident.lead_agency || "";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find admins assigned to this region+service (service optional match)
    let query = supabase.from("admin_assignments").select("user_id, service, region_id").eq("region_id", incident.region_id);
    if (service) query = query.in("service", [service, ""]);
    const { data: assignments, error: aErr } = await query;
    if (aErr) throw aErr;

    const userIds = Array.from(new Set((assignments ?? []).map((a: any) => a.user_id)));
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ notified: 0, info: "no responders assigned" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const title = `НС: ${incident.title || incident.type || "інцидент"}`;
    const body = [
      `Регіон: ${incident.region_name || incident.region_id}`,
      incident.address ? `Адреса: ${incident.address}` : null,
      `Загроза: ${incident.severity || "невідомо"}`,
      service ? `Служба: ${service}` : null,
    ].filter(Boolean).join("\n");

    const rows = userIds.map((user_id) => ({
      user_id, incident_id: incident.id, kind: "incident",
      title, body, channel: "in_app",
    }));
    const { error: nErr } = await supabase.from("notifications").insert(rows);
    if (nErr) throw nErr;

    // Email: requires verified email domain. We try to invoke the transactional
    // send function only if it exists in this project (no-op otherwise).
    let emailed = 0;
    try {
      const { data: users } = await supabase.auth.admin.listUsers();
      const emails = (users?.users ?? [])
        .filter((u: any) => userIds.includes(u.id) && u.email)
        .map((u: any) => u.email as string);

      for (const email of emails) {
        const res = await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "incident-alert",
            recipientEmail: email,
            idempotencyKey: `incident-${incident.id}-${email}`,
            templateData: { title, body, severity: incident.severity || "" },
          },
        });
        if (!res.error) emailed++;
      }
    } catch (_e) {
      // email infra not yet configured — silently skip
    }

    return new Response(JSON.stringify({ notified: rows.length, emailed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String((e as any)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
