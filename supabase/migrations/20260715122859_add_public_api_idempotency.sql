CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.public_api_idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    route TEXT NOT NULL,
    idempotency_key_hash TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    response_status INTEGER NOT NULL,
    response_body JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    CONSTRAINT public_api_idempotency_keys_unique UNIQUE (organization_id, route, idempotency_key_hash)
);

CREATE INDEX IF NOT EXISTS public_api_idempotency_keys_expires_idx
    ON private.public_api_idempotency_keys (expires_at);

ALTER TABLE private.public_api_idempotency_keys ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON private.public_api_idempotency_keys FROM PUBLIC;
REVOKE ALL ON private.public_api_idempotency_keys FROM anon;
REVOKE ALL ON private.public_api_idempotency_keys FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON private.public_api_idempotency_keys TO service_role;
