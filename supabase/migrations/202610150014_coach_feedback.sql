begin;
create table if not exists public.draft_coach_feedback (
 id uuid primary key, author uuid not null references auth.users(id) on delete cascade,
 document jsonb not null, updated_at timestamptz not null default now(),
 check(octet_length(document::text)<60000)
);
create index if not exists draft_coach_feedback_author_updated on public.draft_coach_feedback(author,updated_at desc);
alter table public.draft_coach_feedback enable row level security;
revoke all on public.draft_coach_feedback from public,anon,authenticated;
grant select,insert,update on public.draft_coach_feedback to authenticated;
grant all on public.draft_coach_feedback to service_role;
create policy draft_feedback_read on public.draft_coach_feedback for select to authenticated
 using(public.draft_access() and (author=auth.uid() or public.draft_access(null,true)));
create policy draft_feedback_insert on public.draft_coach_feedback for insert to authenticated
 with check(author=auth.uid() and public.draft_access());
create policy draft_feedback_update on public.draft_coach_feedback for update to authenticated
 using(author=auth.uid() and public.draft_access()) with check(author=auth.uid() and public.draft_access());
create or replace function public.draft_coach_feedback_validate() returns trigger language plpgsql set search_path='' as $$
declare d jsonb;
begin
 d:=new.document;
 if not coalesce(jsonb_typeof(d)='object' and d->>'id'=new.id::text
 and d->>'championId' ~ '^[A-Za-z0-9_]{1,80}$'
 and d->>'role' in ('TOP','JUNGLE','MID','ADC','SUPPORT') and d->>'side' in ('blue','red')
 and d->>'verdict' in ('good','unplayable','bad-matchup')
 and d->>'reason' in ('comfort','lane','composition','execution','other')
 and length(d->>'note')<=600 and length(d->>'teamKey')<=4000
 and jsonb_typeof(d->'draft'->'history')='array' and jsonb_array_length(d->'draft'->'history')<=20
 and (not(d ? 'deleted') or jsonb_typeof(d->'deleted')='boolean'),false)
 then raise exception 'Invalid coach feedback';end if;
 if tg_op='UPDATE' and (new.id<>old.id or new.author<>old.author) then raise exception 'Immutable feedback owner';end if;
 new.updated_at=now();return new;
end $$;
create trigger draft_coach_feedback_validate before insert or update on public.draft_coach_feedback
 for each row execute function public.draft_coach_feedback_validate();
revoke all on function public.draft_coach_feedback_validate() from public,anon,authenticated;
create table if not exists public.draft_pro_context (
 revision text primary key references public.draft_datasets(revision) on delete cascade,
 context jsonb not null, updated_at timestamptz not null default now(),
 check(octet_length(context::text)<12000000),
 check(context->>'schema'='1' and context->>'datasetRevision'=revision and jsonb_typeof(context->'games')='object')
);
alter table public.draft_pro_context enable row level security;
revoke all on public.draft_pro_context from public,anon,authenticated;
grant select on public.draft_pro_context to authenticated;
grant all on public.draft_pro_context to service_role;
create policy draft_pro_context_read on public.draft_pro_context for select to authenticated using(public.draft_access());
commit;
