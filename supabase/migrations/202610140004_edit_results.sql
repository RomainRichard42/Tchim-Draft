begin;
grant update on public.draft_matches to authenticated;
create policy draft_match_update on public.draft_matches for update to authenticated using(author=auth.uid() or public.draft_access(null,true)) with check(author=auth.uid() or public.draft_access(null,true));
commit;
