-- Reparo de dado: restaura o vínculo contato -> empresa perdido pelo defeito de
-- edição parcial de contato (corrigido no frontend em 03/09/2026, PR #16).
--
-- Contexto: `toDB` montava o registro inteiro no UPDATE, então qualquer edição
-- parcial mandava `company_id` nulo. Medido em 03/09: 43 contatos sem empresa
-- quando deveriam ter uma, dos quais 37 recuperáveis.
--
-- A fonte do vínculo é a NEGOCIAÇÃO: ela guarda a própria `company_id` e não foi
-- afetada pelo defeito. Só é reparado o contato cujas negociações apontam para
-- UMA única empresa; ambiguidade não se resolve automaticamente.
--
-- Escrito de forma DERIVACIONAL de propósito: nenhum id de produção aparece
-- aqui, então nada de dado de cliente entra no repositório (RULES §9). O mapa
-- explícito dos 37 pares e o rollback exato vivem fora do git, em
-- `_snapshots/pre-restore-vinculos-2026-09-03/` na pasta do case.
--
-- Idempotente: o `company_id IS NULL` final garante que rodar de novo é no-op e
-- que um vínculo criado à mão depois desta migration nunca é sobrescrito.
--
-- Não toca em Pessoa Física: para PF, não ter empresa é o correto, e a API
-- pública usa justamente `company_id IS NULL` como discriminador de PF.

WITH candidato AS (
  SELECT
    c.id AS contact_id,
    MIN(d.company_id::text)::uuid AS company_id,
    COUNT(DISTINCT d.company_id) AS empresas
  FROM public.crm_contacts c
  JOIN public.crm_deals d
    ON  d.contact_id = c.id
    OR  d.primary_contact_id = c.id
    OR  EXISTS (
          SELECT 1
          FROM public.crm_deal_contacts dc
          WHERE dc.contact_id = c.id
            AND dc.deal_id = d.id
        )
  JOIN public.crm_companies co
    ON  co.id = d.company_id
    AND co.workspace_id = c.workspace_id  -- não cruza workspace
  WHERE c.deleted_at IS NULL
    AND c.company_id IS NULL
    AND (c.person_type = 'Juridica' OR c.person_type IS NULL)
    AND d.deleted_at IS NULL
    AND co.deleted_at IS NULL
  GROUP BY c.id
)
UPDATE public.crm_contacts c
SET company_id = k.company_id
FROM candidato k
WHERE c.id = k.contact_id
  AND k.empresas = 1
  AND c.company_id IS NULL;
