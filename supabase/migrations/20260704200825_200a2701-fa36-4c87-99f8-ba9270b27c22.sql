CREATE OR REPLACE FUNCTION public.approve_part(_part_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.job_parts%rowtype;
begin
  select * into p from public.job_parts where id=_part_id;
  if not found then raise exception 'Part not found'; end if;
  if not exists (select 1 from public.jobs where id=p.job_id and client_id=auth.uid()) then
    raise exception 'Not authorized';
  end if;
  update public.job_parts set payment_status='Paid' where id=_part_id;
  update public.jobs
    set extra_parts_cost = extra_parts_cost + p.part_price,
        total_escrow_pool = total_escrow_pool + p.part_price,
        status = (case when exists(select 1 from public.job_parts where job_id=p.job_id and payment_status='Pending')
                      then 'PartsPending' else 'InProgress' end)::public.job_status
    where id=p.job_id;
end $function$;

CREATE OR REPLACE FUNCTION public.reject_part(_part_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.job_parts%rowtype;
begin
  select * into p from public.job_parts where id=_part_id;
  if not exists (select 1 from public.jobs where id=p.job_id and client_id=auth.uid()) then
    raise exception 'Not authorized';
  end if;
  update public.job_parts set payment_status='Rejected' where id=_part_id;
  update public.jobs
    set status = (case when exists(select 1 from public.job_parts where job_id=p.job_id and payment_status='Pending')
                      then 'PartsPending' else 'InProgress' end)::public.job_status
    where id=p.job_id;
end $function$;

CREATE OR REPLACE FUNCTION public.add_extra_part(_job_id uuid, _name text, _price numeric, _photo text, _source text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _id uuid;
begin
  if not exists (select 1 from public.jobs where id=_job_id and provider_id=auth.uid()) then
    raise exception 'Not authorized';
  end if;
  insert into public.job_parts(job_id, part_name, part_price, part_image_url, source)
    values (_job_id, _name, _price, _photo, coalesce(_source,'Tedarikçi Firma (Local Supplier)'))
    returning id into _id;
  update public.jobs set status='PartsPending'::public.job_status where id=_job_id;
  return _id;
end $function$;