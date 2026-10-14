import { readFile,readdir } from 'node:fs/promises';
import { adminConfig,setup,sql,management } from './supabase-admin.mjs';
import { configureInvitations } from './setup-invitations.mjs';
if(!(await adminConfig()).SUPABASE_SECRET_KEY)await setup();
await sql('create table if not exists public.draft_schema_versions(version text primary key,applied_at timestamptz default now()); alter table public.draft_schema_versions enable row level security; revoke all on public.draft_schema_versions from public,anon,authenticated;');
for(const name of (await readdir('supabase/migrations')).filter(n=>n.endsWith('.sql')).sort()){
 const existing=await sql('select version from public.draft_schema_versions where version=$1',[name]);if(existing.length){console.log('Migration already installed',name);continue;}
 const migration=(await readFile('supabase/migrations/'+name,'utf8')).replace(/^begin;\s*|\s*commit;$/gm,'');
 await sql('begin;\n'+migration+"\ninsert into public.draft_schema_versions(version) values('"+name.replaceAll("'","''")+"');\ncommit;");
 console.log('Migration installed',name);
}
const config=await adminConfig();
if(config.TCHIM_ADMIN_EMAIL){
 await sql("insert into public.draft_organizations(id,name) values('d308eaf0-51fa-4bda-9728-cf6a3fbac947','Tchim Draft') on conflict do nothing;");
 await sql("insert into public.draft_invitations(organization_id,email,role) values('d308eaf0-51fa-4bda-9728-cf6a3fbac947',lower($1),'owner') on conflict(organization_id,email) do update set role='owner';",[config.TCHIM_ADMIN_EMAIL]);
 console.log('Administrator access reserved for configured email');
}else console.log('Administrator email still required');
await configureInvitations();
