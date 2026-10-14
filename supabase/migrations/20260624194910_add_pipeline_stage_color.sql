ALTER TABLE public.crm_pipeline_stages
    ADD COLUMN IF NOT EXISTS color TEXT;

UPDATE public.crm_pipeline_stages
SET color = CASE
    WHEN stage_id IN ('lead_ia', 'leads') THEN '#3B82F6'
    WHEN stage_id IN ('contact_started') THEN '#EC4899'
    WHEN stage_id IN ('qualification') THEN '#06B6D4'
    WHEN stage_id IN ('proposal') THEN '#8B5CF6'
    WHEN stage_id IN ('negotiation') THEN '#F97316'
    WHEN stage_id IN ('closing', 'won') THEN '#10B981'
    WHEN stage_id IN ('lost') THEN '#EF4444'
    WHEN lower(label) LIKE '%lead%' THEN '#3B82F6'
    WHEN lower(label) LIKE '%contato%' THEN '#EC4899'
    WHEN lower(label) LIKE '%qual%' THEN '#06B6D4'
    WHEN lower(label) LIKE '%proposta%' THEN '#8B5CF6'
    WHEN lower(label) LIKE '%negocia%' THEN '#F97316'
    WHEN lower(label) LIKE '%fech%' THEN '#10B981'
    WHEN lower(label) LIKE '%ganh%' THEN '#10B981'
    WHEN lower(label) LIKE '%perd%' THEN '#EF4444'
    ELSE '#94A3B8'
END
WHERE color IS NULL OR btrim(color) = '';
