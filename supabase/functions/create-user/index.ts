import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, app.workspace_id, x-workspace-id',
}

const normalizeWorkspaceIds = (workspaces: unknown) =>
  Array.from(new Set((Array.isArray(workspaces) ? workspaces : []).map(String).filter(Boolean)))

const findAuthUserByEmail = async (supabaseAdmin: ReturnType<typeof createClient>, email: string) => {
  const targetEmail = email.toLowerCase()

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error

    const existingUser = data.users.find((item) => item.email?.toLowerCase() === targetEmail)
    if (existingUser) return existingUser
    if (data.users.length < 1000) return null
  }

  return null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    
    // Auth check
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error("Not authorized")

    // Admin client to create user
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { email, password, name, cpf, roleId, workspaces, organizationId } = await req.json()
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : ""
    const normalizedWorkspaces = normalizeWorkspaceIds(workspaces)
    if (!normalizedEmail || !password || !name || !roleId) throw new Error("Preencha nome, email, senha e perfil")

    const { data: callerProfile, error: callerError } = await supabaseAdmin
      .from("profiles")
      .select("id, role_id, organization_id")
      .eq("id", user.id)
      .single()
    if (callerError || !callerProfile) throw new Error("Caller profile not found")

    const { data: callerRole } = await supabaseAdmin
      .from("roles")
      .select("id, is_master, permissions")
      .eq("id", callerProfile.role_id)
      .maybeSingle()

    const permissions = callerRole?.permissions as Record<string, unknown> | null
    const menus = Array.isArray(permissions?.menus) ? permissions.menus : []
    const canManageUsers = callerRole?.is_master === true || permissions?.canManageUsers === true || menus.includes("users")
    if (!canManageUsers) throw new Error("Not allowed to create users")

    const targetOrganizationId = typeof organizationId === "string" && organizationId.trim()
      ? organizationId.trim()
      : callerProfile.organization_id
    if (!targetOrganizationId) throw new Error("Target organization not found")
    if (callerRole?.is_master !== true && callerProfile.organization_id !== targetOrganizationId) {
      throw new Error("Not allowed to create users in this organization")
    }

    const { data: targetRole, error: targetRoleError } = await supabaseAdmin
      .from("roles")
      .select("id, is_master")
      .eq("id", roleId)
      .maybeSingle()
    if (targetRoleError || !targetRole) throw new Error("Target role not found")
    if (targetRole.is_master === true && callerRole?.is_master !== true) {
      throw new Error("Not allowed to assign master role")
    }

    // Create user in auth.users and persist the public profile explicitly.
    let authUser = null
    let createdAuthUser = false
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          name,
          cpf,
          roleId,
          workspaces: normalizedWorkspaces,
          organizationId: targetOrganizationId,
          requirePasswordChange: true
        }
      })

    if (authError) {
      if (authError.message.toLowerCase().includes("already been registered")) {
        authUser = await findAuthUserByEmail(supabaseAdmin, normalizedEmail)
        if (!authUser) throw authError

        const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
          .from("profiles")
          .select("id, organization_id, role_id")
          .eq("id", authUser.id)
          .maybeSingle()
        if (existingProfileError) throw existingProfileError

        if (!existingProfile || existingProfile.organization_id !== targetOrganizationId) {
          throw new Error("Not allowed to move an existing user into this organization")
        }

        const { data: existingRole } = await supabaseAdmin
          .from("roles")
          .select("id, is_master")
          .eq("id", existingProfile.role_id)
          .maybeSingle()
        if (existingRole?.is_master === true && callerRole?.is_master !== true) {
          throw new Error("Not allowed to update a master user")
        }

        const { error: updateExistingError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
          password,
          email_confirm: true,
          user_metadata: {
            name,
            cpf,
            roleId,
            workspaces: normalizedWorkspaces,
            organizationId: targetOrganizationId,
            requirePasswordChange: true
          }
        })
        if (updateExistingError) throw updateExistingError
      } else {
        throw authError
      }
    } else {
      authUser = authData.user
      createdAuthUser = true
    }

    if (!authUser?.id) throw new Error("Auth user was not created")

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: authUser.id,
        email: normalizedEmail,
        name,
        cpf: cpf || "",
        role_id: roleId,
        workspaces: normalizedWorkspaces,
        organization_id: targetOrganizationId,
        require_password_change: true,
      }, { onConflict: "id" })
      .select("id, name, email, cpf, role_id, workspaces, avatar, require_password_change, organization_id, created_at")
      .single()

    if (profileError) {
      if (createdAuthUser) await supabaseAdmin.auth.admin.deleteUser(authUser.id)
      throw profileError
    }

    return new Response(JSON.stringify({ user: authUser, profile }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
      status: 200,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
      status: 400,
    })
  }
})
