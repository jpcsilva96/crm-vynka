CREATE OR REPLACE FUNCTION public.get_workspace_id()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT public.current_workspace_id();
$$;

REVOKE ALL ON FUNCTION public.get_workspace_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_workspace_id() TO authenticated;
