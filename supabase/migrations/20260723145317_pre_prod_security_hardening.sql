CREATE OR REPLACE FUNCTION public.get_workspace_id()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT public.current_workspace_id();
$$;

DO $$
DECLARE
  policy_row RECORD;
BEGIN
  IF to_regclass('public.roles') IS NOT NULL THEN
    FOR policy_row IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'roles'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.roles', policy_row.policyname);
    END LOOP;

    CREATE POLICY roles_readable_by_current_user_and_org_managers ON public.roles
      FOR SELECT TO authenticated
      USING (
        id::text = private.current_profile_role_id()
        OR private.current_user_can_manage_org()
      );

    CREATE POLICY roles_manageable_by_masters ON public.roles
      FOR ALL TO authenticated
      USING (private.current_user_is_master())
      WITH CHECK (private.current_user_is_master());
  END IF;
END;
$$;

DO $$
DECLARE
  policy_row RECORD;
BEGIN
  IF to_regclass('public.task_automation_rules') IS NOT NULL THEN
    ALTER TABLE public.task_automation_rules ENABLE ROW LEVEL SECURITY;
    FOR policy_row IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'task_automation_rules'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.task_automation_rules', policy_row.policyname);
    END LOOP;

    CREATE POLICY task_automation_rules_workspace_member_access ON public.task_automation_rules
      FOR ALL TO authenticated
      USING ((SELECT private.current_user_can_access_workspace(workspace_id::text)))
      WITH CHECK ((SELECT private.current_user_can_access_workspace(workspace_id::text)));
  END IF;

  IF to_regclass('public.task_automation_executions') IS NOT NULL THEN
    ALTER TABLE public.task_automation_executions ENABLE ROW LEVEL SECURITY;
    FOR policy_row IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'task_automation_executions'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.task_automation_executions', policy_row.policyname);
    END LOOP;

    CREATE POLICY task_automation_executions_workspace_member_access ON public.task_automation_executions
      FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1
        FROM public.crm_deals deal
        WHERE deal.id = task_automation_executions.negotiation_id
          AND (SELECT private.current_user_can_access_workspace(deal.workspace_id::text))
      ))
      WITH CHECK (EXISTS (
        SELECT 1
        FROM public.crm_deals deal
        WHERE deal.id = task_automation_executions.negotiation_id
          AND (SELECT private.current_user_can_access_workspace(deal.workspace_id::text))
      ));
  END IF;
