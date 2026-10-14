-- Menção em comentário volta a notificar quem foi mencionado.
--
-- Sintoma: ao mencionar um colega, a tela mostrava erro e o comentário sumia da lista (ele estava
-- salvo; voltava ao recarregar). Medido em 10/09/2026: 24 comentários com menção, 0 linhas em
-- crm_user_alerts.
--
-- Causa: a policy crm_user_alerts_owner_workspace_access (FOR ALL, criada no hardening
-- 20260722163254) exige, também no WITH CHECK, que o e-mail do alerta seja o do próprio autor.
-- O alerta de menção é, por definição, para OUTRA pessoa: o INSERT sempre violava o RLS.
--
-- Desenho: uma policy por operação. Ler, atualizar e apagar continuam restritos ao DONO do alerta,
-- como o hardening quis. Só o INSERT abre — e só para destinatário que alcança o mesmo workspace.
--
-- Desligar o alerta de outra pessoa (quando a menção é removida ou o comentário é apagado) NÃO é
-- feito por policy: no Postgres, um UPDATE com WHERE precisa ler a linha, e a leitura passa pela
-- policy de SELECT. Permitir isso exigiria deixar todo mundo enxergar alerta alheio. Medido em
-- ensaio (transação revertida, 10/09): com policy de desativação, o UPDATE afetava 0 linhas.
-- Por isso a desativação vira uma função SECURITY DEFINER de escopo estreito: desliga apenas
-- alertas de menção de UM comentário, e só para quem alcança o workspace daquele alerta.

-- Espelha private.current_user_can_access_workspace, mas para o DESTINATÁRIO do alerta.
-- Sem isto, o INSERT aceitaria qualquer string no user_email (inclusive e-mail de fora da conta).
CREATE OR REPLACE FUNCTION private.email_can_access_workspace(p_email TEXT, p_workspace_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles profile
    LEFT JOIN public.roles role ON role.id = profile.role_id
    LEFT JOIN public.workspaces workspace ON workspace.id::text = p_workspace_id
    WHERE lower(profile.email) = lower(COALESCE(p_email, ''))
      AND (
        COALESCE(role.is_master, FALSE)
        OR (
          workspace.id IS NOT NULL
          AND workspace.organization_id = profile.organization_id
          AND (
            'all' = ANY(COALESCE(profile.workspaces, ARRAY[]::TEXT[]))
            OR p_workspace_id = ANY(COALESCE(profile.workspaces, ARRAY[]::TEXT[]))
          )
        )
      )
  );
$function$;

REVOKE ALL ON FUNCTION private.email_can_access_workspace(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.email_can_access_workspace(TEXT, TEXT) TO authenticated;

-- Policy permissiva soma por OR: derruba todas antes de criar as novas.
DO $$
DECLARE policy_row RECORD;
BEGIN
  IF to_regclass('public.crm_user_alerts') IS NULL THEN RETURN; END IF;
  FOR policy_row IN
    SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_user_alerts'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.crm_user_alerts', policy_row.policyname);
  END LOOP;

  CREATE POLICY crm_user_alerts_select_own ON public.crm_user_alerts
    FOR SELECT TO authenticated
    USING (
      lower(user_email) = lower(COALESCE((SELECT auth.jwt() ->> 'email'), ''))
      AND (SELECT private.current_user_can_access_workspace(workspace_id::text))
    );

  CREATE POLICY crm_user_alerts_insert_workspace ON public.crm_user_alerts
    FOR INSERT TO authenticated
    WITH CHECK (
      (SELECT private.current_user_can_access_workspace(workspace_id::text))
      AND (SELECT private.email_can_access_workspace(user_email, workspace_id::text))
    );

  CREATE POLICY crm_user_alerts_update_own ON public.crm_user_alerts
    FOR UPDATE TO authenticated
    USING (
      lower(user_email) = lower(COALESCE((SELECT auth.jwt() ->> 'email'), ''))
      AND (SELECT private.current_user_can_access_workspace(workspace_id::text))
    )
    WITH CHECK (
      lower(user_email) = lower(COALESCE((SELECT auth.jwt() ->> 'email'), ''))
      AND (SELECT private.current_user_can_access_workspace(workspace_id::text))
    );

  CREATE POLICY crm_user_alerts_delete_own ON public.crm_user_alerts
    FOR DELETE TO authenticated
    USING (
      lower(user_email) = lower(COALESCE((SELECT auth.jwt() ->> 'email'), ''))
      AND (SELECT private.current_user_can_access_workspace(workspace_id::text))
    );
END;
$$;

-- Desliga os alertas de menção de UM comentário. Chamada quando a menção é removida na edição ou
-- o comentário é apagado. Roda com privilégio próprio porque mexe em linha de outra pessoa, e por
-- isso valida na marra: só alerta de menção, só daquele comentário, só em workspace que o chamador
-- alcança. Nunca reativa, nunca edita título ou descrição, nunca apaga linha.
CREATE OR REPLACE FUNCTION public.deactivate_comment_mention_alerts(
  p_comment_id TEXT,
  p_user_emails TEXT[] DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_comment_id IS NULL OR btrim(p_comment_id) = '' THEN
    RETURN 0;
  END IF;

  UPDATE public.crm_user_alerts alerta
     SET active = FALSE,
         read_at = COALESCE(alerta.read_at, now()),
         updated_at = now()
   WHERE alerta.type = 'comment_mention'
     AND alerta.dedupe_key LIKE 'comment_mention:' || p_comment_id || ':%'
     AND alerta.active
     AND (
       p_user_emails IS NULL
       OR lower(alerta.user_email) IN (SELECT lower(email) FROM unnest(p_user_emails) AS email)
     )
     AND private.current_user_can_access_workspace(alerta.workspace_id::text);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.deactivate_comment_mention_alerts(TEXT, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deactivate_comment_mention_alerts(TEXT, TEXT[]) TO authenticated;
