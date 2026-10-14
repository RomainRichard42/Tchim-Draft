import {readFile} from 'node:fs/promises';
import {sql} from './supabase-admin.mjs';
if(!process.argv.includes('--apply'))throw new Error('Explicit --apply required');
const name='202610140012_bounded_context_slices.sql',migration=(await readFile('supabase/migrations/'+name,'utf8')).replace(/^begin;\s*|\s*commit;$/gm,'');
await sql('begin;\n'+migration+"\ninsert into public.draft_schema_versions(version) values('"+name+"') on conflict do nothing;\ncommit;");
console.log('Bounded context slices configured');
