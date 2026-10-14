import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, app.workspace_id, x-workspace-id",
};

const normalizeWorkspaceIds = (workspaces: unknown) =>
  Array.from(new Set((Array.isArray(workspaces) ? workspaces : []).map(String).filter(Boolean)));

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
    const { id, updates } = await req.json();
    if (!id || !updates || typeof updates !== "object") throw new Error("Invalid payload");

    const { data: callerProfile, error: callerError } = await supabaseAdmin
      .from("profiles")
      .select("id, role_id, organization_id")
      .eq("id", user.id)
      .single();
    if (callerError || !callerProfile) throw new Error("Caller profile not found");

    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from("profiles")
      .select("id, organization_id, role_id")
      .eq("id", id)
      .single();
    if (targetError || !targetProfile) throw new Error("Target profile not found");

    const { data: callerRole } = await supabaseAdmin
      .from("roles")
      .select("id, is_master, permissions")
      .eq("id", callerProfile.role_id)
      .maybeSingle();

    const isSelfUpdate = user.id === id;
    const canManageUsers = hasManageUsersPermission(callerRole);
    const callerIsMaster = callerRole?.is_master === true;
    const sameOrganization = callerProfile.organization_id === targetProfile.organization_id;

    if (!isSelfUpdate && (!canManageUsers || !sameOrganization)) {
      throw new Error("Not allowed to update this user");
    }

    const profileUpdates: Record<string, unknown> = {};
    const bodyUpdates = updates as Record<string, unknown>;

    if (typeof bodyUpdates.name === "string") profileUpdates.name = bodyUpdates.name;
    if (typeof bodyUpdates.email === "string") profileUpdates.email = bodyUpdates.email.toLowerCase();
    if (typeof bodyUpdates.cpf === "string") profileUpdates.cpf = bodyUpdates.cpf;
    if (typeof bodyUpdates.roleId === "string") profileUpdates.role_id = bodyUpdates.roleId;
    if (Array.isArray(bodyUpdates.workspaces)) profileUpdates.workspaces = normalizeWorkspaceIds(bodyUpdates.workspaces);
    if (typeof bodyUpdates.avatar === "string" || bodyUpdates.avatar === null) profileUpdates.avatar = bodyUpdates.avatar;
    if (typeof bodyUpdates.requirePasswordChange === "boolean") {
      profileUpdates.require_password_change = bodyUpdates.requirePasswordChange;
    }

    if (isSelfUpdate && !canManageUsers) {
      const allowedSelfFields = new Set(["name", "email", "avatar", "require_password_change"]);
      const invalidSelfField = Object.keys(profileUpdates).find((key) => !allowedSelfFields.has(key));
      if (invalidSelfField || bodyUpdates.password) throw new Error("Not allowed to update this field");
    }

    const { data: currentTargetRole } = await supabaseAdmin
      .from("roles")
      .select("id, is_master")
      .eq("id", targetProfile.role_id)
      .maybeSingle();

    if (currentTargetRole?.is_master === true && !callerIsMaster) {
      const touchesSensitiveTargetFields =
        Object.keys(profileUpdates).some((key) => key !== "avatar")
        || typeof bodyUpdates.password === "string";
      if (touchesSensitiveTargetFields) throw new Error("Not allowed to update a master user");
    }

    if (typeof bodyUpdates.roleId === "string") {
      const { data: targetRole, error: targetRoleError } = await supabaseAdmin
        .from("roles")
        .select("id, is_master")
        .eq("id", bodyUpdates.roleId)
        .maybeSingle();
      if (targetRoleError || !targetRole) throw new Error("Target role not found");
      if (targetRole.is_master === true && !callerIsMaster) {
        throw new Error("Not allowed to assign master role");
      }
    }

    const authUpdates: Record<string, unknown> = {};
    if (typeof bodyUpdates.email === "string") authUpdates.email = bodyUpdates.email.toLowerCase();
    if (typeof bodyUpdates.password === "string" && bodyUpdates.password.length > 0) authUpdates.password = bodyUpdates.password;

    if (Object.keys(authUpdates).length > 0) {
      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdates);
      if (authUpdateError) throw authUpdateError;
    }

    let profile = targetProfile;
    if (Object.keys(profileUpdates).length > 0) {
      const { data: updatedProfile, error: updateError } = await supabaseAdmin
        .from("profiles")
        .update(profileUpdates)
        .eq("id", id)
        .select("id, name, email, cpf, role_id, workspaces, avatar, require_password_change, organization_id, created_at")
        .single();

      if (updateError) throw updateError;
      profile = updatedProfile;
    }

    return new Response(JSON.stringify({ profile }), {
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
