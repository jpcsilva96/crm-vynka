-- Idempotencia da API publica por RPC (23/09/2026).
--
-- O defeito: a migration 20260715122859 criou a tabela em `private` e deu GRANT ao
-- `service_role`, e a `public-api` a acessava com `.schema("private")`. GRANT resolve
-- PERMISSAO no Postgres, nao ROTEAMENTO: o PostgREST so atende schemas da lista de expostos,
-- e `private` nao esta nela. Toda chamada com chave de idempotencia respondia 500
-- "Invalid schema: private" desde 15/07 — nas tres rotas de escrita.
--
-- A correcao NAO expoe `private` (isso entregaria a tabela ao PostgREST e esvaziaria o nome).
-- Quatro funcoes SECURITY DEFINER em `public`, de escopo estreito, sao a unica porta — o mesmo
-- padrao das `api_internal_*` que leem `private.api_keys` desde 08/06.
--
-- Aditiva: nao altera a tabela nem apaga linha existente. Rollback = DROP das quatro funcoes.

-- Reserva a chave, ou devolve quem ja a detem. Atomica: o INSERT ... ON CONFLICT serializa
-- duas requisicoes concorrentes com a mesma chave no indice unico.
--
-- Antes de reservar, apaga a linha VENCIDA da mesma chave. Sem isso, o indice unico (que nao
-- olha `expires_at`) colidia para sempre com uma linha que a leitura ja ignorava: a chave
-- ficava travada em 409 depois dos 7 dias, sem rotina de limpeza nenhuma.
CREATE OR REPLACE FUNCTION public.public_api_idempotency_reserve(
    p_organization_id UUID,
    p_route TEXT,
    p_key_hash TEXT,
    p_request_hash TEXT,
    p_processing_status INTEGER,
    p_processing_body JSONB
)
RETURNS TABLE (
    reserved BOOLEAN,
    request_hash TEXT,
    response_status INTEGER,
    response_body JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_row private.public_api_idempotency_keys;
BEGIN
    DELETE FROM private.public_api_idempotency_keys k
     WHERE k.organization_id = p_organization_id
       AND k.route = p_route
       AND k.idempotency_key_hash = p_key_hash
       AND k.expires_at <= now();

    INSERT INTO private.public_api_idempotency_keys AS k (
        organization_id, route, idempotency_key_hash, request_hash, response_status, response_body
    )
    VALUES (
        p_organization_id, p_route, p_key_hash, p_request_hash, p_processing_status, p_processing_body
    )
    ON CONFLICT ON CONSTRAINT public_api_idempotency_keys_unique DO NOTHING
    RETURNING * INTO v_row;

    IF FOUND THEN
        RETURN QUERY SELECT TRUE, v_row.request_hash, v_row.response_status, v_row.response_body;
        RETURN;
    END IF;

    RETURN QUERY
    SELECT FALSE, k.request_hash, k.response_status, k.response_body
      FROM private.public_api_idempotency_keys k
     WHERE k.organization_id = p_organization_id
       AND k.route = p_route
       AND k.idempotency_key_hash = p_key_hash;
END;
$$;

-- Le a chave enquanto a requisicao original ainda processa. So linhas nao vencidas.
CREATE OR REPLACE FUNCTION public.public_api_idempotency_lookup(
    p_organization_id UUID,
    p_route TEXT,
    p_key_hash TEXT
)
RETURNS TABLE (
    request_hash TEXT,
    response_status INTEGER,
    response_body JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT k.request_hash, k.response_status, k.response_body
      FROM private.public_api_idempotency_keys k
     WHERE k.organization_id = p_organization_id
       AND k.route = p_route
       AND k.idempotency_key_hash = p_key_hash
       AND k.expires_at > now();
$$;

-- Grava a resposta final (sucesso ou HttpError) para a repeticao devolver. Retorna quantas
-- linhas mudou: 0 significa que a reserva sumiu, e o chamador tem de saber.
CREATE OR REPLACE FUNCTION public.public_api_idempotency_store(
    p_organization_id UUID,
    p_route TEXT,
    p_key_hash TEXT,
    p_response_status INTEGER,
    p_response_body JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE private.public_api_idempotency_keys k
       SET response_status = p_response_status,
           response_body = p_response_body
     WHERE k.organization_id = p_organization_id
       AND k.route = p_route
       AND k.idempotency_key_hash = p_key_hash;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- Libera uma reserva que nunca recebeu resposta: o handler lancou erro que nao e HttpError.
-- Sem isso a linha ficava em "processing" por 7 dias e toda repeticao da chave recebia 409.
-- So apaga se ainda estiver em processing — nunca uma resposta ja gravada.
CREATE OR REPLACE FUNCTION public.public_api_idempotency_release(
    p_organization_id UUID,
    p_route TEXT,
    p_key_hash TEXT,
    p_processing_status INTEGER,
    p_processing_body JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM private.public_api_idempotency_keys k
     WHERE k.organization_id = p_organization_id
       AND k.route = p_route
       AND k.idempotency_key_hash = p_key_hash
       AND k.response_status = p_processing_status
       AND k.response_body = p_processing_body;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- So o service_role executa. Funcao nova em `public` nasce executavel por anon e authenticated
-- pelos default privileges do Supabase: REVOKE FROM PUBLIC sozinho nao basta.
REVOKE ALL ON FUNCTION public.public_api_idempotency_reserve(UUID, TEXT, TEXT, TEXT, INTEGER, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.public_api_idempotency_lookup(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.public_api_idempotency_store(UUID, TEXT, TEXT, INTEGER, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.public_api_idempotency_release(UUID, TEXT, TEXT, INTEGER, JSONB) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.public_api_idempotency_reserve(UUID, TEXT, TEXT, TEXT, INTEGER, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.public_api_idempotency_lookup(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.public_api_idempotency_store(UUID, TEXT, TEXT, INTEGER, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.public_api_idempotency_release(UUID, TEXT, TEXT, INTEGER, JSONB) TO service_role;
