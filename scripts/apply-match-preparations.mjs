import {readFile} from 'node:fs/promises';
import {sql} from './supabase-admin.mjs';
if(!process.argv.includes('--apply'))throw new Error('Explicit --apply required');
const name='202610140013_match_preparations.sql';
const existing=await sql('select version from public.draft_schema_versions where version=$1',[name]);
if(!existing.length){
 const migration=(await readFile('supabase/migrations/'+name,'utf8')).replace(/^begin;\s*|\s*commit;$/gm,'');
 await sql('begin;\n'+migration+"\ninsert into public.draft_schema_versions(version) values('"+name+"');\ncommit;");
}
console.log('Private match preparations configured; statistical datasets unchanged');
