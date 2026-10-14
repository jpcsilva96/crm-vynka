CREATE TABLE IF NOT EXISTS public.crm_deal_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL REFERENCES public.crm_deals(id) ON DELETE CASCADE,
    quote_number INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'Aberto' CHECK (status IN ('Aberto', 'Enviado', 'Aprovado', 'Recusado', 'Cancelado')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (deal_id, quote_number)
);

ALTER TABLE public.crm_deal_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deal quotes by current workspace" ON public.crm_deal_quotes;

CREATE POLICY "deal quotes by current workspace" ON public.crm_deal_quotes
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

ALTER TABLE public.crm_deal_products
    ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES public.crm_deal_quotes(id) ON DELETE CASCADE;

WITH deals_with_unquoted_products AS (
    SELECT
        p.deal_id,
        CASE
            WHEN BOOL_OR(p.item_status = 'Pedido') THEN 'Aprovado'
            ELSE 'Aberto'
        END AS quote_status,
        MIN(p.created_at) AS created_at,
        MAX(COALESCE(p.updated_at, p.created_at)) AS updated_at
    FROM public.crm_deal_products p
    WHERE p.quote_id IS NULL
    GROUP BY p.deal_id
)
INSERT INTO public.crm_deal_quotes (deal_id, quote_number, status, created_at, updated_at)
SELECT
    grouped.deal_id,
    1,
    grouped.quote_status,
    grouped.created_at,
    grouped.updated_at
FROM deals_with_unquoted_products grouped
ON CONFLICT (deal_id, quote_number) DO UPDATE
SET
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at;

UPDATE public.crm_deal_products p
SET quote_id = q.id
FROM public.crm_deal_quotes q
WHERE p.quote_id IS NULL
  AND q.deal_id = p.deal_id
  AND q.quote_number = 1;

CREATE INDEX IF NOT EXISTS crm_deal_quotes_deal_idx
    ON public.crm_deal_quotes (deal_id, quote_number, status);

CREATE INDEX IF NOT EXISTS crm_deal_products_quote_idx
    ON public.crm_deal_products (quote_id, created_at);
