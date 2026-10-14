-- Central statistics only. No player identities, OP.GG pools or scrim journals.
begin;
create table if not exists public.draft_packs (
  sha256 text primary key check (sha256 ~ '^[a-f0-9]{64}$'),
  pack_id text not null check (pack_id ~ '^shared-[a-z0-9.-]+$'),
  source text not null check (source in ('solo','pro')),
  patch text not null check (patch ~ '^\d{1,2}\.\d{1,2}$'),
  stats_count integer not null check (stats_count >= 0),
  pairs_count integer not null check (pairs_count >= 0),
  games_count integer not null check (games_count >= 0),
  bytes integer not null check (bytes between 1 and 67108864),
  payload jsonb not null check (payload->>'id'=pack_id and payload->'provenance'->>'demo'='false'),
  created_at timestamptz not null default now()
);
create index if not exists draft_packs_source_patch on public.draft_packs(source,patch);
create table if not exists public.draft_datasets (
  revision text primary key check (revision ~ '^[a-f0-9]{64}$'),
  manifest jsonb not null,
  published_at timestamptz not null default now()
);
create table if not exists public.draft_dataset_parts (
  revision text references public.draft_datasets(revision),
  sha256 text references public.draft_packs(sha256),
  primary key (revision,sha256)
);
create table if not exists public.draft_channels (
  name text primary key check (name='stable'),
  revision text not null references public.draft_datasets(revision)
);
alter table public.draft_packs enable row level security;
alter table public.draft_datasets enable row level security;
alter table public.draft_dataset_parts enable row level security;
alter table public.draft_channels enable row level security;

create table if not exists public.draft_organizations(id uuid primary key default gen_random_uuid(),name text not null);
create table if not exists public.draft_members(organization_id uuid references public.draft_organizations(id),user_id uuid references auth.users(id),role text not null check(role in ('owner','coach')),primary key(organization_id,user_id));
create table if not exists public.draft_invitations(organization_id uuid references public.draft_organizations(id),email text not null,role text not null check(role in ('owner','coach')),claimed_by uuid references auth.users(id),primary key(organization_id,email));
create table if not exists public.draft_matches(id bigint generated always as identity primary key,organization_id uuid not null references public.draft_organizations(id),author uuid not null references auth.users(id),document jsonb not null,created_at timestamptz not null default now());
create index if not exists draft_matches_organization on public.draft_matches(organization_id,created_at desc);
alter table public.draft_organizations enable row level security;
alter table public.draft_members enable row level security;
alter table public.draft_invitations enable row level security;
alter table public.draft_matches enable row level security;
create or replace function public.draft_access(org uuid default null,owner_only boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.draft_members m where m.user_id=auth.uid() and (org is null or m.organization_id=org) and (not owner_only or m.role='owner'));
$$;
revoke all on function public.draft_access(uuid,boolean) from public,anon;
grant execute on function public.draft_access(uuid,boolean) to authenticated,service_role;
revoke all on public.draft_packs,public.draft_datasets,public.draft_dataset_parts,public.draft_channels,public.draft_organizations,public.draft_members,public.draft_invitations,public.draft_matches from anon,authenticated;
grant select on public.draft_packs,public.draft_datasets,public.draft_dataset_parts,public.draft_channels,public.draft_organizations,public.draft_members to authenticated;
grant select,insert,delete on public.draft_invitations,public.draft_matches to authenticated;
grant all on public.draft_packs,public.draft_datasets,public.draft_dataset_parts,public.draft_channels,public.draft_organizations,public.draft_members,public.draft_invitations,public.draft_matches to service_role;
grant usage,select on sequence public.draft_matches_id_seq to service_role,authenticated;
create policy draft_organization_read on public.draft_organizations for select to authenticated using(public.draft_access(id));
create policy draft_member_read on public.draft_members for select to authenticated using(user_id=auth.uid());
create policy draft_invitation_manage on public.draft_invitations for all to authenticated using(public.draft_access(organization_id,true)) with check(public.draft_access(organization_id,true) and role='coach');
create policy draft_match_read on public.draft_matches for select to authenticated using(author=auth.uid() or public.draft_access(null,true));
create policy draft_match_insert on public.draft_matches for insert to authenticated with check(public.draft_access(organization_id) and author=auth.uid());
create policy draft_match_delete on public.draft_matches for delete to authenticated using(author=auth.uid() or public.draft_access(null,true));
create policy draft_channel_read on public.draft_channels for select to authenticated using(public.draft_access());
create policy draft_dataset_read on public.draft_datasets for select to authenticated using(public.draft_access() and exists(select 1 from public.draft_channels c where c.revision=draft_datasets.revision));
create policy draft_part_read on public.draft_dataset_parts for select to authenticated using(public.draft_access() and exists(select 1 from public.draft_channels c where c.revision=draft_dataset_parts.revision));
create policy draft_pack_read on public.draft_packs for select to authenticated using(public.draft_access() and exists(select 1 from public.draft_dataset_parts p join public.draft_channels c on c.revision=p.revision where p.sha256=draft_packs.sha256));
create or replace function public.draft_claim_invitation() returns void language plpgsql security definer set search_path='' as $$
declare verified_email text;
begin
 select lower(email) into verified_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if verified_email is null then raise exception 'Verify your email first';end if;
 insert into public.draft_members(organization_id,user_id,role) select organization_id,auth.uid(),role from public.draft_invitations where lower(email)=verified_email and (claimed_by is null or claimed_by=auth.uid()) on conflict do nothing;
 update public.draft_invitations set claimed_by=auth.uid() where lower(email)=verified_email and claimed_by is null;
