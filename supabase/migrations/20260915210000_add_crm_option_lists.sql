-- Listas de Segmento (empresa) e Cargo (contato) saem do código e passam a viver no banco.
--
-- Decisão 13 do plano de melhorias: as listas são IGUAIS para toda a conta — não são por
-- workspace. Por isso esta tabela não tem workspace_id.
--
-- Decisão do operador (15/09): a semente leva as listas que estavam no código MAIS os valores
-- que já existem gravados em produção e que nenhuma lista oferecia. Medido em 15/09:
--   cargo    -> "Compras" (3), "Sócio-Administrador" (2), "Sócia Proprietária" (1), "Dono" (1)
--   segmento -> "Tecnologia" (1)   [a lista do código só tinha "Tecnologia / SaaS"]
-- São 5 valores distintos em 8 registros. Sem semeá-los, abrir esses registros para editar
-- mostraria o campo vazio e salvar apagaria o cargo em silêncio — o mesmo defeito do campo CNPJ
-- corrigido no lote 2.
--
-- Duas decisões menores, explicitadas para não passarem escondidas:
--   * "Coordenador" é semeado: o painel de WhatsApp o oferecia hoje, ainda que 0 registros o usem.
--   * "Outros" NÃO é semeado: é duplicata de "Outro", que é o valor realmente gravado (33 usos).
-- Ambos podem ser criados ou removidos na tela de Configurações, que é o ponto desta entrega.
--
-- Remover uma opção NÃO apaga o valor já gravado (decisão 13): a opção só deixa de ser oferecida.
-- Por isso a desativação é `is_active = false`, e não DELETE — e o frontend sempre inclui o valor
-- atual do registro no campo, mesmo que ele não esteja mais na lista.

CREATE TABLE IF NOT EXISTS public.crm_option_lists (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind        TEXT NOT NULL CHECK (kind IN ('segment', 'contact_role')),
    label       TEXT NOT NULL CHECK (btrim(label) <> ''),
    position    INTEGER NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.crm_option_lists IS
    'Opções de Segmento e Cargo, globais (não por workspace). Desativar não apaga valor já gravado.';

-- Chave de duplicidade com a regra do SQL: btrim() remove APENAS espaço (U+0020). O `.trim()` do
-- JavaScript remove todo whitespace Unicode — código que espelhar esta chave tem de usar a regra
-- daqui, não a do JS (RULES.md, armadilhas do ambiente).
CREATE UNIQUE INDEX IF NOT EXISTS crm_option_lists_kind_label_key
    ON public.crm_option_lists (kind, lower(btrim(label)));

CREATE INDEX IF NOT EXISTS crm_option_lists_kind_position_idx
    ON public.crm_option_lists (kind, position);

ALTER TABLE public.crm_option_lists ENABLE ROW LEVEL SECURITY;

-- Espelha canManageSettings() do frontend: mestre, ou permissão explícita, ou menu "settings".
CREATE OR REPLACE FUNCTION private.current_user_can_manage_settings()
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles profile
    LEFT JOIN public.roles role ON role.id = profile.role_id
    WHERE profile.id = (SELECT auth.uid())
      AND (
        COALESCE(role.is_master, FALSE)
        OR COALESCE((role.permissions ->> 'canManageSettings')::BOOLEAN, FALSE)
        OR COALESCE(role.permissions -> 'menus', '[]'::jsonb) ? 'settings'
      )
  );
$function$;

REVOKE ALL ON FUNCTION private.current_user_can_manage_settings() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.current_user_can_manage_settings() FROM anon;
GRANT EXECUTE ON FUNCTION private.current_user_can_manage_settings() TO authenticated;

-- Policy permissiva soma por OR: derruba o que existir antes de criar (RULES.md §13 e 19/08).
DO $$
DECLARE policy_row RECORD;
BEGIN
  FOR policy_row IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'crm_option_lists'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.crm_option_lists', policy_row.policyname);
  END LOOP;
END $$;

-- Ler: qualquer autenticado. A lista não é segredo e toda tela de cadastro depende dela.
CREATE POLICY crm_option_lists_read ON public.crm_option_lists
    FOR SELECT TO authenticated USING (TRUE);

-- Escrever: só quem administra configurações.
CREATE POLICY crm_option_lists_insert ON public.crm_option_lists
    FOR INSERT TO authenticated WITH CHECK (private.current_user_can_manage_settings());

CREATE POLICY crm_option_lists_update ON public.crm_option_lists
    FOR UPDATE TO authenticated
    USING (private.current_user_can_manage_settings())
    WITH CHECK (private.current_user_can_manage_settings());

CREATE POLICY crm_option_lists_delete ON public.crm_option_lists
    FOR DELETE TO authenticated USING (private.current_user_can_manage_settings());

-- Semente. Idempotente: ON CONFLICT DO NOTHING sobre a chave (kind, lower(btrim(label))), para
-- que rodar de novo em produção seja no-op (RULES.md §3).
INSERT INTO public.crm_option_lists (kind, label, position) VALUES
    ('segment', 'Varejo', 1),
    ('segment', 'E-commerce', 2),
    ('segment', 'Serviços Financeiros', 3),
    ('segment', 'Seguros', 4),
    ('segment', 'Saúde', 5),
    ('segment', 'Imobiliário', 6),
    ('segment', 'Educação', 7),
    ('segment', 'Prestação de Serviços', 8),
    ('segment', 'Alimentação / Delivery', 9),
    ('segment', 'Automotivo', 10),
    ('segment', 'Telecomunicações', 11),
    ('segment', 'Turismo e Hotelaria', 12),
    ('segment', 'Eventos', 13),
    ('segment', 'Jurídico', 14),
    ('segment', 'Recursos Humanos / Recrutamento', 15),
    ('segment', 'Tecnologia / SaaS', 16),
    ('segment', 'Estética e Beleza', 17),
    ('segment', 'Fitness / Academias', 18),
    ('segment', 'Construção Civil', 19),
    ('segment', 'Logística e Transporte', 20),
    ('segment', 'Tecnologia', 21),
    ('contact_role', 'Sócio', 1),
    ('contact_role', 'Proprietário', 2),
    ('contact_role', 'Diretor', 3),
    ('contact_role', 'Gerente', 4),
    ('contact_role', 'Coordenador', 5),
    ('contact_role', 'Financeiro', 6),
    ('contact_role', 'Comercial', 7),
    ('contact_role', 'Executivo de Contas', 8),
    ('contact_role', 'Vendedor', 9),
    ('contact_role', 'Analista', 10),
    ('contact_role', 'Assistente', 11),
    ('contact_role', 'Comprador', 12),
    ('contact_role', 'Compras', 13),
    ('contact_role', 'Implantação', 14),
    ('contact_role', 'Projetos', 15),
    ('contact_role', 'TI', 16),
    ('contact_role', 'Sócio-Administrador', 17),
    ('contact_role', 'Sócia Proprietária', 18),
    ('contact_role', 'Dono', 19),
    ('contact_role', 'Outro', 20)
ON CONFLICT DO NOTHING;
