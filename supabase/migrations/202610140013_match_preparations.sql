begin;
create table if not exists public.draft_preparations (
 id uuid primary key, author uuid not null references auth.users(id) on delete cascade,
 document jsonb not null, revision integer not null default 1,
 updated_at timestamptz not null default now(), created_at timestamptz not null default now(),
 check (octet_length(document::text)<1000000)
);
create index if not exists draft_preparations_author_updated on public.draft_preparations(author,updated_at desc);
alter table public.draft_preparations enable row level security;
revoke all on public.draft_preparations from public,anon,authenticated;
grant select,insert,update on public.draft_preparations to authenticated;
grant all on public.draft_preparations to service_role;
create policy draft_preparation_read on public.draft_preparations for select to authenticated
 using(public.draft_access() and (author=auth.uid() or public.draft_access(null,true)));
create policy draft_preparation_insert on public.draft_preparations for insert to authenticated
 with check(author=auth.uid() and public.draft_access());
create policy draft_preparation_update on public.draft_preparations for update to authenticated
 using(author=auth.uid() and public.draft_access()) with check(author=auth.uid() and public.draft_access());
create or replace function public.draft_preparation_validate() returns trigger language plpgsql set search_path='' as $$
declare d jsonb;
begin
 d:=new.document;
 if not coalesce(jsonb_typeof(d)='object' and length(d->>'name') between 1 and 100
 and d->>'kind' in ('scrim','official','practice') and jsonb_typeof(d->'draft'->'history')='array'
 and jsonb_array_length(d->'draft'->'history')<=20 and d->'draft'->>'mode' in ('pro','solo')
 and jsonb_typeof(d->'teams')='object' and jsonb_typeof(d->'results')='array'
 and jsonb_array_length(d->'results')<=5 and jsonb_typeof(d->'archived')='boolean',false)
 then raise exception 'Invalid match preparation'; end if;
 if tg_op='UPDATE' then
  if new.author<>old.author or new.id<>old.id then raise exception 'Immutable preparation owner'; end if;
  new.revision=old.revision+1;
 else new.revision=1; end if;
 new.updated_at=now();return new;
end $$;
create trigger draft_preparation_validate before insert or update on public.draft_preparations
 for each row execute function public.draft_preparation_validate();
revoke all on function public.draft_preparation_validate() from public,anon,authenticated;
commit;
