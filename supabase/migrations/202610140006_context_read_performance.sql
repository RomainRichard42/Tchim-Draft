begin;
-- Statistics are common to approved accounts. The explicit draft_access gate
-- remains inside this function; no private matches or rosters are read here.
alter function public.draft_context(text[]) security definer;
notify pgrst,'reload schema';
commit;
