-- Fase 2, parte 2: histórico de alteração de contato e empresa.
--
-- Por que isto existe: em 03/09/2026, para descobrir o que apagou o vínculo de um
-- contato, foi preciso reconstruir a linha do tempo por prova indireta (a data de
-- criação de cada negociação) e pelo log da plataforma, que guarda ~24h. A janela
-- de 01/09 já voltava vazia. O `updated_at` da migration anterior responde QUANDO;
-- esta tabela responde QUEM e O QUÊ.
--
-- Escopo deliberadamente estreito: só `crm_contacts` e `crm_companies`, só UPDATE.
-- INSERT não se registra porque a linha criada já é o próprio registro, e o
-- soft delete da lixeira é um UPDATE de `deleted_at` — já cai aqui.

CREATE TABLE IF NOT EXISTS public.crm_record_history (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name    TEXT NOT NULL CHECK (table_name IN ('crm_contacts', 'crm_companies')),
    record_id     UUID NOT NULL,
    workspace_id  UUID NOT NULL,
    action        TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    changed_by    UUID,
    changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    changes       JSONB NOT NULL
);

-- SEM foreign key para crm_contacts/crm_companies, de propósito: a lixeira faz
-- DELETE físico depois da retenção (src/pages/Trash.tsx), e uma FK com CASCADE
-- apagaria justamente o histórico de quem mais interessa investigar. O preço é
-- que record_id pode apontar para linha que não existe mais — aceito.

CREATE INDEX IF NOT EXISTS idx_crm_record_history_record
    ON public.crm_record_history (table_name, record_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_record_history_workspace
    ON public.crm_record_history (workspace_id, changed_at DESC);

ALTER TABLE public.crm_record_history ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.crm_record_history TO authenticated;

-- Uma policy só, e só de SELECT. Lembrete do fato medido em 19/08: policy
-- permissiva anula policy restritiva na mesma tabela, porque somam por OR — logo
-- não se acrescenta policy aqui sem revisar o conjunto.
DROP POLICY IF EXISTS "crm record history select workspace" ON public.crm_record_history;
CREATE POLICY "crm record history select workspace" ON public.crm_record_history
    FOR SELECT TO authenticated
    USING (workspace_id::text = public.current_workspace_id());

-- Nenhuma policy de INSERT, UPDATE ou DELETE: o histórico é append-only e a
-- única escrita vem do trigger abaixo, que roda como SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.log_crm_record_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- `updated_at` muda em toda edição por causa do outro trigger: registrá-lo
  -- seria ruído em 100% das linhas do histórico.
  campos_ignorados CONSTANT TEXT[] := ARRAY['updated_at'];
  antes  JSONB := to_jsonb(OLD);
  depois JSONB := to_jsonb(NEW);
  diff   JSONB := '{}'::jsonb;
  campo  TEXT;
BEGIN
  FOR campo IN SELECT key FROM jsonb_each(depois) LOOP
    IF campo = ANY (campos_ignorados) THEN
      CONTINUE;
    END IF;

    IF antes -> campo IS DISTINCT FROM depois -> campo THEN
      diff := diff || jsonb_build_object(
        campo,
        jsonb_build_object('de', antes -> campo, 'para', depois -> campo)
      );
    END IF;
  END LOOP;

  -- UPDATE que não mudou nada de fato não vira linha de histórico.
  IF diff = '{}'::jsonb THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.crm_record_history (
    table_name, record_id, workspace_id, action, changed_by, changes
  ) VALUES (
    TG_TABLE_NAME, NEW.id, NEW.workspace_id, TG_OP, auth.uid(), diff
  );

  RETURN NULL;
END;
$$;

-- AFTER, para não interferir na escrita em si. Não há captura de exceção: se o
-- registro falhar, é melhor a edição falhar junto do que perder rastro em
-- silêncio — que é exatamente o problema que esta migration existe para resolver.
-- O INSERT não tem caminho realista de falha: sem FK, e workspace_id é NOT NULL
-- nas duas tabelas de origem.
DROP TRIGGER IF EXISTS trg_crm_contacts_history ON public.crm_contacts;
CREATE TRIGGER trg_crm_contacts_history
AFTER UPDATE ON public.crm_contacts
FOR EACH ROW
EXECUTE FUNCTION public.log_crm_record_change();

DROP TRIGGER IF EXISTS trg_crm_companies_history ON public.crm_companies;
CREATE TRIGGER trg_crm_companies_history
AFTER UPDATE ON public.crm_companies
FOR EACH ROW
EXECUTE FUNCTION public.log_crm_record_change();
