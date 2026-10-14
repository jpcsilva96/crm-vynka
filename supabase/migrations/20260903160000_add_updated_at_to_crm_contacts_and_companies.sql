-- Fase 2 do reparo do vínculo contato x empresa: dar rastro de alteração às duas
-- tabelas que não tinham nenhum.
--
-- Por que isto existe: em 03/09/2026 só foi possível datar a perda de um vínculo
-- porque o log da plataforma guarda ~24h e o episódio tinha acontecido no mesmo
-- dia. A janela de 01/09 já voltava vazia. `crm_contacts` e `crm_companies` não
-- têm nem "quando mudou" — a função public.update_updated_at_column() existe
-- desde 20260401194039, mas o trigger dela só está na tabela LEGADA
-- public.contacts (contatos do WhatsApp), nunca nas tabelas do CRM.
--
-- Isto responde QUANDO. Quem alterou e o que mudou continuam sem registro; a
-- decisão sobre tabela de histórico é separada desta migration.

-- 1. Coluna primeiro sem default, para o backfill não ser sobrescrito.
ALTER TABLE public.crm_contacts  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE public.crm_companies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- 2. Backfill = created_at, não NOW(). NOW() afirmaria que toda linha existente
--    mudou no dia da migration, o que é falso. created_at é o piso honesto:
--    "não se sabe de alteração depois da criação".
--
--    O UPDATE em crm_companies passa pelo trigger validate_crm_company_hierarchy,
--    que dispara em QUALQUER update. Medido antes: as 12 filiais ativas têm
--    matriz existente, do tipo MATRIZ, no mesmo workspace e sem vínculo circular
--    — nenhuma reprova, então o backfill não aborta.
UPDATE public.crm_contacts  SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE public.crm_companies SET updated_at = created_at WHERE updated_at IS NULL;

-- 3. Só então apertar, seguindo a convenção das outras tabelas do schema
--    (crm_deals, crm_tasks, crm_deal_quotes: NOT NULL DEFAULT NOW()).
ALTER TABLE public.crm_contacts
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.crm_companies
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET NOT NULL;

-- 4. Triggers no fim, de propósito: criados antes do backfill, o próprio UPDATE
--    do passo 2 gravaria NOW() e a coluna nasceria mentindo.
DROP TRIGGER IF EXISTS trg_crm_contacts_updated_at ON public.crm_contacts;
CREATE TRIGGER trg_crm_contacts_updated_at
BEFORE UPDATE ON public.crm_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_crm_companies_updated_at ON public.crm_companies;
CREATE TRIGGER trg_crm_companies_updated_at
BEFORE UPDATE ON public.crm_companies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
