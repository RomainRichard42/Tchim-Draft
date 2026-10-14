begin;
create table if not exists public.draft_models(kind text primary key check(kind in ('candidate','active')),model jsonb not null,updated_at timestamptz not null default now());
create table if not exists public.draft_model_profiles(user_id uuid references auth.users(id),team_key text not null,profile jsonb not null,primary key(user_id,team_key));
alter table public.draft_models enable row level security;
alter table public.draft_model_profiles enable row level security;
revoke all on public.draft_models,public.draft_model_profiles from public,anon,authenticated;
grant select,insert,update,delete on public.draft_models,public.draft_model_profiles to authenticated;
grant all on public.draft_models,public.draft_model_profiles to service_role;
create policy draft_model_read on public.draft_models for select to authenticated using(public.draft_access() and (kind='active' or public.draft_access(null,true)));
create policy draft_model_write on public.draft_models for all to authenticated using(public.draft_access(null,true)) with check(public.draft_access(null,true));
create policy draft_profile_read on public.draft_model_profiles for select to authenticated using(user_id=auth.uid() or public.draft_access(null,true));
create policy draft_profile_write on public.draft_model_profiles for all to authenticated using(public.draft_access(null,true)) with check(public.draft_access(null,true));
create or replace function public.draft_validate_match() returns trigger language plpgsql set search_path='' as $$
declare d jsonb; h jsonb;
begin
 d:=new.document;h:=d->'draft'->'history';
 if jsonb_typeof(d)<>'object' or length(d->>'name') not between 1 and 100 or jsonb_typeof(h)<>'array' or jsonb_array_length(h)<>20 or d->'draft'->>'mode' not in ('pro','solo') or (d->>'winner' is not null and d->>'winner' not in ('blue','red')) or (d->>'coachRating')::integer not between 1 and 5 then raise exception 'Invalid draft result'; end if;
 if d ? 'kills' and ((d->'kills'->>'blue')::integer not between 0 and 999 or (d->'kills'->>'red')::integer not between 0 and 999) then raise exception 'Invalid kills';end if;
 if exists(select 1 from jsonb_array_elements(h) r where jsonb_typeof(r)<>'object' or (r->>'role' is not null and r->>'role' not in ('TOP','JUNGLE','MID','ADC','SUPPORT'))) then raise exception 'Invalid draft selection';end if;
 return new;
end $$;
create trigger draft_validate_match before insert or update on public.draft_matches for each row execute function public.draft_validate_match();
revoke all on function public.draft_validate_match() from public,anon,authenticated;
commit;
