-- Anexo na proposta.
--
-- Mesma forma do anexo de negociação (`crm_deal_notes.attachments`): lista JSON de
-- { name, path, size, type }. **Sem URL gravada** — este é o ponto que difere do que existia.
--
-- Por quê: o bucket `chat-media` é privado e não tem policy nenhuma (medido em 10/09), então só o
-- service role o alcança. O código antigo resolvia isso gravando a URL assinada que o upload
-- devolvia — só que ela vale 1 hora. Resultado medido: os 49 anexos de negociação em produção
-- estão com link morto, e o `path` gravado era sintético (`dealId:nome:timestamp`), o que impedia
-- até regenerar. Aqui guarda-se o caminho REAL do arquivo, e o link é assinado na hora de abrir,
-- pela Edge Function `storage-signed-url`.
--
-- A proposta cancelada mantém os anexos (decisão do operador: histórico), e a negociação gerada a
-- partir de uma proposta leva os anexos junto.

ALTER TABLE public.crm_deal_quotes
    ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.crm_deal_quotes.attachments IS
    'Anexos da proposta: [{name, path, size, type}]. `path` é o caminho no bucket chat-media; a URL é assinada sob demanda, nunca gravada.';
