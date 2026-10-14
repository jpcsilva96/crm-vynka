DROP POLICY IF EXISTS "Enable all operations for pipelines in workspace" ON public.crm_pipelines;

CREATE POLICY "Enable all operations for pipelines in workspace" ON public.crm_pipelines
    FOR ALL TO anon, authenticated
    USING (workspace_id::text = current_setting('app.workspace_id', true))
    WITH CHECK (workspace_id::text = current_setting('app.workspace_id', true));

DROP POLICY IF EXISTS "Enable all operations for pipeline stages in workspace" ON public.crm_pipeline_stages;

CREATE POLICY "Enable all operations for pipeline stages in workspace" ON public.crm_pipeline_stages
    FOR ALL TO anon, authenticated
    USING (workspace_id::text = current_setting('app.workspace_id', true))
    WITH CHECK (workspace_id::text = current_setting('app.workspace_id', true));
