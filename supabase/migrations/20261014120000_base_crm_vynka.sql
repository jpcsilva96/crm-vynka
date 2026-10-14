-- =============================================================================
-- crm-vynka — migration base
--
-- Schema completo do banco, num arquivo só. Gerado em 14/10/2026 assim:
--   1. as 60 migrations do CRM de origem foram reaplicadas, numa transação descartável, sobre
--      as tabelas centrais que lá nasceram fora de migration (organizations, roles, workspaces,
--      profiles), reconstruídas pelos tipos gerados e pelo código;
--   2. na mesma transação, saiu o que não faz parte do crm-vynka: atendimento WhatsApp, API
--      pública, propostas, pedidos, produtos, integração com ERP, regras do pipeline e metas;
--   3. o DDL resultante foi extraído do catálogo (pg_get_*); a transação terminou em ROLLBACK.
--
-- Correções em relação à origem (defeitos documentados lá e nunca corrigidos):
--   - handle_new_user: papel padrão 'vendedor' (era 'agent', papel inexistente), workspaces
--     padrão vazio (era ["default"]) e search_path fixo (SECURITY DEFINER sem search_path).
--   - workspaces.deal_code_prefix: padrão 'VYN' (era o da origem).
--   - policies frouxas de profiles e workspaces trocadas por recorte por organização, e as de
--     histórico e vínculos passam a exigir que o usuário seja membro do workspace (ver a seção
--     "Isolamento entre organizações", no fim do arquivo).
--
-- Daqui para frente, toda mudança de schema é uma migration nova (RULES.md §3).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Schemas
-- -----------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS private;


-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------

CREATE TABLE public.crm_companies (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  cnpj text,
  assigned_to uuid,
  segment text,
  url text,
  address text,
  notes text,
  workspace_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  company_type text DEFAULT 'MATRIZ'::text NOT NULL,
  parent_company_id uuid,
  deleted_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.crm_contact_companies (
  contact_id uuid NOT NULL,
  company_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.crm_contacts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  role text,
  phone text,
  email text,
  linked_in text,
  company_id uuid,
  person_type text,
  cpf text,
  workspace_id uuid NOT NULL,
  notes text,
  assigned_to uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  qualification_bant jsonb DEFAULT '{}'::jsonb NOT NULL,
  qualification_score integer,
  qualification_classification text,
  qualification_completed_at timestamp with time zone,
  qualification_responsible text,
  deleted_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.crm_deal_comments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  deal_id uuid NOT NULL,
  author_user_id uuid,
  author_name text NOT NULL,
  message text NOT NULL,
  mentions jsonb DEFAULT '[]'::jsonb NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.crm_deal_contacts (
  deal_id uuid NOT NULL,
  contact_id uuid NOT NULL
);

CREATE TABLE public.crm_deal_history (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  deal_id uuid,
  action text NOT NULL,
  user_name text,
  date timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.crm_deal_notes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  deal_id uuid NOT NULL,
  content_html text DEFAULT ''::text NOT NULL,
  content_text text DEFAULT ''::text NOT NULL,
  attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
  last_edited_by text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.crm_deals (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  deal_name text,
  person_type text,
  company_id uuid,
  contact_id uuid,
  phone text,
  contact_name text,
  contact_role text,
  stage text DEFAULT 'leads'::text NOT NULL,
  outcome text,
  loss_reason text,
  loss_description text,
  value numeric DEFAULT 0,
  tags text[] DEFAULT '{}'::text[],
  assigned_to uuid,
  notes text[] DEFAULT '{}'::text[],
  qualification text,
  closing_date timestamp with time zone,
  workspace_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  pipeline_id uuid NOT NULL,
  qualification_bant jsonb DEFAULT '{}'::jsonb NOT NULL,
  qualification_score integer,
  qualification_classification text,
  qualification_completed_at timestamp with time zone,
  qualification_responsible text,
  deal_code text,
  deal_code_number bigint,
  deleted_at timestamp with time zone,
  primary_contact_id uuid
);

CREATE TABLE public.crm_option_lists (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  kind text NOT NULL,
  label text NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.crm_pipeline_stages (
  workspace_id uuid NOT NULL,
  stage_id text NOT NULL,
  label text NOT NULL,
  probability numeric DEFAULT 0 NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  pipeline_id uuid NOT NULL,
  color text
);

CREATE TABLE public.crm_pipelines (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  workspace_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.crm_record_history (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  action text NOT NULL,
  changed_by uuid,
  changed_at timestamp with time zone DEFAULT now() NOT NULL,
  changes jsonb NOT NULL
);

CREATE TABLE public.crm_tasks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  deal_id uuid,
  title text NOT NULL,
  description text,
  due_date date,
  due_time time without time zone,
  assigned_to uuid,
  task_type text,
  completed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  company_id uuid,
  status text DEFAULT 'pending'::text NOT NULL,
  activity_result text,
  result_notes text,
  completed_at timestamp with time zone,
  completed_by text,
  canceled_at timestamp with time zone,
  canceled_by text,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.crm_user_alerts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  workspace_id text NOT NULL,
  user_email text NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  active boolean DEFAULT true NOT NULL,
  dedupe_key text NOT NULL,
  target text DEFAULT 'deal'::text NOT NULL,
  target_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  read_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  dismissed_at timestamp with time zone
);

CREATE TABLE public.organizations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  trade_name text,
  legal_name text,
  cnpj text,
  email text,
  phone text,
  whatsapp text,
  website text,
  manager_name text,
  manager_email text,
  status text,
  subscription_status text DEFAULT 'Ativa'::text,
  billing_frequency text,
  due_day integer,
  next_due_date date,
  contract_end_date date,
  max_users integer,
  max_workspaces integer,
  is_active boolean DEFAULT true,
  is_blocked boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  cpf text,
  avatar text,
  role_id text DEFAULT 'vendedor'::text NOT NULL,
  organization_id uuid,
  workspaces text[] DEFAULT '{}'::text[],
  require_password_change boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.roles (
  id text NOT NULL,
  name text NOT NULL,
  permissions jsonb DEFAULT '{}'::jsonb NOT NULL,
  is_master boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.task_automation_executions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  rule_id uuid NOT NULL,
  negotiation_id uuid NOT NULL,
  stage_id text NOT NULL,
  task_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.task_automation_rules (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  workspace_id uuid NOT NULL,
  pipeline_id uuid NOT NULL,
  stage_id text NOT NULL,
  task_title text NOT NULL,
  task_description text,
  due_days integer DEFAULT 0 NOT NULL,
  active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.workspaces (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  name text NOT NULL,
  color text,
  organization_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  deal_code_prefix text DEFAULT 'VYN'::text NOT NULL,
  deal_code_next_number bigint DEFAULT 1 NOT NULL
);


-- -----------------------------------------------------------------------------
-- Chaves primárias, unicidade e checks
-- -----------------------------------------------------------------------------

ALTER TABLE public.crm_companies ADD CONSTRAINT crm_companies_company_type_check CHECK ((company_type = ANY (ARRAY['MATRIZ'::text, 'FILIAL'::text])));

ALTER TABLE public.crm_companies ADD CONSTRAINT crm_companies_pkey PRIMARY KEY (id);

ALTER TABLE public.crm_contact_companies ADD CONSTRAINT crm_contact_companies_pkey PRIMARY KEY (contact_id, company_id);

ALTER TABLE public.crm_contacts ADD CONSTRAINT crm_contacts_person_type_check CHECK ((person_type = ANY (ARRAY['Fisica'::text, 'Juridica'::text])));

ALTER TABLE public.crm_contacts ADD CONSTRAINT crm_contacts_pkey PRIMARY KEY (id);

ALTER TABLE public.crm_deal_comments ADD CONSTRAINT crm_deal_comments_pkey PRIMARY KEY (id);

ALTER TABLE public.crm_deal_contacts ADD CONSTRAINT crm_deal_contacts_pkey PRIMARY KEY (deal_id, contact_id);

ALTER TABLE public.crm_deal_history ADD CONSTRAINT crm_deal_history_pkey PRIMARY KEY (id);

ALTER TABLE public.crm_deal_notes ADD CONSTRAINT crm_deal_notes_deal_id_key UNIQUE (deal_id);

ALTER TABLE public.crm_deal_notes ADD CONSTRAINT crm_deal_notes_pkey PRIMARY KEY (id);

ALTER TABLE public.crm_deals ADD CONSTRAINT crm_deals_person_type_check CHECK ((person_type = ANY (ARRAY['Fisica'::text, 'Juridica'::text])));

ALTER TABLE public.crm_deals ADD CONSTRAINT crm_deals_pkey PRIMARY KEY (id);

ALTER TABLE public.crm_option_lists ADD CONSTRAINT crm_option_lists_kind_check CHECK ((kind = ANY (ARRAY['segment'::text, 'contact_role'::text])));

ALTER TABLE public.crm_option_lists ADD CONSTRAINT crm_option_lists_label_check CHECK ((btrim(label) <> ''::text));

ALTER TABLE public.crm_option_lists ADD CONSTRAINT crm_option_lists_pkey PRIMARY KEY (id);

ALTER TABLE public.crm_pipeline_stages ADD CONSTRAINT crm_pipeline_stages_id_key UNIQUE (id);

ALTER TABLE public.crm_pipeline_stages ADD CONSTRAINT crm_pipeline_stages_pipeline_stage_key UNIQUE (pipeline_id, stage_id);

ALTER TABLE public.crm_pipeline_stages ADD CONSTRAINT crm_pipeline_stages_pkey PRIMARY KEY (id);

ALTER TABLE public.crm_pipeline_stages ADD CONSTRAINT crm_pipeline_stages_probability_check CHECK (((probability >= (0)::numeric) AND (probability <= (100)::numeric)));

ALTER TABLE public.crm_pipelines ADD CONSTRAINT crm_pipelines_pkey PRIMARY KEY (id);

ALTER TABLE public.crm_record_history ADD CONSTRAINT crm_record_history_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])));

ALTER TABLE public.crm_record_history ADD CONSTRAINT crm_record_history_pkey PRIMARY KEY (id);

ALTER TABLE public.crm_record_history ADD CONSTRAINT crm_record_history_table_name_check CHECK ((table_name = ANY (ARRAY['crm_contacts'::text, 'crm_companies'::text, 'crm_contact_companies'::text])));

ALTER TABLE public.crm_tasks ADD CONSTRAINT crm_tasks_pkey PRIMARY KEY (id);

ALTER TABLE public.crm_tasks ADD CONSTRAINT crm_tasks_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'cancelled'::text])));

