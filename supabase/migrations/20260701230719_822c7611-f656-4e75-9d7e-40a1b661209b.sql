
-- Lock down SECURITY DEFINER RPCs to authenticated users only
revoke execute on function public.accept_offer(uuid,uuid) from public, anon;
revoke execute on function public.set_sail(uuid) from public, anon;
revoke execute on function public.mark_arrived(uuid) from public, anon;
revoke execute on function public.add_extra_part(uuid,text,numeric,text,text) from public, anon;
revoke execute on function public.approve_part(uuid) from public, anon;
revoke execute on function public.reject_part(uuid) from public, anon;
revoke execute on function public.complete_job(uuid) from public, anon;
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.accept_offer(uuid,uuid) to authenticated;
grant execute on function public.set_sail(uuid) to authenticated;
grant execute on function public.mark_arrived(uuid) to authenticated;
grant execute on function public.add_extra_part(uuid,text,numeric,text,text) to authenticated;
grant execute on function public.approve_part(uuid) to authenticated;
grant execute on function public.reject_part(uuid) to authenticated;
grant execute on function public.complete_job(uuid) to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;

-- Pin search_path on the utility triggers
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
