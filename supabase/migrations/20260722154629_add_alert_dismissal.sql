alter table public.crm_user_alerts
  add column if not exists dismissed_at timestamptz;

create index if not exists crm_user_alerts_active_scope_idx
  on public.crm_user_alerts (workspace_id, user_email, updated_at desc)
  where dismissed_at is null;
