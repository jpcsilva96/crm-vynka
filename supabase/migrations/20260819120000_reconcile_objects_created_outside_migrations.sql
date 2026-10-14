-- Reconciliação: objetos que existem em PRODUÇÃO mas nunca estiveram em migration.
--
-- Descobertos em 19/08/2026 ao comparar o banco com o repo. Foram criados à mão (dashboard
-- ou psql) ao longo do tempo; como Supabase -> GitHub não tem escrita de volta, nada disso
-- voltou ao repo. Quem recriasse o banco a partir das migrations receberia um schema
-- incompleto -- inclusive sem o índice único que o sync de produtos depende, e sem o gatilho
-- que cria o `profiles` de um usuário novo (ou seja: usuário criado, sem acesso nenhum).
--
-- Esta migration é TRANSCRIÇÃO do DDL real (pg_get_functiondef / indexdef / pg_policies),
-- não redação. Ela é idempotente de propósito: em produção todos os objetos já existem e
-- ela deve ser um no-op; o valor está em quem recria o banco do zero.
--
-- NÃO corrige defeitos conhecidos destes objetos -- corrigir aqui misturaria reconciliação
-- com mudança de comportamento. Os defeitos estão anotados abaixo e viram trabalho próprio.

-- O índice único de SKU do catálogo de produtos NÃO está aqui: ele já tinha versão própria no
-- histórico da produção (13/08) e foi reconstituído no arquivo daquela data,
-- `20260813120000_add_unique_workspace_product_sku.sql`, para preservar a linha do tempo.

-- ---------------------------------------------------------------------------
-- 1. Índice único de metas de venda
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS crm_sales_goals_unique_idx
  ON public.crm_sales_goals USING btree (
    workspace_id, user_id, period_month, period_year, COALESCE(pipeline_id, ''::text)
  );

-- ---------------------------------------------------------------------------
-- 2. Criação automática do profile ao criar usuário no auth
--
-- Sem esta função e o gatilho abaixo, um usuário criado não ganha linha em `profiles` e
-- fica sem acesso ao CRM. O fluxo normal (Edge Function `create-user`) faz um upsert em
-- `profiles` logo depois, então convive com o gatilho sem conflito de chave.
--
-- DEFEITOS CONHECIDOS, transcritos como estão (correção é trabalho próprio):
--   a) o default de `role_id` é 'agent', papel que NÃO existe no catálogo `roles`
--      (existem admin, admin-empresa, gestor, master, vendedor). Hoje inalcançável pelo
--      `create-user`, que exige e valida `roleId`, mas um usuário criado por outra via
--      (signup direto, dashboard) nasceria com perfil inválido -- não há FK protegendo;
--   b) é SECURITY DEFINER sem `search_path` fixo.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, name, email, cpf, role_id, workspaces, require_password_change, organization_id)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'cpf',
    COALESCE(new.raw_user_meta_data->>'roleId', 'agent'),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(new.raw_user_meta_data->'workspaces', '["default"]'::jsonb))),
    COALESCE((new.raw_user_meta_data->>'requirePasswordChange')::boolean, false),
    (new.raw_user_meta_data->>'organizationId')::uuid
  );
  RETURN new;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 3. Policies criadas pela UI do Supabase (era abril, tabelas do WhatsApp/atendimento)
--
-- Transcritas como estão. Note que várias concedem ao papel `public` e se apoiam apenas
-- em `auth.role() = 'authenticated'`, sem recorte por workspace -- padrão mais frouxo
-- que o das policies `_workspace_member_access` criadas nas migrations de hardening de
-- julho. Revisar é trabalho próprio; aqui só se registra o que existe.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.profiles;
CREATE POLICY "Enable read access for authenticated users" ON public.profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable update for users based on id" ON public.profiles;
CREATE POLICY "Enable update for users based on id" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Enable all access for tabulations" ON public.tabulations;
CREATE POLICY "Enable all access for tabulations" ON public.tabulations
  FOR ALL USING (auth.role() = 'authenticated'::text);

DROP POLICY IF EXISTS "Enable all access for tags" ON public.tags;
CREATE POLICY "Enable all access for tags" ON public.tags
  FOR ALL USING (auth.role() = 'authenticated'::text);

DROP POLICY IF EXISTS "Enable all access for channels" ON public.whatsapp_channels;
CREATE POLICY "Enable all access for channels" ON public.whatsapp_channels
  FOR ALL USING (auth.role() = 'authenticated'::text);

DROP POLICY IF EXISTS "Enable all access for master on workspaces" ON public.workspaces;
CREATE POLICY "Enable all access for master on workspaces" ON public.workspaces
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE ((profiles.id = auth.uid()) AND (profiles.role_id = 'master'::text))
    )
  );

DROP POLICY IF EXISTS "Enable read access for all users on workspaces" ON public.workspaces;
CREATE POLICY "Enable read access for all users on workspaces" ON public.workspaces
  FOR SELECT USING (auth.role() = 'authenticated'::text);
