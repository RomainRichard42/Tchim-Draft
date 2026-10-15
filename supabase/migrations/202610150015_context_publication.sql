begin;
create or replace function public.draft_publish_with_context(new_manifest jsonb, expected_revision text, new_context jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(new_context->>'schema'='1' and new_context->>'datasetRevision'=new_manifest->>'revision'
 and jsonb_typeof(new_context->'games')='object',false) then raise exception 'Invalid pro context';end if;
 -- The existing revision check and manifest validation still execute. Both changes
 -- become visible together when this transaction commits.
 perform public.draft_publish(new_manifest,expected_revision);
 insert into public.draft_pro_context(revision,context) values(new_manifest->>'revision',new_context)
 on conflict(revision) do update set context=excluded.context,updated_at=now();
end $$;
revoke all on function public.draft_publish_with_context(jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.draft_publish_with_context(jsonb,text,jsonb) to service_role;
commit;
