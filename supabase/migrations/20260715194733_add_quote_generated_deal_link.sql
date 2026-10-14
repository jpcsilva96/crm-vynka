alter table public.crm_deal_quotes
  add column if not exists generated_deal_id uuid references public.crm_deals(id) on delete set null,
  add column if not exists generated_quote_id uuid references public.crm_deal_quotes(id) on delete set null,
  add column if not exists generated_deal_code text,
  add column if not exists generated_quote_code text,
  add column if not exists generated_at timestamptz,
  add column if not exists generated_by text;

create index if not exists crm_deal_quotes_generated_deal_idx
  on public.crm_deal_quotes (generated_deal_id)
  where generated_deal_id is not null;

create index if not exists crm_deal_quotes_generated_quote_idx
  on public.crm_deal_quotes (generated_quote_id)
  where generated_quote_id is not null;
