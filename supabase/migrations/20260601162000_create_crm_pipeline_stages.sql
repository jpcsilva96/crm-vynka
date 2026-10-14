CREATE TABLE IF NOT EXISTS public.crm_pipeline_stages (
    workspace_id UUID NOT NULL,
    stage_id TEXT NOT NULL,
    label TEXT NOT NULL,
    probability NUMERIC NOT NULL DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
    position INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (workspace_id, stage_id)
);

ALTER TABLE public.crm_pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all operations for pipeline stages in workspace" ON public.crm_pipeline_stages
    FOR ALL TO authenticated
    USING (workspace_id::text = current_setting('app.workspace_id', true))
    WITH CHECK (workspace_id::text = current_setting('app.workspace_id', true));

UPDATE public.crm_deals
SET stage = 'leads', updated_at = NOW()
WHERE stage NOT IN ('leads', 'qualification', 'proposal', 'negotiation', 'closing', 'won', 'lost');
