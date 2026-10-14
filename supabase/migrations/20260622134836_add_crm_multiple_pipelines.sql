CREATE TABLE IF NOT EXISTS public.crm_pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.crm_pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all operations for pipelines in workspace" ON public.crm_pipelines
    FOR ALL TO authenticated
    USING (workspace_id::text = current_setting('app.workspace_id', true))
    WITH CHECK (workspace_id::text = current_setting('app.workspace_id', true));

ALTER TABLE public.crm_pipeline_stages
    ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS pipeline_id UUID,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'crm_pipeline_stages'
          AND constraint_name = 'crm_pipeline_stages_pkey'
    ) THEN
        ALTER TABLE public.crm_pipeline_stages DROP CONSTRAINT crm_pipeline_stages_pkey;
    END IF;
END $$;

UPDATE public.crm_pipeline_stages
SET id = gen_random_uuid()
WHERE id IS NULL;

ALTER TABLE public.crm_pipeline_stages
    ALTER COLUMN id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'crm_pipeline_stages'
          AND constraint_name = 'crm_pipeline_stages_id_key'
    ) THEN
        ALTER TABLE public.crm_pipeline_stages ADD CONSTRAINT crm_pipeline_stages_id_key UNIQUE (id);
    END IF;
END $$;

INSERT INTO public.crm_pipelines (workspace_id, name, description, is_active)
SELECT seeded.workspace_id, seeded.name, seeded.description, true
FROM (
    SELECT DISTINCT
        workspace_id,
        'Pipeline Comercial'::text AS name,
        'Pipeline padrao migrado automaticamente das negociacoes existentes.'::text AS description
    FROM public.crm_pipeline_stages
    UNION
    SELECT DISTINCT
        workspace_id,
        'Pipeline IA'::text AS name,
        'Pipeline dedicado ao processo de vendas assistido por IA.'::text AS description
    FROM public.crm_pipeline_stages
    UNION
    SELECT DISTINCT
        workspace_id,
        'Pipeline Comercial'::text AS name,
        'Pipeline padrao para novas negociacoes do workspace.'::text AS description
    FROM public.crm_deals
    WHERE workspace_id IS NOT NULL
    UNION
    SELECT DISTINCT
        workspace_id,
        'Pipeline IA'::text AS name,
        'Pipeline dedicado ao processo de vendas assistido por IA.'::text AS description
    FROM public.crm_deals
    WHERE workspace_id IS NOT NULL
) AS seeded
WHERE NOT EXISTS (
    SELECT 1
    FROM public.crm_pipelines p
    WHERE p.workspace_id = seeded.workspace_id
      AND p.name = seeded.name
);

UPDATE public.crm_pipeline_stages stages
SET pipeline_id = pipelines.id
FROM public.crm_pipelines pipelines
WHERE pipelines.workspace_id = stages.workspace_id
  AND pipelines.name = 'Pipeline Comercial'
  AND stages.pipeline_id IS NULL;

ALTER TABLE public.crm_pipeline_stages
    ALTER COLUMN pipeline_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'crm_pipeline_stages'
          AND constraint_name = 'crm_pipeline_stages_pkey'
    ) THEN
        ALTER TABLE public.crm_pipeline_stages ADD CONSTRAINT crm_pipeline_stages_pkey PRIMARY KEY (id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'crm_pipeline_stages'
          AND constraint_name = 'crm_pipeline_stages_pipeline_stage_key'
    ) THEN
        ALTER TABLE public.crm_pipeline_stages
            ADD CONSTRAINT crm_pipeline_stages_pipeline_stage_key UNIQUE (pipeline_id, stage_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'crm_pipeline_stages'
          AND constraint_name = 'crm_pipeline_stages_pipeline_id_fkey'
    ) THEN
        ALTER TABLE public.crm_pipeline_stages
            ADD CONSTRAINT crm_pipeline_stages_pipeline_id_fkey
            FOREIGN KEY (pipeline_id) REFERENCES public.crm_pipelines(id) ON DELETE CASCADE;
    END IF;
END $$;

ALTER TABLE public.crm_deals
    ADD COLUMN IF NOT EXISTS pipeline_id UUID;

UPDATE public.crm_deals deals
SET pipeline_id = pipelines.id
FROM public.crm_pipelines pipelines
WHERE pipelines.workspace_id = deals.workspace_id
  AND pipelines.name = 'Pipeline Comercial'
  AND deals.pipeline_id IS NULL;

ALTER TABLE public.crm_deals
    ALTER COLUMN pipeline_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'crm_deals'
          AND constraint_name = 'crm_deals_pipeline_id_fkey'
    ) THEN
        ALTER TABLE public.crm_deals
            ADD CONSTRAINT crm_deals_pipeline_id_fkey
            FOREIGN KEY (pipeline_id) REFERENCES public.crm_pipelines(id) ON DELETE RESTRICT;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION private.seed_default_crm_pipeline_for_workspace(p_workspace_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
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
$$;

CREATE OR REPLACE FUNCTION private.sync_crm_pipelines_from_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
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
$$;

DO $$
BEGIN
    IF to_regclass('public.workspaces') IS NOT NULL THEN
        PERFORM private.seed_default_crm_pipeline_for_workspace(w.id::uuid)
        FROM public.workspaces w;

        IF EXISTS (
            SELECT 1
            FROM pg_trigger
            WHERE tgname = 'sync_pipeline_stages_from_workspace_trigger'
        ) THEN
            DROP TRIGGER sync_pipeline_stages_from_workspace_trigger ON public.workspaces;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_trigger
            WHERE tgname = 'sync_crm_pipelines_from_workspace_trigger'
        ) THEN
            CREATE TRIGGER sync_crm_pipelines_from_workspace_trigger
            AFTER INSERT OR UPDATE OR DELETE ON public.workspaces
            FOR EACH ROW
            EXECUTE FUNCTION private.sync_crm_pipelines_from_workspace();
        END IF;
    END IF;
END $$;
