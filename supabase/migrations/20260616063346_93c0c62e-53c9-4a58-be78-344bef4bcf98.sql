
ALTER FUNCTION public.touch_updated_at() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_org(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_pastoral(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.redeem_access_code(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_church(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_org(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_pastoral(UUID) TO authenticated;
