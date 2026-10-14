begin;
-- The service API role cannot read auth.users directly. This narrow function validates only
-- the reserved account's email; its execution remains restricted to service_role.
alter function public.draft_finish_invitation(text,text,uuid,uuid) security definer;
commit;
