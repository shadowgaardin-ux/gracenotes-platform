
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'pastor', 'staff', 'congregation');

-- ORGANIZATIONS (churches)
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- ACCESS CODES
CREATE TABLE public.access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  role public.app_role NOT NULL DEFAULT 'congregation',
  max_uses INT,
  uses INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_codes TO authenticated;
GRANT ALL ON public.access_codes TO service_role;
ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- USER ROLES (separate table — never on profile)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER FUNCTIONS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_user_org(_user_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.profiles WHERE id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.is_pastoral(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'pastor')
  )
$$;

-- SERMONS
CREATE TABLE public.sermons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  scripture_focus TEXT,
  transcript TEXT,
  summary TEXT,
  delivered_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sermons TO authenticated;
GRANT ALL ON public.sermons TO service_role;
ALTER TABLE public.sermons ENABLE ROW LEVEL SECURITY;

-- SERMON DERIVED CONTENT
CREATE TABLE public.sermon_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sermon_id UUID NOT NULL REFERENCES public.sermons(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, -- 'social_x', 'social_instagram', 'social_facebook', 'discussion_guide', 'bulletin', 'newsletter'
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sermon_content TO authenticated;
GRANT ALL ON public.sermon_content TO service_role;
ALTER TABLE public.sermon_content ENABLE ROW LEVEL SECURITY;

-- SCRIPTURE REFS
CREATE TABLE public.scripture_refs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sermon_id UUID NOT NULL REFERENCES public.sermons(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reference TEXT NOT NULL,
  book TEXT,
  chapter INT,
  verse_start INT,
  verse_end INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scripture_refs TO authenticated;
GRANT ALL ON public.scripture_refs TO service_role;
ALTER TABLE public.scripture_refs ENABLE ROW LEVEL SECURITY;

-- PASTORAL VAULT NOTES
CREATE TABLE public.vault_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'general', -- counseling, sermon_draft, admin
  title TEXT NOT NULL,
  body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_notes TO authenticated;
GRANT ALL ON public.vault_notes TO service_role;
ALTER TABLE public.vault_notes ENABLE ROW LEVEL SECURITY;

-- =============== RLS POLICIES ===============

-- organizations: members can read their own org; admins can update
CREATE POLICY "Members read own org" ON public.organizations FOR SELECT TO authenticated
  USING (id = public.get_user_org(auth.uid()));
CREATE POLICY "Admins update own org" ON public.organizations FOR UPDATE TO authenticated
  USING (id = public.get_user_org(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- access_codes: only admins of the org can read/manage
CREATE POLICY "Admins manage access codes" ON public.access_codes FOR ALL TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (organization_id = public.get_user_org(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- profiles: user reads/updates own; same-org members can read names
CREATE POLICY "Read own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR organization_id = public.get_user_org(auth.uid()));
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- user_roles: read own; admins read all in org
CREATE POLICY "Read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (organization_id = public.get_user_org(auth.uid()) AND public.has_role(auth.uid(), 'admin')));

-- sermons: same-org read; pastoral write
CREATE POLICY "Org members read sermons" ON public.sermons FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()));
CREATE POLICY "Pastoral insert sermons" ON public.sermons FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_org(auth.uid()) AND public.is_pastoral(auth.uid()) AND author_id = auth.uid());
CREATE POLICY "Pastoral update sermons" ON public.sermons FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()) AND public.is_pastoral(auth.uid()));
CREATE POLICY "Pastoral delete sermons" ON public.sermons FOR DELETE TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()) AND public.is_pastoral(auth.uid()));

-- sermon_content: same-org read; pastoral write
CREATE POLICY "Org read sermon content" ON public.sermon_content FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()));
CREATE POLICY "Pastoral write sermon content" ON public.sermon_content FOR ALL TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()) AND public.is_pastoral(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org(auth.uid()) AND public.is_pastoral(auth.uid()));

-- scripture_refs: same-org read; pastoral write
CREATE POLICY "Org read scripture refs" ON public.scripture_refs FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()));
CREATE POLICY "Pastoral write scripture refs" ON public.scripture_refs FOR ALL TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()) AND public.is_pastoral(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org(auth.uid()) AND public.is_pastoral(auth.uid()));

-- vault_notes: pastoral only
CREATE POLICY "Pastoral read vault" ON public.vault_notes FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()) AND public.is_pastoral(auth.uid()));
CREATE POLICY "Pastoral write vault" ON public.vault_notes FOR ALL TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()) AND public.is_pastoral(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org(auth.uid()) AND public.is_pastoral(auth.uid()) AND author_id = auth.uid());

-- ============ TRIGGERS ============

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER touch_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_sermons BEFORE UPDATE ON public.sermons FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_vault_notes BEFORE UPDATE ON public.vault_notes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ REDEEM ACCESS CODE RPC ============
CREATE OR REPLACE FUNCTION public.redeem_access_code(_code TEXT)
RETURNS TABLE(organization_id UUID, role public.app_role)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ac public.access_codes%ROWTYPE;
  _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _ac FROM public.access_codes WHERE code = _code;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid access code'; END IF;
  IF _ac.expires_at IS NOT NULL AND _ac.expires_at < now() THEN RAISE EXCEPTION 'Access code expired'; END IF;
  IF _ac.max_uses IS NOT NULL AND _ac.uses >= _ac.max_uses THEN RAISE EXCEPTION 'Access code fully redeemed'; END IF;

  UPDATE public.profiles SET organization_id = _ac.organization_id WHERE id = _uid;
  INSERT INTO public.user_roles (user_id, organization_id, role)
    VALUES (_uid, _ac.organization_id, _ac.role)
    ON CONFLICT (user_id, organization_id, role) DO NOTHING;
  UPDATE public.access_codes SET uses = uses + 1 WHERE id = _ac.id;

  RETURN QUERY SELECT _ac.organization_id, _ac.role;
END; $$;

-- ============ CREATE CHURCH RPC (admin self-serve onboarding) ============
CREATE OR REPLACE FUNCTION public.create_church(_name TEXT)
RETURNS TABLE(organization_id UUID, admin_code TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _org_id UUID;
  _admin_code TEXT;
  _congregation_code TEXT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  INSERT INTO public.organizations (name) VALUES (_name) RETURNING id INTO _org_id;

  _admin_code := 'GN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  _congregation_code := 'GN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  INSERT INTO public.access_codes (organization_id, code, role) VALUES (_org_id, _admin_code, 'admin');
  INSERT INTO public.access_codes (organization_id, code, role) VALUES (_org_id, _congregation_code, 'congregation');

  UPDATE public.profiles SET organization_id = _org_id WHERE id = _uid;
  INSERT INTO public.user_roles (user_id, organization_id, role) VALUES (_uid, _org_id, 'admin');
  INSERT INTO public.user_roles (user_id, organization_id, role) VALUES (_uid, _org_id, 'pastor');

  RETURN QUERY SELECT _org_id, _admin_code;
END; $$;

GRANT EXECUTE ON FUNCTION public.redeem_access_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_church(TEXT) TO authenticated;
