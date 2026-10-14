ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS deal_code_prefix TEXT NOT NULL DEFAULT 'SUP',
  ADD COLUMN IF NOT EXISTS deal_code_next_number BIGINT NOT NULL DEFAULT 1;

ALTER TABLE public.crm_deals
  ADD COLUMN IF NOT EXISTS deal_code TEXT,
  ADD COLUMN IF NOT EXISTS deal_code_number BIGINT;

ALTER TABLE public.workspaces
  DROP CONSTRAINT IF EXISTS workspaces_deal_code_prefix_check,
  DROP CONSTRAINT IF EXISTS workspaces_deal_code_next_number_check,
  ADD CONSTRAINT workspaces_deal_code_prefix_check
    CHECK (deal_code_prefix ~ '^[A-Z0-9]{2,8}$'),
  ADD CONSTRAINT workspaces_deal_code_next_number_check
    CHECK (deal_code_next_number >= 1);

UPDATE public.workspaces
SET deal_code_prefix = COALESCE(
  NULLIF(
    upper(
      left(
        regexp_replace(
          translate(
            coalesce(name, ''),
            'áàâãäåÁÀÂÃÄÅéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑ',
            'aaaaaaAAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcCnN'
          ),
          '[^A-Za-z0-9]',
          '',
          'g'
        ),
        3
      )
    ),
    ''
  ),
  'SUP'
)
WHERE deal_code_prefix IS NULL
   OR deal_code_prefix = ''
   OR deal_code_prefix = 'SUP';

WITH numbered AS (
  SELECT
    id,
    workspace_id,
    row_number() OVER (PARTITION BY workspace_id ORDER BY created_at, id) AS next_number
  FROM public.crm_deals
  WHERE deal_code IS NULL
     OR deal_code_number IS NULL
),
workspace_prefixes AS (
  SELECT id, deal_code_prefix
  FROM public.workspaces
)
UPDATE public.crm_deals d
SET
  deal_code_number = numbered.next_number,
  deal_code = workspace_prefixes.deal_code_prefix || '-' || numbered.next_number::text
FROM numbered
JOIN workspace_prefixes ON workspace_prefixes.id::text = numbered.workspace_id::text
WHERE d.id = numbered.id;

WITH max_numbers AS (
  SELECT workspace_id, COALESCE(MAX(deal_code_number), 0) + 1 AS next_number
  FROM public.crm_deals
  GROUP BY workspace_id
)
UPDATE public.workspaces w
SET deal_code_next_number = GREATEST(w.deal_code_next_number, max_numbers.next_number)
FROM max_numbers
WHERE w.id::text = max_numbers.workspace_id::text;

CREATE UNIQUE INDEX IF NOT EXISTS crm_deals_workspace_deal_code_key
  ON public.crm_deals (workspace_id, deal_code)
  WHERE deal_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS crm_deals_workspace_deal_code_number_key
  ON public.crm_deals (workspace_id, deal_code_number)
  WHERE deal_code_number IS NOT NULL;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;
REVOKE ALL ON SCHEMA private FROM authenticated;

DROP TRIGGER IF EXISTS assign_crm_deal_code_before_insert ON public.crm_deals;
DROP FUNCTION IF EXISTS public.assign_crm_deal_code();

CREATE OR REPLACE FUNCTION private.assign_crm_deal_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  code_prefix TEXT;
  next_number BIGINT;
BEGIN
  IF NEW.workspace_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.deal_code IS NOT NULL AND NEW.deal_code_number IS NOT NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.workspaces
  SET deal_code_next_number = deal_code_next_number + 1
  WHERE id::text = NEW.workspace_id::text
  RETURNING deal_code_prefix, deal_code_next_number - 1
  INTO code_prefix, next_number;

  IF next_number IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.deal_code_number := COALESCE(NEW.deal_code_number, next_number);
  NEW.deal_code := COALESCE(NEW.deal_code, code_prefix || '-' || NEW.deal_code_number::text);

  RETURN NEW;
END;
$$;

CREATE TRIGGER assign_crm_deal_code_before_insert
  BEFORE INSERT ON public.crm_deals
  FOR EACH ROW
  EXECUTE FUNCTION private.assign_crm_deal_code();
