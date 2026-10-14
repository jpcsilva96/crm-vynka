create sequence if not exists public.crm_deal_quotes_crm_proposal_number_seq;

create or replace function public.generate_crm_proposal_number()
returns text
language plpgsql
as $$
declare
  next_value bigint;
begin
  next_value := nextval('public.crm_deal_quotes_crm_proposal_number_seq');
  return 'PROP-' || lpad(next_value::text, 6, '0');
end;
$$;

alter table public.crm_deal_quotes
  add column if not exists crm_proposal_number text,
  add column if not exists erp_proposal_number text,
  add column if not exists erp_generated_at timestamptz,
  add column if not exists erp_generated_by text;

update public.crm_deal_quotes
set crm_proposal_number = public.generate_crm_proposal_number()
where crm_proposal_number is null;

alter table public.crm_deal_quotes
  alter column crm_proposal_number set default public.generate_crm_proposal_number(),
  alter column crm_proposal_number set not null;

create unique index if not exists crm_deal_quotes_crm_proposal_number_key
  on public.crm_deal_quotes (crm_proposal_number);
