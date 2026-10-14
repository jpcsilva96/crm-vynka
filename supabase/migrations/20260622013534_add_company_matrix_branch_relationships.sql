ALTER TABLE public.crm_companies
ADD COLUMN IF NOT EXISTS company_type TEXT NOT NULL DEFAULT 'MATRIZ',
ADD COLUMN IF NOT EXISTS parent_company_id UUID REFERENCES public.crm_companies(id) ON DELETE RESTRICT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'crm_companies_company_type_check'
  ) THEN
    ALTER TABLE public.crm_companies
      ADD CONSTRAINT crm_companies_company_type_check
      CHECK (company_type IN ('MATRIZ', 'FILIAL'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_crm_companies_parent_company_id
  ON public.crm_companies(parent_company_id);

CREATE INDEX IF NOT EXISTS idx_crm_companies_company_type
  ON public.crm_companies(company_type);

UPDATE public.crm_companies
SET company_type = COALESCE(company_type, 'MATRIZ');

CREATE OR REPLACE FUNCTION public.validate_crm_company_hierarchy()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parent_record public.crm_companies%ROWTYPE;
  has_children BOOLEAN;
BEGIN
  NEW.company_type := COALESCE(NULLIF(NEW.company_type, ''), 'MATRIZ');

  IF NEW.company_type = 'MATRIZ' THEN
    NEW.parent_company_id := NULL;
  ELSIF NEW.company_type = 'FILIAL' THEN
    IF NEW.parent_company_id IS NULL THEN
      RAISE EXCEPTION 'Para cadastrar uma filial, selecione a empresa matriz.';
    END IF;

    IF NEW.parent_company_id = NEW.id THEN
      RAISE EXCEPTION 'Empresa não pode ser matriz dela mesma.';
    END IF;

    SELECT *
    INTO parent_record
    FROM public.crm_companies
    WHERE id = NEW.parent_company_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'A empresa matriz selecionada não foi encontrada.';
    END IF;

    IF parent_record.company_type <> 'MATRIZ' THEN
      RAISE EXCEPTION 'Uma filial só pode ser vinculada a uma empresa do tipo MATRIZ.';
    END IF;

    IF parent_record.workspace_id <> NEW.workspace_id THEN
      RAISE EXCEPTION 'A empresa matriz deve pertencer ao mesmo workspace.';
    END IF;

    IF parent_record.parent_company_id = NEW.id THEN
      RAISE EXCEPTION 'Não é permitido criar vínculo circular entre matriz e filial.';
    END IF;
  ELSE
    RAISE EXCEPTION 'Tipo da empresa inválido.';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.company_type = 'MATRIZ' AND NEW.company_type = 'FILIAL' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.crm_companies
      WHERE parent_company_id = OLD.id
        AND id <> OLD.id
    )
    INTO has_children;

    IF has_children THEN
      RAISE EXCEPTION 'Esta empresa possui filiais vinculadas. Remova ou transfira as filiais antes de alterar o tipo da empresa.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_crm_company_hierarchy ON public.crm_companies;

CREATE TRIGGER trg_validate_crm_company_hierarchy
BEFORE INSERT OR UPDATE ON public.crm_companies
FOR EACH ROW
EXECUTE FUNCTION public.validate_crm_company_hierarchy();
