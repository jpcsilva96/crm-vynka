-- Endurece a RLS de public.whatsapp_channels e reconcilia a coluna workspace_id.
--
-- CONTEXTO (medido em 19/08/2026 contra a producao do projeto de origem):
--
-- A tabela guarda o `token` da API de WhatsApp em texto claro e ficou de fora do
-- padrao canonico `_workspace_member_access` das migrations de hardening de julho.
-- Em pg_policies coexistiam DUAS policies permissivas:
--
--   "channels owned by authenticated user"  roles={authenticated}  qual=(user_email = jwt email)
--   "Enable all access for channels"        roles={public}         qual=(auth.role() = 'authenticated')
--
-- Policies permissivas se somam por OR, entao a segunda anula a primeira: qualquer
-- sessao autenticada lia, alterava e apagava o token de TODOS os canais. Medido com
-- tres identidades -- um vendedor restrito a um workspace, o master, e uma sessao cujo
-- `sub` nao corresponde a perfil nenhum: as tres viam todos os canais, inclusive um
-- que nao pertencia ao workspace do vendedor.
--
-- Cadeia de ataque: as funcoes hubchat-* rodam com verify_jwt=false e recebem o token
-- no corpo do request. Quem le o token de um canal alheio envia por aquele canal.
--
-- Anonimo NAO estava exposto na producao (HTTP 200 com zero linhas, medido): auth.role()
-- devolve 'anon' e nenhuma das duas policies casa. O alerta do scanner do Lovable, que
-- falava em acesso nao autenticado, descrevia um projeto legado -- outro banco,
-- nao este.
--
-- Idempotente por desenho (RULES.md §3): em producao os objetos ja existem.

-- ---------------------------------------------------------------------------
-- 1. Coluna criada fora de migration (RULES.md §3)
--
-- `workspace_id` existe na producao e o frontend depende dela
-- (src/lib/channelStore.ts, src/lib/workspaceStore.ts), mas nunca passou por
-- migration nenhuma -- nem pela reconciliacao de 20260819120000. Sem isto, quem
-- recriar o banco pelo repo quebra a tela de canais e a policy abaixo nao compila.
-- Tipo TEXT com FK para workspaces(id), que tambem e TEXT.
-- ---------------------------------------------------------------------------
ALTER TABLE public.whatsapp_channels ADD COLUMN IF NOT EXISTS workspace_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.whatsapp_channels'::regclass
      AND conname = 'whatsapp_channels_workspace_id_fkey'
  ) THEN
    ALTER TABLE public.whatsapp_channels
      ADD CONSTRAINT whatsapp_channels_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. RLS no padrao canonico do projeto
--
-- Mesmo idioma de 20260722163254_harden_critical_crm_security.sql, que cobre 22
-- tabelas: derruba TODAS as policies da tabela em loop antes de criar a nova. E
-- esse loop -- e nao a policy em si -- que impede uma policy frouxa antiga de
-- sobreviver e voltar a valer por OR. E o passo que whatsapp_channels nunca teve.
--
-- Recorte por WORKSPACE, nao por dono. A variante "dono + workspace"
-- (crm_user_alerts_owner_workspace_access) quebraria a producao: os canais
-- pertencem a um usuario e sao usados por uma equipe que nao e dona de nenhum.
--
-- `workspace_id` nulo falha fechado de proposito: o helper nao casa workspace
-- nenhum e so o master enxerga. E o que tira de uma equipe o canal que nao e do
-- workspace dela. Nao ha backfill aqui por isso.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  policy_row RECORD;
BEGIN
  IF to_regclass('public.whatsapp_channels') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.whatsapp_channels ENABLE ROW LEVEL SECURITY;

  FOR policy_row IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'whatsapp_channels'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.whatsapp_channels', policy_row.policyname);
  END LOOP;

  CREATE POLICY whatsapp_channels_workspace_member_access ON public.whatsapp_channels
    FOR ALL TO authenticated
    USING ((SELECT private.current_user_can_access_workspace(workspace_id::text)))
    WITH CHECK ((SELECT private.current_user_can_access_workspace(workspace_id::text)));
END $$;