ALTER TABLE public.crm_user_alerts ADD CONSTRAINT crm_user_alerts_dedupe_key_key UNIQUE (dedupe_key);

ALTER TABLE public.crm_user_alerts ADD CONSTRAINT crm_user_alerts_pkey PRIMARY KEY (id);

ALTER TABLE public.organizations ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);

ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

ALTER TABLE public.roles ADD CONSTRAINT roles_pkey PRIMARY KEY (id);

ALTER TABLE public.task_automation_executions ADD CONSTRAINT task_automation_executions_pkey PRIMARY KEY (id);

ALTER TABLE public.task_automation_executions ADD CONSTRAINT task_automation_executions_rule_negotiation_stage_key UNIQUE (rule_id, negotiation_id, stage_id);

ALTER TABLE public.task_automation_rules ADD CONSTRAINT task_automation_rules_pkey PRIMARY KEY (id);

ALTER TABLE public.workspaces ADD CONSTRAINT workspaces_deal_code_next_number_check CHECK ((deal_code_next_number >= 1));

ALTER TABLE public.workspaces ADD CONSTRAINT workspaces_deal_code_prefix_check CHECK ((deal_code_prefix ~ '^[A-Z0-9]{2,8}$'::text));

ALTER TABLE public.workspaces ADD CONSTRAINT workspaces_pkey PRIMARY KEY (id);


-- -----------------------------------------------------------------------------
-- Chaves estrangeiras
-- -----------------------------------------------------------------------------

ALTER TABLE public.crm_companies ADD CONSTRAINT crm_companies_parent_company_id_fkey FOREIGN KEY (parent_company_id) REFERENCES crm_companies(id) ON DELETE RESTRICT;

ALTER TABLE public.crm_contact_companies ADD CONSTRAINT crm_contact_companies_company_id_fkey FOREIGN KEY (company_id) REFERENCES crm_companies(id) ON DELETE CASCADE;

ALTER TABLE public.crm_contact_companies ADD CONSTRAINT crm_contact_companies_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE;

ALTER TABLE public.crm_contacts ADD CONSTRAINT crm_contacts_company_id_fkey FOREIGN KEY (company_id) REFERENCES crm_companies(id) ON DELETE SET NULL;

ALTER TABLE public.crm_deal_comments ADD CONSTRAINT crm_deal_comments_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES crm_deals(id) ON DELETE CASCADE;

ALTER TABLE public.crm_deal_contacts ADD CONSTRAINT crm_deal_contacts_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE;

ALTER TABLE public.crm_deal_contacts ADD CONSTRAINT crm_deal_contacts_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES crm_deals(id) ON DELETE CASCADE;

ALTER TABLE public.crm_deal_history ADD CONSTRAINT crm_deal_history_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES crm_deals(id) ON DELETE CASCADE;

ALTER TABLE public.crm_deal_notes ADD CONSTRAINT crm_deal_notes_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES crm_deals(id) ON DELETE CASCADE;

ALTER TABLE public.crm_deals ADD CONSTRAINT crm_deals_company_id_fkey FOREIGN KEY (company_id) REFERENCES crm_companies(id) ON DELETE SET NULL;

ALTER TABLE public.crm_deals ADD CONSTRAINT crm_deals_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE SET NULL;

ALTER TABLE public.crm_deals ADD CONSTRAINT crm_deals_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES crm_pipelines(id) ON DELETE RESTRICT;

ALTER TABLE public.crm_deals ADD CONSTRAINT crm_deals_primary_contact_id_fkey FOREIGN KEY (primary_contact_id) REFERENCES crm_contacts(id) ON DELETE SET NULL;

ALTER TABLE public.crm_pipeline_stages ADD CONSTRAINT crm_pipeline_stages_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES crm_pipelines(id) ON DELETE CASCADE;

ALTER TABLE public.crm_tasks ADD CONSTRAINT crm_tasks_company_id_fkey FOREIGN KEY (company_id) REFERENCES crm_companies(id) ON DELETE SET NULL;

ALTER TABLE public.crm_tasks ADD CONSTRAINT crm_tasks_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES crm_deals(id) ON DELETE CASCADE;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;

ALTER TABLE public.task_automation_executions ADD CONSTRAINT task_automation_executions_negotiation_id_fkey FOREIGN KEY (negotiation_id) REFERENCES crm_deals(id) ON DELETE CASCADE;

