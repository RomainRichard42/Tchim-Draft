begin;
-- Read narrow column slices. Never materialize all champions' pair arrays for metadata.
create or replace function public.draft_context_slice(candidates text[],origins text[],previous text[] default array[]::text[],known_revision text default null,include_metadata boolean default true,include_games boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' set statement_timeout='20s' as $$
declare current_revision text;result jsonb;
begin
 if not public.draft_access() then raise exception 'An invitation is required';end if;
 if cardinality(candidates)>300 or cardinality(previous)>300 or cardinality(origins)>6 or not origins<@candidates then raise exception 'Invalid context slice';end if;
 select revision into current_revision from public.draft_channels where name='stable';
 if current_revision is null then raise exception 'Statistics have not been published yet';end if;
 select jsonb_build_object(
  'revision',current_revision,
  'manifest',case when include_metadata then (select manifest from public.draft_datasets where revision=current_revision) else null end,
  'stats',case when include_metadata then coalesce((select jsonb_agg(r) from public.draft_champion_data a join public.draft_dataset_parts p on a.sha256=p.sha256 cross join lateral jsonb_array_elements(a.stats) r where p.revision=current_revision),'[]'::jsonb) else '[]'::jsonb end,
  'pairs',coalesce((select jsonb_agg(r) from public.draft_champion_data a join public.draft_dataset_parts p on a.sha256=p.sha256 cross join lateral jsonb_array_elements(a.pairs) r where p.revision=current_revision and a.champion_id=any(origins) and r->>'otherId'=any(candidates) and (current_revision is distinct from known_revision or not a.champion_id=any(previous) or not r->>'otherId'=any(previous))),'[]'::jsonb),
  'games',case when include_games then coalesce((select jsonb_agg(r) from public.draft_packs a join public.draft_dataset_parts p on a.sha256=p.sha256 cross join lateral jsonb_array_elements(a.payload->'games') r where p.revision=current_revision and a.games_count>0),'[]'::jsonb) else '[]'::jsonb end
 ) into result;
 return result;
end $$;
revoke all on function public.draft_context_slice(text[],text[],text[],text,boolean,boolean) from public,anon;
grant execute on function public.draft_context_slice(text[],text[],text[],text,boolean,boolean) to authenticated,service_role;
notify pgrst,'reload schema';
commit;
