begin;
create or replace function public.draft_context_delta(candidates text[] default array[]::text[],previous text[] default array[]::text[],known_revision text default null,include_games boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' set statement_timeout='30s' as $$
declare current_revision text;result jsonb;
begin
 if not public.draft_access() then raise exception 'An invitation is required';end if;
 if cardinality(candidates)>300 or cardinality(previous)>300 then raise exception 'Too many champions';end if;
 select revision into current_revision from public.draft_channels where name='stable';
 if current_revision is null then raise exception 'Statistics have not been published yet';end if;
 with active as (select d.* from public.draft_champion_data d join public.draft_dataset_parts p on d.sha256=p.sha256 where p.revision=current_revision),
 stats as (select r from active a cross join lateral jsonb_array_elements(a.stats) r),
 pairs as (select r from active a cross join lateral jsonb_array_elements(a.pairs) r where a.champion_id=any(candidates) and r->>'otherId'=any(candidates) and (current_revision is distinct from known_revision or not a.champion_id=any(previous) or not r->>'otherId'=any(previous))),
 games as (select r from public.draft_packs d join public.draft_dataset_parts p on p.sha256=d.sha256 cross join lateral jsonb_array_elements(d.payload->'games') r where include_games and p.revision=current_revision)
 select jsonb_build_object('revision',current_revision,'manifest',(select manifest from public.draft_datasets where revision=current_revision),'stats',coalesce((select jsonb_agg(r) from stats),'[]'::jsonb),'pairs',coalesce((select jsonb_agg(r) from pairs),'[]'::jsonb),'games',coalesce((select jsonb_agg(r) from games),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.draft_context_delta(text[],text[],text,boolean) from public,anon;
grant execute on function public.draft_context_delta(text[],text[],text,boolean) to authenticated,service_role;
notify pgrst,'reload schema';
commit;
