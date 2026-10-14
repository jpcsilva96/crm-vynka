DROP POLICY IF EXISTS "Enable all operations for pipelines in workspace" ON public.crm_pipelines;

CREATE POLICY "Enable all operations for pipelines in workspace" ON public.crm_pipelines
    FOR ALL TO public
    USING ((workspace_id)::text = get_workspace_id())
    WITH CHECK ((workspace_id)::text = get_workspace_id());

DROP POLICY IF EXISTS "Enable all operations for pipeline stages in workspace" ON public.crm_pipeline_stages;

CREATE POLICY "Enable all operations for pipeline stages in workspace" ON public.crm_pipeline_stages
    FOR ALL TO public
    USING ((workspace_id)::text = get_workspace_id())
    WITH CHECK ((workspace_id)::text = get_workspace_id());
