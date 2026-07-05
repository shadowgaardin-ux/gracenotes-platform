ALTER TABLE public.user_roles ALTER COLUMN organization_id DROP NOT NULL;
-- Ensure uniqueness still works with NULL org (super_admin has no org)
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_role_no_org_uniq
  ON public.user_roles (user_id, role) WHERE organization_id IS NULL;