begin;
alter table public.draft_invitations add column code_hash text;
alter table public.draft_invitations add column expires_at timestamptz;
alter table public.draft_invitations add column reservation uuid;
alter table public.draft_invitations add column reserved_until timestamptz;
create unique index draft_invitation_code_hash on public.draft_invitations(code_hash) where code_hash is not null;
-- Email alone never grants membership. Older clients can safely call this compatibility function.
create or replace function public.draft_claim_invitation() returns void language sql security invoker set search_path='' as $$ select; $$;
revoke all on public.draft_invitations from anon,authenticated;
drop policy draft_invitation_manage on public.draft_invitations;

create function public.draft_issue_invitation(target_email text) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid; normalized_email text:=lower(btrim(target_email)); invitation_code text; expiry timestamptz:=now()+interval '30 days';
begin
 select organization_id into org from public.draft_members where user_id=auth.uid() and role='owner' limit 1;
 if org is null then raise exception 'Administrator only';end if;
 if length(normalized_email)>254 or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email';end if;
 if exists(select 1 from public.draft_invitations where organization_id=org and email=normalized_email and (role='owner' or claimed_by is not null))
   or exists(select 1 from public.draft_members m join auth.users u on u.id=m.user_id where m.organization_id=org and lower(u.email)=normalized_email) then raise exception 'Account already reserved or registered';end if;
 invitation_code:='TD-'||encode(extensions.gen_random_bytes(16),'hex');
 insert into public.draft_invitations(organization_id,email,role,code_hash,expires_at)
 values(org,normalized_email,'coach',encode(extensions.digest(lower(invitation_code),'sha256'),'hex'),expiry)
 on conflict(organization_id,email) do update set code_hash=excluded.code_hash,expires_at=excluded.expires_at,reservation=null,reserved_until=null
 where draft_invitations.role='coach' and draft_invitations.claimed_by is null;
 if not found then raise exception 'Account already reserved';end if;
 return jsonb_build_object('code',invitation_code,'email',normalized_email,'expiresAt',expiry);
end $$;
revoke all on function public.draft_issue_invitation(text) from public,anon;
grant execute on function public.draft_issue_invitation(text) to authenticated;

-- Only the server can reserve and consume codes. The reservation closes concurrent registration races.
create function public.draft_reserve_invitation(invitation_hash text,invitation_email text,reservation_id uuid) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 update public.draft_invitations set reservation=reservation_id,reserved_until=now()+interval '5 minutes'
 where code_hash=invitation_hash and email=lower(btrim(invitation_email)) and claimed_by is null and expires_at>now()
 and (reserved_until is null or reserved_until<now());
 return found;
end $$;
create function public.draft_finish_invitation(invitation_hash text,invitation_email text,reservation_id uuid,account_id uuid) returns void language plpgsql security invoker set search_path='' as $$
declare invitation public.draft_invitations;
begin
 select * into invitation from public.draft_invitations where code_hash=invitation_hash and email=lower(btrim(invitation_email)) and claimed_by is null and expires_at>now() and reservation=reservation_id and reserved_until>now() for update;
 if not found then raise exception 'Invitation unavailable';end if;
 if not exists(select 1 from auth.users where id=account_id and lower(email)=invitation.email and email_confirmed_at is not null) then raise exception 'Account mismatch';end if;
 insert into public.draft_members(organization_id,user_id,role) values(invitation.organization_id,account_id,invitation.role) on conflict do nothing;
 update public.draft_invitations set claimed_by=account_id,reservation=null,reserved_until=null where code_hash=invitation_hash;
end $$;
create function public.draft_release_invitation(invitation_hash text,reservation_id uuid) returns void language sql security invoker set search_path='' as $$
 update public.draft_invitations set reservation=null,reserved_until=null where code_hash=invitation_hash and reservation=reservation_id and claimed_by is null;
$$;
revoke all on function public.draft_reserve_invitation(text,text,uuid),public.draft_finish_invitation(text,text,uuid,uuid),public.draft_release_invitation(text,uuid) from public,anon,authenticated;
grant execute on function public.draft_reserve_invitation(text,text,uuid),public.draft_finish_invitation(text,text,uuid,uuid),public.draft_release_invitation(text,uuid) to service_role;
commit;
