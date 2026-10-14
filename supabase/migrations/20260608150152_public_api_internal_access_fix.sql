CREATE OR REPLACE VIEW public.api_internal_pipelines AS
SELECT
    id,
    organization_id,
    workspace_id,
    name,
    created_at,
    updated_at
FROM private.api_pipelines;

REVOKE ALL ON public.api_internal_pipelines FROM PUBLIC;
REVOKE ALL ON public.api_internal_pipelines FROM anon;
REVOKE ALL ON public.api_internal_pipelines FROM authenticated;
GRANT SELECT ON public.api_internal_pipelines TO service_role;

CREATE OR REPLACE VIEW public.api_internal_keys AS
SELECT
    id,
    organization_id,
    name,
    key_prefix,
    key_hash,
    permissions,
    is_active,
    is_revoked,
    last_used_at,
    last_used_ip,
    last_used_user_agent,
    created_by,
    created_by_email,
    revoked_at,
    revoked_by,
    revoked_reason,
    created_at,
    updated_at
FROM private.api_keys;

REVOKE ALL ON public.api_internal_keys FROM PUBLIC;
REVOKE ALL ON public.api_internal_keys FROM anon;
REVOKE ALL ON public.api_internal_keys FROM authenticated;
GRANT SELECT ON public.api_internal_keys TO service_role;

CREATE OR REPLACE FUNCTION public.api_internal_create_key(
    p_organization_id UUID,
    p_name TEXT,
    p_key_prefix TEXT,
    p_key_hash TEXT,
    p_permissions JSONB,
    p_created_by UUID,
    p_created_by_email TEXT
)
RETURNS private.api_keys
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    inserted private.api_keys;
BEGIN
    INSERT INTO private.api_keys (
        organization_id,
        name,
        key_prefix,
        key_hash,
        permissions,
        created_by,
        created_by_email
    )
    VALUES (
        p_organization_id,
        p_name,
        p_key_prefix,
        p_key_hash,
        COALESCE(p_permissions, '{}'::jsonb),
        p_created_by,
        p_created_by_email
    )
    RETURNING * INTO inserted;

    RETURN inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_internal_touch_key_usage(
    p_id UUID,
    p_last_used_at TIMESTAMPTZ,
    p_last_used_ip TEXT,
    p_last_used_user_agent TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    UPDATE private.api_keys
    SET
        last_used_at = p_last_used_at,
        last_used_ip = p_last_used_ip,
        last_used_user_agent = p_last_used_user_agent,
        updated_at = NOW()
    WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_internal_update_key(
    p_id UUID,
    p_organization_id UUID,
    p_name TEXT DEFAULT NULL,
    p_permissions JSONB DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT NULL,
    p_is_revoked BOOLEAN DEFAULT NULL,
    p_revoked_at TIMESTAMPTZ DEFAULT NULL,
    p_revoked_by UUID DEFAULT NULL,
    p_revoked_reason TEXT DEFAULT NULL
)
RETURNS private.api_keys
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    updated_record private.api_keys;
BEGIN
    UPDATE private.api_keys
    SET
        name = COALESCE(p_name, name),
        permissions = COALESCE(p_permissions, permissions),
        is_active = COALESCE(p_is_active, is_active),
        is_revoked = COALESCE(p_is_revoked, is_revoked),
        revoked_at = CASE WHEN p_is_revoked IS NOT NULL THEN p_revoked_at ELSE revoked_at END,
        revoked_by = CASE WHEN p_is_revoked IS NOT NULL THEN p_revoked_by ELSE revoked_by END,
        revoked_reason = CASE WHEN p_is_revoked IS NOT NULL THEN p_revoked_reason ELSE revoked_reason END,
        updated_at = NOW()
    WHERE id = p_id
      AND organization_id = p_organization_id
    RETURNING * INTO updated_record;

    RETURN updated_record;
END;
$$;

REVOKE ALL ON FUNCTION public.api_internal_create_key(UUID, TEXT, TEXT, TEXT, JSONB, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.api_internal_create_key(UUID, TEXT, TEXT, TEXT, JSONB, UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.api_internal_create_key(UUID, TEXT, TEXT, TEXT, JSONB, UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.api_internal_create_key(UUID, TEXT, TEXT, TEXT, JSONB, UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.api_internal_touch_key_usage(UUID, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.api_internal_touch_key_usage(UUID, TIMESTAMPTZ, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.api_internal_touch_key_usage(UUID, TIMESTAMPTZ, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.api_internal_touch_key_usage(UUID, TIMESTAMPTZ, TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.api_internal_update_key(UUID, UUID, TEXT, JSONB, BOOLEAN, BOOLEAN, TIMESTAMPTZ, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.api_internal_update_key(UUID, UUID, TEXT, JSONB, BOOLEAN, BOOLEAN, TIMESTAMPTZ, UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.api_internal_update_key(UUID, UUID, TEXT, JSONB, BOOLEAN, BOOLEAN, TIMESTAMPTZ, UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.api_internal_update_key(UUID, UUID, TEXT, JSONB, BOOLEAN, BOOLEAN, TIMESTAMPTZ, UUID, TEXT) TO service_role;
