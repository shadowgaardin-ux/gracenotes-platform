
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending_payment',
  ADD COLUMN IF NOT EXISTS subscription_price_cents integer,
  ADD COLUMN IF NOT EXISTS subscription_currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS subscription_period_days integer,
  ADD COLUMN IF NOT EXISTS subscription_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.validate_org_status()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.status NOT IN ('pending_payment','pending_review','active','expired','suspended') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_org_status ON public.organizations;
CREATE TRIGGER trg_validate_org_status BEFORE INSERT OR UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.validate_org_status();

DROP TRIGGER IF EXISTS trg_org_touch ON public.organizations;
CREATE TRIGGER trg_org_touch BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.payment_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_mime text,
  amount_cents integer,
  note text,
  status text NOT NULL DEFAULT 'pending',
  rejection_reason text,
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_receipts TO authenticated;
GRANT ALL ON public.payment_receipts TO service_role;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org admins view own receipts" ON public.payment_receipts;
CREATE POLICY "Org admins view own receipts" ON public.payment_receipts
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (organization_id = public.get_user_org(auth.uid())
        AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pastor')))
  );

DROP POLICY IF EXISTS "Org admins create receipts" ON public.payment_receipts;
CREATE POLICY "Org admins create receipts" ON public.payment_receipts
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND organization_id = public.get_user_org(auth.uid())
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pastor'))
  );

DROP POLICY IF EXISTS "Super admin updates receipts" ON public.payment_receipts;
CREATE POLICY "Super admin updates receipts" ON public.payment_receipts
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP TRIGGER IF EXISTS trg_receipt_touch ON public.payment_receipts;
CREATE TRIGGER trg_receipt_touch BEFORE UPDATE ON public.payment_receipts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.organization_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_name text NOT NULL,
  email text NOT NULL,
  organization_name text NOT NULL,
  size text,
  message text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.organization_inquiries TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.organization_inquiries TO authenticated;
GRANT ALL ON public.organization_inquiries TO service_role;
ALTER TABLE public.organization_inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit inquiry" ON public.organization_inquiries;
CREATE POLICY "Anyone can submit inquiry" ON public.organization_inquiries
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Super admin reads inquiries" ON public.organization_inquiries;
CREATE POLICY "Super admin reads inquiries" ON public.organization_inquiries
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admin updates inquiries" ON public.organization_inquiries;
CREATE POLICY "Super admin updates inquiries" ON public.organization_inquiries
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

ALTER TABLE public.access_codes
  ADD COLUMN IF NOT EXISTS cycle_started_at timestamptz;

DROP POLICY IF EXISTS "Super admin reads codes" ON public.access_codes;
CREATE POLICY "Super admin reads codes" ON public.access_codes
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admin updates codes" ON public.access_codes;
CREATE POLICY "Super admin updates codes" ON public.access_codes
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Org admins read own org codes" ON public.access_codes;
CREATE POLICY "Org admins read own org codes" ON public.access_codes
  FOR SELECT TO authenticated
  USING (
    organization_id = public.get_user_org(auth.uid())
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pastor'))
  );

DROP POLICY IF EXISTS "Members read own org" ON public.organizations;
CREATE POLICY "Members read own org" ON public.organizations
  FOR SELECT TO authenticated
  USING (id = public.get_user_org(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admin updates orgs" ON public.organizations;
CREATE POLICY "Super admin updates orgs" ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Org admins upload receipts" ON storage.objects;
CREATE POLICY "Org admins upload receipts" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = public.get_user_org(auth.uid())::text
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pastor'))
  );

DROP POLICY IF EXISTS "Org admins read own receipts" ON storage.objects;
CREATE POLICY "Org admins read own receipts" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR ((storage.foldername(name))[1] = public.get_user_org(auth.uid())::text
          AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pastor')))
    )
  );

CREATE OR REPLACE FUNCTION public.refresh_org_status(_org_id uuid)
RETURNS public.organizations LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _o public.organizations%ROWTYPE;
BEGIN
  SELECT * INTO _o FROM public.organizations WHERE id = _org_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF _o.status = 'active' AND _o.subscription_expires_at IS NOT NULL
     AND _o.subscription_expires_at < now() THEN
    UPDATE public.organizations SET status='expired' WHERE id=_org_id RETURNING * INTO _o;
    UPDATE public.access_codes SET expires_at = now()
      WHERE organization_id = _org_id AND (expires_at IS NULL OR expires_at > now());
  END IF;
  RETURN _o;
END $$;

