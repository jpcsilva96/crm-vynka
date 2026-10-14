ALTER TABLE public.crm_deals
    ADD COLUMN IF NOT EXISTS qualification_bant JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS qualification_score INTEGER,
    ADD COLUMN IF NOT EXISTS qualification_classification TEXT,
    ADD COLUMN IF NOT EXISTS qualification_completed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS qualification_responsible TEXT;

ALTER TABLE public.crm_contacts
    ADD COLUMN IF NOT EXISTS qualification_bant JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS qualification_score INTEGER,
    ADD COLUMN IF NOT EXISTS qualification_classification TEXT,
    ADD COLUMN IF NOT EXISTS qualification_completed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS qualification_responsible TEXT;
