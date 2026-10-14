-- Critical production hardening: tenant isolation, private storage, secret removal,
-- and atomic order creation/cancellation.

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.current_user_can_access_workspace(p_workspace_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles profile
    LEFT JOIN public.roles role ON role.id = profile.role_id
    LEFT JOIN public.workspaces workspace ON workspace.id::text = p_workspace_id
    WHERE profile.id = (SELECT auth.uid())
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
$$;

REVOKE ALL ON FUNCTION private.current_user_can_access_workspace(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.current_user_can_access_workspace(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION private.current_user_can_access_workspace(TEXT) TO authenticated;

DO $$
DECLARE
  table_name TEXT;
  policy_row RECORD;
  workspace_tables TEXT[] := ARRAY[
    'crm_companies', 'crm_contacts', 'crm_deals', 'crm_pipelines',
    'crm_pipeline_stages', 'crm_pipeline_rules', 'crm_workspace_products',
    'crm_workspace_product_integrations', 'crm_cadences', 'crm_sales_goals'
  ];
  deal_tables TEXT[] := ARRAY[
    'crm_deal_contacts', 'crm_deal_history', 'crm_tasks', 'crm_deal_notes',
    'crm_deal_products', 'crm_deal_quotes', 'crm_deal_orders', 'crm_deal_comments'
  ];
BEGIN
  FOREACH table_name IN ARRAY workspace_tables LOOP
    IF to_regclass('public.' || table_name) IS NULL THEN CONTINUE; END IF;
    FOR policy_row IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = table_name LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_row.policyname, table_name);
    END LOOP;
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
       USING ((SELECT private.current_user_can_access_workspace(workspace_id::text)))
       WITH CHECK ((SELECT private.current_user_can_access_workspace(workspace_id::text)))',
      table_name || '_workspace_member_access', table_name
    );
  END LOOP;

  FOREACH table_name IN ARRAY deal_tables LOOP
    IF to_regclass('public.' || table_name) IS NULL THEN CONTINUE; END IF;
    FOR policy_row IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = table_name LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_row.policyname, table_name);
    END LOOP;
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
       USING (EXISTS (SELECT 1 FROM public.crm_deals deal WHERE deal.id = %I.deal_id
         AND (SELECT private.current_user_can_access_workspace(deal.workspace_id::text))))
       WITH CHECK (EXISTS (SELECT 1 FROM public.crm_deals deal WHERE deal.id = %I.deal_id
         AND (SELECT private.current_user_can_access_workspace(deal.workspace_id::text))))',
      table_name || '_deal_workspace_member_access', table_name, table_name, table_name
    );
  END LOOP;

  IF to_regclass('public.crm_deal_order_items') IS NOT NULL THEN
    FOR policy_row IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_deal_order_items' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.crm_deal_order_items', policy_row.policyname);
    END LOOP;
    CREATE POLICY crm_deal_order_items_workspace_member_access ON public.crm_deal_order_items
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.crm_deal_orders deal_order JOIN public.crm_deals deal ON deal.id = deal_order.deal_id
        WHERE deal_order.id = crm_deal_order_items.order_id
          AND (SELECT private.current_user_can_access_workspace(deal.workspace_id::text))))
      WITH CHECK (EXISTS (SELECT 1 FROM public.crm_deal_orders deal_order JOIN public.crm_deals deal ON deal.id = deal_order.deal_id
        WHERE deal_order.id = crm_deal_order_items.order_id
          AND (SELECT private.current_user_can_access_workspace(deal.workspace_id::text))));
  END IF;

  IF to_regclass('public.crm_cadence_steps') IS NOT NULL THEN
    FOR policy_row IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_cadence_steps' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.crm_cadence_steps', policy_row.policyname);
    END LOOP;
    CREATE POLICY crm_cadence_steps_workspace_member_access ON public.crm_cadence_steps
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.crm_cadences cadence WHERE cadence.id = crm_cadence_steps.cadence_id
        AND (SELECT private.current_user_can_access_workspace(cadence.workspace_id::text))))
      WITH CHECK (EXISTS (SELECT 1 FROM public.crm_cadences cadence WHERE cadence.id = crm_cadence_steps.cadence_id
        AND (SELECT private.current_user_can_access_workspace(cadence.workspace_id::text))));
  END IF;
END;
$$;

DO $$
DECLARE policy_row RECORD;
BEGIN
  IF to_regclass('public.crm_user_alerts') IS NULL THEN RETURN; END IF;
  FOR policy_row IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_user_alerts' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.crm_user_alerts', policy_row.policyname);
  END LOOP;
  CREATE POLICY crm_user_alerts_owner_workspace_access ON public.crm_user_alerts FOR ALL TO authenticated
    USING (lower(user_email) = lower(COALESCE((SELECT auth.jwt() ->> 'email'), ''))
      AND (SELECT private.current_user_can_access_workspace(workspace_id::text)))
    WITH CHECK (lower(user_email) = lower(COALESCE((SELECT auth.jwt() ->> 'email'), ''))
      AND (SELECT private.current_user_can_access_workspace(workspace_id::text)));
END;
$$;

-- These credentials were previously readable by any browser with database access.
-- Set fresh credentials as Edge Function secrets before enabling the integration again.
UPDATE public.crm_workspace_product_integrations
SET secret_key = NULL, authorization_token = NULL, updated_at = NOW()
WHERE secret_key IS NOT NULL OR authorization_token IS NOT NULL;

