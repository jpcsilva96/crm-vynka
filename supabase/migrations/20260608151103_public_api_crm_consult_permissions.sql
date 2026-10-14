UPDATE private.api_keys
SET permissions = jsonb_strip_nulls(
    permissions ||
    jsonb_build_object(
        'contato', COALESCE(permissions->'contato', '["consultar"]'::jsonb),
        'empresa', COALESCE(permissions->'empresa', '["consultar"]'::jsonb),
        'negociacao', COALESCE(permissions->'negociacao', '["consultar"]'::jsonb)
    )
)
WHERE permissions IS NOT NULL;
