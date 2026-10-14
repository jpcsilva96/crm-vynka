import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, app.workspace_id, x-workspace-id",
};

const hasManageUsersPermission = (role: Record<string, unknown> | null) => {
  if (!role) return false;
  if (role.is_master === true) return true;

  const permissions = role.permissions as Record<string, unknown> | null;
  const menus = Array.isArray(permissions?.menus) ? permissions.menus : [];
  return permissions?.canManageUsers === true || menus.includes("users");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authorized");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error("Not authorized");

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { id } = await req.json();
    if (!id || typeof id !== "string") throw new Error("Invalid payload");
    if (id === user.id) throw new Error("Not allowed to delete your own user");

    const { data: callerProfile, error: callerError } = await supabaseAdmin
      .from("profiles")
      .select("id, role_id, organization_id")
      .eq("id", user.id)
      .single();
    if (callerError || !callerProfile) throw new Error("Caller profile not found");

    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from("profiles")
      .select("id, role_id, organization_id")
      .eq("id", id)
      .single();
    if (targetError || !targetProfile) throw new Error("Target profile not found");

    const { data: callerRole } = await supabaseAdmin
      .from("roles")
      .select("id, is_master, permissions")
      .eq("id", callerProfile.role_id)
      .maybeSingle();

    const { data: targetRole } = await supabaseAdmin
      .from("roles")
      .select("id, is_master")
      .eq("id", targetProfile.role_id)
      .maybeSingle();

    const canManageUsers = hasManageUsersPermission(callerRole);
    const sameOrganization = callerProfile.organization_id === targetProfile.organization_id;

    if (!canManageUsers || (!sameOrganization && callerRole?.is_master !== true)) {
      throw new Error("Not allowed to delete this user");
    }

    if (targetRole?.is_master === true) {
      throw new Error("Not allowed to delete master user");
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (deleteError) throw deleteError;

    await supabaseAdmin.from("profiles").delete().eq("id", id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      status: 400,
    });
  }
});
