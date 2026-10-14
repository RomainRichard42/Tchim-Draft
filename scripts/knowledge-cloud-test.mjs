import {readFile,writeFile} from 'node:fs/promises';
import {createTestUsers,cleanupTestUsers,cloudRequest} from './cloud-integration-test.mjs';
import {sql} from './supabase-admin.mjs';
const check=(v,m)=>{if(!v)throw new Error(m);},literal=v=>"'"+JSON.stringify(v).replaceAll("'","''")+"'";
try{
 const [coach,,admin,blocked]=await createTestUsers(),data=JSON.parse(await readFile('resources/champion-knowledge.json','utf8'));
 check(!(await cloudRequest('/rest/v1/draft_knowledge?select=revision')).ok,'Anonymous knowledge read accepted');
 check((await cloudRequest('/rest/v1/draft_knowledge?select=revision',undefined,coach.headers)).ok,'Approved knowledge read failed');
 check(!(await cloudRequest('/rest/v1/rpc/draft_publish_knowledge',{candidate:data,expected_revision:null},coach.headers)).ok,'Coach publication accepted');
 check(!(await cloudRequest('/rest/v1/draft_knowledge',{slot:'stable',revision:data.revision,payload:data},coach.headers)).ok,'Direct table write accepted');
 check(!(await cloudRequest('/rest/v1/rpc/draft_publish_knowledge',{candidate:{schema:1,revision:data.revision,patches:[]},expected_revision:null},admin.headers)).ok,'Empty catalog accepted');
 const before=await sql("select revision from public.draft_knowledge where slot='stable'");
 // Management queries have a smaller payload limit than the project data API. A valid
 // compact excerpt exercises the same SQL transaction without uploading a live channel.
 const sample={...data,patches:[{...data.patches[0],kits:data.patches[0].kits.slice(0,100).map(k=>({...k,abilities:k.abilities.map(a=>({...a,description:{fr:a.description.fr.slice(0,140),en:a.description.en.slice(0,140)},tooltip:{fr:a.tooltip.fr.slice(0,140),en:a.tooltip.en.slice(0,140)},parameters:{},effects:[],variables:[],unresolved:[]}))})),changes:[]}]};
 const candidate=literal(sample),expected=before[0]?"'"+before[0].revision+"'":'null';
 // Exercise the real publication transaction without exposing or committing a dataset.
 await sql("begin;select set_config('request.jwt.claim.sub','"+admin.id+"',true);select public.draft_publish_knowledge("+candidate+"::jsonb,"+expected+");rollback;");
 const after=await sql("select revision from public.draft_knowledge where slot='stable'");check(JSON.stringify(before)===JSON.stringify(after),'Rollback test changed publication');
 const report={anonymousDenied:true,approvedRead:true,coachCannotPublish:true,directWritesDenied:true,emptyDatasetDenied:true,ownerTransactionValidated:true,noPublication:true};await writeFile('artifacts/knowledge-cloud-report.json',JSON.stringify(report,null,2));console.log('KNOWLEDGE_CLOUD_OK',JSON.stringify(report));
}finally{await cleanupTestUsers();}
