-- An organization always has at least one workspace. Without this cascade,
-- PostgreSQL rejects organization deletion because of the child workspace.
ALTER TABLE public.workspaces
  DROP CONSTRAINT IF EXISTS workspaces_organization_id_fkey;

ALTER TABLE public.workspaces
  ADD CONSTRAINT workspaces_organization_id_fkey
  FOREIGN KEY (organization_id)
  REFERENCES public.organizations(id)
  ON DELETE CASCADE;

-- Keep user accounts intact if their organization is removed. The master user
-- can subsequently assign them to another organization when appropriate.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_organization_id_fkey;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_organization_id_fkey
  FOREIGN KEY (organization_id)
  REFERENCES public.organizations(id)
  ON DELETE SET NULL;
