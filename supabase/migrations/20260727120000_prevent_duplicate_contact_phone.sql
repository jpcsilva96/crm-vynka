CREATE OR REPLACE FUNCTION public.enforce_crm_contact_unique_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  normalized_phone TEXT;
BEGIN
  normalized_phone := regexp_replace(COALESCE(NEW.phone, ''), '[^0-9]', '', 'g');

  -- Empty phone values remain allowed. Only a supplied phone must be unique.
  IF normalized_phone = '' OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Serialize checks for the same workspace/phone pair to prevent concurrent inserts.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.workspace_id::text || ':' || normalized_phone, 0));

  IF EXISTS (
    SELECT 1
    FROM public.crm_contacts contact
    WHERE contact.workspace_id = NEW.workspace_id
      AND contact.deleted_at IS NULL
      AND regexp_replace(COALESCE(contact.phone, ''), '[^0-9]', '', 'g') = normalized_phone
      AND contact.id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'Já existe um contato ativo com este telefone neste workspace.'
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_crm_contact_unique_phone ON public.crm_contacts;

CREATE TRIGGER trg_enforce_crm_contact_unique_phone
BEFORE INSERT OR UPDATE OF phone, workspace_id, deleted_at ON public.crm_contacts
FOR EACH ROW
EXECUTE FUNCTION public.enforce_crm_contact_unique_phone();
