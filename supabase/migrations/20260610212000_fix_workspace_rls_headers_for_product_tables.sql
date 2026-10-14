CREATE OR REPLACE FUNCTION public.current_workspace_id()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.workspace_id', true), ''),
    NULLIF((current_setting('request.headers', true)::json ->> 'x-workspace-id'), ''),
    NULLIF((current_setting('request.headers', true)::json ->> 'app.workspace_id'), '')
  );
$$;

DROP POLICY IF EXISTS "Enable all operations for workspace products in current workspace" ON public.crm_workspace_products;
DROP POLICY IF EXISTS "Enable all operations for deal products based on deal workspace" ON public.crm_deal_products;
DROP POLICY IF EXISTS "Enable all operations for deal notes based on deal workspace" ON public.crm_deal_notes;

CREATE POLICY "workspace products by current workspace" ON public.crm_workspace_products
    FOR ALL TO authenticated
    USING (workspace_id::text = public.current_workspace_id())
    WITH CHECK (workspace_id::text = public.current_workspace_id());

CREATE POLICY "deal products by current workspace" ON public.crm_deal_products
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

CREATE POLICY "deal notes by current workspace" ON public.crm_deal_notes
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
