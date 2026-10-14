begin;
create table public.draft_knowledge(slot text primary key check(slot='stable'),revision text not null check(revision ~ '^[a-f0-9]{64}$'),payload jsonb not null,published_at timestamptz not null default now());
alter table public.draft_knowledge enable row level security;
revoke all on public.draft_knowledge from public,anon,authenticated;
grant select on public.draft_knowledge to authenticated;
grant all on public.draft_knowledge to service_role;
create policy draft_knowledge_read on public.draft_knowledge for select to authenticated using(public.draft_access());
create policy draft_knowledge_insert on public.draft_knowledge for insert to authenticated with check(public.draft_access(null,true));
create policy draft_knowledge_update on public.draft_knowledge for update to authenticated using(public.draft_access(null,true)) with check(public.draft_access(null,true));
create function public.draft_publish_knowledge(candidate jsonb,expected_revision text default null) returns text language plpgsql security definer set search_path='' as $$
declare current_revision text;patch jsonb;
begin
 if not public.draft_access(null,true) then raise exception 'Administrator only';end if;
 perform pg_advisory_xact_lock(76413951);
 select revision into current_revision from public.draft_knowledge where slot='stable';
 if current_revision is distinct from expected_revision then raise exception 'Another publication occurred';end if;
 if candidate->>'schema'<>'1' or candidate->>'revision' !~ '^[a-f0-9]{64}$' or jsonb_array_length(candidate->'patches') not between 1 and 3 or octet_length(candidate::text)>16000000 then raise exception 'Invalid knowledge data';end if;
 for patch in select value from jsonb_array_elements(candidate->'patches') loop
  if jsonb_array_length(patch->'kits') not between 100 and 300 then raise exception 'Incomplete champion catalog';end if;
 end loop;
 insert into public.draft_knowledge(slot,revision,payload) values('stable',candidate->>'revision',candidate) on conflict(slot) do update set revision=excluded.revision,payload=excluded.payload,published_at=now();
 return candidate->>'revision';
end $$;
revoke all on function public.draft_publish_knowledge(jsonb,text) from public,anon;
grant execute on function public.draft_publish_knowledge(jsonb,text) to authenticated;
commit;
