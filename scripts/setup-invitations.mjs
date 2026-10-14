import { randomBytes,createHash } from 'node:crypto';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { adminConfig,management,sql } from './supabase-admin.mjs';

export async function configureInvitations(){
 const config=await adminConfig(),ref=new URL(config.SUPABASE_URL).hostname.split('.')[0];
 const form=new FormData();
 form.set('metadata',JSON.stringify({name:'draft-register',entrypoint_path:'index.ts',verify_jwt:false}));
 form.append('file',new Blob([await readFile('supabase/functions/draft-register/index.ts')],{type:'application/typescript'}),'index.ts');
 const deployed=await fetch('https://api.supabase.com/v1/projects/'+ref+'/functions/deploy?slug=draft-register',{method:'POST',headers:{Authorization:'Bearer '+config.SUPABASE_ACCESS_TOKEN},body:form,signal:AbortSignal.timeout(120000)});
 if(!deployed.ok)throw new Error('Invitation function deployment failed ('+deployed.status+'): '+(await deployed.text()).replace(/sb[p_]\S+|eyJ\S+/g,'[redacted]').slice(0,600));
 const functionInfo=await deployed.json();console.log('Invitation function deployed',functionInfo.slug,functionInfo.status);
 // Public signup stays closed. Only code-checked, server-side account creation is permitted.
 await management('projects/'+ref+'/config/auth',{disable_signup:true},'PATCH');
 console.log('Unrestricted public registration disabled; password login retained');
 if(config.TCHIM_ADMIN_EMAIL){
  const [invitation]=await sql("select claimed_by,code_hash from public.draft_invitations where organization_id='d308eaf0-51fa-4bda-9728-cf6a3fbac947' and email=lower($1)",[config.TCHIM_ADMIN_EMAIL]);
  if(invitation?.claimed_by){console.log('Administrator account already active');return;}
  const destination='data/local/authorizations/admin-invite.txt';
  if(invitation?.code_hash){try{await readFile(destination);console.log('Administrator code retained in private local file');return;}catch{}}
  const code='TD-'+randomBytes(16).toString('hex'),hash=createHash('sha256').update(code.toLowerCase()).digest('hex');
  await sql("update public.draft_invitations set code_hash=$1,expires_at=now()+interval '30 days',reservation=null,reserved_until=null where organization_id='d308eaf0-51fa-4bda-9728-cf6a3fbac947' and email=lower($2) and role='owner' and claimed_by is null",[hash,config.TCHIM_ADMIN_EMAIL]);
  await mkdir('data/local/authorizations',{recursive:true});
  await writeFile(destination,'Tchim Draft - administrator invitation\nEmail: '+config.TCHIM_ADMIN_EMAIL+'\nCode: '+code+'\nSingle use, valid for 30 days. Choose your password in the application.\n');
  console.log('Administrator invitation saved in '+destination+' (excluded from Git and installer)');
 }
}
if(process.argv[1]?.endsWith('setup-invitations.mjs'))await configureInvitations();
