import {readFile} from 'node:fs/promises';
import {sql} from './supabase-admin.mjs';
if(!process.argv.includes('--apply'))throw Error('Explicit --apply required');
for(const name of ['202610150014_coach_feedback.sql','202610150015_context_publication.sql']){
const existing=await sql('select version from public.draft_schema_versions where version=$1',[name]);
if(!existing.length){const migration=(await readFile('supabase/migrations/'+name,'utf8')).replace(/^begin;\s*|\s*commit;$/gm,'');await sql('begin;\n'+migration+"\ninsert into public.draft_schema_versions(version) values('"+name+"');\ncommit;");}}
console.log('Private coach feedback and pro context tables ready; shared statistics unchanged');