CREATE OR REPLACE FUNCTION public.submit_payment_receipt(
  _file_path text, _file_mime text, _amount_cents integer, _note text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _uid uuid := auth.uid(); _org uuid; _rid uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  _org := public.get_user_org(_uid);
  IF _org IS NULL THEN RAISE EXCEPTION 'No organization'; END IF;
  IF NOT (public.has_role(_uid,'admin') OR public.has_role(_uid,'pastor')) THEN
    RAISE EXCEPTION 'Only organization admins can submit receipts';
  END IF;
  INSERT INTO public.payment_receipts(organization_id, uploaded_by, file_path, file_mime, amount_cents, note)
    VALUES (_org, _uid, _file_path, _file_mime, _amount_cents, _note)
    RETURNING id INTO _rid;
  UPDATE public.organizations SET status='pending_review' WHERE id=_org;
  RETURN _rid;
END $$;
REVOKE EXECUTE ON FUNCTION public.submit_payment_receipt(text,text,integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_payment_receipt(text,text,integer,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_receipt_and_activate(
  _receipt_id uuid, _period_days integer, _price_cents integer
) RETURNS TABLE(access_code text, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _uid uuid := auth.uid(); _r public.payment_receipts%ROWTYPE;
  _code text; _exp timestamptz; _start timestamptz := now();
BEGIN
  IF _uid IS NULL OR NOT public.has_role(_uid,'super_admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT * INTO _r FROM public.payment_receipts WHERE id=_receipt_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Receipt not found'; END IF;
  IF _period_days IS NULL OR _period_days <= 0 THEN RAISE EXCEPTION 'Invalid period'; END IF;
  _exp := _start + make_interval(days => _period_days);
  UPDATE public.payment_receipts SET status='approved', reviewed_at=now(), reviewed_by=_uid WHERE id=_receipt_id;
  UPDATE public.organizations
    SET status='active',
        subscription_price_cents = COALESCE(_price_cents, subscription_price_cents),
        subscription_period_days = _period_days,
        subscription_started_at = _start,
        subscription_expires_at = _exp
    WHERE id = _r.organization_id;
  UPDATE public.access_codes SET expires_at = now()
    WHERE organization_id = _r.organization_id AND (expires_at IS NULL OR expires_at > now());
  _code := 'GN-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  INSERT INTO public.access_codes(organization_id, code, role, expires_at, cycle_started_at)
    VALUES (_r.organization_id, _code, 'congregation', _exp, _start);
  RETURN QUERY SELECT _code, _exp;
END $$;
REVOKE EXECUTE ON FUNCTION public.approve_receipt_and_activate(uuid,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_receipt_and_activate(uuid,integer,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_receipt(_receipt_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _uid uuid := auth.uid(); _r public.payment_receipts%ROWTYPE;
BEGIN
  IF _uid IS NULL OR NOT public.has_role(_uid,'super_admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO _r FROM public.payment_receipts WHERE id=_receipt_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Receipt not found'; END IF;
  UPDATE public.payment_receipts
    SET status='rejected', rejection_reason=_reason, reviewed_at=now(), reviewed_by=_uid WHERE id=_receipt_id;
  UPDATE public.organizations SET status='pending_payment'
    WHERE id=_r.organization_id AND status='pending_review';
END $$;
REVOKE EXECUTE ON FUNCTION public.reject_receipt(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_receipt(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.super_create_organization(
  _name text, _admin_email text, _price_cents integer, _period_days integer
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _uid uuid := auth.uid(); _org_id uuid; _admin_uid uuid;
BEGIN
  IF _uid IS NULL OR NOT public.has_role(_uid,'super_admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  INSERT INTO public.organizations(name, status, subscription_price_cents, subscription_period_days)
    VALUES (_name, 'pending_payment', _price_cents, _period_days) RETURNING id INTO _org_id;
  SELECT id INTO _admin_uid FROM auth.users WHERE lower(email)=lower(_admin_email);
  IF _admin_uid IS NOT NULL THEN
    UPDATE public.profiles SET organization_id=_org_id WHERE id=_admin_uid;
    INSERT INTO public.user_roles(user_id, organization_id, role)
      VALUES (_admin_uid, _org_id, 'admin') ON CONFLICT (user_id, organization_id, role) DO NOTHING;
    INSERT INTO public.user_roles(user_id, organization_id, role)
      VALUES (_admin_uid, _org_id, 'pastor') ON CONFLICT (user_id, organization_id, role) DO NOTHING;
  END IF;
  RETURN _org_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.super_create_organization(text,text,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.super_create_organization(text,text,integer,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.redeem_access_code(_code text)
 RETURNS TABLE(organization_id uuid, role app_role)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $function$
DECLARE _ac public.access_codes%ROWTYPE; _uid uuid := auth.uid(); _org public.organizations%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _ac FROM public.access_codes WHERE code = _code;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid access code'; END IF;
  IF _ac.expires_at IS NOT NULL AND _ac.expires_at < now() THEN RAISE EXCEPTION 'Access code expired'; END IF;
  IF _ac.max_uses IS NOT NULL AND _ac.uses >= _ac.max_uses THEN RAISE EXCEPTION 'Access code fully redeemed'; END IF;
  SELECT * INTO _org FROM public.organizations WHERE id=_ac.organization_id;
  IF _org.status <> 'active' THEN RAISE EXCEPTION 'Organization workspace is not active'; END IF;
  IF _org.subscription_expires_at IS NOT NULL AND _org.subscription_expires_at < now() THEN
    RAISE EXCEPTION 'Organization subscription has expired';
  END IF;
  UPDATE public.profiles SET organization_id = _ac.organization_id WHERE id = _uid;
  INSERT INTO public.user_roles (user_id, organization_id, role)
    VALUES (_uid, _ac.organization_id, _ac.role) ON CONFLICT (user_id, organization_id, role) DO NOTHING;
  UPDATE public.access_codes SET uses = uses + 1 WHERE id = _ac.id;
  RETURN QUERY SELECT _ac.organization_id, _ac.role;
END; $function$;

CREATE OR REPLACE FUNCTION public.grant_super_admin_by_email(_email text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _uid uuid;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE lower(email)=lower(_email);
  IF _uid IS NULL THEN RETURN false; END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (_uid, 'super_admin')
    ON CONFLICT (user_id, organization_id, role) DO NOTHING;
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.grant_super_admin_by_email(text) FROM PUBLIC, anon, authenticated;

UPDATE public.organizations SET status='active'
  WHERE status='pending_payment' AND created_at < now() - interval '1 minute';
