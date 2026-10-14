CREATE TABLE IF NOT EXISTS public.crm_pipeline_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    pipeline_id UUID NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
    rule_key TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT false,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT crm_pipeline_rules_pipeline_rule_key UNIQUE (pipeline_id, rule_key)
);

CREATE INDEX IF NOT EXISTS crm_pipeline_rules_workspace_id_idx
    ON public.crm_pipeline_rules (workspace_id);

CREATE INDEX IF NOT EXISTS crm_pipeline_rules_pipeline_id_idx
    ON public.crm_pipeline_rules (pipeline_id);

ALTER TABLE public.crm_pipeline_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all operations for pipeline rules in workspace" ON public.crm_pipeline_rules;

CREATE POLICY "Enable all operations for pipeline rules in workspace" ON public.crm_pipeline_rules
    FOR ALL TO public
    USING ((workspace_id)::text = get_workspace_id())
    WITH CHECK (
        (workspace_id)::text = get_workspace_id()
        AND EXISTS (
            SELECT 1
            FROM public.crm_pipelines p
            WHERE p.id = crm_pipeline_rules.pipeline_id
              AND p.workspace_id = crm_pipeline_rules.workspace_id
        )
    );
