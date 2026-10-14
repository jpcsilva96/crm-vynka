-- Fase 4, parte 2: dar rastro aos vínculos contato × empresa.
--
-- Por que isto existe: a Fase 2 (20260903161000) nasceu porque ninguém sabia quem
-- tinha apagado o vínculo de um contato com a empresa — a investigação de 03/09
-- teve de reconstruir a linha do tempo por prova indireta, e o log da plataforma
-- guarda ~24h. A Fase 4 criou uma SEGUNDA forma de vínculo, em tabela própria, e
-- ela nasceu fora do alcance daquele trigger: ele escuta UPDATE em crm_contacts e
-- crm_companies, e vincular não altera nenhuma das duas.
--
-- Resultado medido em 04/09, depois do primeiro vínculo criado pela tela: a linha
-- apareceu em crm_contact_companies e crm_record_history ficou vazio. Sem isto,
-- desvincular por engano apaga a linha sem deixar quem nem quando.

-- 1. O CHECK de table_name aceitava só as duas tabelas da Fase 2.
ALTER TABLE public.crm_record_history
  DROP CONSTRAINT IF EXISTS crm_record_history_table_name_check;

ALTER TABLE public.crm_record_history
  ADD CONSTRAINT crm_record_history_table_name_check
  CHECK (table_name IN ('crm_contacts', 'crm_companies', 'crm_contact_companies'));

-- 2. Função própria, e não a log_crm_record_change() da Fase 2, por três motivos:
--    aqui interessam INSERT e DELETE (não UPDATE — a tabela só tem a PK composta e
--    dois campos derivados); não existe diff de colunas a calcular; e o record_id
--    precisa de uma decisão que a outra função não toma (ver abaixo).
--
--    record_id = contact_id, NÃO uma chave da própria linha: a tabela tem PK
--    composta e não há id de linha. O eixo de investigação é sempre o contato
--    ("o que aconteceu com este cadastro?"), e assim o índice
--    (table_name, record_id, changed_at DESC) continua servindo à pergunta real.
CREATE OR REPLACE FUNCTION public.log_contact_company_link_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  linha         RECORD;
  nome_empresa  TEXT;
BEGIN
  -- Atribuição explícita em vez de COALESCE(NEW, OLD): com row types o COALESCE
  -- depende de resolução de tipo polimórfico e é frágil entre versões. Isto não
  -- tem como não funcionar — e não há Postgres descartável aqui para descobrir na
  -- hora do socorro (ata de 03/09, A1).
  IF TG_OP = 'DELETE' THEN
    linha := OLD;
  ELSE
    linha := NEW;
  END IF;

  -- O nome vai junto do id porque o id sozinho não diz nada numa investigação
  -- futura: a empresa pode ter sido renomeada ou apagada desde então. Fica NULL
  -- quando o DELETE veio em CASCADE da própria empresa — nesse caso a linha da
  -- empresa já não existe mais, e isso também é informação.
  SELECT c.name INTO nome_empresa FROM public.crm_companies c WHERE c.id = linha.company_id;

  INSERT INTO public.crm_record_history (
    table_name, record_id, workspace_id, action, changed_by, changes
  ) VALUES (
    'crm_contact_companies',
    linha.contact_id,
    linha.workspace_id,
    TG_OP,
    auth.uid(),
    jsonb_build_object(
      'company_id',   jsonb_build_object(
        'de',   CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(linha.company_id) ELSE 'null'::jsonb END,
        'para', CASE WHEN TG_OP = 'INSERT' THEN to_jsonb(linha.company_id) ELSE 'null'::jsonb END
      ),
      'company_name', to_jsonb(nome_empresa)
    )
  );

  RETURN NULL;
END;
$$;

-- AFTER, pelo mesmo motivo da Fase 2: não interferir na escrita em si. Sem captura
-- de exceção — falhar o vínculo é melhor do que gravá-lo sem rastro, que é
-- exatamente o problema que esta migration existe para resolver.
DROP TRIGGER IF EXISTS trg_crm_contact_companies_history ON public.crm_contact_companies;
CREATE TRIGGER trg_crm_contact_companies_history
AFTER INSERT OR DELETE ON public.crm_contact_companies
FOR EACH ROW
EXECUTE FUNCTION public.log_contact_company_link_change();

-- 3. Backfill do que já existe: as 53 linhas do backfill da 20260904120000 e o que
--    a tela criou desde então nasceram antes deste trigger. Registrar cada uma como
--    INSERT com changed_by NULL é honesto — "existe desde esta data, autor
--    desconhecido" — e evita que uma investigação futura conclua que o vínculo
--    apareceu do nada. NULL, e não um usuário qualquer, porque atribuir autoria
--    inventada é pior do que não ter autoria.
INSERT INTO public.crm_record_history (
  table_name, record_id, workspace_id, action, changed_by, changed_at, changes
)
SELECT 'crm_contact_companies',
       l.contact_id,
       l.workspace_id,
       'INSERT',
       NULL,
       l.created_at,
       jsonb_build_object(
         'company_id',   jsonb_build_object('de', 'null'::jsonb, 'para', to_jsonb(l.company_id)),
         'company_name', to_jsonb(co.name),
         'origem',       to_jsonb('backfill'::text)
       )
  FROM public.crm_contact_companies l
  LEFT JOIN public.crm_companies co ON co.id = l.company_id
 WHERE NOT EXISTS (
   SELECT 1 FROM public.crm_record_history h
    WHERE h.table_name = 'crm_contact_companies'
      AND h.record_id  = l.contact_id
      AND h.changes -> 'company_id' ->> 'para' = l.company_id::text
 );