ALTER TABLE public.task_automation_executions ADD CONSTRAINT task_automation_executions_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES task_automation_rules(id) ON DELETE CASCADE;

ALTER TABLE public.task_automation_executions ADD CONSTRAINT task_automation_executions_task_id_fkey FOREIGN KEY (task_id) REFERENCES crm_tasks(id) ON DELETE SET NULL;

ALTER TABLE public.task_automation_rules ADD CONSTRAINT task_automation_rules_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES crm_pipelines(id) ON DELETE CASCADE;

ALTER TABLE public.workspaces ADD CONSTRAINT workspaces_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


-- -----------------------------------------------------------------------------
-- Índices
-- -----------------------------------------------------------------------------

CREATE INDEX crm_deal_comments_deal_created_idx ON public.crm_deal_comments USING btree (deal_id, created_at DESC);

CREATE INDEX crm_deal_notes_deal_idx ON public.crm_deal_notes USING btree (deal_id);

CREATE UNIQUE INDEX crm_deals_workspace_deal_code_key ON public.crm_deals USING btree (workspace_id, deal_code) WHERE (deal_code IS NOT NULL);

CREATE UNIQUE INDEX crm_deals_workspace_deal_code_number_key ON public.crm_deals USING btree (workspace_id, deal_code_number) WHERE (deal_code_number IS NOT NULL);

CREATE UNIQUE INDEX crm_option_lists_kind_label_key ON public.crm_option_lists USING btree (kind, lower(btrim(label)));

CREATE INDEX crm_option_lists_kind_position_idx ON public.crm_option_lists USING btree (kind, "position");

CREATE INDEX crm_tasks_company_id_idx ON public.crm_tasks USING btree (company_id);

CREATE INDEX crm_tasks_deal_status_due_idx ON public.crm_tasks USING btree (deal_id, status, due_date, due_time);

CREATE INDEX crm_user_alerts_active_scope_idx ON public.crm_user_alerts USING btree (workspace_id, user_email, updated_at DESC) WHERE (dismissed_at IS NULL);

CREATE INDEX crm_user_alerts_scope_idx ON public.crm_user_alerts USING btree (workspace_id, user_email, active, updated_at DESC);

CREATE INDEX idx_crm_companies_company_type ON public.crm_companies USING btree (company_type);

CREATE INDEX idx_crm_companies_parent_company_id ON public.crm_companies USING btree (parent_company_id);

CREATE INDEX idx_crm_companies_workspace_deleted_at ON public.crm_companies USING btree (workspace_id, deleted_at);

CREATE INDEX idx_crm_contact_companies_company ON public.crm_contact_companies USING btree (company_id, contact_id);

CREATE INDEX idx_crm_contacts_workspace_deleted_at ON public.crm_contacts USING btree (workspace_id, deleted_at);

CREATE INDEX idx_crm_deals_workspace_deleted_at ON public.crm_deals USING btree (workspace_id, deleted_at);

CREATE INDEX idx_crm_record_history_record ON public.crm_record_history USING btree (table_name, record_id, changed_at DESC);

CREATE INDEX idx_crm_record_history_workspace ON public.crm_record_history USING btree (workspace_id, changed_at DESC);

CREATE INDEX task_automation_executions_negotiation_stage_idx ON public.task_automation_executions USING btree (negotiation_id, stage_id, created_at DESC);

CREATE INDEX task_automation_rules_workspace_pipeline_stage_idx ON public.task_automation_rules USING btree (workspace_id, pipeline_id, stage_id, active);


-- -----------------------------------------------------------------------------
-- Funções
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.assign_crm_deal_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  code_prefix TEXT;
  next_number BIGINT;
