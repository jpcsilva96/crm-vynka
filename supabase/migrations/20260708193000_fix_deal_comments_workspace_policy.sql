GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.crm_deal_comments TO authenticated;

DROP POLICY IF EXISTS "Enable all operations for deal comments based on deal workspace" ON public.crm_deal_comments;
DROP POLICY IF EXISTS "deal comments by current workspace" ON public.crm_deal_comments;

CREATE POLICY "deal comments by current workspace" ON public.crm_deal_comments
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.crm_deals d
            WHERE d.id = deal_id
              AND d.workspace_id::text = public.current_workspace_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.crm_deals d
            WHERE d.id = deal_id
              AND d.workspace_id::text = public.current_workspace_id()
        )
    );
