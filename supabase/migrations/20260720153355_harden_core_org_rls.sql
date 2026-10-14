CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.current_profile_org_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  resolved_org_id TEXT;
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RETURN NULL;
  END IF;

  EXECUTE 'SELECT organization_id::text FROM public.profiles WHERE id = $1 LIMIT 1'
    INTO resolved_org_id
    USING auth.uid();

  RETURN resolved_org_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.current_profile_role_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  resolved_role_id TEXT;
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RETURN NULL;
  END IF;

  EXECUTE 'SELECT role_id::text FROM public.profiles WHERE id = $1 LIMIT 1'
    INTO resolved_role_id
    USING auth.uid();

  RETURN resolved_role_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.current_user_is_master()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  allowed BOOLEAN := FALSE;
BEGIN
  IF to_regclass('public.profiles') IS NULL OR to_regclass('public.roles') IS NULL THEN
    RETURN FALSE;
  END IF;

  EXECUTE 'SELECT coalesce(r.is_master, false) FROM public.profiles p JOIN public.roles r ON r.id = p.role_id WHERE p.id = $1 LIMIT 1'
    INTO allowed
    USING auth.uid();

  RETURN coalesce(allowed, FALSE);
END;
$$;

CREATE OR REPLACE FUNCTION private.current_user_can_manage_org()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  allowed BOOLEAN := FALSE;
BEGIN
  IF to_regclass('public.profiles') IS NULL OR to_regclass('public.roles') IS NULL THEN
    RETURN FALSE;
  END IF;

  EXECUTE
    'SELECT
       coalesce(r.is_master, false)
       OR coalesce((r.permissions::jsonb ->> ''canManageUsers'')::boolean, false)
       OR coalesce((r.permissions::jsonb ->> ''canManageSettings'')::boolean, false)
       OR coalesce((r.permissions::jsonb -> ''menus'') ? ''users'', false)
       OR coalesce((r.permissions::jsonb -> ''menus'') ? ''settings'', false)
     FROM public.profiles p
     JOIN public.roles r ON r.id = p.role_id
     WHERE p.id = $1
     LIMIT 1'
    INTO allowed
    USING auth.uid();

  RETURN coalesce(allowed, FALSE);
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "profiles readable by self or org managers" ON public.profiles';
    EXECUTE 'DROP POLICY IF EXISTS "profiles insertable by org managers" ON public.profiles';
    EXECUTE 'DROP POLICY IF EXISTS "profiles updatable by self or org managers" ON public.profiles';
    EXECUTE 'DROP POLICY IF EXISTS "profiles deletable by org managers" ON public.profiles';

    EXECUTE 'CREATE POLICY "profiles readable by self or org managers" ON public.profiles
      FOR SELECT TO authenticated
      USING (
        id = auth.uid()
        OR private.current_user_is_master()
        OR (
          private.current_user_can_manage_org()
          AND organization_id::text = private.current_profile_org_id()
        )
      )';

    EXECUTE 'CREATE POLICY "profiles insertable by org managers" ON public.profiles
      FOR INSERT TO authenticated
      WITH CHECK (
        private.current_user_is_master()
        OR (
          private.current_user_can_manage_org()
          AND organization_id::text = private.current_profile_org_id()
        )
      )';

    EXECUTE 'CREATE POLICY "profiles updatable by self or org managers" ON public.profiles
      FOR UPDATE TO authenticated
      USING (
        private.current_user_is_master()
        OR (
          private.current_user_can_manage_org()
          AND organization_id::text = private.current_profile_org_id()
        )
      )
      WITH CHECK (
        private.current_user_is_master()
        OR (
          private.current_user_can_manage_org()
          AND organization_id::text = private.current_profile_org_id()
        )
      )';

    EXECUTE 'CREATE POLICY "profiles deletable by org managers" ON public.profiles
      FOR DELETE TO authenticated
      USING (
        id <> auth.uid()
        AND (
          private.current_user_is_master()
          OR (
            private.current_user_can_manage_org()
            AND organization_id::text = private.current_profile_org_id()
          )
        )
      )';
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.organizations') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "organizations readable by members" ON public.organizations';
    EXECUTE 'DROP POLICY IF EXISTS "organizations manageable by masters" ON public.organizations';

    EXECUTE 'CREATE POLICY "organizations readable by members" ON public.organizations
      FOR SELECT TO authenticated
      USING (
        private.current_user_is_master()
        OR id::text = private.current_profile_org_id()
      )';

    EXECUTE 'CREATE POLICY "organizations manageable by masters" ON public.organizations
      FOR ALL TO authenticated
      USING (private.current_user_is_master())
      WITH CHECK (private.current_user_is_master())';
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.workspaces') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "workspaces manageable by organization" ON public.workspaces';

    EXECUTE 'CREATE POLICY "workspaces manageable by organization" ON public.workspaces
      FOR ALL TO authenticated
      USING (
        private.current_user_is_master()
        OR organization_id::text = private.current_profile_org_id()
      )
      WITH CHECK (
        private.current_user_is_master()
        OR organization_id::text = private.current_profile_org_id()
      )';
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.roles') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "roles readable by current user and org managers" ON public.roles';
    EXECUTE 'DROP POLICY IF EXISTS "roles manageable by org managers" ON public.roles';

    EXECUTE 'CREATE POLICY "roles readable by current user and org managers" ON public.roles
      FOR SELECT TO authenticated
      USING (
        id::text = private.current_profile_role_id()
        OR private.current_user_can_manage_org()
      )';

    EXECUTE 'CREATE POLICY "roles manageable by org managers" ON public.roles
      FOR ALL TO authenticated
      USING (private.current_user_can_manage_org())
      WITH CHECK (private.current_user_can_manage_org())';
  END IF;
END;
$$;