BEGIN
  IF NEW.workspace_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.deal_code IS NOT NULL AND NEW.deal_code_number IS NOT NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.workspaces
  SET deal_code_next_number = deal_code_next_number + 1
  WHERE id::text = NEW.workspace_id::text
  RETURNING deal_code_prefix, deal_code_next_number - 1
  INTO code_prefix, next_number;

  IF next_number IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.deal_code_number := COALESCE(NEW.deal_code_number, next_number);
  NEW.deal_code := COALESCE(NEW.deal_code, code_prefix || '-' || NEW.deal_code_number::text);

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION private.current_profile_org_id()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  resolved_org_id TEXT;
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RETURN NULL;
  END IF;

  EXECUTE 'SELECT organization_id::text FROM public.profiles WHERE id = $1 LIMIT 1'
    INTO resolved_org_id
    USING auth.uid();

  RETURN resolved_org_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION private.current_profile_role_id()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  resolved_role_id TEXT;
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RETURN NULL;
  END IF;

  EXECUTE 'SELECT role_id::text FROM public.profiles WHERE id = $1 LIMIT 1'
    INTO resolved_role_id
    USING auth.uid();

  RETURN resolved_role_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION private.current_user_can_access_workspace(p_workspace_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION private.current_user_can_manage_org()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  allowed BOOLEAN := FALSE;
BEGIN
  IF to_regclass('public.profiles') IS NULL OR to_regclass('public.roles') IS NULL THEN
    RETURN FALSE;
  END IF;

  EXECUTE
    'SELECT
       coalesce(r.is_master, false)
       OR coalesce((r.permissions::jsonb ->> ''canManageUsers'')::boolean, false)
       OR coalesce((r.permissions::jsonb ->> ''canManageSettings'')::boolean, false)
       OR coalesce((r.permissions::jsonb -> ''menus'') ? ''users'', false)
       OR coalesce((r.permissions::jsonb -> ''menus'') ? ''settings'', false)
     FROM public.profiles p
     JOIN public.roles r ON r.id = p.role_id
     WHERE p.id = $1
     LIMIT 1'
    INTO allowed
    USING auth.uid();

  RETURN coalesce(allowed, FALSE);
END;
$function$
;

CREATE OR REPLACE FUNCTION private.current_user_can_manage_settings()
 RETURNS boolean
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
$function$
;

CREATE OR REPLACE FUNCTION private.current_user_is_master()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  allowed BOOLEAN := FALSE;
BEGIN
  IF to_regclass('public.profiles') IS NULL OR to_regclass('public.roles') IS NULL THEN
    RETURN FALSE;
  END IF;

  EXECUTE 'SELECT coalesce(r.is_master, false) FROM public.profiles p JOIN public.roles r ON r.id = p.role_id WHERE p.id = $1 LIMIT 1'
    INTO allowed
    USING auth.uid();

  RETURN coalesce(allowed, FALSE);
END;
$function$
;

CREATE OR REPLACE FUNCTION private.email_can_access_workspace(p_email text, p_workspace_id text)
 RETURNS boolean
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
$function$
;

CREATE OR REPLACE FUNCTION private.seed_default_crm_pipeline_for_workspace(p_workspace_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
    v_pipeline_id UUID;
BEGIN
    INSERT INTO public.crm_pipelines (workspace_id, name, description, is_active)
    SELECT p_workspace_id, seeded.name, seeded.description, true
    FROM (
        VALUES
            ('Pipeline Comercial'::text, 'Pipeline padrao para novas negociacoes do workspace.'::text),
            ('Pipeline IA'::text, 'Pipeline dedicado ao processo de vendas assistido por IA.'::text)
    ) AS seeded(name, description)
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.crm_pipelines existing
        WHERE existing.workspace_id = p_workspace_id
          AND existing.name = seeded.name
    );

    SELECT id
    INTO v_pipeline_id
    FROM public.crm_pipelines
    WHERE workspace_id = p_workspace_id
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_pipeline_id IS NULL THEN
        RAISE EXCEPTION 'Nao foi possivel localizar pipeline padrao do workspace %', p_workspace_id;
    END IF;

    INSERT INTO public.crm_pipeline_stages (
        pipeline_id,
        workspace_id,
        stage_id,
        label,
        probability,
        position,
        is_active
    )
    SELECT
        pipeline.id,
        p_workspace_id,
        seeded.stage_id,
        seeded.label,
        seeded.probability,
        seeded.position,
        true
    FROM public.crm_pipelines pipeline
    JOIN (
        VALUES
            ('Pipeline Comercial'::text, 'leads'::text, 'Lead Comercial'::text, 10::numeric, 1::integer),
            ('Pipeline Comercial'::text, 'qualification'::text, 'Qualificacao'::text, 35::numeric, 2::integer),
            ('Pipeline Comercial'::text, 'proposal'::text, 'Proposta'::text, 60::numeric, 3::integer),
            ('Pipeline Comercial'::text, 'negotiation'::text, 'Negociacao'::text, 80::numeric, 4::integer),
            ('Pipeline IA'::text, 'lead_ia'::text, 'Novo Lead'::text, 10::numeric, 1::integer),
            ('Pipeline IA'::text, 'contact_started'::text, 'Contato Iniciado'::text, 25::numeric, 2::integer),
            ('Pipeline IA'::text, 'qualification'::text, 'Qualificacao'::text, 45::numeric, 3::integer),
            ('Pipeline IA'::text, 'proposal'::text, 'Proposta'::text, 70::numeric, 4::integer),
            ('Pipeline IA'::text, 'negotiation'::text, 'Negociacao'::text, 85::numeric, 5::integer)
    ) AS seeded(pipeline_name, stage_id, label, probability, position)
        ON seeded.pipeline_name = pipeline.name
    WHERE pipeline.workspace_id = p_workspace_id
    ON CONFLICT (pipeline_id, stage_id) DO NOTHING;

    RETURN v_pipeline_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION private.seed_pipeline_stages_for_workspace(p_workspace_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
    INSERT INTO public.crm_pipeline_stages (
        workspace_id,
        stage_id,
        label,
        probability,
        position,
        is_active
    )
    VALUES
        (p_workspace_id, 'leads', 'Novos Leads', 10, 1, true),
        (p_workspace_id, 'qualification', 'Qualificação', 25, 2, true),
        (p_workspace_id, 'proposal', 'Proposta', 50, 3, true),
        (p_workspace_id, 'negotiation', 'Negociação', 75, 4, true),
        (p_workspace_id, 'closing', 'Fechamento', 95, 5, true)
    ON CONFLICT (workspace_id, stage_id) DO NOTHING;
END;
$function$
;

CREATE OR REPLACE FUNCTION private.set_current_timestamp_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION private.sync_crm_pipelines_from_workspace()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM public.crm_pipeline_stages
        WHERE workspace_id = OLD.id::uuid;

        DELETE FROM public.crm_pipelines
        WHERE workspace_id = OLD.id::uuid;

        RETURN OLD;
    END IF;

    PERFORM private.seed_default_crm_pipeline_for_workspace(NEW.id::uuid);
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION private.sync_pipeline_stages_from_workspace()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM public.crm_pipeline_stages
        WHERE workspace_id = OLD.id::uuid;
        RETURN OLD;
    END IF;

    PERFORM private.seed_pipeline_stages_for_workspace(NEW.id::uuid);
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.current_workspace_id()
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  SELECT COALESCE(
    NULLIF(current_setting('app.workspace_id', true), ''),
    NULLIF((current_setting('request.headers', true)::json ->> 'x-workspace-id'), ''),
    NULLIF((current_setting('request.headers', true)::json ->> 'app.workspace_id'), '')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.deactivate_comment_mention_alerts(p_comment_id text, p_user_emails text[] DEFAULT NULL::text[])
 RETURNS integer
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
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_crm_company_unique_cnpj()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  normalized_cnpj TEXT;
BEGIN
  normalized_cnpj := regexp_replace(COALESCE(NEW.cnpj, ''), '[^0-9]', '', 'g');

  -- Empty CNPJ values remain allowed. Only a supplied CNPJ must be unique.
  IF normalized_cnpj = '' OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Serialize checks for the same workspace/CNPJ pair to prevent concurrent inserts.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.workspace_id::text || ':' || normalized_cnpj, 0));

  IF EXISTS (
    SELECT 1
    FROM public.crm_companies company
    WHERE company.workspace_id = NEW.workspace_id
      AND company.deleted_at IS NULL
      AND regexp_replace(COALESCE(company.cnpj, ''), '[^0-9]', '', 'g') = normalized_cnpj
      AND company.id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'Já existe uma empresa ativa com este CNPJ neste workspace.'
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_crm_contact_unique_phone()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  normalized_phone TEXT;
BEGIN
  normalized_phone := regexp_replace(COALESCE(NEW.phone, ''), '[^0-9]', '', 'g');

  -- Empty phone values remain allowed. Only a supplied phone must be unique.
  IF normalized_phone = '' OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Serialize checks for the same workspace/phone pair to prevent concurrent inserts.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.workspace_id::text || ':' || normalized_phone, 0));

  IF EXISTS (
    SELECT 1
    FROM public.crm_contacts contact
    WHERE contact.workspace_id = NEW.workspace_id
      AND contact.deleted_at IS NULL
      AND regexp_replace(COALESCE(contact.phone, ''), '[^0-9]', '', 'g') = normalized_phone
      AND contact.id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'Já existe um contato ativo com este telefone neste workspace.'
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_workspace_id()
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  SELECT public.current_workspace_id();
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, name, email, cpf, role_id, workspaces, require_password_change, organization_id)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'cpf',
    COALESCE(new.raw_user_meta_data->>'roleId', 'vendedor'),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(new.raw_user_meta_data->'workspaces', '[]'::jsonb))),
    COALESCE((new.raw_user_meta_data->>'requirePasswordChange')::boolean, false),
    (new.raw_user_meta_data->>'organizationId')::uuid
  );
  RETURN new;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.log_contact_company_link_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.log_crm_record_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.sync_contact_primary_company()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.company_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.crm_contact_companies (contact_id, company_id, workspace_id)
  VALUES (NEW.id, NEW.company_id, NEW.workspace_id)
  ON CONFLICT DO NOTHING;

  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_crm_company_hierarchy()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  parent_record public.crm_companies%ROWTYPE;
  has_children BOOLEAN;
