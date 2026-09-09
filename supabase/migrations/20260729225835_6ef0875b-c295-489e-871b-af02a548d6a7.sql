REVOKE EXECUTE ON FUNCTION public.is_verified_dealer(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_verified_dealer(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_verified_dealer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_verified_dealer(uuid) TO service_role;