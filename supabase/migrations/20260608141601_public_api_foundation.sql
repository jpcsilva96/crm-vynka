CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;
REVOKE ALL ON SCHEMA private FROM authenticated;

CREATE TABLE IF NOT EXISTS private.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    name TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    last_used_at TIMESTAMPTZ,
    last_used_ip TEXT,
    last_used_user_agent TEXT,
    created_by UUID,
    created_by_email TEXT,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID,
    revoked_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT api_keys_org_name_unique UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS api_keys_organization_idx ON private.api_keys (organization_id);
CREATE INDEX IF NOT EXISTS api_keys_active_idx ON private.api_keys (organization_id, is_active, is_revoked);
CREATE INDEX IF NOT EXISTS api_keys_last_used_idx ON private.api_keys (last_used_at DESC NULLS LAST);

ALTER TABLE private.api_keys ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS private.api_pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    workspace_id UUID NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS api_pipelines_org_idx ON private.api_pipelines (organization_id);
CREATE INDEX IF NOT EXISTS api_pipelines_workspace_idx ON private.api_pipelines (workspace_id);

ALTER TABLE private.api_pipelines ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.set_current_timestamp_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_private_api_keys_updated_at ON private.api_keys;
CREATE TRIGGER set_private_api_keys_updated_at
BEFORE UPDATE ON private.api_keys
FOR EACH ROW
EXECUTE FUNCTION private.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS set_private_api_pipelines_updated_at ON private.api_pipelines;
CREATE TRIGGER set_private_api_pipelines_updated_at
BEFORE UPDATE ON private.api_pipelines
FOR EACH ROW
EXECUTE FUNCTION private.set_current_timestamp_updated_at();

CREATE OR REPLACE FUNCTION private.sync_api_pipeline_from_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM private.api_pipelines
        WHERE workspace_id = OLD.id::uuid;
        RETURN OLD;
    END IF;

    INSERT INTO private.api_pipelines (organization_id, workspace_id, name)
    VALUES (NEW.organization_id, NEW.id::uuid, NEW.name)
    ON CONFLICT (workspace_id) DO UPDATE
    SET organization_id = EXCLUDED.organization_id,
        name = EXCLUDED.name,
        updated_at = NOW();

    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF to_regclass('public.workspaces') IS NOT NULL THEN
        INSERT INTO private.api_pipelines (organization_id, workspace_id, name)
        SELECT w.organization_id, w.id::uuid, w.name
        FROM public.workspaces w
        ON CONFLICT (workspace_id) DO UPDATE
        SET organization_id = EXCLUDED.organization_id,
            name = EXCLUDED.name,
            updated_at = NOW();

        IF NOT EXISTS (
            SELECT 1
            FROM pg_trigger
            WHERE tgname = 'sync_api_pipeline_from_workspace_trigger'
        ) THEN
            CREATE TRIGGER sync_api_pipeline_from_workspace_trigger
            AFTER INSERT OR UPDATE OR DELETE ON public.workspaces
            FOR EACH ROW
            EXECUTE FUNCTION private.sync_api_pipeline_from_workspace();
        END IF;
    END IF;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA private FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM authenticated;

GRANT USAGE ON SCHEMA private TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA private TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO service_role;
