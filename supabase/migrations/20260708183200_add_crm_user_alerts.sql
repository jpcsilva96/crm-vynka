CREATE TABLE IF NOT EXISTS public.crm_user_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    dedupe_key TEXT NOT NULL UNIQUE,
    target TEXT NOT NULL DEFAULT 'deal',
    target_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.crm_user_alerts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.crm_user_alerts TO authenticated;

DROP POLICY IF EXISTS "crm user alerts select own" ON public.crm_user_alerts;
DROP POLICY IF EXISTS "crm user alerts update own" ON public.crm_user_alerts;
DROP POLICY IF EXISTS "crm user alerts delete own" ON public.crm_user_alerts;
DROP POLICY IF EXISTS "crm user alerts insert workspace" ON public.crm_user_alerts;

CREATE POLICY "crm user alerts select own" ON public.crm_user_alerts
    FOR SELECT TO authenticated
    USING (
        workspace_id = public.current_workspace_id()
        AND lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );

CREATE POLICY "crm user alerts update own" ON public.crm_user_alerts
    FOR UPDATE TO authenticated
    USING (
        workspace_id = public.current_workspace_id()
        AND lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
    WITH CHECK (
        workspace_id = public.current_workspace_id()
        AND lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );

CREATE POLICY "crm user alerts delete own" ON public.crm_user_alerts
    FOR DELETE TO authenticated
    USING (
        workspace_id = public.current_workspace_id()
        AND lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );

CREATE POLICY "crm user alerts insert workspace" ON public.crm_user_alerts
    FOR INSERT TO authenticated
    WITH CHECK (
        workspace_id = public.current_workspace_id()
    );

CREATE INDEX IF NOT EXISTS crm_user_alerts_scope_idx
    ON public.crm_user_alerts (workspace_id, user_email, active, updated_at DESC);
