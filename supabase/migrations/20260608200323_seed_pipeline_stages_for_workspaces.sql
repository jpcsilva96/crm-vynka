CREATE OR REPLACE FUNCTION private.seed_pipeline_stages_for_workspace(p_workspace_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
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
$$;

CREATE OR REPLACE FUNCTION private.sync_pipeline_stages_from_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM public.crm_pipeline_stages
        WHERE workspace_id = OLD.id::uuid;
        RETURN OLD;
    END IF;

    PERFORM private.seed_pipeline_stages_for_workspace(NEW.id::uuid);
    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF to_regclass('public.workspaces') IS NOT NULL THEN
        INSERT INTO public.crm_pipeline_stages (
            workspace_id,
            stage_id,
            label,
            probability,
            position,
            is_active
        )
        SELECT
            w.id::uuid,
            seeded.stage_id,
            seeded.label,
            seeded.probability,
            seeded.position,
            true
        FROM public.workspaces w
        CROSS JOIN (
            VALUES
                ('leads'::text, 'Novos Leads'::text, 10::numeric, 1::integer),
                ('qualification'::text, 'Qualificação'::text, 25::numeric, 2::integer),
                ('proposal'::text, 'Proposta'::text, 50::numeric, 3::integer),
                ('negotiation'::text, 'Negociação'::text, 75::numeric, 4::integer),
                ('closing'::text, 'Fechamento'::text, 95::numeric, 5::integer)
        ) AS seeded(stage_id, label, probability, position)
        ON CONFLICT (workspace_id, stage_id) DO NOTHING;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_trigger
            WHERE tgname = 'sync_pipeline_stages_from_workspace_trigger'
        ) THEN
            CREATE TRIGGER sync_pipeline_stages_from_workspace_trigger
            AFTER INSERT OR UPDATE OR DELETE ON public.workspaces
            FOR EACH ROW
            EXECUTE FUNCTION private.sync_pipeline_stages_from_workspace();
        END IF;
    END IF;
END $$;