END;
$$;

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
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_deal FROM public.crm_deals WHERE id = p_deal_id FOR UPDATE;
  IF NOT FOUND OR NOT private.current_user_can_access_workspace(v_deal.workspace_id::text) THEN
    RAISE EXCEPTION 'Negociacao nao encontrada ou sem acesso' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_quote FROM public.crm_deal_quotes WHERE id = p_quote_id AND deal_id = p_deal_id FOR UPDATE;
  IF NOT FOUND OR v_quote.status <> 'Ativa' THEN
    RAISE EXCEPTION 'A proposta selecionada nao esta ativa' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (SELECT 1 FROM public.crm_deal_orders WHERE deal_id = p_deal_id AND status = 'Ativo') THEN
    RAISE EXCEPTION 'Esta negociacao ja possui um pedido ativo' USING ERRCODE = '23505';
  END IF;

  PERFORM 1 FROM public.crm_deal_quotes WHERE deal_id = p_deal_id AND status = 'Ativa' FOR UPDATE;

  SELECT COUNT(*), COALESCE(SUM(total_price), 0) INTO v_item_count, v_total
    FROM public.crm_deal_products WHERE quote_id = p_quote_id;
  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'Nao e possivel criar pedido sem itens' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.crm_deal_orders (deal_id, source_quote_id, order_number, status, notes)
    VALUES (p_deal_id, p_quote_id, NULLIF(BTRIM(p_order_number), ''), 'Ativo', NULLIF(BTRIM(p_notes), ''))
    RETURNING * INTO v_order;

  INSERT INTO public.crm_deal_order_items (
    order_id, workspace_product_id, quote_product_id, product_name, sku, quantity, unit_price, total_price, item_notes, metadata
  )
  SELECT v_order.id, workspace_product_id, id, product_name, sku, quantity, unit_price, total_price, item_notes, metadata
  FROM public.crm_deal_products
  WHERE quote_id = p_quote_id;

  UPDATE public.crm_deal_quotes
  SET status = CASE WHEN id = p_quote_id THEN 'Convertida em Pedido' ELSE 'Cancelada' END,
      canceled_at = CASE WHEN id = p_quote_id THEN NULL ELSE NOW() END,
      canceled_by = CASE WHEN id = p_quote_id THEN NULL ELSE 'Sistema' END,
      updated_at = NOW()
  WHERE deal_id = p_deal_id
    AND status = 'Ativa';

  UPDATE public.crm_deal_products
  SET item_status = CASE WHEN quote_id = p_quote_id THEN 'Pedido' ELSE 'Cotação' END,
      updated_at = NOW()
  WHERE deal_id = p_deal_id
    AND quote_id IN (SELECT id FROM public.crm_deal_quotes WHERE deal_id = p_deal_id);

  UPDATE public.crm_deals
  SET has_active_order = TRUE, value = v_total, updated_at = NOW()
  WHERE id = p_deal_id;

  RETURN jsonb_build_object(
    'id', v_order.id,
    'dealId', v_order.deal_id,
    'sourceQuoteId', v_order.source_quote_id,
    'orderNumber', v_order.order_number,
    'status', v_order.status,
    'notes', v_order.notes,
    'createdAt', v_order.created_at,
    'updatedAt', v_order.updated_at,
    'totalValue', v_total
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_deal_order(p_order_id UUID, p_canceled_by TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_order public.crm_deal_orders%ROWTYPE;
  v_deal public.crm_deals%ROWTYPE;
  v_total NUMERIC := 0;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_order FROM public.crm_deal_orders WHERE id = p_order_id FOR UPDATE;
  IF FOUND THEN
    SELECT * INTO v_deal FROM public.crm_deals WHERE id = v_order.deal_id FOR UPDATE;
  END IF;
  IF NOT FOUND OR NOT private.current_user_can_access_workspace(v_deal.workspace_id::text) THEN
    RAISE EXCEPTION 'Pedido nao encontrado ou sem acesso' USING ERRCODE = '42501';
  END IF;
  IF v_order.status <> 'Ativo' THEN
    RAISE EXCEPTION 'Este pedido nao esta ativo' USING ERRCODE = '23514';
  END IF;

  UPDATE public.crm_deal_orders
  SET status = 'Cancelado',
      canceled_at = NOW(),
      canceled_by = NULLIF(BTRIM(COALESCE(p_canceled_by, '')), ''),
      updated_at = NOW()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  UPDATE public.crm_deal_quotes
  SET status = 'Ativa',
      canceled_at = NULL,
      canceled_by = NULL,
      updated_at = NOW()
  WHERE id = v_order.source_quote_id;

  UPDATE public.crm_deal_products
  SET item_status = 'Cotação',
      updated_at = NOW()
  WHERE quote_id = v_order.source_quote_id;

  SELECT COALESCE(SUM(total_price), 0) INTO v_total
  FROM public.crm_deal_products
  WHERE quote_id = v_order.source_quote_id;

  UPDATE public.crm_deals
  SET has_active_order = FALSE, value = v_total, updated_at = NOW()
  WHERE id = v_order.deal_id;

  RETURN jsonb_build_object(
    'id', v_order.id,
    'dealId', v_order.deal_id,
    'sourceQuoteId', v_order.source_quote_id,
    'status', v_order.status,
    'totalValue', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_workspace_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_workspace_id() TO authenticated;
REVOKE ALL ON FUNCTION public.create_deal_order_from_quote(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_deal_order_from_quote(UUID, UUID, TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.cancel_deal_order(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_deal_order(UUID, TEXT) TO authenticated;
