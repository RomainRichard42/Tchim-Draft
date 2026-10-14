begin;
-- Scoped to these two endpoints; default Auth/table API timeouts are unchanged.
alter function public.draft_ingest(text,jsonb,integer) set statement_timeout='45s';
alter function public.draft_context(text[]) set statement_timeout='30s';
notify pgrst,'reload schema';
commit;