BEGIN
  NEW.company_type := COALESCE(NULLIF(NEW.company_type, ''), 'MATRIZ');

  IF NEW.company_type = 'MATRIZ' THEN
    NEW.parent_company_id := NULL;
  ELSIF NEW.company_type = 'FILIAL' THEN
    IF NEW.parent_company_id IS NULL THEN
      RAISE EXCEPTION 'Para cadastrar uma filial, selecione a empresa matriz.';
    END IF;

    IF NEW.parent_company_id = NEW.id THEN
      RAISE EXCEPTION 'Empresa não pode ser matriz dela mesma.';
    END IF;

    SELECT *
    INTO parent_record
    FROM public.crm_companies
    WHERE id = NEW.parent_company_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'A empresa matriz selecionada não foi encontrada.';
    END IF;

    IF parent_record.company_type <> 'MATRIZ' THEN
      RAISE EXCEPTION 'Uma filial só pode ser vinculada a uma empresa do tipo MATRIZ.';
    END IF;

    IF parent_record.workspace_id <> NEW.workspace_id THEN
      RAISE EXCEPTION 'A empresa matriz deve pertencer ao mesmo workspace.';
    END IF;

    IF parent_record.parent_company_id = NEW.id THEN
      RAISE EXCEPTION 'Não é permitido criar vínculo circular entre matriz e filial.';
    END IF;
  ELSE
    RAISE EXCEPTION 'Tipo da empresa inválido.';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.company_type = 'MATRIZ' AND NEW.company_type = 'FILIAL' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.crm_companies
      WHERE parent_company_id = OLD.id
        AND id <> OLD.id
    )
    INTO has_children;

    IF has_children THEN
      RAISE EXCEPTION 'Esta empresa possui filiais vinculadas. Remova ou transfira as filiais antes de alterar o tipo da empresa.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;


-- -----------------------------------------------------------------------------
-- Gatilhos
-- -----------------------------------------------------------------------------

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER trg_crm_companies_history AFTER UPDATE ON public.crm_companies FOR EACH ROW EXECUTE FUNCTION log_crm_record_change();

CREATE TRIGGER trg_crm_companies_updated_at BEFORE UPDATE ON public.crm_companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_enforce_crm_company_unique_cnpj BEFORE INSERT OR UPDATE OF cnpj, workspace_id, deleted_at ON public.crm_companies FOR EACH ROW EXECUTE FUNCTION enforce_crm_company_unique_cnpj();

CREATE TRIGGER trg_validate_crm_company_hierarchy BEFORE INSERT OR UPDATE ON public.crm_companies FOR EACH ROW EXECUTE FUNCTION validate_crm_company_hierarchy();

CREATE TRIGGER trg_crm_contact_companies_history AFTER INSERT OR DELETE ON public.crm_contact_companies FOR EACH ROW EXECUTE FUNCTION log_contact_company_link_change();

CREATE TRIGGER trg_crm_contacts_history AFTER UPDATE ON public.crm_contacts FOR EACH ROW EXECUTE FUNCTION log_crm_record_change();

CREATE TRIGGER trg_crm_contacts_sync_primary_company AFTER INSERT OR UPDATE OF company_id ON public.crm_contacts FOR EACH ROW EXECUTE FUNCTION sync_contact_primary_company();

CREATE TRIGGER trg_crm_contacts_updated_at BEFORE UPDATE ON public.crm_contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_enforce_crm_contact_unique_phone BEFORE INSERT OR UPDATE OF phone, workspace_id, deleted_at ON public.crm_contacts FOR EACH ROW EXECUTE FUNCTION enforce_crm_contact_unique_phone();

CREATE TRIGGER assign_crm_deal_code_before_insert BEFORE INSERT ON public.crm_deals FOR EACH ROW EXECUTE FUNCTION private.assign_crm_deal_code();

CREATE TRIGGER sync_crm_pipelines_from_workspace_trigger AFTER INSERT OR DELETE OR UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION private.sync_crm_pipelines_from_workspace();


-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

ALTER TABLE public.crm_companies ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.crm_contact_companies ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.crm_deal_comments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.crm_deal_contacts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.crm_deal_history ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.crm_deal_notes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.crm_option_lists ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.crm_pipeline_stages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.crm_pipelines ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.crm_record_history ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.crm_user_alerts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.task_automation_executions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.task_automation_rules ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- Policies
-- -----------------------------------------------------------------------------

CREATE POLICY crm_companies_workspace_member_access ON public.crm_companies AS PERMISSIVE FOR ALL TO authenticated
  USING (( SELECT private.current_user_can_access_workspace((crm_companies.workspace_id)::text) AS current_user_can_access_workspace))
  WITH CHECK (( SELECT private.current_user_can_access_workspace((crm_companies.workspace_id)::text) AS current_user_can_access_workspace));

CREATE POLICY crm_contacts_workspace_member_access ON public.crm_contacts AS PERMISSIVE FOR ALL TO authenticated
  USING (( SELECT private.current_user_can_access_workspace((crm_contacts.workspace_id)::text) AS current_user_can_access_workspace))
  WITH CHECK (( SELECT private.current_user_can_access_workspace((crm_contacts.workspace_id)::text) AS current_user_can_access_workspace));

CREATE POLICY crm_deal_comments_deal_workspace_member_access ON public.crm_deal_comments AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM crm_deals deal
  WHERE ((deal.id = crm_deal_comments.deal_id) AND ( SELECT private.current_user_can_access_workspace((deal.workspace_id)::text) AS current_user_can_access_workspace)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM crm_deals deal
  WHERE ((deal.id = crm_deal_comments.deal_id) AND ( SELECT private.current_user_can_access_workspace((deal.workspace_id)::text) AS current_user_can_access_workspace)))));

CREATE POLICY crm_deal_contacts_deal_workspace_member_access ON public.crm_deal_contacts AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM crm_deals deal
  WHERE ((deal.id = crm_deal_contacts.deal_id) AND ( SELECT private.current_user_can_access_workspace((deal.workspace_id)::text) AS current_user_can_access_workspace)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM crm_deals deal
  WHERE ((deal.id = crm_deal_contacts.deal_id) AND ( SELECT private.current_user_can_access_workspace((deal.workspace_id)::text) AS current_user_can_access_workspace)))));

CREATE POLICY crm_deal_history_deal_workspace_member_access ON public.crm_deal_history AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM crm_deals deal
  WHERE ((deal.id = crm_deal_history.deal_id) AND ( SELECT private.current_user_can_access_workspace((deal.workspace_id)::text) AS current_user_can_access_workspace)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM crm_deals deal
  WHERE ((deal.id = crm_deal_history.deal_id) AND ( SELECT private.current_user_can_access_workspace((deal.workspace_id)::text) AS current_user_can_access_workspace)))));

CREATE POLICY crm_deal_notes_deal_workspace_member_access ON public.crm_deal_notes AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM crm_deals deal
  WHERE ((deal.id = crm_deal_notes.deal_id) AND ( SELECT private.current_user_can_access_workspace((deal.workspace_id)::text) AS current_user_can_access_workspace)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM crm_deals deal
  WHERE ((deal.id = crm_deal_notes.deal_id) AND ( SELECT private.current_user_can_access_workspace((deal.workspace_id)::text) AS current_user_can_access_workspace)))));

CREATE POLICY crm_deals_workspace_member_access ON public.crm_deals AS PERMISSIVE FOR ALL TO authenticated
  USING (( SELECT private.current_user_can_access_workspace((crm_deals.workspace_id)::text) AS current_user_can_access_workspace))
  WITH CHECK (( SELECT private.current_user_can_access_workspace((crm_deals.workspace_id)::text) AS current_user_can_access_workspace));

CREATE POLICY crm_option_lists_delete ON public.crm_option_lists AS PERMISSIVE FOR DELETE TO authenticated
  USING (private.current_user_can_manage_settings());

CREATE POLICY crm_option_lists_insert ON public.crm_option_lists AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (private.current_user_can_manage_settings());

CREATE POLICY crm_option_lists_read ON public.crm_option_lists AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY crm_option_lists_update ON public.crm_option_lists AS PERMISSIVE FOR UPDATE TO authenticated
  USING (private.current_user_can_manage_settings())
  WITH CHECK (private.current_user_can_manage_settings());

