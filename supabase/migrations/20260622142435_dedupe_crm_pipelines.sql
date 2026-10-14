WITH ranked_pipelines AS (
    SELECT
        p.id,
        p.workspace_id,
        p.name,
        p.created_at,
        COUNT(d.id) AS deal_count,
        ROW_NUMBER() OVER (
            PARTITION BY p.workspace_id, p.name
            ORDER BY
                CASE WHEN COUNT(d.id) > 0 THEN 0 ELSE 1 END,
                p.created_at ASC,
                p.id ASC
        ) AS keep_rank
    FROM public.crm_pipelines p
    LEFT JOIN public.crm_deals d
        ON d.pipeline_id = p.id
    GROUP BY p.id, p.workspace_id, p.name, p.created_at
),
pipeline_mapping AS (
    SELECT
        duplicates.id AS duplicate_id,
        keeper.id AS keeper_id
    FROM ranked_pipelines duplicates
    JOIN ranked_pipelines keeper
        ON keeper.workspace_id = duplicates.workspace_id
       AND keeper.name = duplicates.name
       AND keeper.keep_rank = 1
    WHERE duplicates.keep_rank > 1
)
UPDATE public.crm_deals deals
SET pipeline_id = mapping.keeper_id
FROM pipeline_mapping mapping
WHERE deals.pipeline_id = mapping.duplicate_id;

DELETE FROM public.crm_pipelines pipelines
USING (
    SELECT duplicate_id
    FROM (
        SELECT
            p.id AS duplicate_id,
            ROW_NUMBER() OVER (
                PARTITION BY p.workspace_id, p.name
                ORDER BY
                    CASE WHEN EXISTS (
                        SELECT 1
                        FROM public.crm_deals d
                        WHERE d.pipeline_id = p.id
                    ) THEN 0 ELSE 1 END,
                    p.created_at ASC,
                    p.id ASC
            ) AS keep_rank
        FROM public.crm_pipelines p
    ) ranked
    WHERE keep_rank > 1
) duplicates
WHERE pipelines.id = duplicates.duplicate_id;
