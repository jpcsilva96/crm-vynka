ALTER TABLE public.crm_deals
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.crm_contacts
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.crm_companies
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_crm_deals_workspace_deleted_at
  ON public.crm_deals(workspace_id, deleted_at);

CREATE INDEX IF NOT EXISTS idx_crm_contacts_workspace_deleted_at
  ON public.crm_contacts(workspace_id, deleted_at);

CREATE INDEX IF NOT EXISTS idx_crm_companies_workspace_deleted_at
  ON public.crm_companies(workspace_id, deleted_at);