CREATE POLICY crm_pipeline_stages_workspace_member_access ON public.crm_pipeline_stages AS PERMISSIVE FOR ALL TO authenticated
  USING (( SELECT private.current_user_can_access_workspace((crm_pipeline_stages.workspace_id)::text) AS current_user_can_access_workspace))
  WITH CHECK (( SELECT private.current_user_can_access_workspace((crm_pipeline_stages.workspace_id)::text) AS current_user_can_access_workspace));

CREATE POLICY crm_pipelines_workspace_member_access ON public.crm_pipelines AS PERMISSIVE FOR ALL TO authenticated
  USING (( SELECT private.current_user_can_access_workspace((crm_pipelines.workspace_id)::text) AS current_user_can_access_workspace))
  WITH CHECK (( SELECT private.current_user_can_access_workspace((crm_pipelines.workspace_id)::text) AS current_user_can_access_workspace));

CREATE POLICY crm_tasks_deal_workspace_member_access ON public.crm_tasks AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM crm_deals deal
  WHERE ((deal.id = crm_tasks.deal_id) AND ( SELECT private.current_user_can_access_workspace((deal.workspace_id)::text) AS current_user_can_access_workspace)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM crm_deals deal
  WHERE ((deal.id = crm_tasks.deal_id) AND ( SELECT private.current_user_can_access_workspace((deal.workspace_id)::text) AS current_user_can_access_workspace)))));

CREATE POLICY crm_user_alerts_delete_own ON public.crm_user_alerts AS PERMISSIVE FOR DELETE TO authenticated
  USING (((lower(user_email) = lower(COALESCE(( SELECT (auth.jwt() ->> 'email'::text)), ''::text))) AND ( SELECT private.current_user_can_access_workspace(crm_user_alerts.workspace_id) AS current_user_can_access_workspace)));

CREATE POLICY crm_user_alerts_insert_workspace ON public.crm_user_alerts AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((( SELECT private.current_user_can_access_workspace(crm_user_alerts.workspace_id) AS current_user_can_access_workspace) AND ( SELECT private.email_can_access_workspace(crm_user_alerts.user_email, crm_user_alerts.workspace_id) AS email_can_access_workspace)));

CREATE POLICY crm_user_alerts_select_own ON public.crm_user_alerts AS PERMISSIVE FOR SELECT TO authenticated
  USING (((lower(user_email) = lower(COALESCE(( SELECT (auth.jwt() ->> 'email'::text)), ''::text))) AND ( SELECT private.current_user_can_access_workspace(crm_user_alerts.workspace_id) AS current_user_can_access_workspace)));

CREATE POLICY crm_user_alerts_update_own ON public.crm_user_alerts AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((lower(user_email) = lower(COALESCE(( SELECT (auth.jwt() ->> 'email'::text)), ''::text))) AND ( SELECT private.current_user_can_access_workspace(crm_user_alerts.workspace_id) AS current_user_can_access_workspace)))
  WITH CHECK (((lower(user_email) = lower(COALESCE(( SELECT (auth.jwt() ->> 'email'::text)), ''::text))) AND ( SELECT private.current_user_can_access_workspace(crm_user_alerts.workspace_id) AS current_user_can_access_workspace)));

CREATE POLICY "organizations manageable by masters" ON public.organizations AS PERMISSIVE FOR ALL TO authenticated
  USING (private.current_user_is_master())
  WITH CHECK (private.current_user_is_master());

CREATE POLICY "organizations readable by members" ON public.organizations AS PERMISSIVE FOR SELECT TO authenticated
  USING ((private.current_user_is_master() OR ((id)::text = private.current_profile_org_id())));

CREATE POLICY "profiles deletable by org managers" ON public.profiles AS PERMISSIVE FOR DELETE TO authenticated
  USING (((id <> auth.uid()) AND (private.current_user_is_master() OR (private.current_user_can_manage_org() AND ((organization_id)::text = private.current_profile_org_id())))));

CREATE POLICY "profiles insertable by org managers" ON public.profiles AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((private.current_user_is_master() OR (private.current_user_can_manage_org() AND ((organization_id)::text = private.current_profile_org_id()))));

CREATE POLICY "profiles readable by self or org managers" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated
  USING (((id = auth.uid()) OR private.current_user_is_master() OR (private.current_user_can_manage_org() AND ((organization_id)::text = private.current_profile_org_id()))));

CREATE POLICY "profiles updatable by self or org managers" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((private.current_user_is_master() OR (private.current_user_can_manage_org() AND ((organization_id)::text = private.current_profile_org_id()))))
  WITH CHECK ((private.current_user_is_master() OR (private.current_user_can_manage_org() AND ((organization_id)::text = private.current_profile_org_id()))));

CREATE POLICY roles_manageable_by_masters ON public.roles AS PERMISSIVE FOR ALL TO authenticated
  USING (private.current_user_is_master())
  WITH CHECK (private.current_user_is_master());

CREATE POLICY roles_readable_by_current_user_and_org_managers ON public.roles AS PERMISSIVE FOR SELECT TO authenticated
  USING (((id = private.current_profile_role_id()) OR private.current_user_can_manage_org()));

CREATE POLICY task_automation_executions_workspace_member_access ON public.task_automation_executions AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM crm_deals deal
  WHERE ((deal.id = task_automation_executions.negotiation_id) AND ( SELECT private.current_user_can_access_workspace((deal.workspace_id)::text) AS current_user_can_access_workspace)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM crm_deals deal
  WHERE ((deal.id = task_automation_executions.negotiation_id) AND ( SELECT private.current_user_can_access_workspace((deal.workspace_id)::text) AS current_user_can_access_workspace)))));

CREATE POLICY task_automation_rules_workspace_member_access ON public.task_automation_rules AS PERMISSIVE FOR ALL TO authenticated
  USING (( SELECT private.current_user_can_access_workspace((task_automation_rules.workspace_id)::text) AS current_user_can_access_workspace))
  WITH CHECK (( SELECT private.current_user_can_access_workspace((task_automation_rules.workspace_id)::text) AS current_user_can_access_workspace));


-- -----------------------------------------------------------------------------
-- Permissões de schema
-- -----------------------------------------------------------------------------

GRANT USAGE ON SCHEMA private TO service_role;


-- -----------------------------------------------------------------------------
-- Permissões de tabela (exatas: o que não está aqui foi revogado de propósito)
-- -----------------------------------------------------------------------------

REVOKE ALL ON public.crm_companies FROM anon, authenticated, service_role; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_companies TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_companies TO authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_companies TO service_role;

REVOKE ALL ON public.crm_contact_companies FROM anon, authenticated, service_role; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_contact_companies TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_contact_companies TO authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_contact_companies TO service_role;

REVOKE ALL ON public.crm_contacts FROM anon, authenticated, service_role; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_contacts TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_contacts TO authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_contacts TO service_role;

REVOKE ALL ON public.crm_deal_comments FROM anon, authenticated, service_role; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_deal_comments TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_deal_comments TO authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_deal_comments TO service_role;

REVOKE ALL ON public.crm_deal_contacts FROM anon, authenticated, service_role; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_deal_contacts TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_deal_contacts TO authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_deal_contacts TO service_role;

REVOKE ALL ON public.crm_deal_history FROM anon, authenticated, service_role; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_deal_history TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_deal_history TO authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_deal_history TO service_role;

REVOKE ALL ON public.crm_deal_notes FROM anon, authenticated, service_role; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_deal_notes TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_deal_notes TO authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_deal_notes TO service_role;

