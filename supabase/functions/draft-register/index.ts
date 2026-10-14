// Runs only on Supabase. No privileged key is sent to or bundled with Electron.
const url=Deno.env.get('SUPABASE_URL')!;
const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const headers={apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'};
const response=(status:number,error?:string)=>Response.json(error?{error}:{ok:true},{status,headers:{'Cache-Control':'no-store'}});
async function server(path:string,body?:unknown,method=body===undefined?'GET':'POST'){
 const res=await fetch(url+path,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
 const text=await res.text();return {ok:res.ok,status:res.status,data:text?JSON.parse(text):null};
}
Deno.serve(async request=>{
 if(request.method!=='POST')return response(405,'method');
 let hash='',reservation='',createdId='';
 try{
  const text=await request.text();if(text.length>4096)return response(400,'details');
  const body=JSON.parse(text);
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>!['email','password','code'].includes(key)))return response(400,'details');
  const {email,password,code}=body;
  if(typeof email!=='string'||email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email.trim())||typeof password!=='string'||password.length<8||password.length>72||typeof code!=='string'||!/^TD-[a-f0-9]{32}$/i.test(code.trim()))return response(400,'details');
  const normalizedEmail=email.trim().toLowerCase();
  hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code.trim().toLowerCase())))].map(b=>b.toString(16).padStart(2,'0')).join('');
  reservation=crypto.randomUUID();
  const reserved=await server('/rest/v1/rpc/draft_reserve_invitation',{invitation_hash:hash,invitation_email:normalizedEmail,reservation_id:reservation});
  if(!reserved.ok)throw new Error('unavailable');
  if(reserved.data!==true)return response(403,'invitation');
  const created=await server('/auth/v1/admin/users',{email:normalizedEmail,password,email_confirm:true});
  let accountId:string;
  if(created.ok){accountId=created.data.id;createdId=accountId;}
  else {
   // A retry after an interrupted creation requires the existing account's password.
   const signed=await server('/auth/v1/token?grant_type=password',{email:normalizedEmail,password});
   if(!signed.ok)throw new Error('account');accountId=signed.data.user.id;
  }
  const finished=await server('/rest/v1/rpc/draft_finish_invitation',{invitation_hash:hash,invitation_email:normalizedEmail,reservation_id:reservation,account_id:accountId});
  if(!finished.ok)throw new Error('unavailable');
  return response(201);
 }catch{
  // Compensate only the account this request created. Never log passwords, codes or keys.
  if(createdId)await server('/auth/v1/admin/users/'+createdId,undefined,'DELETE').catch(()=>{});
  if(hash&&reservation)await server('/rest/v1/rpc/draft_release_invitation',{invitation_hash:hash,reservation_id:reservation}).catch(()=>{});
  return response(409,'registration');
 }
});
