ALTER TABLE public.crm_deal_quotes
    ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS canceled_by TEXT;