REVOKE ALL ON public.crm_deals FROM anon, authenticated, service_role; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_deals TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_deals TO authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_deals TO service_role;

REVOKE ALL ON public.crm_option_lists FROM anon, authenticated, service_role; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_option_lists TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_option_lists TO authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_option_lists TO service_role;

REVOKE ALL ON public.crm_pipeline_stages FROM anon, authenticated, service_role; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_pipeline_stages TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_pipeline_stages TO authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_pipeline_stages TO service_role;

REVOKE ALL ON public.crm_pipelines FROM anon, authenticated, service_role; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_pipelines TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_pipelines TO authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_pipelines TO service_role;

REVOKE ALL ON public.crm_record_history FROM anon, authenticated, service_role; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_record_history TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_record_history TO authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_record_history TO service_role;

REVOKE ALL ON public.crm_tasks FROM anon, authenticated, service_role; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_tasks TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_tasks TO authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_tasks TO service_role;

REVOKE ALL ON public.crm_user_alerts FROM anon, authenticated, service_role; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_user_alerts TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_user_alerts TO authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.crm_user_alerts TO service_role;

REVOKE ALL ON public.organizations FROM anon, authenticated, service_role; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.organizations TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.organizations TO authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.organizations TO service_role;

REVOKE ALL ON public.profiles FROM anon, authenticated, service_role; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.profiles TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.profiles TO authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.profiles TO service_role;

REVOKE ALL ON public.roles FROM anon, authenticated, service_role; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.roles TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.roles TO authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.roles TO service_role;

REVOKE ALL ON public.task_automation_executions FROM anon, authenticated, service_role; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.task_automation_executions TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.task_automation_executions TO authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.task_automation_executions TO service_role;

REVOKE ALL ON public.task_automation_rules FROM anon, authenticated, service_role; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.task_automation_rules TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.task_automation_rules TO authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.task_automation_rules TO service_role;

REVOKE ALL ON public.workspaces FROM anon, authenticated, service_role; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.workspaces TO anon; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.workspaces TO authenticated; GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.workspaces TO service_role;


-- -----------------------------------------------------------------------------
-- Permissões de função (exatas)
-- -----------------------------------------------------------------------------

REVOKE ALL ON FUNCTION private.assign_crm_deal_code() FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION private.assign_crm_deal_code() TO PUBLIC;

REVOKE ALL ON FUNCTION private.current_profile_org_id() FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION private.current_profile_org_id() TO PUBLIC;

REVOKE ALL ON FUNCTION private.current_profile_role_id() FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION private.current_profile_role_id() TO PUBLIC;

REVOKE ALL ON FUNCTION private.current_user_can_access_workspace(p_workspace_id text) FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION private.current_user_can_access_workspace(p_workspace_id text) TO authenticated;

REVOKE ALL ON FUNCTION private.current_user_can_manage_org() FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION private.current_user_can_manage_org() TO PUBLIC;

REVOKE ALL ON FUNCTION private.current_user_can_manage_settings() FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION private.current_user_can_manage_settings() TO authenticated;

REVOKE ALL ON FUNCTION private.current_user_is_master() FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION private.current_user_is_master() TO PUBLIC;

REVOKE ALL ON FUNCTION private.email_can_access_workspace(p_email text, p_workspace_id text) FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION private.email_can_access_workspace(p_email text, p_workspace_id text) TO authenticated;

REVOKE ALL ON FUNCTION private.seed_default_crm_pipeline_for_workspace(p_workspace_id uuid) FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION private.seed_default_crm_pipeline_for_workspace(p_workspace_id uuid) TO PUBLIC;

REVOKE ALL ON FUNCTION private.seed_pipeline_stages_for_workspace(p_workspace_id uuid) FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION private.seed_pipeline_stages_for_workspace(p_workspace_id uuid) TO PUBLIC;

REVOKE ALL ON FUNCTION private.set_current_timestamp_updated_at() FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION private.set_current_timestamp_updated_at() TO PUBLIC; GRANT EXECUTE ON FUNCTION private.set_current_timestamp_updated_at() TO service_role;

REVOKE ALL ON FUNCTION private.sync_crm_pipelines_from_workspace() FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION private.sync_crm_pipelines_from_workspace() TO PUBLIC;

REVOKE ALL ON FUNCTION private.sync_pipeline_stages_from_workspace() FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION private.sync_pipeline_stages_from_workspace() TO PUBLIC;

REVOKE ALL ON FUNCTION public.current_workspace_id() FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION public.current_workspace_id() TO PUBLIC; GRANT EXECUTE ON FUNCTION public.current_workspace_id() TO anon; GRANT EXECUTE ON FUNCTION public.current_workspace_id() TO authenticated; GRANT EXECUTE ON FUNCTION public.current_workspace_id() TO service_role;

REVOKE ALL ON FUNCTION public.deactivate_comment_mention_alerts(p_comment_id text, p_user_emails text[]) FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION public.deactivate_comment_mention_alerts(p_comment_id text, p_user_emails text[]) TO anon; GRANT EXECUTE ON FUNCTION public.deactivate_comment_mention_alerts(p_comment_id text, p_user_emails text[]) TO authenticated; GRANT EXECUTE ON FUNCTION public.deactivate_comment_mention_alerts(p_comment_id text, p_user_emails text[]) TO service_role;

REVOKE ALL ON FUNCTION public.enforce_crm_company_unique_cnpj() FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION public.enforce_crm_company_unique_cnpj() TO PUBLIC; GRANT EXECUTE ON FUNCTION public.enforce_crm_company_unique_cnpj() TO anon; GRANT EXECUTE ON FUNCTION public.enforce_crm_company_unique_cnpj() TO authenticated; GRANT EXECUTE ON FUNCTION public.enforce_crm_company_unique_cnpj() TO service_role;

REVOKE ALL ON FUNCTION public.enforce_crm_contact_unique_phone() FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION public.enforce_crm_contact_unique_phone() TO PUBLIC; GRANT EXECUTE ON FUNCTION public.enforce_crm_contact_unique_phone() TO anon; GRANT EXECUTE ON FUNCTION public.enforce_crm_contact_unique_phone() TO authenticated; GRANT EXECUTE ON FUNCTION public.enforce_crm_contact_unique_phone() TO service_role;

REVOKE ALL ON FUNCTION public.get_workspace_id() FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION public.get_workspace_id() TO authenticated; GRANT EXECUTE ON FUNCTION public.get_workspace_id() TO service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION public.handle_new_user() TO PUBLIC; GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon; GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated; GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

REVOKE ALL ON FUNCTION public.log_contact_company_link_change() FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION public.log_contact_company_link_change() TO PUBLIC; GRANT EXECUTE ON FUNCTION public.log_contact_company_link_change() TO anon; GRANT EXECUTE ON FUNCTION public.log_contact_company_link_change() TO authenticated; GRANT EXECUTE ON FUNCTION public.log_contact_company_link_change() TO service_role;

REVOKE ALL ON FUNCTION public.log_crm_record_change() FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION public.log_crm_record_change() TO PUBLIC; GRANT EXECUTE ON FUNCTION public.log_crm_record_change() TO anon; GRANT EXECUTE ON FUNCTION public.log_crm_record_change() TO authenticated; GRANT EXECUTE ON FUNCTION public.log_crm_record_change() TO service_role;

