CREATE OR REPLACE FUNCTION public.enforce_crm_company_unique_cnpj()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  normalized_cnpj TEXT;
BEGIN
  normalized_cnpj := regexp_replace(COALESCE(NEW.cnpj, ''), '[^0-9]', '', 'g');

  -- Empty CNPJ values remain allowed. Only a supplied CNPJ must be unique.
  IF normalized_cnpj = '' OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Serialize checks for the same workspace/CNPJ pair to prevent concurrent inserts.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.workspace_id::text || ':' || normalized_cnpj, 0));

  IF EXISTS (
    SELECT 1
    FROM public.crm_companies company
    WHERE company.workspace_id = NEW.workspace_id
      AND company.deleted_at IS NULL
      AND regexp_replace(COALESCE(company.cnpj, ''), '[^0-9]', '', 'g') = normalized_cnpj
      AND company.id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'Já existe uma empresa ativa com este CNPJ neste workspace.'
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_crm_company_unique_cnpj ON public.crm_companies;

CREATE TRIGGER trg_enforce_crm_company_unique_cnpj
BEFORE INSERT OR UPDATE OF cnpj, workspace_id, deleted_at ON public.crm_companies
FOR EACH ROW
EXECUTE FUNCTION public.enforce_crm_company_unique_cnpj();
