
-- Revoke default PUBLIC execute on every SECURITY DEFINER function,
-- then grant back only what the app truly needs.

-- Trigger-only functions: no direct callers.
REVOKE ALL ON FUNCTION public.prevent_profile_privilege_escalation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mask_job_message() FROM PUBLIC, anon, authenticated;

-- Role check: used by RLS policies as the signed-in user.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- Mission / offers / parts RPCs — signed-in users only.
REVOKE ALL ON FUNCTION public.set_sail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_sail(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.mark_arrived(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_arrived(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.accept_offer(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_offer(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.reject_part(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_part(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.approve_part(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_part(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.add_extra_part(uuid, text, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_extra_part(uuid, text, numeric, text, text) TO authenticated;

-- Admin listing: self-guarded via has_role('admin').
REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- Marketplace checkout (both overloads).
REVOKE ALL ON FUNCTION public.checkout_parts_cart(jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checkout_parts_cart(jsonb, text) TO authenticated;

REVOKE ALL ON FUNCTION public.checkout_parts_cart(jsonb, text, uuid, text, integer, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checkout_parts_cart(jsonb, text, uuid, text, integer, text, text)
  TO authenticated;

-- Payments / escrow lifecycle RPCs.
REVOKE ALL ON FUNCTION public.record_payment_intent(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_payment_intent(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.complete_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_job(uuid) TO authenticated;
