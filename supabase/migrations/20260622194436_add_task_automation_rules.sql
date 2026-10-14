CREATE TABLE IF NOT EXISTS public.task_automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    pipeline_id UUID NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
    stage_id TEXT NOT NULL,
    task_title TEXT NOT NULL,
    task_description TEXT,
    due_days INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.task_automation_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES public.task_automation_rules(id) ON DELETE CASCADE,
    negotiation_id UUID NOT NULL REFERENCES public.crm_deals(id) ON DELETE CASCADE,
    stage_id TEXT NOT NULL,
    task_id UUID REFERENCES public.crm_tasks(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT task_automation_executions_rule_negotiation_stage_key UNIQUE (rule_id, negotiation_id, stage_id)
);

ALTER TABLE public.task_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_automation_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task automation rules by workspace" ON public.task_automation_rules;
CREATE POLICY "task automation rules by workspace" ON public.task_automation_rules
    FOR ALL TO public
    USING (workspace_id::text = get_workspace_id())
    WITH CHECK (workspace_id::text = get_workspace_id());

DROP POLICY IF EXISTS "task automation executions by deal workspace" ON public.task_automation_executions;
CREATE POLICY "task automation executions by deal workspace" ON public.task_automation_executions
    FOR ALL TO public
    USING (
        EXISTS (
            SELECT 1
            FROM public.crm_deals d
            WHERE d.id = negotiation_id
              AND d.workspace_id::text = get_workspace_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.crm_deals d
            WHERE d.id = negotiation_id
              AND d.workspace_id::text = get_workspace_id()
        )
    );

CREATE INDEX IF NOT EXISTS task_automation_rules_workspace_pipeline_stage_idx
    ON public.task_automation_rules (workspace_id, pipeline_id, stage_id, active);

CREATE INDEX IF NOT EXISTS task_automation_executions_negotiation_stage_idx
    ON public.task_automation_executions (negotiation_id, stage_id, created_at DESC);