end $$;
revoke all on function public.draft_claim_invitation() from public,anon;
grant execute on function public.draft_claim_invitation() to authenticated;

create or replace function public.draft_publish(new_manifest jsonb,expected_revision text default null)
returns text language plpgsql security invoker set search_path='' as $$
declare new_revision text; item jsonb; current_revision text;
begin
  perform pg_advisory_xact_lock(76413950);
  select revision into current_revision from public.draft_channels where name='stable';
  if current_revision is distinct from expected_revision then raise exception 'Another publication occurred. Refresh before publishing.'; end if;
  new_revision:=new_manifest->>'revision';
  if new_manifest->>'kind'<>'tchim-dataset' or new_manifest->>'schemaVersion'<>'2' or jsonb_array_length(new_manifest->'parts')=0 then raise exception 'Invalid dataset'; end if;
  for item in select * from jsonb_array_elements(new_manifest->'parts') loop
    if not exists(select 1 from public.draft_packs p where p.sha256=item->>'sha256' and p.pack_id=item->>'id' and p.bytes=(item->>'bytes')::integer and p.stats_count=(item->>'stats')::integer and p.pairs_count=(item->>'pairs')::integer and p.games_count=(item->>'games')::integer) then raise exception 'Missing or inconsistent dataset part'; end if;
  end loop;
  insert into public.draft_datasets(revision,manifest) values(new_revision,new_manifest) on conflict(revision) do nothing;
  insert into public.draft_dataset_parts(revision,sha256) select new_revision,p->>'sha256' from jsonb_array_elements(new_manifest->'parts') p on conflict do nothing;
  insert into public.draft_channels(name,revision) values('stable',new_revision) on conflict(name) do update set revision=excluded.revision;
  return new_revision;
end $$;
revoke all on function public.draft_publish(jsonb,text) from public,anon,authenticated;
grant execute on function public.draft_publish(jsonb,text) to service_role;
-- Private authenticated downloads; writes remain exclusively privileged. The application never embeds a secret key.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('tchim-datasets','tchim-datasets',false,67108864,array['application/gzip'])
on conflict(id) do update set public=false;
create policy draft_storage_read on storage.objects for select to authenticated using(bucket_id='tchim-datasets' and public.draft_access());
commit;
