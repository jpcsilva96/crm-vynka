CREATE TABLE IF NOT EXISTS public.crm_workspace_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    name TEXT NOT NULL,
    sku TEXT,
    category TEXT,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.crm_deal_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL REFERENCES public.crm_deals(id) ON DELETE CASCADE,
    workspace_product_id UUID REFERENCES public.crm_workspace_products(id) ON DELETE SET NULL,
    source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual', 'integration')),
    source_label TEXT,
    external_reference TEXT,
    item_status TEXT NOT NULL DEFAULT 'Cotação' CHECK (item_status IN ('Cotação', 'Pedido')),
    product_name TEXT NOT NULL,
    sku TEXT,
    quantity NUMERIC NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    discount NUMERIC NOT NULL DEFAULT 0,
    total_price NUMERIC NOT NULL DEFAULT 0,
    item_notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    event_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.crm_deal_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL UNIQUE REFERENCES public.crm_deals(id) ON DELETE CASCADE,
    content_html TEXT NOT NULL DEFAULT '',
    content_text TEXT NOT NULL DEFAULT '',
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_edited_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.crm_workspace_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_deal_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_deal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all operations for workspace products in current workspace" ON public.crm_workspace_products
    FOR ALL TO authenticated
    USING (workspace_id::text = current_setting('app.workspace_id', true))
    WITH CHECK (workspace_id::text = current_setting('app.workspace_id', true));

CREATE POLICY "Enable all operations for deal products based on deal workspace" ON public.crm_deal_products
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.crm_deals d
            WHERE d.id = deal_id
              AND d.workspace_id::text = current_setting('app.workspace_id', true)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.crm_deals d
            WHERE d.id = deal_id
              AND d.workspace_id::text = current_setting('app.workspace_id', true)
        )
    );

CREATE POLICY "Enable all operations for deal notes based on deal workspace" ON public.crm_deal_notes
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.crm_deals d
            WHERE d.id = deal_id
              AND d.workspace_id::text = current_setting('app.workspace_id', true)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.crm_deals d
            WHERE d.id = deal_id
              AND d.workspace_id::text = current_setting('app.workspace_id', true)
        )
    );

CREATE INDEX IF NOT EXISTS crm_workspace_products_workspace_idx ON public.crm_workspace_products (workspace_id, is_active, name);
CREATE INDEX IF NOT EXISTS crm_deal_products_deal_idx ON public.crm_deal_products (deal_id, item_status, source_type);
CREATE INDEX IF NOT EXISTS crm_deal_notes_deal_idx ON public.crm_deal_notes (deal_id);
