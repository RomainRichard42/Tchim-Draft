begin;
-- One indexed row per champion/role/source/patch/part. JSONB compression avoids
-- duplicating a million large row indexes while allowing targeted draft queries.
create table if not exists public.draft_champion_data (
 sha256 text references public.draft_packs(sha256),champion_id text,role text,
 stats jsonb not null,pairs jsonb not null,
 primary key(sha256,champion_id,role)
);
create index if not exists draft_champion_lookup on public.draft_champion_data(champion_id);
alter table public.draft_champion_data enable row level security;
revoke all on public.draft_champion_data from public,anon,authenticated;
grant select on public.draft_champion_data to authenticated;
grant all on public.draft_champion_data to service_role;
create policy draft_champion_read on public.draft_champion_data for select to authenticated using(public.draft_access() and exists(select 1 from public.draft_dataset_parts p join public.draft_channels c on c.revision=p.revision where p.sha256=draft_champion_data.sha256));
create or replace function public.draft_ingest(new_hash text,new_pack jsonb,new_bytes integer) returns void language plpgsql security invoker set search_path='' as $$
begin
 insert into public.draft_packs(sha256,pack_id,source,patch,stats_count,pairs_count,games_count,bytes,payload)
 values(new_hash,new_pack->>'id',split_part(new_pack->>'id','-',2),split_part(new_pack->>'id','-',3),jsonb_array_length(new_pack->'stats'),jsonb_array_length(new_pack->'pairs'),jsonb_array_length(new_pack->'games'),new_bytes,new_pack) on conflict do nothing;
 with s as (select r->>'championId' champion_id,r->>'role' role,jsonb_agg(r) items from jsonb_array_elements(new_pack->'stats') r group by 1,2),
 p as (select r->>'championId' champion_id,r->>'role' role,jsonb_agg(r) items from jsonb_array_elements(new_pack->'pairs') r group by 1,2)
 insert into public.draft_champion_data(sha256,champion_id,role,stats,pairs)
 select new_hash,coalesce(s.champion_id,p.champion_id),coalesce(s.role,p.role),coalesce(s.items,'[]'::jsonb),coalesce(p.items,'[]'::jsonb) from s full join p using(champion_id,role) on conflict do nothing;
end $$;
revoke all on function public.draft_ingest(text,jsonb,integer) from public,anon,authenticated;
grant execute on function public.draft_ingest(text,jsonb,integer) to service_role;

create or replace function public.draft_context(candidates text[] default array[]::text[]) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb; current_revision text;
begin
 if not public.draft_access() then raise exception 'An invitation is required'; end if;
 if cardinality(candidates)>300 then raise exception 'Too many champions';end if;
 select revision into current_revision from public.draft_channels where name='stable';
 if current_revision is null then raise exception 'Statistics have not been published yet';end if;
 with active as (select d.* from public.draft_champion_data d join public.draft_dataset_parts p on d.sha256=p.sha256 where p.revision=current_revision),
 stats as (select r from active a cross join lateral jsonb_array_elements(a.stats) r),
 pairs as (select r from active a cross join lateral jsonb_array_elements(a.pairs) r where a.champion_id=any(candidates) and r->>'otherId'=any(candidates)),
 games as (select r from public.draft_packs d join public.draft_dataset_parts p on p.sha256=d.sha256 cross join lateral jsonb_array_elements(d.payload->'games') r where p.revision=current_revision)
 select jsonb_build_object('revision',current_revision,'manifest',(select manifest from public.draft_datasets where revision=current_revision),'stats',coalesce((select jsonb_agg(r) from stats),'[]'::jsonb),'pairs',coalesce((select jsonb_agg(r) from pairs),'[]'::jsonb),'games',coalesce((select jsonb_agg(r) from games),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.draft_context(text[]) from public,anon;
grant execute on function public.draft_context(text[]) to authenticated,service_role;
commit;
