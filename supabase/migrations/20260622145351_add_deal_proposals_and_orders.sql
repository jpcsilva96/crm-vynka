ALTER TABLE public.crm_deals
    ADD COLUMN IF NOT EXISTS has_active_order BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.crm_deal_quotes
    ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.crm_deal_quotes
    DROP CONSTRAINT IF EXISTS crm_deal_quotes_status_check;

UPDATE public.crm_deal_quotes
SET status = CASE status
    WHEN 'Aberto' THEN 'Ativa'
    WHEN 'Enviado' THEN 'Ativa'
    WHEN 'Aprovado' THEN 'Convertida em Pedido'
    WHEN 'Recusado' THEN 'Cancelada'
    WHEN 'Cancelado' THEN 'Cancelada'
    ELSE status
END;

ALTER TABLE public.crm_deal_quotes
    ADD CONSTRAINT crm_deal_quotes_status_check
    CHECK (status IN ('Ativa', 'Convertida em Pedido', 'Cancelada'));

CREATE TABLE IF NOT EXISTS public.crm_deal_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL UNIQUE REFERENCES public.crm_deals(id) ON DELETE CASCADE,
    source_quote_id UUID NOT NULL REFERENCES public.crm_deal_quotes(id) ON DELETE RESTRICT,
    order_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Cancelado')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    canceled_at TIMESTAMPTZ,
    canceled_by TEXT
);

CREATE TABLE IF NOT EXISTS public.crm_deal_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.crm_deal_orders(id) ON DELETE CASCADE,
    workspace_product_id UUID REFERENCES public.crm_workspace_products(id) ON DELETE SET NULL,
    quote_product_id UUID REFERENCES public.crm_deal_products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    sku TEXT,
    quantity NUMERIC NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    total_price NUMERIC NOT NULL DEFAULT 0,
    item_notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.crm_deal_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_deal_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deal quotes by current workspace" ON public.crm_deal_quotes;
CREATE POLICY "deal quotes by current workspace" ON public.crm_deal_quotes
    FOR ALL TO public
    USING (
        EXISTS (
            SELECT 1
            FROM public.crm_deals d
            WHERE d.id = deal_id
              AND d.workspace_id::text = get_workspace_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.crm_deals d
            WHERE d.id = deal_id
              AND d.workspace_id::text = get_workspace_id()
        )
    );

DROP POLICY IF EXISTS "Enable all operations for deal products based on deal workspace" ON public.crm_deal_products;
CREATE POLICY "Enable all operations for deal products based on deal workspace" ON public.crm_deal_products
    FOR ALL TO public
    USING (
        EXISTS (
            SELECT 1
            FROM public.crm_deals d
            WHERE d.id = deal_id
              AND d.workspace_id::text = get_workspace_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.crm_deals d
            WHERE d.id = deal_id
              AND d.workspace_id::text = get_workspace_id()
        )
    );

DROP POLICY IF EXISTS "Enable all operations for workspace products in current workspace" ON public.crm_workspace_products;
CREATE POLICY "Enable all operations for workspace products in current workspace" ON public.crm_workspace_products
    FOR ALL TO public
    USING (workspace_id::text = get_workspace_id())
    WITH CHECK (workspace_id::text = get_workspace_id());

DROP POLICY IF EXISTS "deal orders by current workspace" ON public.crm_deal_orders;
CREATE POLICY "deal orders by current workspace" ON public.crm_deal_orders
    FOR ALL TO public
    USING (
        EXISTS (
            SELECT 1
            FROM public.crm_deals d
            WHERE d.id = deal_id
              AND d.workspace_id::text = get_workspace_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.crm_deals d
            WHERE d.id = deal_id
              AND d.workspace_id::text = get_workspace_id()
        )
    );

DROP POLICY IF EXISTS "deal order items by current workspace" ON public.crm_deal_order_items;
CREATE POLICY "deal order items by current workspace" ON public.crm_deal_order_items
    FOR ALL TO public
    USING (
        EXISTS (
            SELECT 1
            FROM public.crm_deal_orders o
            JOIN public.crm_deals d ON d.id = o.deal_id
            WHERE o.id = order_id
              AND d.workspace_id::text = get_workspace_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.crm_deal_orders o
            JOIN public.crm_deals d ON d.id = o.deal_id
            WHERE o.id = order_id
              AND d.workspace_id::text = get_workspace_id()
        )
    );

CREATE INDEX IF NOT EXISTS crm_deal_orders_deal_idx ON public.crm_deal_orders (deal_id, status);
CREATE INDEX IF NOT EXISTS crm_deal_order_items_order_idx ON public.crm_deal_order_items (order_id, created_at);
