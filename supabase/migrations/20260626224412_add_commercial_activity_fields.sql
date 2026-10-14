ALTER TABLE public.crm_tasks
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.crm_companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS activity_result TEXT,
  ADD COLUMN IF NOT EXISTS result_notes TEXT,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_by TEXT,
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS canceled_by TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.crm_tasks
SET
  status = CASE WHEN completed THEN 'completed' ELSE COALESCE(NULLIF(status, ''), 'pending') END,
  completed_at = CASE WHEN completed AND completed_at IS NULL THEN created_at ELSE completed_at END,
  updated_at = NOW()
WHERE status IS NULL
   OR status = ''
   OR completed = TRUE;

ALTER TABLE public.crm_tasks
  DROP CONSTRAINT IF EXISTS crm_tasks_status_check;

ALTER TABLE public.crm_tasks
  ADD CONSTRAINT crm_tasks_status_check
  CHECK (status IN ('pending', 'completed', 'cancelled'));

CREATE INDEX IF NOT EXISTS crm_tasks_deal_status_due_idx
  ON public.crm_tasks (deal_id, status, due_date, due_time);

CREATE INDEX IF NOT EXISTS crm_tasks_company_id_idx
  ON public.crm_tasks (company_id);