UPDATE storage.buckets SET public = FALSE WHERE id = 'chat-media';
DO $$
DECLARE policy_row RECORD;
BEGIN
  FOR policy_row IN SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (qual ILIKE '%chat-media%' OR with_check ILIKE '%chat-media%' OR policyname ILIKE '%chat-media%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', policy_row.policyname);
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.crm_deal_orders WHERE status = 'Ativo' GROUP BY deal_id HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'Não foi possível criar o índice de pedido ativo: existem negociações com mais de um pedido ativo.';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS crm_deal_orders_one_active_per_deal
  ON public.crm_deal_orders (deal_id) WHERE status = 'Ativo';

CREATE OR REPLACE FUNCTION public.create_deal_order_from_quote(
  p_deal_id UUID, p_quote_id UUID, p_order_number TEXT DEFAULT NULL, p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_deal public.crm_deals%ROWTYPE;
  v_quote public.crm_deal_quotes%ROWTYPE;
  v_order public.crm_deal_orders%ROWTYPE;
  v_total NUMERIC := 0;
  v_item_count INTEGER := 0;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_deal FROM public.crm_deals WHERE id = p_deal_id FOR UPDATE;
  IF NOT FOUND OR NOT private.current_user_can_access_workspace(v_deal.workspace_id::text) THEN
    RAISE EXCEPTION 'Negociação não encontrada ou sem acesso' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_quote FROM public.crm_deal_quotes WHERE id = p_quote_id AND deal_id = p_deal_id FOR UPDATE;
  IF NOT FOUND OR v_quote.status <> 'Ativa' THEN RAISE EXCEPTION 'A proposta selecionada não está ativa' USING ERRCODE = '23514'; END IF;
  IF EXISTS (SELECT 1 FROM public.crm_deal_orders WHERE deal_id = p_deal_id AND status = 'Ativo') THEN
    RAISE EXCEPTION 'Esta negociação já possui um pedido ativo' USING ERRCODE = '23505';
  END IF;
  SELECT COUNT(*), COALESCE(SUM(total_price), 0) INTO v_item_count, v_total
    FROM public.crm_deal_products WHERE quote_id = p_quote_id;
  IF v_item_count = 0 THEN RAISE EXCEPTION 'Não é possível criar pedido sem itens' USING ERRCODE = '23514'; END IF;
  INSERT INTO public.crm_deal_orders (deal_id, source_quote_id, order_number, status, notes)
    VALUES (p_deal_id, p_quote_id, NULLIF(BTRIM(p_order_number), ''), 'Ativo', NULLIF(BTRIM(p_notes), ''))
    RETURNING * INTO v_order;
  INSERT INTO public.crm_deal_order_items (
    order_id, workspace_product_id, quote_product_id, product_name, sku, quantity, unit_price, total_price, item_notes, metadata
  ) SELECT v_order.id, workspace_product_id, id, product_name, sku, quantity, unit_price, total_price, item_notes, metadata
    FROM public.crm_deal_products WHERE quote_id = p_quote_id;
  UPDATE public.crm_deals SET has_active_order = TRUE, value = v_total, updated_at = NOW() WHERE id = p_deal_id;
  RETURN jsonb_build_object('id', v_order.id, 'dealId', v_order.deal_id, 'sourceQuoteId', v_order.source_quote_id,
    'orderNumber', v_order.order_number, 'status', v_order.status, 'notes', v_order.notes,
    'createdAt', v_order.created_at, 'updatedAt', v_order.updated_at, 'totalValue', v_total);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_deal_order(p_order_id UUID, p_canceled_by TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE v_order public.crm_deal_orders%ROWTYPE; v_deal public.crm_deals%ROWTYPE; v_total NUMERIC := 0;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_order FROM public.crm_deal_orders WHERE id = p_order_id FOR UPDATE;
  IF FOUND THEN SELECT * INTO v_deal FROM public.crm_deals WHERE id = v_order.deal_id FOR UPDATE; END IF;
  IF NOT FOUND OR NOT private.current_user_can_access_workspace(v_deal.workspace_id::text) THEN
    RAISE EXCEPTION 'Pedido não encontrado ou sem acesso' USING ERRCODE = '42501';
  END IF;
  IF v_order.status <> 'Ativo' THEN RAISE EXCEPTION 'Este pedido não está ativo' USING ERRCODE = '23514'; END IF;
  UPDATE public.crm_deal_orders SET status = 'Cancelado', canceled_at = NOW(),
    canceled_by = NULLIF(BTRIM(COALESCE(p_canceled_by, '')), ''), updated_at = NOW()
    WHERE id = p_order_id RETURNING * INTO v_order;
  SELECT COALESCE(SUM(total_price), 0) INTO v_total FROM public.crm_deal_products WHERE quote_id = v_order.source_quote_id;
  UPDATE public.crm_deals SET has_active_order = FALSE, value = v_total, updated_at = NOW() WHERE id = v_order.deal_id;
  RETURN jsonb_build_object('id', v_order.id, 'dealId', v_order.deal_id, 'sourceQuoteId', v_order.source_quote_id,
    'status', v_order.status, 'totalValue', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.create_deal_order_from_quote(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_deal_order_from_quote(UUID, UUID, TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.cancel_deal_order(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_deal_order(UUID, TEXT) TO authenticated;
