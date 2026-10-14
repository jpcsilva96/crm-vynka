-- Fase 4: um contato pode pertencer a mais de uma empresa.
--
-- Por que isto existe: a equipe comercial atende compradores que respondem por
-- vários CNPJs — grupos hoteleiros com filiais, e a mesma pessoa comprando para
-- empresas de grupos diferentes. Até aqui o CRM só sabia guardar UMA empresa por
-- contato (crm_contacts.company_id), e a tela de criar negociação lista contatos
-- por essa coluna. Consequência medida em 04/09/2026: para abrir negociação de um
-- contato numa segunda empresa, o vendedor tinha de TROCAR a empresa dele — o
-- mesmo gesto que, até o PR #16, apagava o vínculo em silêncio.
--
-- Esta tabela passa a ser a resposta para "em quais empresas este contato atua?".
-- A coluna crm_contacts.company_id CONTINUA existindo, agora com o papel de
-- "empresa principal": é o que a coluna Empresa da lista mostra e o que a API
-- pública devolvia a integradores, que esperam um campo e não uma lista. Ela deixa de ser
-- regra de filtro e vira rótulo de exibição.

CREATE TABLE IF NOT EXISTS public.crm_contact_companies (
    contact_id   UUID NOT NULL REFERENCES public.crm_contacts(id)  ON DELETE CASCADE,
    company_id   UUID NOT NULL REFERENCES public.crm_companies(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (contact_id, company_id)
);

-- COM foreign key e CASCADE, ao contrário de crm_record_history (20260903161000),
-- e o motivo é o oposto: histórico de quem foi apagado é justamente o que se quer
-- preservar; vínculo de quem foi apagado é lixo. A lixeira (src/pages/Trash.tsx)
-- faz DELETE físico depois da retenção, e aí a linha daqui não tem mais sentido.

-- A PK já indexa (contact_id, company_id) e serve "as empresas deste contato".
-- Este índice serve a pergunta inversa — "os contatos desta empresa" — que é o
-- que CompanyView e a lista de contatos da negociação perguntam.
CREATE INDEX IF NOT EXISTS idx_crm_contact_companies_company
    ON public.crm_contact_companies (company_id, contact_id);

ALTER TABLE public.crm_contact_companies ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON TABLE public.crm_contact_companies TO authenticated;

-- Uma policy por comando, todas com a MESMA condição de workspace. Lembrete do
-- fato medido em 19/08: policy permissiva anula policy restritiva na mesma tabela,
-- porque somam por OR — não se acrescenta policy aqui sem revisar o conjunto.
-- Não há policy de UPDATE: a tabela só tem a PK e dois campos derivados; mudar um
-- vínculo é apagar e criar outro.
DROP POLICY IF EXISTS "crm contact companies select workspace" ON public.crm_contact_companies;
CREATE POLICY "crm contact companies select workspace" ON public.crm_contact_companies
    FOR SELECT TO authenticated
    USING (workspace_id::text = public.current_workspace_id());

DROP POLICY IF EXISTS "crm contact companies insert workspace" ON public.crm_contact_companies;
CREATE POLICY "crm contact companies insert workspace" ON public.crm_contact_companies
    FOR INSERT TO authenticated
    WITH CHECK (workspace_id::text = public.current_workspace_id());

DROP POLICY IF EXISTS "crm contact companies delete workspace" ON public.crm_contact_companies;
CREATE POLICY "crm contact companies delete workspace" ON public.crm_contact_companies
    FOR DELETE TO authenticated
    USING (workspace_id::text = public.current_workspace_id());

-- Backfill: toda empresa principal que existe hoje vira também um vínculo aqui.
--
-- Derivacional, sem id de produção escrito no arquivo (decisão D1 de 03/09): a
-- migration DESCREVE o critério, o mapa concreto fica no snapshot fora do git.
-- Inclui contatos na lixeira de propósito — restaurar um contato é um UPDATE de
-- deleted_at, que não passa pelo trigger abaixo (ele só olha company_id), e sem
-- isto o contato voltaria da lixeira sem os vínculos.
INSERT INTO public.crm_contact_companies (contact_id, company_id, workspace_id, created_at)
SELECT c.id, c.company_id, c.workspace_id, c.created_at
  FROM public.crm_contacts c
 WHERE c.company_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Sincronia no banco, não no frontend. Porquê medido: o defeito de 02/09 nasceu
-- de o frontend montar o registro inteiro e esquecer um campo; confiar nele para
-- manter duas fontes coerentes repete a classe de erro. O trigger da Fase 2
-- mostrou que o padrão funciona.
--
-- Deliberadamente NÃO apaga o vínculo anterior quando a principal muda: trocar a
-- empresa principal de A para B deixa o contato vinculado a A e a B. É o que
-- preserva a informação que o defeito destruía. Desvincular de A é ação explícita
-- da tela, com aviso.
CREATE OR REPLACE FUNCTION public.sync_contact_primary_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.crm_contact_companies (contact_id, company_id, workspace_id)
  VALUES (NEW.id, NEW.company_id, NEW.workspace_id)
  ON CONFLICT DO NOTHING;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_contacts_sync_primary_company ON public.crm_contacts;
CREATE TRIGGER trg_crm_contacts_sync_primary_company
AFTER INSERT OR UPDATE OF company_id ON public.crm_contacts
FOR EACH ROW
EXECUTE FUNCTION public.sync_contact_primary_company();