REVOKE ALL ON FUNCTION public.sync_contact_primary_company() FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION public.sync_contact_primary_company() TO PUBLIC; GRANT EXECUTE ON FUNCTION public.sync_contact_primary_company() TO anon; GRANT EXECUTE ON FUNCTION public.sync_contact_primary_company() TO authenticated; GRANT EXECUTE ON FUNCTION public.sync_contact_primary_company() TO service_role;

REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO PUBLIC; GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO anon; GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO authenticated; GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;

REVOKE ALL ON FUNCTION public.validate_crm_company_hierarchy() FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION public.validate_crm_company_hierarchy() TO PUBLIC; GRANT EXECUTE ON FUNCTION public.validate_crm_company_hierarchy() TO anon; GRANT EXECUTE ON FUNCTION public.validate_crm_company_hierarchy() TO authenticated; GRANT EXECUTE ON FUNCTION public.validate_crm_company_hierarchy() TO service_role;


-- -----------------------------------------------------------------------------
-- Comentários
-- -----------------------------------------------------------------------------

COMMENT ON TABLE public.crm_option_lists IS 'Opções de Segmento e Cargo, globais (não por workspace). Desativar não apaga valor já gravado.';


-- -----------------------------------------------------------------------------
-- Isolamento entre organizações
--
-- Na origem, três policies criadas pela UI do Supabase anulavam o recorte por organização (policies
-- permissivas se somam por OR):
--   - profiles "Enable read access for authenticated users" (USING true): qualquer usuário logado
--     lia o perfil de TODAS as organizações, com e-mail e CPF;
--   - profiles "Enable update for users based on id": cada usuário podia alterar a própria linha
--     inteira, inclusive role_id e organization_id — escalada de privilégio pela API. O app não
--     precisa dela: toda alteração de perfil passa pela função update-user, que restringe os campos;
--   - workspaces "Enable read access for all users on workspaces": qualquer usuário logado via os
--     workspaces de todas as organizações; e "workspaces manageable by organization" (FOR ALL)
--     deixava qualquer membro, até vendedor, editar e apagar o workspace.
--
-- O app lê os colegas da própria organização (responsáveis, menções, atribuição), então a leitura
-- passa a ser "mesma organização", não "todos". A escrita em workspaces fica com master e gestores
-- da organização; o código VYN-n continua funcionando porque private.assign_crm_deal_code é
-- SECURITY DEFINER.
-- -----------------------------------------------------------------------------
CREATE POLICY "profiles readable by same organization" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated
  USING ((id = auth.uid()) OR private.current_user_is_master() OR ((organization_id)::text = private.current_profile_org_id()));

CREATE POLICY "workspaces readable by organization" ON public.workspaces AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.current_user_is_master() OR ((organization_id)::text = private.current_profile_org_id()));

CREATE POLICY "workspaces manageable by org managers" ON public.workspaces AS PERMISSIVE FOR ALL TO authenticated
  USING (private.current_user_is_master() OR (private.current_user_can_manage_org() AND ((organization_id)::text = private.current_profile_org_id())))
  WITH CHECK (private.current_user_is_master() OR (private.current_user_can_manage_org() AND ((organization_id)::text = private.current_profile_org_id())));

-- Histórico de alterações e vínculos contato x empresa: na origem, as policies comparavam o
-- workspace só com current_workspace_id(), que vem do cabeçalho x-workspace-id — escrito pelo
-- navegador. Medido em 14/10/2026: um usuário de outra organização, forjando o cabeçalho, lia o
-- histórico (com o antes/depois de nome, telefone, e-mail e documento) e os vínculos alheios.
-- O cabeçalho segue recortando o workspace aberto; quem autoriza é ser membro dele.
CREATE POLICY "crm record history select workspace member" ON public.crm_record_history AS PERMISSIVE FOR SELECT TO authenticated
  USING (((workspace_id)::text = current_workspace_id()) AND ( SELECT private.current_user_can_access_workspace((crm_record_history.workspace_id)::text)));

CREATE POLICY "crm contact companies select workspace member" ON public.crm_contact_companies AS PERMISSIVE FOR SELECT TO authenticated
  USING (((workspace_id)::text = current_workspace_id()) AND ( SELECT private.current_user_can_access_workspace((crm_contact_companies.workspace_id)::text)));

CREATE POLICY "crm contact companies insert workspace member" ON public.crm_contact_companies AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((workspace_id)::text = current_workspace_id()) AND ( SELECT private.current_user_can_access_workspace((crm_contact_companies.workspace_id)::text)));

CREATE POLICY "crm contact companies delete workspace member" ON public.crm_contact_companies AS PERMISSIVE FOR DELETE TO authenticated
  USING (((workspace_id)::text = current_workspace_id()) AND ( SELECT private.current_user_can_access_workspace((crm_contact_companies.workspace_id)::text)));

-- -----------------------------------------------------------------------------
-- Listas de Segmento e Cargo
--
-- As mesmas da origem, sem os cinco valores que lá entraram por campo de texto livre e duplicavam
-- outros da lista (RULES.md §14). Editáveis em Configurações > Segmento e Cargo.
-- -----------------------------------------------------------------------------
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
  ('contact_role', 'Implantação', 13),
  ('contact_role', 'Projetos', 14),
  ('contact_role', 'TI', 15),
  ('contact_role', 'Outro', 16)
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- Storage: anexos da negociação
--
-- Bucket privado e SEM policy de propósito: só o service role o alcança. Quem grava é a função
-- upload-anexo e quem assina o link de leitura é a storage-signed-url — as duas conferem se o
-- usuário alcança o workspace do caminho pedido.
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('anexos', 'anexos', false, 10485760)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Perfis de acesso iniciais
--
-- `master` administra todas as organizações (is_master). Os outros três seguem os modelos da
-- tela Usuários e Acessos e podem ser editados por lá.
-- -----------------------------------------------------------------------------
INSERT INTO public.roles (id, name, is_master, permissions) VALUES
  ('master', 'Master', true, '{
    "menus": ["pipeline", "settings", "users"],
    "dealsVisibility": "all", "tasksVisibility": "all", "contactsVisibility": "all", "companiesVisibility": "all",
    "canDeleteRecords": true, "canManageSettings": true, "canManageUsers": true, "dealsEdit": true, "dealsDelete": true
  }'::jsonb),
  ('admin', 'Administrador da Organização', false, '{
    "menus": ["pipeline", "settings", "users"],
    "dealsVisibility": "all", "tasksVisibility": "all", "contactsVisibility": "all", "companiesVisibility": "all",
    "canDeleteRecords": true, "canManageSettings": true, "canManageUsers": true, "dealsEdit": true, "dealsDelete": true
  }'::jsonb),
  ('gestor', 'Gestor Comercial', false, '{
    "menus": ["pipeline"],
    "dealsVisibility": "all", "tasksVisibility": "all", "contactsVisibility": "all", "companiesVisibility": "all",
    "canDeleteRecords": false, "canManageSettings": false, "canManageUsers": false, "dealsEdit": true, "dealsDelete": false
  }'::jsonb),
  ('vendedor', 'Vendedor', false, '{
    "menus": ["pipeline"],
    "dealsVisibility": "own", "tasksVisibility": "own", "contactsVisibility": "own", "companiesVisibility": "own",
    "canDeleteRecords": false, "canManageSettings": false, "canManageUsers": false, "dealsEdit": true, "dealsDelete": false
  }'::jsonb)
ON CONFLICT (id) DO NOTHING;
