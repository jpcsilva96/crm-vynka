-- Índice único de SKU por workspace no catálogo de produtos.
--
-- RECONSTITUÍDA em 19/08/2026. Esta migration existia no histórico da produção
-- (`supabase_migrations.schema_migrations`) desde 13/08, mas **com zero statements** — assinatura
-- de `supabase migration repair --status applied`, que marca uma versão como aplicada sem executar
-- corpo nenhum. O arquivo nunca esteve no repositório.
--
-- O DDL abaixo é transcrição do índice real (`pg_indexes.indexdef`), não redação. Ele é registrado
-- aqui, na data original, em vez de apagar a versão do rastreio da produção: quem for reconstruir o
-- banco recebe o índice no ponto certo da linha do tempo, e o histórico continua contando o que
-- aconteceu de fato.
--
-- Contexto de por que este índice importa: ele é o que expôs, em 18/08, que o sync de produtos não
-- deduplicava a fila de eventos do ERP. Antes dele, duplicatas entravam em silêncio (as 4 linhas
-- inativas com barCode gravado no campo sku são desse período); depois dele, a mesma duplicata passou
-- a derrubar a execução inteira com 23505.
--
-- ATENÇÃO para quem espelhar esta chave em código: a normalização usa `trim()` do SQL, que remove
-- **apenas** espaço (U+0020) — diferente do `.trim()` do JavaScript, que remove todo whitespace
-- Unicode. Ver RULES.md §7 e o comentário em `_shared/product-sync-logic.ts`.

CREATE UNIQUE INDEX IF NOT EXISTS crm_workspace_products_workspace_sku_unique
  ON public.crm_workspace_products USING btree (workspace_id, lower(TRIM(BOTH FROM sku)))
  WHERE ((sku IS NOT NULL) AND (length(TRIM(BOTH FROM sku)) > 0));
