CREATE TABLE IF NOT EXISTS public.crm_deal_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL REFERENCES public.crm_deals(id) ON DELETE CASCADE,
    author_user_id UUID,
    author_name TEXT NOT NULL,
    message TEXT NOT NULL,
    mentions JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.crm_deal_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all operations for deal comments based on deal workspace" ON public.crm_deal_comments
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.crm_deals d
            WHERE d.id = deal_id
              AND d.workspace_id::text = current_setting('app.workspace_id', true)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.crm_deals d
            WHERE d.id = deal_id
              AND d.workspace_id::text = current_setting('app.workspace_id', true)
        )
    );

CREATE INDEX IF NOT EXISTS crm_deal_comments_deal_created_idx
    ON public.crm_deal_comments (deal_id, created_at DESC);

INSERT INTO public.crm_deal_comments (
    deal_id,
    author_name,
    message,
    mentions,
    metadata,
    created_at,
    updated_at
)
SELECT
    d.id,
    'Comentário legado',
    legacy.note,
    '[]'::jsonb,
    jsonb_build_object(
        'legacy', true,
        'migration_source', 'crm_deals.notes'
    ),
    COALESCE(d.updated_at, d.created_at, NOW()),
    COALESCE(d.updated_at, d.created_at, NOW())
FROM public.crm_deals d
CROSS JOIN LATERAL unnest(COALESCE(d.notes, ARRAY[]::text[])) AS legacy(note)
WHERE legacy.note IS NOT NULL
  AND btrim(legacy.note) <> ''
  AND NOT EXISTS (
      SELECT 1
      FROM public.crm_deal_comments existing
      WHERE existing.deal_id = d.id
        AND existing.message = legacy.note
        AND existing.metadata ->> 'migration_source' = 'crm_deals.notes'
  );
