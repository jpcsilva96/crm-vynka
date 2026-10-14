alter table public.crm_deals
  add column if not exists primary_contact_id uuid references public.crm_contacts(id) on delete set null;

-- Existing negotiations keep their legacy contact as the primary reference.
update public.crm_deals
set primary_contact_id = contact_id
where primary_contact_id is null
  and contact_id is not null;

-- For multi-contact negotiations without a legacy contact, choose one linked contact.
with first_linked_contact as (
  select distinct on (deal_id) deal_id, contact_id
  from public.crm_deal_contacts
  order by deal_id, contact_id
)
update public.crm_deals deal
set primary_contact_id = first_linked_contact.contact_id
from first_linked_contact
where deal.id = first_linked_contact.deal_id
  and deal.primary_contact_id is null;
